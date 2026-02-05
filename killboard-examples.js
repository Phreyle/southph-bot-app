/**
 * KILLBOARD USAGE EXAMPLES
 * 
 * Quick reference for using the Albion Online Killboard feature
 */

// =============================================================================
// DISCORD SLASH COMMANDS (User-facing)
// =============================================================================

// 1. SET UP KILLBOARD CHANNEL
// Command: /killboard set-channel #albion-kills
// Result: Bot will post kill/death events to #albion-kills

// 2. TRACK A PLAYER
// Command: /killboard track player JohnDoe
// Result: Bot searches Albion API for "JohnDoe" and adds to tracking list

// 3. TRACK A GUILD
// Command: /killboard track guild MyAwesomeGuild
// Result: Bot searches Albion API for guild and tracks all their events

// 4. UNTRACK A PLAYER
// Command: /killboard untrack player JohnDoe
// Result: Stops tracking JohnDoe's kills/deaths

// 5. UNTRACK A GUILD
// Command: /killboard untrack guild MyAwesomeGuild
// Result: Stops tracking guild events

// 6. LIST TRACKED ENTITIES
// Command: /killboard list
// Result: Shows all tracked players and guilds for your server

// 7. CHECK POLLER STATUS
// Command: /killboard status
// Result: Shows if poller is running, interval, and statistics


// =============================================================================
// PROGRAMMATIC USAGE (Code examples)
// =============================================================================

// --- Configuration Management ---
import {
  loadKillboardConfig,
  setKillboardChannel,
  addTrackedPlayer,
  removeTrackedPlayer,
  addTrackedGuild,
  removeTrackedGuild,
  hasSeenEvent,
  markEventSeen
} from './killboard-config.js';

// Get current config for a guild
const config = loadKillboardConfig('123456789012345678');
console.log(config.channelId); // Discord channel ID
console.log(config.trackedPlayers); // Array of { name, id }

// Set channel
setKillboardChannel('123456789012345678', '987654321098765432');

// Add player (returns true if added, false if already exists)
const added = addTrackedPlayer('123456789012345678', 'JohnDoe', 'abc123xyz');

// Remove player (returns true if removed, false if not found)
const removed = removeTrackedPlayer('123456789012345678', 'JohnDoe');

// Check if event was already seen (prevents duplicates)
const seen = hasSeenEvent('123456789012345678', 123456789, 'kills');

// Mark event as seen
markEventSeen('123456789012345678', 123456789, 'kills');


// --- Albion API Interaction ---
import {
  searchPlayer,
  searchGuild,
  getPlayerKills,
  getPlayerDeaths,
  getGuildEvents,
  formatEvent,
  eventInvolvesPlayer,
  eventInvolvesGuild,
  batchFetchPlayerEvents,
  batchFetchGuildEvents
} from './albion-api.js';

// Search for a player
const player = await searchPlayer('JohnDoe');
console.log(player);
// Output: { Id: 'abc123', Name: 'JohnDoe', GuildName: 'MyGuild', ... }

// Search for a guild
const guild = await searchGuild('MyAwesomeGuild');
console.log(guild);
// Output: { Id: 'def456', Name: 'MyAwesomeGuild', MemberCount: 50, ... }

// Get player's recent kills
const kills = await getPlayerKills('abc123', 10);
console.log(kills.length); // Up to 10 kills

// Get player's recent deaths
const deaths = await getPlayerDeaths('abc123', 10);
console.log(deaths.length); // Up to 10 deaths

// Get guild events
const guildEvents = await getGuildEvents('def456', 20);
console.log(guildEvents.length); // Up to 20 events

// Format an event for display
const event = kills[0];
const formatted = formatEvent(event);
console.log(formatted);
// Output: {
//   title: '⚔️ PvP Kill - 150,000 Fame',
//   description: 'JohnDoe [MyGuild] killed JaneSmith [TheirGuild]',
//   location: 'BlackZone@Cluster-123',
//   fame: '150,000',
//   url: 'https://albiononline.com/killboard/kill/123456789',
//   ...
// }

// Check if event involves a specific player
const involvesPlayer = eventInvolvesPlayer(event, 'abc123');
console.log(involvesPlayer); // true or false

// Check if event involves a guild
const involvesGuild = eventInvolvesGuild(event, 'def456');
console.log(involvesGuild); // true or false

// Batch fetch events for multiple players (efficient)
const playerIds = ['abc123', 'def456', 'ghi789'];
const allPlayerEvents = await batchFetchPlayerEvents(playerIds, 10);
console.log(allPlayerEvents.length); // Combined events from all players

// Batch fetch events for multiple guilds
const guildIds = ['guild1', 'guild2'];
const allGuildEvents = await batchFetchGuildEvents(guildIds, 20);
console.log(allGuildEvents.length); // Combined events from all guilds


// --- Poller Control ---
import {
  initializePoller,
  stopPoller,
  getPollerStatus,
  updatePollingInterval,
  manualPollGuild
} from './killboard-poller.js';

// Initialize poller (called once in app.js when bot is ready)
// client is the Discord.js Client instance
initializePoller(client, 30000); // 30 second interval

// Stop the poller
stopPoller();

// Get current status
const status = getPollerStatus();
console.log(status);
// Output: {
//   isRunning: true,
//   isPolling: false,
//   interval: 30000,
//   configuredGuilds: 3
// }

// Update polling interval (will restart poller)
updatePollingInterval(60000); // Change to 60 seconds

// Manually trigger a poll for testing
await manualPollGuild('123456789012345678');


// =============================================================================
// ADVANCED CUSTOMIZATION
// =============================================================================

// --- Custom Event Filtering ---
// Add fame threshold filter in killboard-poller.js

// In pollGuild() function, after fetching events:
const filteredEvents = newEvents.filter(event => {
  const totalFame = event.TotalVictimKillFame || 0;
  return totalFame >= 50000; // Only post events with 50k+ fame
});


// --- Custom Embed Appearance ---
// Edit albion-api.js, formatEvent() function

export function formatEvent(event) {
  // ... existing code ...
  
  return {
    title: `🔥 ${killType} - ${fameFormatted} Fame 🔥`, // Add emoji
    description: `**${killer}** destroyed **${victim}**`, // Custom text
    // ... rest of fields
  };
}


// --- Zone Filtering ---
// Only track kills in specific zones

// In pollGuild() function:
const blackZoneEvents = newEvents.filter(event => {
  const location = event.Location || '';
  return location.includes('BlackZone');
});


// --- Webhook Integration (Alternative to Bot Messages) ---
// Instead of posting via bot, use a webhook for the channel

import axios from 'axios';

async function postEventToWebhook(webhookUrl, event) {
  const formatted = formatEvent(event);
  
  await axios.post(webhookUrl, {
    embeds: [{
      title: formatted.title,
      description: formatted.description,
      color: 0xe74c3c,
      fields: [
        { name: '📍 Location', value: formatted.location, inline: true },
        { name: '💰 Fame', value: formatted.fame, inline: true }
      ],
      url: formatted.url,
      timestamp: formatted.timestamp
    }]
  });
}


// --- Database Integration (Advanced) ---
// Instead of JSON files, use a database

// Example with MongoDB:
import mongoose from 'mongoose';

const KillboardConfigSchema = new mongoose.Schema({
  guildId: String,
  channelId: String,
  trackedPlayers: [{ name: String, id: String }],
  trackedGuilds: [{ name: String, id: String }],
  lastEventIds: {
    kills: [Number],
    deaths: [Number]
  }
});

const KillboardConfig = mongoose.model('KillboardConfig', KillboardConfigSchema);

// Replace loadKillboardConfig:
async function loadKillboardConfig(guildId) {
  return await KillboardConfig.findOne({ guildId }) || { /* defaults */ };
}


// =============================================================================
// API ENDPOINT REFERENCE
// =============================================================================

// Base URL: https://gameinfo.albiononline.com/api/gameinfo

// Search for player/guild:
// GET /search?q=PlayerName
// Response: { players: [...], guilds: [...] }

// Get player kills:
// GET /players/{playerId}/kills?limit=50
// Response: [ { EventId, Killer, Victim, Location, ... }, ... ]

// Get player deaths:
// GET /players/{playerId}/deaths?limit=50
// Response: [ { EventId, Killer, Victim, Location, ... }, ... ]

// Get guild events:
// GET /guilds/{guildId}/kills?limit=50
// Response: [ { EventId, Killer, Victim, Location, ... }, ... ]

// Get recent global events:
// GET /events?limit=50&offset=0
// Response: [ { EventId, Killer, Victim, Location, ... }, ... ]

// Get specific event:
// GET /events/{eventId}
// Response: { EventId, Killer, Victim, Location, TotalVictimKillFame, ... }


// =============================================================================
// RATE LIMITING BEST PRACTICES
// =============================================================================

// Current implementation:
// - Minimum 2 seconds between API calls
// - 1 second delay between processing multiple players/guilds
// - 30 second interval between full polls
// - Automatic 60 second backoff on 429 errors

// Recommended limits:
// - Track no more than 10 players per guild
// - Track no more than 5 guilds per guild
// - Increase poll interval if you have many Discord servers

// Calculate your request rate:
const playersTracked = 5;
const guildsTracked = 2;
const requestsPerPoll = (playersTracked * 2) + guildsTracked; // kills + deaths per player
const pollInterval = 30000; // 30 seconds
const requestsPerMinute = (requestsPerPoll / (pollInterval / 1000)) * 60;
console.log(`Estimated requests/minute: ${requestsPerMinute}`);
// Should stay well under 30 requests/minute


// =============================================================================
// TROUBLESHOOTING CHECKLIST
// =============================================================================

// ✅ Bot has permissions in target channel:
//    - Send Messages
//    - Embed Links
//    - View Channel

// ✅ Channel is configured:
//    /killboard list → Should show your channel

// ✅ Poller is running:
//    /killboard status → Should show "Running"

// ✅ At least one entity tracked:
//    /killboard list → Should show players or guilds

// ✅ Player/guild names are correct:
//    Check spelling on https://albiononline.com/killboard

// ✅ Player/guild has recent activity:
//    Recent kills/deaths exist in Albion Online

// ✅ No rate limit errors in console:
//    Check bot logs for "429" or "Rate limit exceeded"

// ✅ Events are being fetched:
//    Add console.log in pollGuild() to verify API calls

// ✅ Data directory is writable:
//    Check that /data folder exists and bot can write to it


// =============================================================================
// TESTING WORKFLOW
// =============================================================================

// 1. Start bot
// 2. Run: /killboard set-channel #test-channel
// 3. Run: /killboard track player YourMainCharacter
// 4. Run: /killboard status (verify poller is running)
// 5. Go into Albion Online
// 6. Get a kill or death
// 7. Wait up to 30 seconds
// 8. Check #test-channel for the event

// If event doesn't appear:
// - Check console logs for errors
// - Verify player name is correct
// - Run /killboard list to confirm tracking
// - Manually trigger poll: manualPollGuild(guildId) in console


// =============================================================================
// PRODUCTION DEPLOYMENT
// =============================================================================

// 1. Set environment variables:
//    DATA_DIR=/persistent/storage/path
//    DISCORD_TOKEN=your_production_token

// 2. Ensure data directory persists across restarts:
//    - Use docker volumes
//    - Or external storage mount

// 3. Monitor bot logs:
//    - Set up logging service (Winston, etc.)
//    - Alert on repeated errors

// 4. Set up health checks:
//    - Verify poller is running
//    - Check last poll timestamp
//    - Alert if stale (>5 minutes)

// 5. Backup configuration:
//    - Periodically backup data/ directory
//    - Or use database with backups

// 6. Scale considerations:
//    - If many guilds, consider sharding
//    - Or run multiple bot instances with load balancing
