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
 * @returns {Promise<Object>} Player data with Name, GuildName, GuildId
 */
export async function fetchPlayerInfo(region, playerName) {
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

    // Find exact match (case-insensitive)
    const exactMatch = players.find(p => p.Name.toLowerCase() === playerName.toLowerCase());
    const playerId = exactMatch ? exactMatch.Id : players[0].Id;

    // Fetch detailed player info
    const playerUrl = `${baseUrl}/players/${playerId}`;
    const playerResponse = await axios.get(playerUrl, { timeout: 10000 });
    
    const playerData = playerResponse.data;
    
    return {
      success: true,
      data: {
        Name: playerData.Name,
        GuildName: playerData.GuildName || null,
        GuildId: playerData.GuildId || null,
        AllianceName: playerData.AllianceName || null,
        AllianceId: playerData.AllianceId || null
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
 * Validate if player is in the specified guild
 * @param {string} region - Region (americas, europe, asia)
 * @param {string} playerName - Player's in-game name
 * @param {string} expectedGuildName - Expected guild name
 * @returns {Promise<Object>} Validation result
 */
export async function validatePlayerGuild(region, playerName, expectedGuildName) {
  const result = await fetchPlayerInfo(region, playerName);
  
  if (!result.success) {
    return result;
  }

  const playerData = result.data;

  // Check if player has a guild
  if (!playerData.GuildName) {
    return {
      success: false,
      error: 'NO_GUILD',
      message: `Player "${playerName}" is not in any guild.`,
      data: playerData
    };
  }

  // Check if guild matches (case-insensitive)
  const guildMatches = playerData.GuildName.toLowerCase() === expectedGuildName.toLowerCase();
  
  if (!guildMatches) {
    return {
      success: false,
      error: 'GUILD_MISMATCH',
      message: `Player "${playerName}" is in guild "${playerData.GuildName}", not "${expectedGuildName}".`,
      data: playerData
    };
  }

  return {
    success: true,
    message: `Player "${playerName}" is verified in guild "${expectedGuildName}".`,
    data: playerData
  };
}
