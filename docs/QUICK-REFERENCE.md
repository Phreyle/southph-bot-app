# 🎫 Ticket System Quick Reference Card

## 📝 Setup (One-Time)

### Configure Panel
```
!ticketsetup <panelId> "<name>" <categoryId> <pingRoleId> <staffRoleIds> <approveRoleId> <transcriptChannelId> "<nickname>"
```

**Example:**
```
!ticketsetup apply "Apply" 123456 789012 111111,222222 333333 444444 "SOUTH | {username}"
```

### Create Apply Button
```
!applypanel
```

---

## 👥 User Actions

### Open Ticket
1. Click "Apply" button in apply channel
2. New ticket channel created automatically

### Close Own Ticket
Click "🔒 Close Ticket" button

---

## 🛠️ Staff Actions

### Claim Ticket
Click "✋ Claim Ticket" button

### Approve Application
Click "✅ Approve" button
- Assigns role
- Changes nickname
- Closes ticket

### Close Without Approval
Click "🔒 Close Ticket" button

---

## 📊 Admin Commands

### View All Panels
```
!ticketpanels
```

### View Statistics
```
!ticketstats
```

### Health Check
```
!tickethealth
```

### Delete Panel
```
!ticketdelete <panelId>
```

---

## 🔍 Quick Diagnostics

### Bot Not Responding?
1. Check bot is online
2. Check console for errors
3. Verify bot has required permissions

### Tickets Not Creating?
1. Verify panel exists: `!ticketpanels`
2. Check bot has "Manage Channels" permission
3. Verify category ID is correct

### Role Not Assigned?
1. Check bot role is above target role
2. Verify bot has "Manage Roles" permission
3. Confirm role ID in panel config

### Nickname Not Changing?
1. Check bot role is above user's roles
2. Verify bot has "Manage Nicknames" permission
3. Cannot change server owner nickname

---

## 📁 File Locations

### Guild Data
```
/data/guilds/{guildId}/
├── tickets.json
├── transcripts.json
├── panels.json
└── meta.json
```

---

## 🔑 Required Bot Permissions

- ✅ View Channels
- ✅ Send Messages
- ✅ Embed Links
- ✅ Manage Channels
- ✅ Manage Roles
- ✅ Manage Nicknames
- ✅ Read Message History

---

## 🎯 Ticket Status Flow

```
open → claimed → approved/closed
```

- **open**: Ticket just created
- **claimed**: Staff has claimed it
- **approved**: Staff approved (role + nickname)
- **closed**: Closed without approval

---

## 💡 Tips

- **Multiple Staff Roles**: Separate with commas, no spaces
  ```
  111111,222222,333333
  ```

- **Nickname Format**: Use `{username}` placeholder
  ```
  "SOUTH | {username}"
  ```

- **Get IDs**: Enable Developer Mode → Right-click → Copy ID

- **Test First**: Create test panel in test channel before production

- **Backups**: Data stored in `/data/guilds/` - back up regularly

---

## 🚨 Common Errors

| Error | Solution |
|-------|----------|
| "Ticket system is not configured" | Run `!ticketsetup` first |
| "You already have an open ticket" | Close existing ticket or use link |
| "Only staff members can..." | User lacks staff role |
| "Missing permissions" | Check bot role permissions |

---

## 📞 Need Help?

1. Check console for detailed errors
2. Run `!tickethealth` for diagnostics
3. Review TICKET-README.md
4. Check DEPLOYMENT-CHECKLIST.md

---

## 📈 Statistics Reference

```
!ticketstats
```

Shows:
- Total tickets created
- Currently open
- Currently claimed
- Total closed
- Total approved
- Last ticket ID

---

## 🎨 Embed Colors

- 🟦 Blue (0x5865F2): Info/Header
- 🟩 Green (0x57F287): Success
- 🟥 Red (0xED4245): Close/Error

---

**Keep this card handy for daily operations!**

---

Last Updated: February 6, 2026
Version: 1.0
