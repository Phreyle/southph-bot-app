import axios from 'axios';

/**
 * Albion Online API Service
 * Provides methods to interact with the Albion Online unofficial gameinfo API
 * Includes rate limiting, error handling, and event polling
 * 
 * API Documentation: https://github.com/broderickhyman/ao-killboard
 * Base URLs:
 * - Americas: https://gameinfo.albiononline.com/api/gameinfo
 * - Europe: https://gameinfo-ams.albiononline.com/api/gameinfo
 * - Asia: https://gameinfo-sgp.albiononline.com/api/gameinfo
 */

// All available regions
const REGIONS = [
  { name: 'Americas', baseUrl: 'https://gameinfo.albiononline.com/api/gameinfo' },
  { name: 'Europe', baseUrl: 'https://gameinfo-ams.albiononline.com/api/gameinfo' },
  { name: 'Asia', baseUrl: 'https://gameinfo-sgp.albiononline.com/api/gameinfo' }
];

const API_BASE_URL = 'https://gameinfo.albiononline.com/api/gameinfo'; // Default for non-search operations

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
      timeout: 15000, // Increased to 15 seconds
      ...options
    });
    return response.data;
  } catch (error) {
    if (error.response?.status === 429) {
      console.error('Rate limit exceeded. Waiting 60 seconds...');
      await new Promise(resolve => setTimeout(resolve, 60000));
      // Retry once after rate limit
      return await axios.get(url, { timeout: 15000, ...options }).then(r => r.data);
    }
    throw error;
  }
}

/**
 * Search for a player by name across all regions or a specific region
 * @param {string} playerName - Player name to search
 * @param {string} regionFilter - Optional region to search ('americas', 'europe', 'asia')
 * @returns {Promise<object|null>} Player object with id, name, region, etc., or null if not found
 */
export async function searchPlayer(playerName, regionFilter = null) {
  try {
    // Filter regions if specified
    const regionsToSearch = regionFilter 
      ? REGIONS.filter(r => r.name.toLowerCase() === regionFilter.toLowerCase())
      : REGIONS;
    
    if (regionsToSearch.length === 0) {
      console.error(`Invalid region filter: ${regionFilter}`);
      return null;
    }
    
    // Search across filtered regions
    for (const region of regionsToSearch) {
      try {
        const url = `${region.baseUrl}/search?q=${encodeURIComponent(playerName)}`;
        const data = await rateLimitedRequest(url);
        
        // API returns { players: [], guilds: [] }
        if (data.players && data.players.length > 0) {
          // Find exact match (case-insensitive)
          const exactMatch = data.players.find(
            p => p.Name.toLowerCase() === playerName.toLowerCase()
          );
          const player = exactMatch || data.players[0];
          
          // Add region info to the player object
          player.Region = region.name;
          player.ApiBaseUrl = region.baseUrl;
          
          console.log(`Found player ${player.Name} in ${region.name} region`);
          return player;
        }
      } catch (error) {
        console.error(`Error searching ${region.name} for player ${playerName}:`, error.message);
        // Continue to next region
      }
    }
    
    console.log(`Player ${playerName} not found in any region`);
    return null;
  } catch (error) {
    console.error(`Error searching for player ${playerName}:`, error.message);
    return null;
  }
}

/**
 * Search for a guild by name across all regions or a specific region
 * @param {string} guildName - Guild name to search
 * @param {string} regionFilter - Optional region to search ('americas', 'europe', 'asia')
 * @returns {Promise<object|null>} Guild object with Id, Name, region, etc., or null if not found
 */
export async function searchGuild(guildName, regionFilter = null) {
  try {
    // Filter regions if specified
    const regionsToSearch = regionFilter 
      ? REGIONS.filter(r => r.name.toLowerCase() === regionFilter.toLowerCase())
      : REGIONS;
    
    if (regionsToSearch.length === 0) {
      console.error(`Invalid region filter: ${regionFilter}`);
      return null;
    }
    
    // Search across filtered regions
    for (const region of regionsToSearch) {
      try {
        const url = `${region.baseUrl}/search?q=${encodeURIComponent(guildName)}`;
        const data = await rateLimitedRequest(url);
        
        // API returns { players: [], guilds: [] }
        if (data.guilds && data.guilds.length > 0) {
          // Find exact match (case-insensitive)
          const exactMatch = data.guilds.find(
            g => g.Name.toLowerCase() === guildName.toLowerCase()
          );
          const guild = exactMatch || data.guilds[0];
          
          // Add region info to the guild object
          guild.Region = region.name;
          guild.ApiBaseUrl = region.baseUrl;
          
          console.log(`Found guild ${guild.Name} in ${region.name} region`);
          return guild;
        }
      } catch (error) {
        console.error(`Error searching ${region.name} for guild ${guildName}:`, error.message);
        // Continue to next region
      }
    }
    
    console.log(`Guild ${guildName} not found in any region`);
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
 * @param {string} apiBaseUrl - Optional custom API base URL for specific region
 * @returns {Promise<Array>} Array of kill event objects
 */
export async function getPlayerKills(playerId, limit = 50, apiBaseUrl = null) {
  try {
    const baseUrl = apiBaseUrl || API_BASE_URL;
    const url = `${baseUrl}/players/${playerId}/kills?limit=${limit}`;
    console.log(`[API] Fetching player kills: ${url}`);
    const data = await rateLimitedRequest(url);
    return data || [];
  } catch (error) {
    if (error.response?.status === 404) {
      console.warn(`Player ${playerId} not found or has no kills (404)`);
      return [];
    }
    console.error(`Error fetching kills for player ${playerId}:`, error.message);
    return [];
  }
}

/**
 * Get deaths for a specific player
 * @param {string} playerId - Albion Online player ID
 * @param {number} limit - Number of deaths to fetch (default: 50)
 * @param {string} apiBaseUrl - Optional custom API base URL for specific region
 * @returns {Promise<Array>} Array of death event objects
 */
export async function getPlayerDeaths(playerId, limit = 50, apiBaseUrl = null) {
  try {
    const baseUrl = apiBaseUrl || API_BASE_URL;
    const url = `${baseUrl}/players/${playerId}/deaths?limit=${limit}`;
    console.log(`[API] Fetching player deaths: ${url}`);
    const data = await rateLimitedRequest(url);
    return data || [];
  } catch (error) {
    if (error.response?.status === 404) {
      console.warn(`Player ${playerId} not found or has no deaths (404)`);
      return [];
    }
    console.error(`Error fetching deaths for player ${playerId}:`, error.message);
    return [];
  }
}

/**
 * Get kills/deaths for a specific guild
 * @param {string} guildId - Albion Online guild ID
 * @param {number} limit - Number of events to fetch (default: 50)
 * @param {string} apiBaseUrl - Optional custom API base URL for specific region
 * @returns {Promise<Array>} Array of event objects
 */
export async function getGuildEvents(guildId, limit = 50, apiBaseUrl = null) {
  try {
    const baseUrl = apiBaseUrl || API_BASE_URL;
    const url = `${baseUrl}/guilds/${guildId}/kills?limit=${limit}`;
    console.log(`[API] Fetching guild events: ${url}`);
    const data = await rateLimitedRequest(url);
    return data || [];
  } catch (error) {
    if (error.response?.status === 404) {
      console.warn(`Guild ${guildId} not found or has no accessible data (404)`);
      return [];
    }
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
 * Batch fetch evobject>} players - Array of player objects with { id, apiBaseUrl }
 * @param {number} eventsPerPlayer - Number of events to fetch per player
 * @returns {Promise<Array>} Combined array of all events
 */
export async function batchFetchPlayerEvents(players, eventsPerPlayer = 10) {
  const allEvents = [];
  
  for (const player of players) {
    try {
      const playerId = player.id || player;
      const apiBaseUrl = player.apiBaseUrl || null;
      
      // Fetch both kills and deaths
      const [kills, deaths] = await Promise.all([
        getPlayerKills(playerId, eventsPerPlayer, apiBaseUrl),
        getPlayerDeaths(playerId, eventsPerPlayer, apiBaseUrl)
      ]);
      
      allEvents.push(...kills, ...deaths);
      
      // Small delay between players to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Error fetching events for player ${player.id || player}`);
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
 * @param {Array<object>} guilds - Array of guild objects with { id, apiBaseUrl }
 * @param {number} eventsPerGuild - Number of events to fetch per guild
 * @returns {Promise<Array>} Combined array of all events
 */
export async function batchFetchGuildEvents(guilds, eventsPerGuild = 20) {
  const allEvents = [];
  
  for (const guild of guilds) {
    try {
      const guildId = guild.id || guild;
      const apiBaseUrl = guild.apiBaseUrl || null;
      
      const events = await getGuildEvents(guildId, eventsPerGuild, apiBaseUrl);
      allEvents.push(...events);
      
      // Small delay between guilds
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Error fetching events for guild ${guild.id || guild}:`, error.message);
    }
  }
  
  // Sort by EventId and remove duplicates
  const uniqueEvents = allEvents.filter((event, index, self) =>
    index === self.findIndex(e => e.EventId === event.EventId)
  );
  
  return uniqueEvents.sort((a, b) => b.EventId - a.EventId);
}
