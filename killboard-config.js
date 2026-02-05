import fs from 'fs';
import path from 'path';

/**
 * Killboard Configuration Manager
 * Handles persistent storage of tracked players, guilds, channels, and event IDs
 * Each guild has its own configuration stored separately
 */

const DATA_DIR = process.env.DATA_DIR || '/home/container/data';

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * Get the killboard config file path for a guild
 * @param {string} guildId - Discord guild ID
 * @returns {string} Full path to the config file
 */
const getKillboardFile = (guildId) => path.join(DATA_DIR, `killboard-config-${guildId}.json`);

/**
 * Default killboard configuration structure
 */
const defaultConfig = {
  channelId: null,              // Discord channel ID for posting events
  trackedPlayers: [],           // Array of player objects: { name, id }
  trackedGuilds: [],            // Array of guild objects: { name, id }
  lastEventIds: {               // Track last seen event IDs to prevent duplicates
    kills: [],                  // Array of last N kill event IDs
    deaths: []                  // Array of last N death event IDs
  },
  lastPollTimestamp: null       // Timestamp of last successful poll
};

/**
 * Load killboard configuration for a guild
 * @param {string} guildId - Discord guild ID
 * @returns {object} Killboard configuration
 */
export function loadKillboardConfig(guildId) {
  try {
    const file = getKillboardFile(guildId);
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      // Merge with defaults to ensure all fields exist
      return { ...defaultConfig, ...data };
    }
  } catch (e) {
    console.error(`Error loading killboard config for guild ${guildId}:`, e);
  }
  return { ...defaultConfig };
}

/**
 * Save killboard configuration for a guild
 * @param {string} guildId - Discord guild ID
 * @param {object} config - Configuration object
 */
export function saveKillboardConfig(guildId, config) {
  try {
    const file = getKillboardFile(guildId);
    fs.writeFileSync(file, JSON.stringify(config, null, 2), 'utf8');
  } catch (e) {
    console.error(`Error saving killboard config for guild ${guildId}:`, e);
  }
}

/**
 * Set the channel for killboard events
 * @param {string} guildId - Discord guild ID
 * @param {string} channelId - Discord channel ID
 */
export function setKillboardChannel(guildId, channelId) {
  const config = loadKillboardConfig(guildId);
  config.channelId = channelId;
  saveKillboardConfig(guildId, config);
}

/**
 * Add a player to track
 * @param {string} guildId - Discord guild ID
 * @param {string} playerName - Albion Online player name
 * @param {string} playerId - Albion Online player ID
 * @returns {boolean} True if added, false if already exists
 */
export function addTrackedPlayer(guildId, playerName, playerId) {
  const config = loadKillboardConfig(guildId);
  
  // Check if player already tracked
  const exists = config.trackedPlayers.some(p => p.id === playerId);
  if (exists) {
    return false;
  }
  
  config.trackedPlayers.push({ name: playerName, id: playerId });
  saveKillboardConfig(guildId, config);
  return true;
}

/**
 * Remove a player from tracking
 * @param {string} guildId - Discord guild ID
 * @param {string} playerIdentifier - Player name or ID
 * @returns {boolean} True if removed, false if not found
 */
export function removeTrackedPlayer(guildId, playerIdentifier) {
  const config = loadKillboardConfig(guildId);
  const initialLength = config.trackedPlayers.length;
  
  config.trackedPlayers = config.trackedPlayers.filter(
    p => p.name !== playerIdentifier && p.id !== playerIdentifier
  );
  
  if (config.trackedPlayers.length < initialLength) {
    saveKillboardConfig(guildId, config);
    return true;
  }
  return false;
}

/**
 * Add a guild to track
 * @param {string} guildId - Discord guild ID
 * @param {string} guildName - Albion Online guild name
 * @param {string} albionGuildId - Albion Online guild ID
 * @returns {boolean} True if added, false if already exists
 */
export function addTrackedGuild(guildId, guildName, albionGuildId) {
  const config = loadKillboardConfig(guildId);
  
  // Check if guild already tracked
  const exists = config.trackedGuilds.some(g => g.id === albionGuildId);
  if (exists) {
    return false;
  }
  
  config.trackedGuilds.push({ name: guildName, id: albionGuildId });
  saveKillboardConfig(guildId, config);
  return true;
}

/**
 * Remove a guild from tracking
 * @param {string} guildId - Discord guild ID
 * @param {string} guildIdentifier - Guild name or ID
 * @returns {boolean} True if removed, false if not found
 */
export function removeTrackedGuild(guildId, guildIdentifier) {
  const config = loadKillboardConfig(guildId);
  const initialLength = config.trackedGuilds.length;
  
  config.trackedGuilds = config.trackedGuilds.filter(
    g => g.name !== guildIdentifier && g.id !== guildIdentifier
  );
  
  if (config.trackedGuilds.length < initialLength) {
    saveKillboardConfig(guildId, config);
    return true;
  }
  return false;
}

/**
 * Check if an event ID has been seen before
 * @param {string} guildId - Discord guild ID
 * @param {number} eventId - Albion event ID
 * @param {string} type - 'kills' or 'deaths'
 * @returns {boolean} True if event was already seen
 */
export function hasSeenEvent(guildId, eventId, type = 'kills') {
  const config = loadKillboardConfig(guildId);
  return config.lastEventIds[type]?.includes(eventId) || false;
}

/**
 * Mark an event as seen
 * @param {string} guildId - Discord guild ID
 * @param {number} eventId - Albion event ID
 * @param {string} type - 'kills' or 'deaths'
 */
export function markEventSeen(guildId, eventId, type = 'kills') {
  const config = loadKillboardConfig(guildId);
  
  if (!config.lastEventIds[type]) {
    config.lastEventIds[type] = [];
  }
  
  // Add event ID if not already present
  if (!config.lastEventIds[type].includes(eventId)) {
    config.lastEventIds[type].push(eventId);
    
    // Keep only last 1000 event IDs to prevent memory bloat
    if (config.lastEventIds[type].length > 1000) {
      config.lastEventIds[type] = config.lastEventIds[type].slice(-1000);
    }
    
    saveKillboardConfig(guildId, config);
  }
}

/**
 * Update last poll timestamp
 * @param {string} guildId - Discord guild ID
 */
export function updateLastPollTimestamp(guildId) {
  const config = loadKillboardConfig(guildId);
  config.lastPollTimestamp = new Date().toISOString();
  saveKillboardConfig(guildId, config);
}

/**
 * Get all guilds with killboard configured
 * @returns {Array} Array of guild IDs that have killboard configured
 */
export function getAllConfiguredGuilds() {
  try {
    const files = fs.readdirSync(DATA_DIR);
    const guildIds = [];
    
    for (const file of files) {
      if (file.startsWith('killboard-config-') && file.endsWith('.json')) {
        const guildId = file.replace('killboard-config-', '').replace('.json', '');
        const config = loadKillboardConfig(guildId);
        
        // Only include guilds with a channel set and at least one tracked entity
        if (config.channelId && 
            (config.trackedPlayers.length > 0 || config.trackedGuilds.length > 0)) {
          guildIds.push(guildId);
        }
      }
    }
    
    return guildIds;
  } catch (e) {
    console.error('Error getting configured guilds:', e);
    return [];
  }
}
