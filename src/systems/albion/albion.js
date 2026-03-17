/**
 * Albion Online registration system
 * Supports typed registrations: guild, alliance, player
 */

import { validatePlayerGuild, validatePlayerAlliance } from './albion-api.js';
import {
  loadAlbionConfig,
  getAlbionUser,
  saveAlbionUser,
  removeAlbionUser,
  getAllAlbionUsers,
  validateAlbionConfig,
  findAlbionUserByIGN,
  getAlbionRegistrationsByType
} from './albion-db.js';

const DEFAULT_ALLIANCE_ROLE_NAME = 'Alliance Member';

async function applyNickname(guild, memberId, nickname) {
  try {
    const member = await guild.members.fetch(memberId);

    if (!member) {
      return { success: false, error: 'Member not found in guild.' };
    }

    const botMember = guild.members.me;
    if (!botMember.permissions.has('ManageNicknames')) {
      return { success: false, error: 'Bot lacks "Manage Nicknames" permission.' };
    }

    if (member.roles.highest.position >= botMember.roles.highest.position) {
      return { success: false, error: 'Cannot change nickname: user has higher or equal role.' };
    }

    let finalNickname = nickname;
    if (nickname.length > 32) {
      finalNickname = nickname.substring(0, 32);
      console.log(`⚠️ Nickname truncated from ${nickname.length} to 32 characters`);
    }

    await member.setNickname(finalNickname);
    return { success: true, nickname: finalNickname };
  } catch (error) {
    console.error('Error applying nickname:', error);
    return { success: false, error: 'Failed to apply nickname.' };
  }
}

function formatNickname(template, variables) {
  let result = template;

  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{${key}}`;
    result = result.replace(new RegExp(placeholder, 'g'), value || '');
  }

  return result.replace(/\s+/g, ' ').trim();
}

async function resolveAllianceRole(guild) {
  const existingRole = guild.roles.cache.find(
    (role) => role.name.toLowerCase() === DEFAULT_ALLIANCE_ROLE_NAME.toLowerCase()
  );

  if (existingRole) {
    return { success: true, role: existingRole, created: false };
  }

  const botMember = guild.members.me;
  if (!botMember.permissions.has('ManageRoles')) {
    return {
      success: false,
      error: 'MISSING_PERMISSIONS',
      message: `Missing permission to create role "${DEFAULT_ALLIANCE_ROLE_NAME}".`
    };
  }

  try {
    const createdRole = await guild.roles.create({
      name: DEFAULT_ALLIANCE_ROLE_NAME,
      reason: 'Alliance registration system setup'
    });
    return { success: true, role: createdRole, created: true };
  } catch (error) {
    console.error('Error creating Alliance Member role:', error);
    return {
      success: false,
      error: 'ROLE_CREATE_FAILED',
      message: 'Failed to create Alliance Member role.'
    };
  }
}

async function assignRoleByType(guild, discordId, registerType, config) {
  let targetRoleId = null;
  let resolvedRole = null;

  if (registerType === 'alliance') {
    const roleResult = await resolveAllianceRole(guild);
    if (!roleResult.success) {
      return { success: false, assigned: false, message: roleResult.message };
    }

    targetRoleId = roleResult.role.id;
    resolvedRole = roleResult.role;
  } else if (registerType === 'guild' && config.registerRoleId) {
    targetRoleId = config.registerRoleId;
    resolvedRole = guild.roles.cache.get(config.registerRoleId) || null;
  }

  if (!targetRoleId) {
    return { success: true, assigned: false, roleName: null };
  }

  try {
    const member = await guild.members.fetch(discordId);
    if (!member) {
      return { success: false, assigned: false, message: 'Member not found in guild.' };
    }

    if (!member.roles.cache.has(targetRoleId)) {
      await member.roles.add(targetRoleId);
    }

    return {
      success: true,
      assigned: true,
      roleName: resolvedRole?.name || (registerType === 'alliance' ? DEFAULT_ALLIANCE_ROLE_NAME : 'Registered Member')
    };
  } catch (error) {
    console.error('Error assigning role:', error);
    return { success: false, assigned: false, message: 'Failed to assign role.' };
  }
}

function normalizeRegisterType(registerType) {
  return (registerType || 'guild').toLowerCase();
}

function buildRegistrationPayload(guild, discordId, region, registerType, validationData) {
  return {
    registerType,
    region,
    ign: validationData.Name,
    playerId: validationData.Id,
    guildId: validationData.GuildId || null,
    guild: validationData.GuildName || null,
    allianceId: validationData.AllianceId || null,
    allianceName: validationData.AllianceName || null,
    allianceTag: validationData.AllianceTag || null,
    discordId,
    guildDiscordId: guild.id,
    isActive: true
  };
}

/**
 * Register a user with typed verification.
 * Backward compatible signature:
 * registerUser(guild, discordId, region, ign, playerId, registerType)
 */
export async function registerUser(guild, discordId, region, ign, playerId = null, registerType = 'guild') {
  const guildId = guild.id;
  const normalizedType = normalizeRegisterType(registerType);
  const config = loadAlbionConfig(guildId);

  let validation;

  if (normalizedType === 'alliance') {
    validation = await validatePlayerAlliance(region, ign, playerId);
  } else {
    const configValidation = validateAlbionConfig(config);
    if (!configValidation.valid) {
      return {
        success: false,
        error: 'INCOMPLETE_CONFIG',
        message: `Server configuration incomplete. Missing: ${configValidation.missing.join(', ')}. Please contact an administrator.`
      };
    }

    validation = await validatePlayerGuild(region, ign, config.albionGuildName, playerId);
  }

  if (!validation.success) {
    return validation;
  }

  const registrationPayload = buildRegistrationPayload(guild, discordId, region, normalizedType, validation.data);

  // Upsert active registration for one user/type pair.
  saveAlbionUser(guildId, discordId, registrationPayload);

  const roleResult = await assignRoleByType(guild, discordId, normalizedType, config);

  let nicknameResult = { success: false };
  if (config.nicknameFormat) {
    const nicknameVars = {
      ign: validation.data.Name,
      tag: config.guildTag || validation.data.AllianceTag || '',
      guild: validation.data.GuildName || '',
      region: region.toUpperCase()
    };

    const formattedNickname = formatNickname(config.nicknameFormat, nicknameVars);
    nicknameResult = await applyNickname(guild, discordId, formattedNickname);
  }

  const successMessage = normalizedType === 'alliance'
    ? `Successfully registered as **${validation.data.Name}** from alliance **${validation.data.AllianceName}**!`
    : `Successfully registered as **${validation.data.Name}** from guild **${validation.data.GuildName}**!`;

  return {
    success: true,
    message: successMessage,
    data: {
      ign: validation.data.Name,
      guild: validation.data.GuildName,
      alliance: validation.data.AllianceName,
      allianceTag: validation.data.AllianceTag,
      registerType: normalizedType,
      roleAssigned: roleResult.assigned,
      roleName: roleResult.roleName || null,
      nicknameApplied: nicknameResult.success,
      nickname: nicknameResult.nickname
    }
  };
}

/**
 * Purge users by registration type.
 * For alliance registrations this purges all active alliance registrations.
 */
export async function purgeUsers(guild, registerType = 'guild') {
  const guildId = guild.id;
  const normalizedType = normalizeRegisterType(registerType);
  const config = loadAlbionConfig(guildId);

  if (normalizedType === 'alliance') {
    const registrations = getAlbionRegistrationsByType(guildId, 'alliance');
    const roleResult = await resolveAllianceRole(guild);
    const allianceRoleId = roleResult.success ? roleResult.role.id : null;

    const summary = {
      success: true,
      checked: registrations.length,
      removed: 0,
      valid: 0,
      errors: 0,
      details: []
    };

    for (const registration of registrations) {
      try {
        const member = await guild.members.fetch(registration.discord_user_id).catch(() => null);

        if (member && allianceRoleId && member.roles.cache.has(allianceRoleId)) {
          await member.roles.remove(allianceRoleId).catch(() => null);
        }

        removeAlbionUser(guildId, registration.discord_user_id, 'alliance');
        summary.removed++;
        summary.details.push({
          discordId: registration.discord_user_id,
          ign: registration.player_name,
          action: 'removed'
        });
      } catch (error) {
        summary.errors++;
        summary.details.push({
          discordId: registration.discord_user_id,
          ign: registration.player_name,
          action: 'error'
        });
      }
    }

    return summary;
  }

  const configValidation = validateAlbionConfig(config);
  if (!configValidation.valid) {
    return {
      success: false,
      error: 'INCOMPLETE_CONFIG',
      message: `Server configuration incomplete. Missing: ${configValidation.missing.join(', ')}.`
    };
  }

  let membersToCheck = [];
  try {
    await guild.members.fetch();
    const role = guild.roles.cache.get(config.registerRoleId);

    if (!role) {
      return {
        success: false,
        error: 'ROLE_NOT_FOUND',
        message: 'Register role not found in server.'
      };
    }

    membersToCheck = role.members.map((m) => ({
      id: m.id,
      user: m.user,
      member: m
    }));
  } catch (error) {
    console.error('Error fetching members:', error);
    return {
      success: false,
      error: 'FETCH_ERROR',
      message: 'Failed to fetch server members.'
    };
  }

  const results = {
    checked: 0,
    removed: 0,
    valid: 0,
    errors: 0,
    details: []
  };

  for (const { id, user, member } of membersToCheck) {
    results.checked++;
    const userData = getAlbionUser(guildId, id, 'guild');

    if (!userData) {
      results.details.push({
        discordId: id,
        username: user.username,
        status: 'no_data',
        action: 'none'
      });
      continue;
    }

    try {
      const validation = await validatePlayerGuild(
        userData.region,
        userData.ign,
        config.albionGuildName,
        userData.playerId
      );

      if (validation.success) {
        results.valid++;
      } else {
        results.removed++;
        await member.roles.remove(config.registerRoleId).catch(() => null);
        await member.setNickname(null).catch(() => null);
        removeAlbionUser(guildId, id, 'guild');
      }
    } catch (error) {
      results.errors++;
      console.error(`Error checking ${user.username}:`, error);
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return {
    success: true,
    ...results
  };
}

export function getUserInfo(guildId, discordId, registerType = 'guild') {
  return getAlbionUser(guildId, discordId, registerType);
}

export function getAllUsers(guildId, registerType = null) {
  return getAllAlbionUsers(guildId, registerType, true);
}

export async function unregisterUser(guild, discordId, registerType = 'guild') {
  const guildId = guild.id;
  const normalizedType = normalizeRegisterType(registerType);
  const config = loadAlbionConfig(guildId);

  const userData = getAlbionUser(guildId, discordId, normalizedType);
  if (!userData) {
    return {
      success: false,
      error: 'NOT_REGISTERED',
      message: 'You are not registered in the system.'
    };
  }

  removeAlbionUser(guildId, discordId, normalizedType);

  let roleRemoved = false;
  try {
    const member = await guild.members.fetch(discordId);
    if (member) {
      if (normalizedType === 'alliance') {
        const roleResult = await resolveAllianceRole(guild);
        if (roleResult.success && member.roles.cache.has(roleResult.role.id)) {
          await member.roles.remove(roleResult.role.id);
          roleRemoved = true;
        }
      } else if (config.registerRoleId && member.roles.cache.has(config.registerRoleId)) {
        await member.roles.remove(config.registerRoleId);
        roleRemoved = true;
      }
    }
  } catch (error) {
    console.error('Error removing role:', error);
  }

  let nicknameReset = false;
  try {
    const member = await guild.members.fetch(discordId);
    if (member) {
      await member.setNickname(null);
      nicknameReset = true;
    }
  } catch (error) {
    console.error('Error resetting nickname:', error);
  }

  return {
    success: true,
    message: `Successfully unregistered ${userData.ign}.`,
    data: {
      ign: userData.ign,
      roleRemoved,
      nicknameReset
    }
  };
}

export { findAlbionUserByIGN };