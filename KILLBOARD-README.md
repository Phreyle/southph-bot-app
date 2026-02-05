# 🗡️ Albion Online Killboard Feature

A real-time killboard tracking system for your Discord bot that monitors Albion Online kills and deaths using the unofficial Albion Online gameinfo API.

## 📋 Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Commands](#commands)
- [Setup & Installation](#setup--installation)
- [API Information](#api-information)
- [Configuration](#configuration)
- [Rate Limiting](#rate-limiting)
- [Troubleshooting](#troubleshooting)

---

## ✨ Features

- **Real-time Monitoring**: Polls Albion Online API every 30 seconds for new events
- **Player Tracking**: Track individual player kills and deaths
- **Guild Tracking**: Monitor all kills/deaths involving specific guilds
- **Per-Server Configuration**: Each Discord server has independent tracking lists
- **Event Deduplication**: Prevents posting duplicate events
- **Rich Embeds**: Beautiful Discord embeds with kill details, location, fame, and weapons
- **Rate Limiting**: Built-in rate limiting to respect API constraints
- **Persistent Storage**: All configuration stored in JSON files per guild

---

## 🏗️ Architecture

### File Structure

```
southph-bot-app/
├── app.js                  # Main bot file (command handlers + poller initialization)
├── commands.js             # Command definitions for Discord
├── killboard-config.js     # Configuration management (storage/retrieval)
├── albion-api.js           # Albion Online API wrapper with rate limiting
├── killboard-poller.js     # Background polling service
└── data/                   # Data directory (auto-created)
    └── killboard-config-{guildId}.json  # Per-guild configuration files
```

### Components

#### 1. **killboard-config.js** - Configuration Management
- Handles persistent storage of tracked players, guilds, and channels
- Manages event ID tracking to prevent duplicates
- Provides utility functions for adding/removing tracked entities

#### 2. **albion-api.js** - API Service
- Wrapper for Albion Online gameinfo API
- Rate limiting (minimum 2 seconds between requests)
- Batch fetching for multiple players/guilds
- Event formatting for Discord embeds

#### 3. **killboard-poller.js** - Polling Service
- Runs every 30 seconds (configurable)
- Fetches events for all tracked players/guilds
- Posts new events to configured Discord channels
- Handles concurrent poll prevention

#### 4. **app.js** - Command Handlers
- Slash command implementations
- Integration with Discord.js client
- Poller initialization on bot ready

---

## 💬 Commands

### `/killboard set-channel #channel-name`
Sets the Discord channel where kill/death events will be posted.

**Example:**
```
/killboard set-channel #albion-killboard
```

**Response:**
```
✅ Killboard channel set to #albion-killboard
```

---

### `/killboard track player PlayerName`
Tracks kills and deaths of a specific player.

**Example:**
```
/killboard track player JohnDoe
```

**How it works:**
1. Bot searches for the player in Albion Online API
2. If found, adds player to tracking list with their ID
3. Future kills/deaths involving this player will be posted

**Response:**
```
✅ Now tracking player JohnDoe (ID: abc123xyz)
Kill/death events will be posted to your configured channel.
```

---

### `/killboard track guild GuildName`
Tracks all kills/deaths associated with a guild.

**Example:**
```
/killboard track guild MyAwesomeGuild
```

**How it works:**
1. Bot searches for the guild in Albion Online API
2. If found, adds guild to tracking list with their ID
3. Any event involving this guild (as killer or victim) will be posted

**Response:**
```
✅ Now tracking guild MyAwesomeGuild (ID: def456uvw)
Kill/death events involving this guild will be posted to your configured channel.
```

---

### `/killboard untrack player PlayerName`
Stops tracking a specific player.

**Example:**
```
/killboard untrack player JohnDoe
```

**Response:**
```
✅ Stopped tracking player JohnDoe.
```

---

### `/killboard untrack guild GuildName`
Stops tracking a specific guild.

**Example:**
```
/killboard untrack guild MyAwesomeGuild
```

**Response:**
```
✅ Stopped tracking guild MyAwesomeGuild.
```

---

### `/killboard list`
Lists all currently tracked players and guilds for your server.

**Example:**
```
/killboard list
```

**Response:**
```
📊 Killboard Tracking Status

Channel: #albion-killboard

👤 Tracked Players:
• JohnDoe
• JaneSmith

🏰 Tracked Guilds:
• MyAwesomeGuild
• EliteRaiders
```

---

### `/killboard status`
Shows the current status of the killboard poller.

**Example:**
```
/killboard status
```

**Response:**
```
🔄 Killboard Poller Status

Status: ✅ Running
Currently Polling: No
Poll Interval: 30s
Total Configured Guilds: 3
Tracked Players (This Server): 2
Tracked Guilds (This Server): 2

Last poll: 2/6/2026, 3:45:23 PM
```

---

## 🚀 Setup & Installation

### Prerequisites
- Node.js 18 or higher
- Discord bot with application commands enabled
- Required npm packages (already in package.json):
  - `discord.js`
  - `axios`
  - `dotenv`

### Installation Steps

1. **No additional dependencies needed** - All required packages are already in your `package.json`.

2. **Register the commands** with Discord:
   ```bash
   npm run register
   ```

3. **Start the bot**:
   ```bash
   npm start
   ```

4. **Configure in your Discord server**:
   ```
   /killboard set-channel #your-killboard-channel
   /killboard track player YourPlayerName
   ```

5. **The poller will automatically start** when the bot logs in and begin monitoring every 30 seconds.

---

## 🌐 API Information

### Albion Online Gameinfo API

**Base URL:** `https://gameinfo.albiononline.com/api/gameinfo`

**Alternative Regions:**
- Americas: `https://gameinfo.albiononline.com/api/gameinfo`
- Europe: `https://gameinfo-ams.albiononline.com/api/gameinfo`
- Asia: `https://gameinfo-sgp.albiononline.com/api/gameinfo`

### Key Endpoints Used

| Endpoint | Purpose | Example |
|----------|---------|---------|
| `/search?q={name}` | Search for players/guilds | `/search?q=JohnDoe` |
| `/players/{id}/kills` | Get player's kills | `/players/abc123/kills?limit=50` |
| `/players/{id}/deaths` | Get player's deaths | `/players/abc123/deaths?limit=50` |
| `/guilds/{id}/kills` | Get guild's kills | `/guilds/def456/kills?limit=50` |
| `/events` | Get recent global events | `/events?limit=50` |
| `/events/{id}` | Get specific event details | `/events/123456789` |

### Response Format

Events contain rich information:
```json
{
  "EventId": 123456789,
  "TimeStamp": "2026-02-06T15:30:00.000Z",
  "Killer": {
    "Id": "abc123",
    "Name": "JohnDoe",
    "GuildId": "guild123",
    "GuildName": "MyGuild"
  },
  "Victim": {
    "Id": "def456",
    "Name": "JaneSmith",
    "GuildId": "guild456",
    "GuildName": "TheirGuild",
    "Equipment": {
      "MainHand": { "Type": "T8_MAIN_SWORD" }
    }
  },
  "Location": "BlackZone@Cluster-123",
  "TotalVictimKillFame": 150000
}
```

---

## ⚙️ Configuration

### Configuration Files

Each Discord server gets its own configuration file:
```
data/killboard-config-{guildId}.json
```

**Example Configuration:**
```json
{
  "channelId": "123456789012345678",
  "trackedPlayers": [
    {
      "name": "JohnDoe",
      "id": "abc123xyz"
    }
  ],
  "trackedGuilds": [
    {
      "name": "MyAwesomeGuild",
      "id": "def456uvw"
    }
  ],
  "lastEventIds": {
    "kills": [123456789, 123456790, 123456791],
    "deaths": []
  },
  "lastPollTimestamp": "2026-02-06T15:45:00.000Z"
}
```

### Environment Variables

Add to your `.env` file if you want to customize:

```env
# Data directory for storing config files (default: /home/container/data)
DATA_DIR=./data

# Discord bot token (required)
DISCORD_TOKEN=your_token_here

# Other existing variables...
```

---

## ⏱️ Rate Limiting

### API Rate Limits

The Albion Online API has the following limits:
- **Recommended:** 30 requests per minute maximum
- **Hard limit:** Varies, but excessive requests result in 429 errors

### Our Implementation

To respect these limits, we implement:

1. **Minimum Request Delay**: 2 seconds between individual API calls
   ```javascript
   const minDelay = 2000; // 2 seconds
   ```

2. **Sequential Processing**: Players and guilds are processed one at a time
   ```javascript
   for (const playerId of playerIds) {
     await fetchEvents(playerId);
     await delay(1000); // 1 second delay between players
   }
   ```

3. **Polling Interval**: 30 seconds between full polls
   ```javascript
   const POLL_INTERVAL = 30000; // 30 seconds
   ```

4. **Automatic Retry**: If a 429 error occurs, waits 60 seconds before retrying
   ```javascript
   if (error.response?.status === 429) {
     console.error('Rate limit exceeded. Waiting 60 seconds...');
     await sleep(60000);
   }
   ```

### Calculation Example

With current settings:
- **Per player**: 2 API calls (kills + deaths) = 4 seconds minimum
- **5 tracked players**: ~20 seconds per poll
- **Poll interval**: 30 seconds
- **Total requests/minute**: ~4 requests (well under 30 limit)

---

## 🛠️ Troubleshooting

### Common Issues

#### 1. Events Not Posting

**Problem:** Bot is running but events aren't appearing in Discord.

**Solutions:**
- Check if channel is configured: `/killboard list`
- Verify poller is running: `/killboard status`
- Check bot permissions in the target channel (Send Messages, Embed Links)
- Review bot console logs for errors

#### 2. Player/Guild Not Found

**Problem:** Search fails when tracking a player/guild.

**Solutions:**
- Verify exact spelling (case-sensitive)
- Check if player/guild exists in Albion Online
- Try searching on [Albion Killboard](https://albiononline.com/killboard) first
- Ensure player has recent activity

#### 3. Duplicate Events

**Problem:** Same event posted multiple times.

**Solutions:**
- Should not happen - events are tracked by ID
- If it does, check `lastEventIds` in config file
- May indicate corrupted config - delete and reconfigure

#### 4. API Rate Limit Errors

**Problem:** Console shows "Rate limit exceeded" messages.

**Solutions:**
- Reduce number of tracked entities
- Increase `POLL_INTERVAL` in `killboard-poller.js`
- Reduce `EVENTS_PER_PLAYER` / `EVENTS_PER_GUILD` constants

#### 5. Poller Not Starting

**Problem:** Bot starts but poller doesn't initialize.

**Solutions:**
- Check console for initialization messages
- Verify `client.once('ready')` is executing
- Ensure no errors in module imports
- Restart bot completely

---

## 📊 Event Display Example

When a kill/death occurs, the bot posts a rich embed:

```
⚔️ PvP Kill - 150,000 Fame

JohnDoe [MyGuild] killed JaneSmith [TheirGuild]

📍 Location: BlackZone@Cluster-123
⚔️ Weapon: T8_MAIN_SWORD
💰 Fame: 150,000

[View on Killboard] (clickable link)

Event ID: 123456789
Today at 3:45 PM
```

**Embed Colors:**
- 🔴 Red (`0xe74c3c`) - PvP kills
- ⚪ Gray (`0x95a5a6`) - PvE deaths

---

## 🔄 Polling Flow Diagram

```
Bot Starts → Initialize Poller → Wait 5 seconds → First Poll
                                                       ↓
                                              ┌────────────────┐
                                              │  Poll Cycle    │
                                              │  (every 30s)   │
                                              └────────┬───────┘
                                                       ↓
                                              Get All Configured
                                                    Guilds
                                                       ↓
                                              For Each Discord Guild:
                                                       ↓
                                    ┌──────────────────────────────┐
                                    │  Fetch Player Events (API)   │
                                    │  Fetch Guild Events (API)    │
                                    └──────────┬───────────────────┘
                                               ↓
                                    ┌──────────────────────────────┐
                                    │  Filter New Events Only      │
                                    │  (Check lastEventIds)        │
                                    └──────────┬───────────────────┘
                                               ↓
                                    ┌──────────────────────────────┐
                                    │  Post to Discord Channel     │
                                    │  Mark Events as Seen         │
                                    └──────────┬───────────────────┘
                                               ↓
                                         Next Guild → Loop
```

---

## 🧪 Testing

### Manual Testing

1. **Test channel setup:**
   ```
   /killboard set-channel #test-channel
   /killboard list
   ```

2. **Test player tracking:**
   ```
   /killboard track player YourCharacterName
   /killboard status
   ```

3. **Generate a test kill:**
   - Go into Albion Online
   - Get killed or kill someone
   - Wait up to 30 seconds for event to appear in Discord

4. **Test untracking:**
   ```
   /killboard untrack player YourCharacterName
   /killboard list
   ```

### Debug Mode

Enable verbose logging by adding console.log statements:

```javascript
// In killboard-poller.js, around line 80
console.log(`[DEBUG] Polling guild ${guildId}`);
console.log(`[DEBUG] Config:`, JSON.stringify(config, null, 2));
```

---

## 📝 Code Customization

### Change Poll Interval

Edit `killboard-poller.js`:
```javascript
const POLL_INTERVAL = 60000; // Change to 60 seconds
```

### Change Events Per Fetch

Edit `killboard-poller.js`:
```javascript
const EVENTS_PER_PLAYER = 20; // Fetch more events per player
const EVENTS_PER_GUILD = 50;  // Fetch more events per guild
```

### Customize Embed Appearance

Edit `albion-api.js`, function `formatEvent()`:
```javascript
// Change colors
const embedColor = isPvE ? 0x95a5a6 : 0xe74c3c;

// Change title format
title: `${killType} - ${fameFormatted} Fame`,
```

### Add More Event Details

Edit `killboard-poller.js`, function `postEventToChannel()`:
```javascript
.addFields(
  { name: '📍 Location', value: formatted.location, inline: true },
  { name: '⚔️ Weapon', value: formatted.weapon, inline: true },
  { name: '💰 Fame', value: formatted.fame, inline: true },
  { name: '⚡ New Field', value: 'Custom Value', inline: true } // Add this
)
```

---

## 🤝 Contributing

Feel free to modify and extend this killboard system:

1. **Add new commands** in `commands.js` and `app.js`
2. **Enhance API calls** in `albion-api.js`
3. **Improve polling logic** in `killboard-poller.js`
4. **Add filters** (e.g., minimum fame, specific zones)

---

## 📚 Additional Resources

- [Albion Online Killboard](https://albiononline.com/killboard)
- [Unofficial API Documentation](https://github.com/broderickhyman/ao-killboard)
- [Discord.js Guide](https://discordjs.guide/)
- [Albion Online Data Project](https://www.albion-online-data.com/)

---

## ⚖️ License

This killboard implementation is part of your Discord bot project. Use and modify as needed for your community.

---

## 💡 Tips

1. **Start small**: Track 1-2 players initially to test functionality
2. **Monitor logs**: Keep an eye on console output for errors
3. **Optimize tracking**: Only track active players/guilds
4. **Use filters**: Consider adding fame thresholds to reduce spam
5. **Backup configs**: Periodically backup your `data/` directory

---

**Happy hunting in Albion Online! ⚔️**
