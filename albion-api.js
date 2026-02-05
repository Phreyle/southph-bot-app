import axios from 'axios';

/**
 * Albion Online API Service
 * Provides methods to interact with the Albion Online unofficial gameinfo API
 * Includes rate limiting, error handling, and event polling
 * 
 * API Documentation: https://github.com/broderickhyman/ao-killboard
 * Base URLs:
 * - Americas: https://gameinfo.albiononline.com/api/gameinfo
 * - Europe: https://gameinfo-sgp.albiononline.com/api/gameinfo (for Asia/Oceania)
 */

const API_BASE_URL = 'https://gameinfo.albiononline.com/api/gameinfo';

// Rate limiting configuration
const RATE_LIMIT = {
  maxRequestsPerMinute: 30,  // Conservative limit to avoid API throttling
  requestQueue: [],
  lastRequestTime: 0,
  minDelay: 2000             // Minimum 2 seconds between requests
};

/**
 * Rate-limited axios request wrapper
 * Ensures we don't exceed API rate limits
 * @param {string} url - Full URL to request
 * @param {object} options - Axios options
 * @returns {Promise<object>} API response data
 */
async function rateLimitedRequest(url, options = {}) {
  const now = Date.now();
  const timeSinceLastRequest = now - RATE_LIMIT.lastRequestTime;
  
  // Enforce minimum delay between requests
  if (timeSinceLastRequest < RATE_LIMIT.minDelay) {
    const waitTime = RATE_LIMIT.minDelay - timeSinceLastRequest;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  try {
    RATE_LIMIT.lastRequestTime = Date.now();
    const response = await axios.get(url, {
      timeout: 10000,
      ...options
    });
    return response.data;
  } catch (error) {
    if (error.response?.status === 429) {
      console.error('Rate limit exceeded. Waiting 60 seconds...');
      await new Promise(resolve => setTimeout(resolve, 60000));
      // Retry once after rate limit
      return await axios.get(url, { timeout: 10000, ...options }).then(r => r.data);
    }
    throw error;
  }
}

/**
 * Search for a player by name
 * @param {string} playerName - Player name to search
 * @returns {Promise<object|null>} Player object with id, name, etc., or null if not found
 */
export async function searchPlayer(playerName) {
  try {
    const url = `${API_BASE_URL}/search?q=${encodeURIComponent(playerName)}`;
    const data = await rateLimitedRequest(url);
    
    // API returns { players: [], guilds: [] }
    if (data.players && data.players.length > 0) {
      // Return the first exact match or closest match
      const exactMatch = data.players.find(
        p => p.Name.toLowerCase() === playerName.toLowerCase()
      );
      return exactMatch || data.players[0];
    }
    return null;
  } catch (error) {
    console.error(`Error searching for player ${playerName}:`, error.message);
    return null;
  }
}

/**
 * Search for a guild by name
 * @param {string} guildName - Guild name to search
 * @returns {Promise<object|null>} Guild object with Id, Name, etc., or null if not found
 */
export async function searchGuild(guildName) {
  try {
    const url = `${API_BASE_URL}/search?q=${encodeURIComponent(guildName)}`;
    const data = await rateLimitedRequest(url);
    
    // API returns { players: [], guilds: [] }
    if (data.guilds && data.guilds.length > 0) {
      // Return the first exact match or closest match
      const exactMatch = data.guilds.find(
        g => g.Name.toLowerCase() === guildName.toLowerCase()
      );
      return exactMatch || data.guilds[0];
    }
    return null;
  } catch (error) {
    console.error(`Error searching for guild ${guildName}:`, error.message);
    return null;
  }
}

/**
 * Get recent events (kills/deaths)
 * @param {number} limit - Number of events to fetch (default: 50, max: 51)
 * @param {number} offset - Offset for pagination
 * @returns {Promise<Array>} Array of event objects
 */
export async function getRecentEvents(limit = 50, offset = 0) {
  try {
    const url = `${API_BASE_URL}/events?limit=${limit}&offset=${offset}`;
    const data = await rateLimitedRequest(url);
    return data || [];
  } catch (error) {
    console.error('Error fetching recent events:', error.message);
    return [];
  }
}

/**
 * Get kills for a specific player
 * @param {string} playerId - Albion Online player ID
 * @param {number} limit - Number of kills to fetch (default: 50)
 * @returns {Promise<Array>} Array of kill event objects
 */
export async function getPlayerKills(playerId, limit = 50) {
  try {
    const url = `${API_BASE_URL}/players/${playerId}/kills?limit=${limit}`;
    const data = await rateLimitedRequest(url);
    return data || [];
  } catch (error) {
    console.error(`Error fetching kills for player ${playerId}:`, error.message);
    return [];
  }
}

/**
 * Get deaths for a specific player
 * @param {string} playerId - Albion Online player ID
 * @param {number} limit - Number of deaths to fetch (default: 50)
 * @returns {Promise<Array>} Array of death event objects
 */
export async function getPlayerDeaths(playerId, limit = 50) {
  try {
    const url = `${API_BASE_URL}/players/${playerId}/deaths?limit=${limit}`;
    const data = await rateLimitedRequest(url);
    return data || [];
  } catch (error) {
    console.error(`Error fetching deaths for player ${playerId}:`, error.message);
    return [];
  }
}

/**
 * Get kills/deaths for a specific guild
 * @param {string} guildId - Albion Online guild ID
 * @param {number} limit - Number of events to fetch (default: 50)
 * @returns {Promise<Array>} Array of event objects
 */
export async function getGuildEvents(guildId, limit = 50) {
  try {
    const url = `${API_BASE_URL}/guilds/${guildId}/kills?limit=${limit}`;
    const data = await rateLimitedRequest(url);
    return data || [];
  } catch (error) {
    console.error(`Error fetching guild events for ${guildId}:`, error.message);
    return [];
  }
}

/**
 * Get a specific event by ID
 * @param {number} eventId - Event ID
 * @returns {Promise<object|null>} Event object or null
 */
export async function getEventById(eventId) {
  try {
    const url = `${API_BASE_URL}/events/${eventId}`;
    const data = await rateLimitedRequest(url);
    return data;
  } catch (error) {
    console.error(`Error fetching event ${eventId}:`, error.message);
    return null;
  }
}

/**
 * Format an event into a human-readable message
 * @param {object} event - Event object from Albion API
 * @returns {object} Formatted message with title, description, and metadata
 */
export function formatEvent(event) {
  try {
    const killer = event.Killer?.Name || 'Unknown';
    const victim = event.Victim?.Name || 'Unknown';
    const killerGuild = event.Killer?.GuildName || 'No Guild';
    const victimGuild = event.Victim?.GuildName || 'No Guild';
    
    // Extract location information
    // Format: "City-Name@Cluster-Type" or just cluster identifier
    const location = event.Location || 'Unknown Location';
    
    // Calculate fame/kill value
    const totalFame = event.TotalVictimKillFame || 0;
    const fameFormatted = totalFame.toLocaleString();
    
    // Get equipment info
    const victimEquipment = event.Victim?.Equipment;
    const mainHand = victimEquipment?.MainHand?.Type || 'None';
    
    // Generate killboard URL
    const killboardUrl = `https://albiononline.com/killboard/kill/${event.EventId}`;
    
    // Determine if this was a PvE or PvP kill
    const isPvE = killer.includes('_MOB_') || killer.includes('_KEEPER_');
    const killType = isPvE ? '💀 PvE Death' : '⚔️ PvP Kill';
    
    return {
      title: `${killType} - ${fameFormatted} Fame`,
      description: `**${killer}** [${killerGuild}] killed **${victim}** [${victimGuild}]`,
      location: location,
      killer: killer,
      killerGuild: killerGuild,
      victim: victim,
      victimGuild: victimGuild,
      fame: fameFormatted,
      weapon: mainHand,
      url: killboardUrl,
      eventId: event.EventId,
      timestamp: event.TimeStamp
    };
  } catch (error) {
    console.error('Error formatting event:', error);
    return {
      title: 'Kill Event',
      description: `Event ID: ${event.EventId}`,
      url: `https://albiononline.com/killboard/kill/${event.EventId}`
    };
  }
}

/**
 * Check if an event involves a specific player
 * @param {object} event - Event object from Albion API
 * @param {string} playerId - Player ID to check
 * @returns {boolean} True if player is killer or victim
 */
export function eventInvolvesPlayer(event, playerId) {
  return event.Killer?.Id === playerId || event.Victim?.Id === playerId;
}

/**
 * Check if an event involves a specific guild
 * @param {object} event - Event object from Albion API
 * @param {string} guildId - Guild ID to check
 * @returns {boolean} True if guild is involved in event
 */
export function eventInvolvesGuild(event, guildId) {
  return event.Killer?.GuildId === guildId || event.Victim?.GuildId === guildId;
}

/**
 * Get player information by ID
 * @param {string} playerId - Albion Online player ID
 * @returns {Promise<object|null>} Player information or null
 */
export async function getPlayerInfo(playerId) {
  try {
    const url = `${API_BASE_URL}/players/${playerId}`;
    const data = await rateLimitedRequest(url);
    return data;
  } catch (error) {
    console.error(`Error fetching player info for ${playerId}:`, error.message);
    return null;
  }
}

/**
 * Get guild information by ID
 * @param {string} guildId - Albion Online guild ID
 * @returns {Promise<object|null>} Guild information or null
 */
export async function getGuildInfo(guildId) {
  try {
    const url = `${API_BASE_URL}/guilds/${guildId}`;
    const data = await rateLimitedRequest(url);
    return data;
  } catch (error) {
    console.error(`Error fetching guild info for ${guildId}:`, error.message);
    return null;
  }
}

/**
 * Batch fetch events for multiple players
 * This is more efficient than individual requests when tracking many players
 * @param {Array<string>} playerIds - Array of player IDs
 * @param {number} eventsPerPlayer - Number of events to fetch per player
 * @returns {Promise<Array>} Combined array of all events
 */
export async function batchFetchPlayerEvents(playerIds, eventsPerPlayer = 10) {
  const allEvents = [];
  
  for (const playerId of playerIds) {
    try {
      // Fetch both kills and deaths
      const [kills, deaths] = await Promise.all([
        getPlayerKills(playerId, eventsPerPlayer),
        getPlayerDeaths(playerId, eventsPerPlayer)
      ]);
      
      allEvents.push(...kills, ...deaths);
      
      // Small delay between players to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Error fetching events for player ${playerId}:`, error.message);
    }
  }
  
  // Sort by EventId (newest first) and remove duplicates
  const uniqueEvents = allEvents.filter((event, index, self) =>
    index === self.findIndex(e => e.EventId === event.EventId)
  );
  
  return uniqueEvents.sort((a, b) => b.EventId - a.EventId);
}

/**
 * Batch fetch events for multiple guilds
 * @param {Array<string>} guildIds - Array of guild IDs
 * @param {number} eventsPerGuild - Number of events to fetch per guild
 * @returns {Promise<Array>} Combined array of all events
 */
export async function batchFetchGuildEvents(guildIds, eventsPerGuild = 20) {
  const allEvents = [];
  
  for (const guildId of guildIds) {
    try {
      const events = await getGuildEvents(guildId, eventsPerGuild);
      allEvents.push(...events);
      
      // Small delay between guilds
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Error fetching events for guild ${guildId}:`, error.message);
    }
  }
  
  // Sort by EventId and remove duplicates
  const uniqueEvents = allEvents.filter((event, index, self) =>
    index === self.findIndex(e => e.EventId === event.EventId)
  );
  
  return uniqueEvents.sort((a, b) => b.EventId - a.EventId);
}
