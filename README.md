# SouthPH Bot - Albion Online Guild Management

A comprehensive Discord bot built for Albion Online guilds, featuring guild verification, content management, ticket systems, and virtual economy.

## 🌟 Features

### 🎮 Albion Guild Verification System
- **Automatic Guild Verification**: Verify members are in your Albion guild via official API
- **Region Support**: Americas, Europe, and Asia servers
- **Role Assignment**: Automatically assign roles to verified members
- **Custom Nicknames**: Format nicknames with guild tags and IGN
- **Purge System**: Remove members who left the guild
- **Force Management**: Admin tools to manage registrations by IGN

### 💰 Virtual Bank System
- **User Balances**: Track virtual currency per server
- **Admin Controls**: Deposit, withdraw, and clear balances
- **Transaction Management**: View active users and their balances
- **Multi-server Support**: Separate economy per Discord server

### 🎯 Content Management
- **Multiple Content Types**: ROA, CTA, GCAMPS, FF, Tracking, Avalonian Dungeon
- **Role Assignment**: Fixed slots or category-based signups
- **Fill System**: Auto-assign fill players to empty slots
- **Thread Creation**: Automatic thread creation for content callouts
- **Real-time Updates**: Live embed updates when users sign up

### 🎫 Advanced Ticket System
- **Multi-panel Support**: Create unlimited ticket panels
- **Custom Configuration**: Per-panel settings (categories, roles, transcripts)
- **Staff Management**: Assign staff roles per panel
- **Ticket Transcripts**: Automatic transcript generation
- **Health Monitoring**: Built-in health check system

### ⚔️ Regear Management
- **CTA/FF Support**: Create regear threads for both content types
- **Thread Locking**: Close and lock threads when done
- **Custom Formatting**: Per-content-type embed formatting

### 🔐 Permission System
- **Role-based Permissions**: Grant bank/regear permissions to specific roles
- **Administrator Override**: Admins always have access
- **Per-server Configuration**: Independent settings per Discord server

## 📦 Installation

### Prerequisites
- Node.js 18.x or higher
- Discord Bot Token
- Discord Application ID and Public Key

### Setup

1. **Clone the repository:**
```bash
git clone https://github.com/yourusername/southph-bot-app.git
cd southph-bot-app
```

2. **Install dependencies:**
```bash
npm install
```

3. **Configure environment variables:**

Create a `.env` file in the root directory:
```env
DISCORD_TOKEN=your_discord_bot_token
APP_ID=your_discord_application_id
PUBLIC_KEY=your_discord_public_key
DATA_DIR=./data
PORT=3000
```

4. **Register slash commands:**
```bash
npm run register
```

5. **Start the bot:**
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## 🎯 Quick Start Guide

### Initial Server Setup (Admin)

1. **Set Bot Prefix** (Optional, default is `!`):
```
!prefix !
```

2. **Configure Albion Guild Verification**:
```
/set guild region:americas guild_name:YourGuildName
/set register-role @Verified
/set guild-tag SOUTH
/set nickname-format {tag} {ign}
```

3. **Set Up Permissions** (Optional):
```
/perms add bank @BankManager
/perms add cta @CTALead
```

4. **Create Ticket Panel** (Optional):
```
/ticket setup
```

### User Registration

Members can register their Albion characters:
```
/register region:americas ign:YourCharacterName
```

Bot will:
- Verify character exists in Albion
- Check guild membership
- Assign verified role
- Apply formatted nickname

### Creating Content

Admins can create content callouts:
```
/content create type:CTA title:Reset Bank zone:Brecilien tier:8 time:20:00 UTC
```

Members sign up in the thread:
```
x tank
x fill
```

## 📚 Command Reference

### User Commands

| Command | Description |
|---------|-------------|
| `/help` or `!help` | Show command help |
| `/utc` or `!utc` | Display current UTC time |
| `/info <player>` | Search for Albion player |
| `/register <region> <ign>` | Register your character |
| `/unregister` | Unregister your character |
| `/bank balance [@user]` | Check bank balance |
| `x <role>` | Sign up for content role |
| `x fill` | Sign up as fill |
| `x cancel` | Cancel content signup |

### Admin Commands - Albion Verification

| Command | Description |
|---------|-------------|
| `/set guild <region> <name>` | Configure guild and region |
| `/set register-role @role` | Set verified member role |
| `/set guild-tag <tag>` | Set guild tag for nicknames |
| `/set nickname-format <format>` | Set nickname format |
| `/config view` | View current configuration |
| `/forceunregister <ign>` | Force unregister by IGN |
| `/purge confirm` | Remove invalid registrations |

### Admin Commands - Bank

| Command | Description |
|---------|-------------|
| `/bank deposit @user <amount>` | Add money to user |
| `/bank withdraw @user <amount>` | Remove money from user |
| `/bank clear @user` | Clear user's balance |
| `/bank clearall` | Clear all balances |

### Admin Commands - Content

| Command | Description |
|---------|-------------|
| `/content create` | Create content callout |
| `/content reset` | Reset content system |
| `/content adduser` | Add user to role |
| `/content removeuser` | Remove user from role |

### Admin Commands - Tickets

| Command | Description |
|---------|-------------|
| `/ticket setup` | Create ticket panel |
| `/ticket list` | List all panels |
| `/ticket panel [id]` | Send panel to channel |
| `/ticket delete <id>` | Delete panel |
| `/ticket stats` | View statistics |
| `/ticket health` | Health check |

### Admin Commands - Regear

| Command | Description |
|---------|-------------|
| `/regear create <type> <title> <time>` | Create regear thread |
| `/regear close` | Close regear thread |

### Admin Commands - Permissions

| Command | Description |
|---------|-------------|
| `!prefix <new>` | Change bot prefix |
| `/perms list` | View role permissions |
| `/perms add <type> @role` | Grant role permission |
| `/perms remove <type> @role` | Revoke role permission |

## 🔧 Configuration

### Albion Verification Settings

**Nickname Format Variables:**
- `{ign}` - In-game name
- `{tag}` - Guild tag
- `{guild}` - Guild name
- `{region}` - Region (uppercase)

**Example Formats:**
- `{tag} {ign}` → "SOUTH PlayerName"
- `{ign} | {guild}` → "PlayerName | SouthPH"
- `[{region}] {ign}` → "[AMERICAS] PlayerName"

**Supported Regions:**
- `americas` - https://gameinfo.albiononline.com
- `europe` - https://gameinfo-ams.albiononline.com
- `asia` - https://gameinfo-sgp.albiononline.com

### Content Types

- **ROA (Roads of Avalon)**: 7 fixed roles + fill
- **CTA (Crystal Territory Attack)**: Category-based (tank, heal, dps, support, dtank)
- **GCAMPS (Group Camps)**: 5 fixed roles + fill
- **FF (Faction Warfare)**: Category-based (tank, heal, dps)
- **Tracking (Crystal League)**: 5 fixed roles + fill
- **Avadungeon (Avalonian Dungeon)**: 10 fixed roles + fill

### Database Structure

Bot stores data in JSON files per server:
- `albion-config-{guildId}.json` - Albion verification config
- `albion-users-{guildId}.json` - Registered users
- `bank-data-{guildId}.json` - Bank balances
- `permissions-config-{guildId}.json` - Role permissions
- `prefix-config-{guildId}.json` - Custom prefix
- `ticket-panels-{guildId}.json` - Ticket configurations
- `ticket-data-{guildId}.json` - Ticket records

## 🛠️ Development

### Project Structure

```
southph-bot-app/
├── app.js                      # Main application entry
├── commands.js                 # Slash command registration
├── utils.js                    # Discord API utilities
├── package.json               # Dependencies
├── .env                       # Environment variables
├── src/
│   ├── commands/
│   │   ├── slashCommands.js   # Slash command handlers
│   │   └── prefixCommands.js  # Prefix command handlers
│   ├── config/
│   │   ├── constants.js       # Global constants
│   │   └── contentState.js    # Content system state
│   ├── database/
│   │   └── guildData.js       # Database operations
│   ├── events/
│   │   ├── interactionCreate.js  # Button interactions
│   │   └── messageCreate.js      # Message events
│   ├── services/
│   │   └── contentService.js     # Content management
│   ├── systems/
│   │   ├── albion/
│   │   │   ├── albion.js         # Core logic
│   │   │   ├── albion-api.js     # API wrapper
│   │   │   └── albion-db.js      # Database functions
│   │   ├── bank/
│   │   │   └── bank.js           # Bank system
│   │   └── ticket/
│   │       ├── ticket-system.js  # Ticket logic
│   │       ├── ticket-db.js      # Ticket database
│   │       ├── ticket-utils.js   # Utilities
│   │       └── ticket-commands.js # Ticket commands
│   └── utils/
│       ├── embedBuilder.js       # Embed creation
│       └── permissions.js        # Permission checks
└── docs/                         # Additional documentation
```

### Adding New Commands

1. **Define command in `commands.js`:**
```javascript
const NEW_COMMAND = {
  name: 'mycommand',
  description: 'Description here',
  options: [...],
  type: 1
};
```

2. **Add to ALL_COMMANDS array:**
```javascript
const ALL_COMMANDS = [..., NEW_COMMAND];
```

3. **Implement handler in `slashCommands.js`:**
```javascript
if (name === 'mycommand') {
  // Handler logic
}
```

4. **Implement prefix handler in `prefixCommands.js`:**
```javascript
if (command === 'mycommand') {
  // Handler logic
}
```

5. **Register commands:**
```bash
npm run register
```

## 📊 System Requirements

- **Node.js**: 18.x or higher
- **Memory**: 256MB minimum
- **Storage**: 100MB for application + data
- **Network**: Stable internet connection for Discord and Albion APIs

## 🔒 Security

- Bot tokens stored in environment variables
- Per-server data isolation
- Administrator checks for sensitive commands
- Role hierarchy validation for nickname changes
- Input validation for all user inputs
- No sensitive data logged

## 🐛 Troubleshooting

### Bot not responding to commands
- Ensure bot is online and connected
- Check bot has required permissions
- Verify slash commands are registered (`npm run register`)

### Nickname changes failing
- Verify bot has "Manage Nicknames" permission
- Check bot role is higher than target user's highest role

### Albion verification failing
- Check guild name is exactly as shown in-game (case-sensitive)
- Verify region is correct for your guild
- Ensure player is actually in the guild in-game
- Check Albion API status

### Database errors
- Verify DATA_DIR is writable
- Check file permissions
- Ensure sufficient disk space

## 📝 License

This bot is for private use within the SouthPH Albion Online guild community. Not intended for public distribution.

## 🤝 Contributing

This is a private project, but suggestions and bug reports are welcome through Discord.

## 📞 Support

For support, contact guild leadership through Discord.

## 🎯 Roadmap

- [ ] Alliance verification support
- [ ] Auto-verification background job
- [ ] Registration history tracking
- [ ] Bulk registration tools
- [ ] Enhanced statistics dashboard
- [ ] Multi-guild support for alliances
- [ ] API caching for performance

## ⚡ Quick Reference

**Bot requires these permissions:**
- Manage Nicknames
- Manage Roles
- Read Messages
- Send Messages
- Create Threads
- Manage Threads
- Embed Links
- Read Message History

**Environment Variables:**
```env
DISCORD_TOKEN=required
APP_ID=required
PUBLIC_KEY=required
DATA_DIR=optional (default: ./data)
PORT=optional (default: 3000)
```

**Key Files to Configure:**
- `.env` - Bot credentials
- `src/config/constants.js` - Custom emojis and settings

---

**Built with ❤️ for SouthPH Albion Online Guild**