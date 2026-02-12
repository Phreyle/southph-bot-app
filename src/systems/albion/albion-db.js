/**
 * Albion Database Functions
 * Per-guild storage for Albion configuration and registered users
 */

import fs from 'fs';
import path from 'path';
import { DATA_DIR } from '../../config/constants.js';

// File paths for Albion data
const getAlbionConfigFile = (guildId) => path.join(DATA_DIR, `albion-config-${guildId}.json`);
const getAlbionUsersFile = (guildId) => path.join(DATA_DIR, `albion-users-${guildId}.json`);

/**
 * Load Albion configuration for a guild
 * @param {string} guildId
 * @returns {Object} Configuration object
 */
export function loadAlbionConfig(guildId) {
  try {
    const file = getAlbionConfigFile(guildId);
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  } catch (error) {
    console.error(`Error loading Albion config for guild ${guildId}:`, error);
  }
  
  // Default configuration
  return {
    albionRegion: null,
    albionGuildName: null,
    registerRoleId: null,
    guildTag: null,
    nicknameFormat: '{tag} {ign}'
  };
}

/**
 * Save Albion configuration for a guild
 * @param {string} guildId
 * @param {Object} config - Configuration object
 */
export function saveAlbionConfig(guildId, config) {
  try {
    const file = getAlbionConfigFile(guildId);
    fs.writeFileSync(file, JSON.stringify(config, null, 2), 'utf8');
    console.log(`✅ Albion config saved for guild ${guildId}`);
  } catch (error) {
    console.error(`❌ Error saving Albion config for guild ${guildId}:`, error);
  }
}

/**
 * Load registered users for a guild
 * @param {string} guildId
 * @returns {Map} Map of discordId -> user data
 */
export function loadAlbionUsers(guildId) {
  try {
    const file = getAlbionUsersFile(guildId);
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      return new Map(Object.entries(data));
    }
  } catch (error) {
    console.error(`Error loading Albion users for guild ${guildId}:`, error);
  }
  return new Map();
}

/**
 * Save registered users for a guild
 * @param {string} guildId
 * @param {Map} users - Map of discordId -> user data
 */
export function saveAlbionUsers(guildId, users) {
  try {
    const file = getAlbionUsersFile(guildId);
    const data = Object.fromEntries(users);
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    console.log(`✅ Albion users saved for guild ${guildId}`);
  } catch (error) {
    console.error(`❌ Error saving Albion users for guild ${guildId}:`, error);
  }
}

/**
 * Get registered user by Discord ID
 * @param {string} guildId
 * @param {string} discordId
 * @returns {Object|null} User data or null
 */
export function getAlbionUser(guildId, discordId) {
  const users = loadAlbionUsers(guildId);
  return users.get(discordId) || null;
}

/**
 * Register or update a user
 * @param {string} guildId
 * @param {string} discordId
 * @param {Object} userData - { ign, region, guild, playerId }
 */
export function saveAlbionUser(guildId, discordId, userData) {
  const users = loadAlbionUsers(guildId);
  
  const now = new Date().toISOString();
  const existingUser = users.get(discordId);
  
  users.set(discordId, {
    discordId,
    ign: userData.ign,
    region: userData.region,
    guild: userData.guild,
    playerId: userData.playerId || null,
    registeredAt: existingUser?.registeredAt || now,
    lastVerified: now
  });
  
  saveAlbionUsers(guildId, users);
}

/**
 * Remove a user from the database
 * @param {string} guildId
 * @param {string} discordId
 * @returns {boolean} True if user was removed
 */
export function removeAlbionUser(guildId, discordId) {
  const users = loadAlbionUsers(guildId);
  const existed = users.has(discordId);
  
  if (existed) {
    users.delete(discordId);
    saveAlbionUsers(guildId, users);
  }
  
  return existed;
}

/**
 * Get all registered users for a guild
 * @param {string} guildId
 * @returns {Array} Array of user objects
 */
export function getAllAlbionUsers(guildId) {
  const users = loadAlbionUsers(guildId);
  return Array.from(users.values());
}

/**
 * Find user by in-game name (case-insensitive)
 * @param {string} guildId
 * @param {string} ign
 * @returns {Object|null} User data with discordId or null
 */
export function findAlbionUserByIGN(guildId, ign) {
  const users = loadAlbionUsers(guildId);
  const normalizedIgn = ign.toLowerCase();
  
  for (const [discordId, userData] of users.entries()) {
    if (userData.ign.toLowerCase() === normalizedIgn) {
      return userData;
    }
  }
  
  return null;
}

/**
 * Check if configuration is complete
 * @param {Object} config
 * @returns {Object} { valid: boolean, missing: string[] }
 */
export function validateAlbionConfig(config) {
  const missing = [];
  
  if (!config.albionRegion) missing.push('region');
  if (!config.albionGuildName) missing.push('guild name');
  if (!config.registerRoleId) missing.push('register role');
  
  return {
    valid: missing.length === 0,
    missing
  };
}
