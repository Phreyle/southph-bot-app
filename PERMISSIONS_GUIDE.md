# Role-Based Permission System Guide

## Overview
The bot now supports a **role-based permission system** that allows you to grant specific Discord roles access to admin commands without giving them full Discord Administrator permissions.

This creates a three-tier permission hierarchy:
1. **SuperAdmin** - Discord users with Administrator permission (full access to everything)
2. **Admin** - Discord roles assigned via the permissions system (access to specific command groups)
3. **User** - Regular Discord members (access to basic commands only)

---

## Permission Types

### 🏦 Bank Admin Roles (`bank`)
Roles with this permission can use all bank management commands:
- `/bank deposit` or `!bank deposit` - Add silver to user accounts
- `/bank withdraw` or `!bank withdraw` - Remove silver from user accounts
- `/bank clear` or `!bank clear` - Clear specific user balances
- `/bank clearall` or `!bank clearall` - Clear all balances

### ⚔️ CTA Regear Roles (`cta`)
Roles with this permission can use regear commands:
- `/ctaregear [title]` - Create CTA (Call to Action) regear threads

---

## Setup Instructions

### Step 1: Get Your Role ID
1. Enable Developer Mode in Discord:
   - User Settings → Advanced → Enable "Developer Mode"
2. Right-click on the role you want to authorize
3. Click "Copy Role ID"
4. Save this ID for the next step

### Step 2: Assign Permissions
Use the `!perms` command (requires Discord Administrator permission):

#### Add a role to Bank Admin permissions:
```
!perms add bank @RoleName
```
Or using Role ID:
```
!perms add bank <role_id>
```

#### Add a role to CTA Regear permissions:
```
!perms add cta @RoleName
```

#### View current permissions:
```
!perms list
```

#### Remove a role from permissions:
```
!perms remove bank @RoleName
!perms remove cta @RoleName
```

---

## Example Usage

### Scenario: Guild Officer Setup
You want your "Officers" role to manage bank operations and create regear threads:

```bash
# Add Officers to bank permissions
!perms add bank @Officers

# Add Officers to CTA regear permissions
!perms add cta @Officers

# Verify the setup
!perms list
```

Now anyone with the "Officers" role can:
- Manage bank deposits/withdrawals
- Create CTA regear threads
- But they cannot change the bot prefix or manage permissions (Admin only)

---

## Permission Management Commands

All permission management commands require **Discord Administrator** permission:

| Command | Description |
|---------|-------------|
| `!perms list` | View all assigned role permissions |
| `!perms add bank @role` | Grant bank admin permission to a role |
| `!perms add cta @role` | Grant CTA regear permission to a role |
| `!perms remove bank @role` | Revoke bank admin permission from a role |
| `!perms remove cta @role` | Revoke CTA regear permission from a role |

**Aliases:** `!permissions` or `!perms`

---

## Configuration File

Role permissions are stored in `permissions-config.json`:

```json
{
  "bankAdminRoles": ["1234567890123456789"],
  "ctaRegearRoles": ["1234567890123456789", "9876543210987654321"]
}
```

**Important Notes:**
- This file is automatically created and managed by the bot
- Manual editing is possible but not recommended
- Role IDs must be valid Discord role IDs
- The file is read on every permission check (no restart needed)

---

## Security Considerations

### ✅ Best Practices
1. **Only grant permissions to trusted roles**
2. **Regularly audit permissions** using `!perms list`
3. **Use specific roles** rather than broad server roles
4. **Keep Discord Administrator** for guild leadership only
5. **Test permissions** after assigning to verify correct behavior

### ⚠️ Important Notes
- Discord Administrators **always** have access to all commands
- Regular users **cannot** bypass permission checks
- Permission checks happen **before** command execution
- Invalid role IDs are safely ignored

---

## Troubleshooting

### "You need Administrator permission or an authorized role"
**Problem:** User cannot use a command despite having a role assigned.

**Solutions:**
1. Verify the role is properly assigned: `!perms list`
2. Check the user actually has the role in Discord
3. Ensure the role ID is correct (re-add if necessary)
4. Make sure the user is not using DMs (commands only work in servers)

### Role not showing in `!perms list`
**Problem:** Role was added but doesn't appear in the list.

**Solutions:**
1. Check for typos when adding the role
2. Use `@mention` when adding roles, not manual IDs
3. Verify the role wasn't deleted from Discord
4. Check `permissions-config.json` for the role ID

### Permission changes not taking effect
**Problem:** Changes to permissions don't seem to work.

**Solutions:**
1. No restart is needed - changes are immediate
2. User must have the role assigned in Discord
3. Try removing and re-adding the role permission
4. Verify no typos in command usage

---

## Command Examples

```bash
# View help for permission commands
!perms

# List all current role permissions
!perms list

# Add "Bank Manager" role to bank permissions
!perms add bank @Bank Manager

# Add "Event Coordinator" role to CTA permissions
!perms add cta @Event Coordinator

# Remove a role from permissions
!perms remove bank @Former Officer

# Multiple roles can have the same permission
!perms add bank @Officers
!perms add bank @Guild Leader
!perms add bank @Treasurer
```

---

## Migration from Old System

If you were previously using Discord Administrator permission for all commands:

### Before:
- Only Discord Admins could use bank commands
- No granular permission control

### After:
1. Identify which users need bank access
2. Create a Discord role (e.g., "Bank Admin")
3. Assign that role to appropriate users
4. Add the role to bank permissions: `!perms add bank @Bank Admin`
5. Users now have bank access without full admin rights

---

## FAQ

**Q: Can I assign multiple roles to the same permission type?**  
A: Yes! You can add as many roles as needed to each permission type.

**Q: Do I need to restart the bot after changing permissions?**  
A: No, permission changes take effect immediately.

**Q: Can regular users see who has what permissions?**  
A: No, only Discord Administrators can use the `!perms` command.

**Q: What happens if a role is deleted from Discord?**  
A: The role ID remains in the config but won't grant access. You should remove it with `!perms remove`.

**Q: Can I use this with slash commands and prefix commands?**  
A: Yes! The permission system works for both `/bank deposit` and `!bank deposit` style commands.

**Q: Will this work in DMs?**  
A: No, role-based permissions only work in Discord servers where roles exist.

---

## Support

For issues or questions:
1. Check this guide first
2. Use `!perms` to see command usage
3. Use `!help` to see all available commands
4. Verify your role IDs are correct
5. Check the bot has proper permissions in Discord

---

## Version Information
- **Added:** January 2026
- **Supported Commands:** Bank operations, CTA Regear
- **Configuration File:** `permissions-config.json`
- **Admin Commands:** `!perms`, `!permissions`

