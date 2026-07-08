/**
 * Albion Online API Wrapper
 * Provides clean interface for interacting with Albion Online Game Info API
 */

import axios from 'axios';

// Albion API base URLs by region
export const ALBION_API_REGIONS = {
  americas: 'https://gameinfo.albiononline.com/api/gameinfo',
  europe: 'https://gameinfo-ams.albiononline.com/api/gameinfo',
  asia: 'https://gameinfo-sgp.albiononline.com/api/gameinfo'
};

/**
 * Get the API base URL for a region
 * @param {string} region - Region name (americas, europe, asia)
 * @returns {string|null} Base URL or null if invalid region
 */
export function getRegionApiUrl(region) {
  const normalizedRegion = region.toLowerCase().trim();
  return ALBION_API_REGIONS[normalizedRegion] || null;
}

/**
 * Fetch player information from Albion API
 * @param {string} region - Region (americas, europe, asia)
 * @param {string} playerName - Player's in-game name
 * @param {Object} options - Additional options { returnMultiple: boolean }
 * @returns {Promise<Object>} Player data with Name, GuildName, GuildId
 */
export async function fetchPlayerInfo(region, playerName, options = {}) {
  const baseUrl = getRegionApiUrl(region);
  
  if (!baseUrl) {
    throw new Error(`Invalid region: ${region}. Valid regions: americas, europe, asia`);
  }

  try {
    // Search for player first
    const searchUrl = `${baseUrl}/search?q=${encodeURIComponent(playerName)}`;
    const searchResponse = await axios.get(searchUrl, { timeout: 10000 });
    
    const players = searchResponse.data.players || [];
    
    if (players.length === 0) {
      return {
        success: false,
        error: 'PLAYER_NOT_FOUND',
        message: `Player "${playerName}" not found in ${region} region.`
      };
    }

    // Find all exact matches (case-insensitive) - limit to 5 to prevent overwhelming
    const exactMatches = players.filter(p => p.Name.toLowerCase() === playerName.toLowerCase()).slice(0, 5);
    
    // If returnMultiple is true and we have multiple exact matches, return all of them
    if (options.returnMultiple && exactMatches.length > 1) {
      // Fetch detailed info for each matching player
      const detailedPlayers = await Promise.all(
        exactMatches.map(async (player) => {
          try {
            const playerUrl = `${baseUrl}/players/${player.Id}`;
            const playerResponse = await axios.get(playerUrl, { timeout: 10000 });
            const playerData = playerResponse.data;
            return {
              Id: player.Id,
              Name: playerData.Name,
              GuildName: playerData.GuildName || null,
              GuildId: playerData.GuildId || null,
              AllianceName: playerData.AllianceName || null,
              AllianceId: playerData.AllianceId || null,
              AllianceTag: playerData.AllianceTag || null
            };
          } catch (error) {
            console.error(`Error fetching player ${player.Id}:`, error);
            return null;
          }
        })
      );

      // Filter out any failed fetches
      const validPlayers = detailedPlayers.filter(p => p !== null);

      return {
        success: true,
        multipleMatches: true,
        count: validPlayers.length,
        players: validPlayers
      };
    }

    // Default behavior: return the first exact match or first result
    const playerId = exactMatches.length > 0 ? exactMatches[0].Id : players[0].Id;

    // Fetch detailed player info
    const playerUrl = `${baseUrl}/players/${playerId}`;
    const playerResponse = await axios.get(playerUrl, { timeout: 10000 });
    
    const playerData = playerResponse.data;
    
    return {
      success: true,
      data: {
        Id: playerId,
        Name: playerData.Name,
        GuildName: playerData.GuildName || null,
        GuildId: playerData.GuildId || null,
        AllianceName: playerData.AllianceName || null,
        AllianceId: playerData.AllianceId || null,
        AllianceTag: playerData.AllianceTag || null
      }
    };
    
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return {
        success: false,
        error: 'PLAYER_NOT_FOUND',
        message: `Player "${playerName}" not found in ${region} region.`
      };
    }
    
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return {
        success: false,
        error: 'API_TIMEOUT',
        message: 'Albion API request timed out. Please try again.'
      };
    }

    console.error('Albion API Error:', error);
    return {
      success: false,
      error: 'API_ERROR',
      message: 'Failed to fetch player information from Albion API.'
    };
  }
}

/**
 * Fetch player information by Player ID from Albion API
 * @param {string} region - Region (americas, europe, asia)
 * @param {string} playerId - Player's unique ID
 * @returns {Promise<Object>} Player data with Name, GuildName, GuildId
 */
export async function fetchPlayerInfoById(region, playerId) {
  const baseUrl = getRegionApiUrl(region);
  
  if (!baseUrl) {
    throw new Error(`Invalid region: ${region}. Valid regions: americas, europe, asia`);
  }

  try {
    // Fetch player info directly by ID
    const playerUrl = `${baseUrl}/players/${playerId}`;
    const playerResponse = await axios.get(playerUrl, { timeout: 10000 });
    
    const playerData = playerResponse.data;
    
    return {
      success: true,
      data: {
        Id: playerId,
        Name: playerData.Name,
        GuildName: playerData.GuildName || null,
        GuildId: playerData.GuildId || null,
        AllianceName: playerData.AllianceName || null,
        AllianceId: playerData.AllianceId || null,
        AllianceTag: playerData.AllianceTag || null
      }
    };
    
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return {
        success: false,
        error: 'PLAYER_NOT_FOUND',
        message: `Player with ID "${playerId}" not found in ${region} region.`
      };
    }
    
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return {
        success: false,
        error: 'API_TIMEOUT',
        message: 'Albion API request timed out. Please try again.'
      };
    }

    console.error('Albion API Error:', error);
    return {
      success: false,
      error: 'API_ERROR',
      message: 'Failed to fetch player information from Albion API.'
    };
  }
}

/**
 * Validate if player is in the specified guild
 * @param {string} region - Region (americas, europe, asia)
 * @param {string} playerName - Player's in-game name
 * @param {string} expectedGuildName - Expected guild name
 * @param {string} playerId - Optional Player ID for exact match
 * @returns {Promise<Object>} Validation result
 */
export async function validatePlayerGuild(region, playerName, expectedGuildName, playerId = null) {
  let result;
  
  // If playerId is provided, use it directly
  if (playerId) {
    result = await fetchPlayerInfoById(region, playerId);
  } else {
    // First, check if there are multiple players with same name
    const multiCheckResult = await fetchPlayerInfo(region, playerName, { returnMultiple: true });
    
    // If multiple matches found, return them for user selection
    if (multiCheckResult.success && multiCheckResult.multipleMatches && multiCheckResult.count > 1) {
      return {
        success: false,
        error: 'MULTIPLE_MATCHES',
        message: `Found ${multiCheckResult.count} players with the name "${playerName}". Please specify which one:`,
        players: multiCheckResult.players
      };
    }
    
    // Otherwise fetch normally
    result = await fetchPlayerInfo(region, playerName);
  }
  
  if (!result.success) {
    return result;
  }

  const playerData = result.data;

  // Check if player has a guild
  if (!playerData.GuildName) {
    return {
      success: false,
      error: 'NO_GUILD',
      message: `Player "${playerData.Name}" is not in any guild.`,
      data: playerData
    };
  }

  // Check if guild matches (case-insensitive)
  const guildMatches = playerData.GuildName.toLowerCase() === expectedGuildName.toLowerCase();
  
  if (!guildMatches) {
    return {
      success: false,
      error: 'GUILD_MISMATCH',
      message: `Player "${playerData.Name}" is in guild "${playerData.GuildName}", not "${expectedGuildName}".`,
      data: playerData
    };
  }

  return {
    success: true,
    message: `Player "${playerData.Name}" is verified in guild "${expectedGuildName}".`,
    data: playerData
  };
}

/**
 * Validate if player is in an alliance
 * @param {string} region - Region (americas, europe, asia)
 * @param {string} playerName - Player's in-game name
 * @param {string} playerId - Optional Player ID for exact match
 * @returns {Promise<Object>} Validation result
 */
export async function validatePlayerAlliance(region, playerName, playerId = null) {
  let result;

  if (playerId) {
    result = await fetchPlayerInfoById(region, playerId);
  } else {
    const multiCheckResult = await fetchPlayerInfo(region, playerName, { returnMultiple: true });

    if (multiCheckResult.success && multiCheckResult.multipleMatches && multiCheckResult.count > 1) {
      return {
        success: false,
        error: 'MULTIPLE_MATCHES',
        message: `Found ${multiCheckResult.count} players with the name "${playerName}". Please specify which one:`,
        players: multiCheckResult.players
      };
    }

    result = await fetchPlayerInfo(region, playerName);
  }

  if (!result.success) {
    return result;
  }

  const playerData = result.data;

  if (!playerData.AllianceId) {
    return {
      success: false,
      error: 'NO_ALLIANCE',
      message: `Player "${playerData.Name}" is not in any alliance.`,
      data: playerData
    };
  }

  return {
    success: true,
    message: `Player "${playerData.Name}" is verified in alliance "${playerData.AllianceName}".`,
    data: playerData
  };
}
