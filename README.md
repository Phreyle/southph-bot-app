# SouthPH Bot - Albion Online Discord Bot

A Discord bot for Albion Online guilds featuring automatic guild verification, content management, ticket systems, and virtual economy.

---

## 🌟 Features

- **🎮 Guild Verification** - Automatically verify members are in your Albion guild
- **💰 Virtual Bank** - Track virtual currency for guild activities
- **🎯 Content Management** - Organize group content with role signups
- **🎫 Ticket System** - Application and support tickets
- **⚔️ Regear Threads** - Manage regear requests for CTA/FF

---

## 📖 Getting Started

### For Members

1. **Register your character:**
   ```
   /register region:americas ign:YourCharacterName
   ```
   This verifies you're in the guild and assigns you the verified role.

2. **Sign up for content:**
   - When content is posted, go to the thread
   - Type `x tank` (or your role) to sign up
   - Type `x fill` to sign up as any role
   - Type `x cancel` to remove yourself

3. **Check your bank balance:**
   ```
   /bank balance
   ```

---

## 👤 User Commands

### General Commands
| Command | Description |
|---------|-------------|
| `/help` | Show all available commands |
| `/utc` | Display current UTC time (Albion game time) |
| `/info <playername>` | Search for any Albion player |

### Albion Verification
| Command | Description |
|---------|-------------|
| `/register <region> <ign>` | Register your character (verifies guild membership) |
| `/unregister` | Unregister your character from the system |
| `/config view` | View guild verification settings |

**Regions:** `americas`, `europe`, `asia`

### Bank Commands
| Command | Description |
|---------|-------------|
| `/bank balance [@user]` | Check your balance or another user's |
| `/bank active` | See all members with bank balances |

### Content Threads
When admins post content, interact in the thread using:
- `x <role>` - Sign up for a specific role (e.g., `x tank`, `x heal`, `x dps`)
- `x fill` - Sign up to fill any available slot
- `x cancel` - Remove yourself from the content

---

## 🛡️ Admin Commands

### Albion Verification Management
| Command | Description |
|---------|-------------|
| `/set guild <region> <name>` | Configure your guild and region |
| `/set register-role @role` | Set the role given to verified members |
| `/set guild-tag <tag>` | Set guild tag for nicknames (e.g., SOUTH) |
| `/set nickname-format <format>` | Set nickname format |
| `/forceunregister <ign>` | Force unregister a member by in-game name |
| `/purge confirm` | Remove members no longer in the guild |

**Nickname Format Variables:**
- `{ign}` - In-game name
- `{tag}` - Guild tag
- `{guild}` - Guild name
- `{region}` - Region (uppercase)

**Examples:**
- `{tag} {ign}` → "SOUTH PlayerName"
- `{ign} | {guild}` → "PlayerName | YourGuild"

### Bank Management
| Command | Description |
|---------|-------------|
| `/bank deposit @user <amount>` | Add money to a user's account |
| `/bank withdraw @user <amount>` | Remove money from a user's account |
| `/bank clear @user` | Clear a specific user's balance |
| `/bank clearall` | Clear all balances (use with caution) |

### Content Management
| Command | Description |
|---------|-------------|
| `/content create` | Create content callout (ROA/CTA/GCAMPS/FF/Tracking/Avadungeon) |
| `/content reset` | Reset content system for new callout |
| `/content adduser @user [role]` | Manually add user to a role slot |
| `/content removeuser [role]` | Remove user from a role slot |

**Content Types:**
- **ROA** - Roads of Avalon (7 fixed roles + fill)
- **CTA** - Crystal Territory Attack (tank/heal/dps/support/dtank)
- **GCAMPS** - Group Camps (5 fixed roles + fill)
- **FF** - Faction Warfare (tank/heal/dps)
- **Tracking** - Crystal League (5 fixed roles + fill)
- **Avadungeon** - Avalonian Dungeon (10 fixed roles + fill)

### Regear Management
| Command | Description |
|---------|-------------|
| `/regear create <type> <title> <time>` | Create regear thread (CTA or FF) |
| `/regear close` | Close and lock the regear thread |

### Ticket System
| Command | Description |
|---------|-------------|
| `/ticket setup` | Create a new ticket panel |
| `/ticket list` | List all ticket panels |
| `/ticket panel [id]` | Send ticket button to channel |
| `/ticket delete <id>` | Delete a ticket panel |
| `/ticket stats` | View ticket statistics |
| `/ticket health` | Run system health check |

### Permissions
| Command | Description |
|---------|-------------|
| `!prefix <new>` | Change the bot's prefix |
| `/perms list` | View role permissions |
| `/perms add <bank\|cta\|content> @role` | Grant role permission |
| `/perms remove <bank\|cta\|content> @role` | Revoke role permission |

**Permission Types:**
- `bank` - Allow role to manage bank deposits/withdrawals
- `cta` - Allow role to create regear threads
- `content` - Allow role to create and manage content callouts

---

## ❓ Frequently Asked Questions

**Q: Why can't I register?**
- Make sure you're using your exact in-game name (case-sensitive)
- Verify you're actually in the guild in Albion Online
- Check you selected the correct region

**Q: How do I change my registered character?**
- Use `/unregister` first, then `/register` with your new character

**Q: My nickname didn't change, why?**
- The bot needs "Manage Nicknames" permission
- The bot's role must be higher than your highest role
- Contact an admin if issues persist

**Q: Can I register multiple characters?**
- No, only one character per Discord account
- Use `/unregister` to switch characters

**Q: What happens during a purge?**
- Bot checks all registered members against the Albion API
- Members no longer in the guild are automatically unregistered
- Their verified role is removed

---

## 🔐 Required Bot Permissions

For admins setting up the bot, ensure these permissions are enabled:
- Manage Nicknames
- Manage Roles
- Read Messages
- Send Messages
- Create Threads
- Manage Threads
- Embed Links
- Read Message History

---

## 📞 Support

For help or issues, contact your guild leadership through Discord.

---

**Built for Albion Online Guilds** 🛡️⚔️