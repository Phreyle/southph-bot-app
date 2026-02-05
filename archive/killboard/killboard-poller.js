import { EmbedBuilder } from 'discord.js';
import {
  loadKillboardConfig,
  hasSeenEvent,
  markEventSeen,
  updateLastPollTimestamp,
  getAllConfiguredGuilds
} from './killboard-config.js';
import {
  batchFetchPlayerEvents,
  batchFetchGuildEvents,
  formatEvent,
  eventInvolvesPlayer,
  eventInvolvesGuild
} from './albion-api.js';

/**
 * Killboard Poller Service
 * Continuously polls Albion Online API for new events and posts them to Discord
 * Runs in the background at configured intervals
 */

// Polling configuration
const POLL_INTERVAL = 30000; // 30 seconds between polls (configurable)
const EVENTS_PER_PLAYER = 10; // Number of recent events to fetch per player
const EVENTS_PER_GUILD = 20;  // Number of recent events to fetch per guild

let pollerInterval = null;
let discordClient = null;
let isPolling = false;

/**
 * Initialize the killboard poller
 * @param {Client} client - Discord.js client instance
 * @param {number} intervalMs - Polling interval in milliseconds (default: 30000)
 */
export function initializePoller(client, intervalMs = POLL_INTERVAL) {
  if (pollerInterval) {
    console.log('Killboard poller already running. Stopping previous instance...');
    stopPoller();
  }
  
  discordClient = client;
  
  console.log(`Starting killboard poller with ${intervalMs}ms interval...`);
  
  // Run initial poll after a short delay
  setTimeout(() => pollAllGuilds(), 5000);
  
  // Set up recurring poll
  pollerInterval = setInterval(() => {
    pollAllGuilds();
  }, intervalMs);
  
  console.log('Killboard poller initialized successfully');
}

/**
 * Stop the killboard poller
 */
export function stopPoller() {
  if (pollerInterval) {
    clearInterval(pollerInterval);
    pollerInterval = null;
    console.log('Killboard poller stopped');
  }
}

/**
 * Poll all configured guilds for new events
 */
async function pollAllGuilds() {
  // Prevent concurrent polls
  if (isPolling) {
    console.log('Previous poll still in progress, skipping...');
    return;
  }
  
  isPolling = true;
  
  try {
    const guildIds = getAllConfiguredGuilds();
    
    if (guildIds.length === 0) {
      console.log('No guilds configured for killboard tracking');
      isPolling = false;
      return;
    }
    
    console.log(`Polling killboard for ${guildIds.length} guild(s)...`);
    
    // Process each Discord guild sequentially to avoid rate limits
    for (const guildId of guildIds) {
      try {
        await pollGuild(guildId);
      } catch (error) {
        console.error(`Error polling guild ${guildId}:`, error);
      }
      
      // Small delay between guilds
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('Killboard poll completed');
  } catch (error) {
    console.error('Error in pollAllGuilds:', error);
  } finally {
    isPolling = false;
  }
}

/**
 * Poll a specific Discord guild for new events
 * @param {string} guildId - Discord guild ID
 */
async function pollGuild(guildId) {
  try {
    const config = loadKillboardConfig(guildId);
    
    // Validate configuration
    if (!config.channelId) {
      console.log(`Guild ${guildId} has no channel configured`);
      return;
    }
    
    if (config.trackedPlayers.length === 0 && config.trackedGuilds.length === 0) {
      console.log(`Guild ${guildId} has no tracked players or guilds`);
      return;
    }
    
    // Get the Discord channel
    const channel = await discordClient.channels.fetch(config.channelId).catch(() => null);
    if (!channel) {
      console.error(`Failed to fetch channel ${config.channelId} for guild ${guildId}`);
      return;
    }
    
    // Fetch events for tracked players
    let playerEvents = [];
    if (config.trackedPlayers.length > 0) {
      console.log(`Fetching events for ${config.trackedPlayers.length} tracked player(s) in guild ${guildId}`);
      config.trackedPlayers.forEach(p => {
        console.log(`  - Player: ${p.name} (ID: ${p.id}, Region: ${p.region || 'Unknown'})`);
      });
      playerEvents = await batchFetchPlayerEvents(config.trackedPlayers, EVENTS_PER_PLAYER);
    }
    
    // Fetch events for tracked guilds
    let guildEvents = [];
    if (config.trackedGuilds.length > 0) {
      console.log(`Fetching events for ${config.trackedGuilds.length} tracked guild(s) in guild ${guildId}`);
      config.trackedGuilds.forEach(g => {
        console.log(`  - Guild: ${g.name} (ID: ${g.id}, Region: ${g.region || 'Unknown'})`);
      });
      guildEvents = await batchFetchGuildEvents(config.trackedGuilds, EVENTS_PER_GUILD);
    }
    
    // Combine and deduplicate events
    const allEvents = [...playerEvents, ...guildEvents];
    const uniqueEvents = allEvents.filter((event, index, self) =>
      index === self.findIndex(e => e.EventId === event.EventId)
    );
    
    // Sort by EventId (newest first)
    uniqueEvents.sort((a, b) => b.EventId - a.EventId);
    
    console.log(`Found ${uniqueEvents.length} total event(s) for guild ${guildId}`);
    
    // Filter out events we've already seen and post new ones
    const newEvents = uniqueEvents.filter(event => {
      if (hasSeenEvent(guildId, event.EventId, 'kills')) {
        return false;
      }
      
      // Check if event involves any tracked entity
      const involvesTrackedPlayer = config.trackedPlayers.some(
        p => eventInvolvesPlayer(event, p.id)
      );
      const involvesTrackedGuild = config.trackedGuilds.some(
        g => eventInvolvesGuild(event, g.id)
      );
      
      return involvesTrackedPlayer || involvesTrackedGuild;
    });
    
    console.log(`${newEvents.length} new event(s) to post for guild ${guildId}`);
    
    // Post new events (oldest first, so they appear in chronological order)
    for (const event of newEvents.reverse()) {
      try {
        await postEventToChannel(channel, event);
        markEventSeen(guildId, event.EventId, 'kills');
        
        // Delay between posts to avoid Discord rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Error posting event ${event.EventId}:`, error);
      }
    }
    
    // Update last poll timestamp
    updateLastPollTimestamp(guildId);
    
  } catch (error) {
    console.error(`Error polling guild ${guildId}:`, error);
  }
}

/**
 * Post an event to a Discord channel
 * @param {TextChannel} channel - Discord channel to post to
 * @param {object} event - Event object from Albion API
 */
async function postEventToChannel(channel, event) {
  try {
    const formatted = formatEvent(event);
    
    // Determine embed color based on event type
    const isPvE = formatted.title.includes('PvE');
    const embedColor = isPvE ? 0x95a5a6 : 0xe74c3c; // Gray for PvE, Red for PvP
    
    // Create rich embed
    const embed = new EmbedBuilder()
      .setTitle(formatted.title)
      .setDescription(formatted.description)
      .setColor(embedColor)
      .addFields(
        { name: '📍 Location', value: formatted.location, inline: true },
        { name: '⚔️ Weapon', value: formatted.weapon, inline: true },
        { name: '💰 Fame', value: formatted.fame, inline: true }
      )
      .setURL(formatted.url)
      .setTimestamp(new Date(formatted.timestamp))
      .setFooter({ text: `Event ID: ${formatted.eventId}` });
    
    await channel.send({ embeds: [embed] });
    console.log(`Posted event ${event.EventId} to channel ${channel.id}`);
  } catch (error) {
    console.error('Error posting event to channel:', error);
    // Fallback to simple message if embed fails
    const formatted = formatEvent(event);
    await channel.send(`${formatted.description}\n${formatted.url}`);
  }
}

/**
 * Manually trigger a poll for a specific guild (for testing)
 * @param {string} guildId - Discord guild ID
 * @returns {Promise<void>}
 */
export async function manualPollGuild(guildId) {
  if (!discordClient) {
    throw new Error('Poller not initialized. Call initializePoller() first.');
  }
  
  console.log(`Manual poll triggered for guild ${guildId}`);
  await pollGuild(guildId);
}

/**
 * Get poller status
 * @returns {object} Status information
 */
export function getPollerStatus() {
  return {
    isRunning: pollerInterval !== null,
    isPolling: isPolling,
    interval: POLL_INTERVAL,
    configuredGuilds: getAllConfiguredGuilds().length
  };
}

/**
 * Update polling interval (will restart poller if running)
 * @param {number} intervalMs - New interval in milliseconds
 */
export function updatePollingInterval(intervalMs) {
  if (pollerInterval && discordClient) {
    stopPoller();
    initializePoller(discordClient, intervalMs);
    console.log(`Polling interval updated to ${intervalMs}ms`);
  }
}
