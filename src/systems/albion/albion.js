/**
 * Albion Online Guild Verification System
 * Core registration, verification, and purge logic
 */

import { validatePlayerGuild } from './albion-api.js';
import { 
  loadAlbionConfig, 
  getAlbionUser, 
  saveAlbionUser, 
  removeAlbionUser,
  getAllAlbionUsers,
  validateAlbionConfig,
  findAlbionUserByIGN
} from './albion-db.js';

/**
 * Apply nickname to a guild member
 * @param {Object} guild - Discord guild object
 * @param {string} memberId - Member ID
 * @param {string} nickname - Desired nickname
 * @returns {Promise<Object>} Result object
 */
async function applyNickname(guild, memberId, nickname) {
  try {
    const member = await guild.members.fetch(memberId);
    
    if (!member) {
      return { success: false, error: 'Member not found in guild.' };
    }

    // Check if bot has permission
    const botMember = guild.members.me;
    if (!botMember.permissions.has('ManageNicknames')) {
      return { success: false, error: 'Bot lacks "Manage Nicknames" permission.' };
    }

    // Check role hierarchy
    if (member.roles.highest.position >= botMember.roles.highest.position) {
      return { success: false, error: 'Cannot change nickname: user has higher or equal role.' };
    }

    // Truncate nickname if too long
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

/**
 * Format nickname using template
 * @param {string} template - Nickname format template
 * @param {Object} variables - Variables to replace
 * @returns {string} Formatted nickname
 */
function formatNickname(template, variables) {
  let result = template;
  
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{${key}}`;
    result = result.replace(new RegExp(placeholder, 'g'), value || '');
  }
  
  // Clean up extra spaces
  result = result.replace(/\s+/g, ' ').trim();
  
  return result;
}

/**
 * Register a user with guild verification
 * @param {Object} guild - Discord guild object
 * @param {string} discordId - Discord user ID
 * @param {string} region - Albion region
 * @param {string} ign - In-game name
 * @returns {Promise<Object>} Registration result
 */
export async function registerUser(guild, discordId, region, ign) {
  const guildId = guild.id;
  const config = loadAlbionConfig(guildId);
  
  // Check if user is already registered
  const existingRegistration = getAlbionUser(guildId, discordId);
  if (existingRegistration) {
    return {
      success: false,
      error: 'ALREADY_REGISTERED',
      message: `You are already registered as **${existingRegistration.ign}** in the ${existingRegistration.region} region.\n\nUse \`/unregister\` first if you want to register a different character.`
    };
  }

  // Check if IGN is already registered by another user
  const existingIGN = findAlbionUserByIGN(guildId, ign);
  if (existingIGN) {
    return {
      success: false,
      error: 'IGN_ALREADY_REGISTERED',
      message: `The in-game name **${ign}** is already registered by another Discord user.\n\nIf this is your character, ask an admin to use \`/forceunregister ${ign}\` to remove the old registration first.`
    };
  }
  
  // Validate configuration
  const configValidation = validateAlbionConfig(config);
  if (!configValidation.valid) {
    return {
      success: false,
      error: 'INCOMPLETE_CONFIG',
      message: `Server configuration incomplete. Missing: ${configValidation.missing.join(', ')}. Please contact an administrator.`
    };
  }

  // Validate player guild membership
  console.log(`🔍 Verifying player ${ign} in region ${region}...`);
  const validation = await validatePlayerGuild(region, ign, config.albionGuildName);
  
  if (!validation.success) {
    return validation;
  }

  // Save user to database
  saveAlbionUser(guildId, discordId, {
    ign: validation.data.Name,
    region: region,
    guild: validation.data.GuildName
  });

  console.log(`✅ User ${discordId} registered as ${ign}`);

  // Assign register role
  let roleAssigned = false;
  try {
    const member = await guild.members.fetch(discordId);
    if (member) {
      await member.roles.add(config.registerRoleId);
      roleAssigned = true;
      console.log(`✅ Assigned register role to ${discordId}`);
    }
  } catch (error) {
    console.error('Error assigning role:', error);
  }

  // Apply nickname
  let nicknameResult = { success: false };
  if (config.nicknameFormat) {
    const nicknameVars = {
      ign: validation.data.Name,
      tag: config.guildTag || '',
      guild: validation.data.GuildName || '',
      region: region.toUpperCase()
    };
    
    const formattedNickname = formatNickname(config.nicknameFormat, nicknameVars);
    nicknameResult = await applyNickname(guild, discordId, formattedNickname);
  }

  return {
    success: true,
    message: `Successfully registered as **${validation.data.Name}** from guild **${validation.data.GuildName}**!`,
    data: {
      ign: validation.data.Name,
      guild: validation.data.GuildName,
      roleAssigned,
      nicknameApplied: nicknameResult.success,
      nickname: nicknameResult.nickname
    }
  };
}

/**
 * Purge users who are no longer in the guild
 * @param {Object} guild - Discord guild object
 * @returns {Promise<Object>} Purge results
 */
export async function purgeUsers(guild) {
  const guildId = guild.id;
  const config = loadAlbionConfig(guildId);
  
  // Validate configuration
  const configValidation = validateAlbionConfig(config);
  if (!configValidation.valid) {
    return {
      success: false,
      error: 'INCOMPLETE_CONFIG',
      message: `Server configuration incomplete. Missing: ${configValidation.missing.join(', ')}.`
    };
  }

  // Get all members with register role
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
    
    membersToCheck = role.members.map(m => ({
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

  console.log(`🔍 Starting purge: checking ${membersToCheck.length} members...`);

  for (const { id, user, member } of membersToCheck) {
    results.checked++;
    
    // Get stored user data
    const userData = getAlbionUser(guildId, id);
    
    if (!userData) {
      console.log(`⚠️ ${user.username} has role but no registration data`);
      results.details.push({
        discordId: id,
        username: user.username,
        status: 'no_data',
        action: 'none'
      });
      continue;
    }

    try {
      // Verify current guild membership
      const validation = await validatePlayerGuild(
        userData.region, 
        userData.ign, 
        config.albionGuildName
      );

      if (validation.success) {
        results.valid++;
        results.details.push({
          discordId: id,
          username: user.username,
          ign: userData.ign,
          status: 'valid',
          action: 'none'
        });
        console.log(`✅ ${user.username} (${userData.ign}) - Valid`);
      } else {
        // User no longer in guild - remove
        results.removed++;
        
        // Remove role
        try {
          await member.roles.remove(config.registerRoleId);
          console.log(`🗑️ Removed role from ${user.username}`);
        } catch (error) {
          console.error(`Error removing role from ${user.username}:`, error);
        }

        // Optionally reset nickname
        try {
          await member.setNickname(null);
          console.log(`🔄 Reset nickname for ${user.username}`);
        } catch (error) {
          // Ignore nickname errors
        }

        // Remove from database
        removeAlbionUser(guildId, id);
        
        results.details.push({
          discordId: id,
          username: user.username,
          ign: userData.ign,
          status: 'invalid',
          reason: validation.error,
          action: 'removed'
        });
        
        console.log(`❌ ${user.username} (${userData.ign}) - ${validation.error}`);
      }
      
    } catch (error) {
      results.errors++;
      console.error(`Error checking ${user.username}:`, error);
      results.details.push({
        discordId: id,
        username: user.username,
        ign: userData.ign,
        status: 'error',
        action: 'none'
      });
    }

    // Small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`✅ Purge complete: ${results.checked} checked, ${results.removed} removed, ${results.valid} valid, ${results.errors} errors`);

  return {
    success: true,
    ...results
  };
}

/**
 * Get user registration info
 * @param {string} guildId
 * @param {string} discordId
 * @returns {Object|null} User data or null
 */
export function getUserInfo(guildId, discordId) {
  return getAlbionUser(guildId, discordId);
}

/**
 * Get all registered users
 * @param {string} guildId
 * @returns {Array} Array of user objects
 */
export function getAllUsers(guildId) {
  return getAllAlbionUsers(guildId);
}

/**
 * Unregister a user (remove registration, role, and reset nickname)
 * @param {Object} guild - Discord guild object
 * @param {string} discordId - Discord user ID
 * @returns {Promise<Object>} Unregister result
 */
export async function unregisterUser(guild, discordId) {
  const guildId = guild.id;
  const config = loadAlbionConfig(guildId);
  
  // Get user data before removing
  const userData = getAlbionUser(guildId, discordId);
  
  if (!userData) {
    return {
      success: false,
      error: 'NOT_REGISTERED',
      message: 'You are not registered in the system.'
    };
  }

  // Remove from database
  removeAlbionUser(guildId, discordId);

  // Remove role if configured
  let roleRemoved = false;
  if (config.registerRoleId) {
    try {
      const member = await guild.members.fetch(discordId);
      if (member) {
        await member.roles.remove(config.registerRoleId);
        roleRemoved = true;
        console.log(`✅ Removed register role from ${discordId}`);
      }
    } catch (error) {
      console.error('Error removing role:', error);
    }
  }

  // Reset nickname
  let nicknameReset = false;
  try {
    const member = await guild.members.fetch(discordId);
    if (member) {
      await member.setNickname(null);
      nicknameReset = true;
      console.log(`✅ Reset nickname for ${discordId}`);
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
