# 🎫 TicketKing-Style Discord Ticketing System

A guild-scoped Discord ticketing system with application flow, automatic role assignment, and nickname formatting on approval.

## ✨ Features

- **Guild-Scoped Storage**: Each Discord server has its own isolated ticket data
- **Panel System**: Configurable ticket panels with custom settings per guild
- **Application Flow**: Button-based ticket creation with staff management
- **Role Assignment**: Automatic role assignment on approval
- **Nickname Formatting**: Customizable nickname format (e.g., "SOUTH | {username}")
- **Transcripts**: Message logging with staff message counting
- **Atomic File Operations**: Safe persistent storage in Docker volumes

## 📁 Data Structure

All data is stored under `/data/guilds/{guildId}/`:

```
/data/guilds/{guildId}/
├── tickets.json       # Active and closed tickets
├── transcripts.json   # Message logs per ticket
├── panels.json        # Ticket panel configurations
└── meta.json          # Ticket counter and metadata
```

## 🚀 Setup Guide

### 1. Configure a Ticket Panel

Use the `!ticketsetup` command to create a panel configuration:

```
!ticketsetup apply "Apply" <categoryId> <pingRoleId> <staffRoleIds> <approveRoleId> <transcriptChannelId> [nicknameFormat]
```

**Parameters:**
- `panelId`: Identifier for the panel (e.g., "apply")
- `ticketType`: Display name (e.g., "Apply")
- `categoryId`: Discord category ID where tickets will be created
- `pingRoleId`: Role to ping when a new ticket is created
- `staffRoleIds`: Comma-separated list of staff role IDs (no spaces)
- `approveRoleId`: Role to assign on approval
- `transcriptChannelId`: Channel for ticket open/close notifications
- `nicknameFormat`: Optional - Format for nickname (default: "SOUTH | {username}")

**Example:**
```
!ticketsetup apply "Apply" 123456789012345678 987654321098765432 111222333444555666,777888999000111222 333444555666777888 444555666777888999 "SOUTH | {username}"
```

### 2. Create Apply Panel Button

Send the apply button to a channel:

```
!applypanel
```

This creates a message with an "Apply" button that users can click to open tickets.

### 3. List Panels

View all configured panels:

```
!ticketpanels
```

### 4. Delete a Panel

Remove a panel configuration:

```
!ticketdelete <panelId>
```

## 🎮 User Flow

### Opening a Ticket

1. User clicks the "Apply" button
2. System checks for duplicate open tickets
3. Creates a new ticket channel: `ticket-###`
4. Sets channel permissions (user + staff)
5. Sends notification to transcript channel
6. Initializes message logging

### Ticket Channel

The ticket channel includes three buttons:

- **🔒 Close Ticket**: Close without approval (staff or ticket author)
- **✋ Claim Ticket**: Claim ownership of the ticket (staff only)
- **✅ Approve**: Approve and assign role + nickname (staff only)

### Message Logging

All messages in ticket channels are automatically logged to transcripts with:
- Author information
- Staff detection
- Message content
- Timestamps

### Approval Process

When staff clicks "Approve":

1. Assigns the `approveRoleId` to the ticket author
2. Changes nickname using `nicknameFormat`
3. Saves transcript
4. Sends "Ticket Closed" embed to transcript channel with:
   - Ticket information
   - Open/close dates
   - Close reason
   - Staff message count
5. Deletes the ticket channel after 5 seconds

### Close Process

When closing without approval:

1. Saves transcript
2. Sends "Ticket Closed" embed (without role/nickname changes)
3. Deletes the ticket channel after 5 seconds

## 🔐 Permissions

### Admin Commands
- `!ticketsetup` - Administrator only
- `!ticketdelete` - Administrator only
- `!applypanel` - Administrator only

### Staff Actions
- Claim tickets - Staff roles only
- Approve tickets - Staff roles only
- Close tickets - Staff roles OR ticket author

### User Actions
- Open tickets - Any user
- Close own ticket - Ticket author

## 📊 Data Structures

### Ticket Object
```json
{
  "ticketId": 425,
  "guildId": "1234567890",
  "channelId": "9876543210",
  "panelId": "apply",
  "authorId": "1111111111",
  "claimedBy": null,
  "closedBy": null,
  "status": "open",
  "openDate": "2026-02-06T10:30:00.000Z",
  "closeDate": null,
  "closeReason": null
}
```

### Panel Config
```json
{
  "panelId": "apply",
  "ticketTypeName": "Apply",
  "ticketCategoryId": "123456789012345678",
  "pingRoleId": "987654321098765432",
  "staffRoleIds": ["111222333444555666", "777888999000111222"],
  "approveRoleId": "333444555666777888",
  "nicknameFormat": "SOUTH | {username}",
  "transcriptChannelId": "444555666777888999"
}
```

### Transcript
```json
{
  "ticketId": 425,
  "messages": [
    {
      "authorId": "1111111111",
      "authorTag": "user#0001",
      "isStaff": false,
      "content": "Hello, I would like to apply",
      "createdAt": "2026-02-06T10:31:00.000Z"
    }
  ],
  "staffMessageCount": 0
}
```

## 🛡️ Safety Features

### Guild Isolation
- Each guild has its own data directory
- No cross-guild data access
- Safe multi-server operation

### Atomic Writes
- Write to `.tmp` file first
- Rename on success
- Prevents corruption on crash

### Write Queuing
- One write at a time per guild
- Prevents race conditions
- Thread-safe operations

### Error Handling
- Permission failures don't crash the bot
- Nickname failures are logged and ignored
- Missing configurations return helpful messages
- Bot restarts resume correctly

## 🐳 Docker Configuration

The system uses persistent Docker volumes:

```dockerfile
# Dockerfile or docker-compose.yml
volumes:
  - ./data:/data
```

Environment variable:
```
DATA_DIR=/data
```

## 📝 Notes

- All file operations use `fs/promises` (async)
- No in-memory state caching
- Always reads from disk before writing
- Supports multiple guilds simultaneously
- Ticket IDs are guild-specific and sequential

## 🔧 Troubleshooting

### Tickets Not Creating
1. Check bot has `MANAGE_CHANNELS` permission
2. Verify category ID is correct
3. Ensure panel is configured with `!ticketpanels`

### Role/Nickname Not Applying
1. Check bot role hierarchy (bot role must be higher)
2. Verify bot has `MANAGE_ROLES` and `MANAGE_NICKNAMES` permissions
3. Check role ID in panel configuration

### Transcripts Not Appearing
1. Verify transcript channel ID is correct
2. Check bot can send messages in transcript channel
3. Ensure bot has `EMBED_LINKS` permission

## 📄 Files

- `ticket-db.js` - Database layer with atomic operations
- `ticket-system.js` - Core ticket functionality
- `ticket-commands.js` - Admin configuration commands
- `app.js` - Integration with Discord bot

## 🎯 Commands Reference

| Command | Permission | Description |
|---------|-----------|-------------|
| `!ticketsetup` | Administrator | Configure ticket panel |
| `!ticketpanels` | Everyone | List all panels |
| `!ticketdelete` | Administrator | Delete a panel |
| `!applypanel` | Administrator | Create apply button |
