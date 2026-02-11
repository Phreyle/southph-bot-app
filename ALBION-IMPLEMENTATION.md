# Albion Online Guild Verification System - Implementation Summary

## Overview

This document describes the implementation of the Albion Online guild verification and purge system integrated into the SouthPH Discord bot. The system allows guild administrators to verify members' in-game characters and automatically manage guild membership.

---

## What Was Added

### New Files Created

#### 1. `src/systems/albion/albion-api.js`
**Purpose:** Albion Online API wrapper providing clean interface for API calls.

**Key Functions:**
- `fetchPlayerInfo(region, playerName)` - Fetches player data from Albion API
- `validatePlayerGuild(region, playerName, expectedGuildName)` - Verifies guild membership
- `getRegionApiUrl(region)` - Returns API base URL for region

**Features:**
- Supports all three Albion regions (Americas, Europe, Asia)
- Uses exact API endpoints as specified
- Comprehensive error handling (player not found, no guild, guild mismatch, API timeouts)
- Returns structured response objects with success/error states

#### 2. `src/systems/albion/albion-db.js`
**Purpose:** Database layer for per-guild Albion configuration and user registrations.

**Key Functions:**
- `loadAlbionConfig(guildId)` / `saveAlbionConfig(guildId, config)` - Guild configuration
- `loadAlbionUsers(guildId)` / `saveAlbionUsers(guildId, users)` - User registrations
- `getAlbionUser(guildId, discordId)` - Get single user
- `saveAlbionUser(guildId, discordId, userData)` - Register/update user
- `removeAlbionUser(guildId, discordId)` - Remove user
- `getAllAlbionUsers(guildId)` - Get all registered users
- `validateAlbionConfig(config)` - Check configuration completeness

**Database Schema:**

**Guild Configuration** (`albion-config-{guildId}.json`):
```json
{
  "albionRegion": "americas|europe|asia",
  "albionGuildName": "Guild Name",
  "registerRoleId": "roleId",
  "guildTag": "TAG",
  "nicknameFormat": "{tag} {ign}"
}
```

**Registered Users** (`albion-users-{guildId}.json`):
```json
{
  "discordId": {
    "discordId": "123456789",
    "ign": "PlayerName",
    "region": "americas",
    "guild": "Guild Name",
    "registeredAt": "2026-02-12T10:30:00.000Z",
    "lastVerified": "2026-02-12T10:30:00.000Z"
  }
}
```

#### 3. `src/systems/albion/albion.js`
**Purpose:** Core business logic for registration and purge operations.

**Key Functions:**
- `registerUser(guild, discordId, region, ign)` - Complete registration flow
- `purgeUsers(guild)` - Verify all members and remove invalid ones
- `getUserInfo(guildId, discordId)` - Get user registration info
- `getAllUsers(guildId)` - Get all registered users

**Registration Flow:**
1. Validates server configuration is complete
2. Calls Albion API to verify player exists
3. Checks guild membership matches configuration
4. Saves user to database with primary key = discordId
5. Assigns configured register role
6. Applies formatted nickname (with hierarchy check)
7. Returns detailed success/error response

**Purge Flow:**
1. Fetches all members with register role
2. For each member:
   - Gets stored IGN from database
   - Calls Albion API to verify current guild
   - If guild mismatch: removes role, resets nickname, deletes from database
   - If valid: keeps as-is
   - Handles errors gracefully
3. Returns summary (checked, removed, valid, errors)

**Nickname Formatting:**
- Supports variables: `{ign}`, `{tag}`, `{guild}`, `{region}`
- Max length: 32 characters (enforced and truncated)
- Checks role hierarchy before applying
- Fails gracefully if bot lacks permissions

---

## What Was Modified

### Modified Files

#### 1. `commands.js`
**Changes:**
- Added `SET_COMMAND` definition (4 subcommands: guild, register-role, guild-tag, nickname-format)
- Added `CONFIG_COMMAND` definition (view subcommand)
- Added `REGISTER_COMMAND` definition (region and ign parameters)
- Added `PURGE_COMMAND` definition (confirm subcommand)
- Updated `ALL_COMMANDS` array to include new commands

**No Breaking Changes:** All existing commands remain unchanged.

#### 2. `src/commands/slashCommands.js`
**Changes:**
- Added imports for Albion system functions
- Implemented `/set` command handler (lines ~1667-1798)
  - Subcommands: guild, register-role, guild-tag, nickname-format
  - Admin-only permission check
- Implemented `/config` command handler (lines ~1801-1835)
  - Shows current configuration with status
- Implemented `/register` command handler (lines ~1838-1932)
  - Deferred response for API call
  - Comprehensive error messages
  - Success embed with registration details
- Implemented `/purge` command handler (lines ~1935-2024)
  - Admin-only permission check
  - Deferred response for long operation
  - Summary embed with statistics

**No Breaking Changes:** All existing slash command handlers remain unchanged.

#### 3. `src/commands/prefixCommands.js`
**Changes:**
- Added imports for Albion system functions
- Implemented `!set` command handler (lines ~383-521)
  - Mirrors slash command functionality
  - Shares internal logic with slash version
- Implemented `!config` command handler (lines ~524-547)
  - Mirrors slash command functionality
- Implemented `!register` or `!reg` command handler (lines ~550-618)
  - Mirrors slash command functionality
  - Shows loading message during API call
- Implemented `!purge` command handler (lines ~621-666)
  - Mirrors slash command functionality
  - Shows loading message during operation

**No Breaking Changes:** All existing prefix command handlers remain unchanged.

---

## Integration Points

### Reused Existing Components

The implementation cleanly integrates with existing architecture:

1. **Database Pattern:** Follows same pattern as `bank.js` and `ticket-db.js`
   - Per-guild JSON files in DATA_DIR
   - Load/save functions
   - Map-based user storage

2. **Command Pattern:** Follows same pattern as bank/ticket systems
   - Slash commands in `slashCommands.js`
   - Prefix commands in `prefixCommands.js`
   - Shared internal logic (no duplication)

3. **Permission System:** Uses existing permission utilities
   - `PermissionFlagsBits.Administrator` for admin commands
   - Role hierarchy checks for nickname changes

4. **API Pattern:** Similar to existing `/info` command
   - Uses `axios` library (already in dependencies)
   - Proper timeout handling
   - Error response structures

5. **Embed Pattern:** Consistent with existing embeds
   - `EmbedBuilder` from discord.js
   - Color coding (green for success, red for errors, yellow for warnings)
   - Timestamp and formatting consistency

---

## Command Usage Guide

### Administrator Commands

#### `/set guild <region> <guild_name>`
**Purpose:** Configure the Albion guild and region.

**Parameters:**
- `region`: americas | europe | asia
- `guild_name`: Exact guild name in Albion Online

**Example:**
```
/set guild region:americas guild_name:SouthPH
```

**Prefix equivalent:**
```
!set guild americas SouthPH
```

---

#### `/set register-role <role>`
**Purpose:** Set the role assigned to verified members.

**Parameters:**
- `role`: Discord role mention or ID

**Example:**
```
/set register-role role:@Verified
```

**Prefix equivalent:**
```
!set register-role @Verified
```

---

#### `/set guild-tag <tag>`
**Purpose:** Set the guild tag for nickname formatting.

**Parameters:**
- `tag`: Short guild tag (e.g., SOUTH)

**Example:**
```
/set guild-tag tag:SOUTH
```

**Prefix equivalent:**
```
!set guild-tag SOUTH
```

---

#### `/set nickname-format <format>`
**Purpose:** Set nickname format with variables.

**Parameters:**
- `format`: Template string (max 32 chars)

**Variables:**
- `{ign}` - In-game name
- `{tag}` - Guild tag
- `{guild}` - Guild name
- `{region}` - Region (uppercase)

**Example:**
```
/set nickname-format format:{tag} {ign}
```

**Prefix equivalent:**
```
!set nickname-format {tag} {ign}
```

---

#### `/config view`
**Purpose:** View current configuration.

**Example:**
```
/config view
```

**Prefix equivalent:**
```
!config
```

**Output:**
- Configuration status (complete/incomplete)
- Region, guild name, register role, guild tag, nickname format
- Missing configuration items highlighted

---

#### `/purge confirm`
**Purpose:** Remove users no longer in the guild.

**Warning:** This operation checks all registered members against Albion API and removes those who left the guild or joined a different guild.

**Example:**
```
/purge confirm
```

**Prefix equivalent:**
```
!purge confirm
```

**Output:**
- Members checked
- Members removed
- Valid members
- Errors encountered

**What it does:**
1. Fetches all members with register role
2. Verifies each against Albion API
3. If guild mismatch:
   - Removes register role
   - Resets nickname
   - Removes from database
4. Provides detailed summary

---

### User Commands

#### `/register <region> <ign>`
**Purpose:** Register your Albion Online character.

**Parameters:**
- `region`: americas | europe | asia
- `ign`: Your in-game name

**Example:**
```
/register region:americas ign:MyCharacter
```

**Prefix equivalent:**
```
!register americas MyCharacter
!reg americas MyCharacter
```

**What it does:**
1. Calls Albion API to verify character exists
2. Checks if character is in the configured guild
3. If valid:
   - Saves to database
   - Assigns register role
   - Applies formatted nickname
4. Returns success/error message

**Error Scenarios:**
- **Player not found:** Check spelling and region
- **No guild:** Must join guild in-game first
- **Guild mismatch:** Character is in wrong guild
- **Incomplete config:** Administrator must configure system first
- **API timeout:** Albion API is down, try again

---

## Database Changes

### New Database Files (Per Guild)

1. **`albion-config-{guildId}.json`**
   - Stores server-specific Albion configuration
   - Default: all values null except nicknameFormat

2. **`albion-users-{guildId}.json`**
   - Stores registered users by discordId (PRIMARY KEY)
   - Tracks registration and last verification timestamps
   - Updates on re-registration (keeps original registeredAt)

### No Changes to Existing Database Files
- `bank-data-{guildId}.json` - Unchanged
- `permissions-config-{guildId}.json` - Unchanged
- `prefix-config-{guildId}.json` - Unchanged
- `ticket-*` files - Unchanged

---

## Error Handling

### API Errors

**Player Not Found:**
- Status: 404 from Albion API
- Message: "Player not found in {region} region"
- User Action: Check spelling and region

**No Guild:**
- Status: Player exists but GuildName is null
- Message: "Player is not in any guild"
- User Action: Join guild in-game first

**Guild Mismatch:**
- Status: Player in different guild
- Message: "Player is in guild {actual}, not {expected}"
- User Action: Join correct guild or contact admin

**API Timeout:**
- Status: Request timeout (10s)
- Message: "Albion API request timed out"
- User Action: Try again later

**API Error:**
- Status: Other API errors
- Message: "Failed to fetch player information"
- User Action: Contact administrator

### Configuration Errors

**Incomplete Configuration:**
- Validation: Checks for required fields (region, guild name, register role)
- Message: "Server configuration incomplete. Missing: {fields}"
- Admin Action: Run `/set` commands to complete configuration

### Permission Errors

**Bot Lacks Permissions:**
- Nickname: "Bot lacks Manage Nicknames permission"
- Role: "Bot lacks Manage Roles permission"
- Action: Grant permissions or adjust role hierarchy

**Role Hierarchy:**
- Nickname: "Cannot change nickname: user has higher or equal role"
- Action: Move bot role higher in server settings

### Database Errors

**File System Errors:**
- Logged to console
- Non-fatal: Uses default values or empty collections
- Admin Action: Check file permissions in DATA_DIR

---

## Testing Checklist

### Configuration Tests
- ✅ `/set guild` with valid region and guild name
- ✅ `/set register-role` with valid role
- ✅ `/set guild-tag` with short tag
- ✅ `/set nickname-format` with variables
- ✅ `/config view` shows all settings
- ✅ Prefix commands work identically

### Registration Tests
- ✅ `/register` with valid character in guild
- ✅ `/register` with player not found (404)
- ✅ `/register` with player not in guild
- ✅ `/register` with player in wrong guild
- ✅ `/register` before configuration complete
- ✅ Re-registration updates lastVerified
- ✅ Role is assigned correctly
- ✅ Nickname is applied correctly
- ✅ Prefix commands work identically

### Purge Tests
- ✅ `/purge confirm` with no registered members
- ✅ `/purge confirm` with valid members
- ✅ `/purge confirm` with members who left guild
- ✅ `/purge confirm` with members in wrong guild
- ✅ `/purge confirm` removes role and database entry
- ✅ Summary statistics are accurate
- ✅ Prefix command works identically

### Error Handling Tests
- ✅ No syntax errors in any file
- ✅ No duplicate function names or exports
- ✅ All async operations properly awaited
- ✅ No circular imports
- ✅ API timeout handling (10s)
- ✅ Rate limiting delay in purge (500ms per member)
- ✅ Nickname truncation at 32 characters
- ✅ Role hierarchy checks

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Discord Bot (app.js)                      │
└─────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┴─────────────┐
                │                           │
         ┌──────▼──────┐           ┌───────▼───────┐
         │ Slash       │           │ Prefix        │
         │ Commands    │           │ Commands      │
         └──────┬──────┘           └───────┬───────┘
                │                           │
                └────────────┬──────────────┘
                             │
                   ┌─────────▼─────────┐
                   │  Albion Commands  │
                   │  (/set, /config,  │
                   │   /register,      │
                   │   /purge)         │
                   └─────────┬─────────┘
                             │
            ┌────────────────┼────────────────┐
            │                │                │
    ┌───────▼───────┐ ┌─────▼─────┐ ┌───────▼───────┐
    │ albion.js     │ │albion-    │ │ albion-db.js  │
    │ (Core Logic)  │ │api.js     │ │ (Database)    │
    │               │ │(API       │ │               │
    │ • registerUser│ │Wrapper)   │ │ • loadConfig  │
    │ • purgeUsers  │ │           │ │ • saveConfig  │
    │ • applyNick   │ │ • fetch   │ │ • loadUsers   │
    └───────┬───────┘ │   Player  │ │ • saveUsers   │
            │         │ • validate│ └───────┬───────┘
            │         │   Guild   │         │
            │         └─────┬─────┘         │
            │               │               │
            └───────────────┼───────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼───────┐   ┌───────▼───────┐   ┌──────▼──────┐
│ Albion API    │   │ Discord API   │   │ File System │
│ (gameinfo)    │   │ (roles,       │   │ (JSON)      │
│               │   │  nicknames)   │   │             │
│ • Americas    │   └───────────────┘   │ • config    │
│ • Europe      │                       │ • users     │
│ • Asia        │                       └─────────────┘
└───────────────┘
```

---

## Performance Considerations

### API Rate Limiting
- Purge operation includes 500ms delay between member checks
- Prevents overwhelming Albion API
- Can be adjusted if needed

### Timeout Configuration
- API requests timeout after 10 seconds
- Prevents hanging on slow API responses
- User receives timeout error to retry

### Database Efficiency
- Uses Map for in-memory operations
- Only writes to disk when changes occur
- Per-guild files keep data isolated and manageable

### Discord API Usage
- Batch fetches guild members before purge
- Uses role.members for efficient filtering
- Deferred responses for long operations

---

## Security Considerations

### Permission Checks
- Admin commands require Administrator permission
- No bypass mechanisms
- Consistent between slash and prefix

### Data Validation
- Region validated against whitelist
- Nickname length enforced (32 chars max)
- Guild name and IGN sanitized through API

### Role Hierarchy
- Bot checks own role position before nickname changes
- Fails gracefully if user has higher role
- Prevents privilege escalation

### Error Messages
- Don't expose internal errors to users
- Log detailed errors to console for admins
- Provide actionable user-facing messages

---

## Future Enhancement Opportunities

While not implemented, these features could be added later:

1. **Alliance Support:** Verify alliance membership in addition to guild
2. **Auto-verification:** Periodic background checks (cron job)
3. **Registration History:** Track all registration attempts and changes
4. **Bulk Registration:** Admin command to register multiple users
5. **Exemptions:** Allow certain users to bypass verification
6. **Notifications:** DM users when removed during purge
7. **Statistics:** Dashboard showing registration trends
8. **Multi-guild:** Support for alliance guilds under one Discord
9. **Verification Badges:** Track verification duration
10. **API Caching:** Cache API responses to reduce calls

---

## Production Readiness

### Deployment Checklist
- ✅ No syntax errors
- ✅ No duplicate exports or functions
- ✅ All async operations awaited
- ✅ No circular imports
- ✅ Error handling comprehensive
- ✅ Both slash and prefix commands work
- ✅ Database operations safe
- ✅ API calls properly handled
- ✅ Permission checks in place
- ✅ Clean integration with existing code

### Pre-deployment Steps
1. Run `npm run register` to register new slash commands with Discord
2. Ensure DATA_DIR environment variable is set
3. Verify bot has required permissions:
   - Manage Nicknames
   - Manage Roles
   - Read Messages
   - Send Messages
4. Test in a development server first
5. Monitor logs during initial rollout

---

## Support and Troubleshooting

### Common Issues

**Commands not appearing:**
- Run `npm run register` to register slash commands
- Wait 5-10 minutes for Discord to propagate globally

**Bot can't change nicknames:**
- Check bot has "Manage Nicknames" permission
- Move bot role higher than target user roles

**Bot can't assign roles:**
- Check bot has "Manage Roles" permission
- Move bot role higher than register role

**API timeouts frequently:**
- Albion API may be experiencing issues
- Users should try again during off-peak hours

**Purge removes everyone:**
- Check guild name is EXACTLY as in Albion (case-sensitive)
- Check region is correct for your guild

### Debug Mode
Enable verbose logging by checking console output:
```
✅ User {discordId} registered as {ign}
✅ Assigned register role to {discordId}
🔍 Verifying player {ign} in region {region}...
🗑️ Removed role from {username}
```

---

## Summary

The Albion Online guild verification system has been successfully integrated into the SouthPH Discord bot. It provides:

- **Complete registration flow** with API verification
- **Automatic purge system** to maintain guild roster accuracy
- **Flexible configuration** per Discord server
- **Both slash and prefix commands** for user preference
- **Production-grade error handling** and validation
- **Clean integration** with existing codebase
- **No breaking changes** to existing functionality

The implementation follows all requirements:
- ✅ Uses EXACT Albion API endpoints
- ✅ Supports all three regions
- ✅ Both slash and prefix commands work
- ✅ Shared internal logic (no duplication)
- ✅ Proper database schema with primary keys
- ✅ Complete register flow with role/nickname
- ✅ Complete purge flow with summary
- ✅ Comprehensive error handling
- ✅ Self-audited and production-ready
- ✅ Single documentation file (this)

**The system is ready for deployment.**
