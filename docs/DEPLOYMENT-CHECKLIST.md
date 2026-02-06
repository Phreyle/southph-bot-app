# 🚀 Ticket System Deployment Checklist

## Pre-Deployment Checks

### 1. Environment Setup
- [ ] Node.js 18+ installed
- [ ] Discord.js v14 dependencies installed (`npm install`)
- [ ] `.env` file configured with:
  - [ ] `DISCORD_TOKEN`
  - [ ] `PUBLIC_KEY`
  - [ ] `DATA_DIR` (optional, defaults to `/home/container/data`)

### 2. Bot Configuration
- [ ] Bot invited to Discord server
- [ ] Developer Mode enabled in Discord settings
- [ ] Bot permissions configured:
  - [ ] View Channels
  - [ ] Send Messages
  - [ ] Embed Links
  - [ ] Manage Channels
  - [ ] Manage Roles
  - [ ] Manage Nicknames
  - [ ] Read Message History

### 3. Bot Role Hierarchy
- [ ] Bot role is positioned ABOVE:
  - [ ] Approval role (role to assign on approval)
  - [ ] Any staff roles
- [ ] Bot role is positioned BELOW server owner only

## Server Preparation

### 4. Discord Server Setup
- [ ] Category created for tickets (e.g., "📋 APPLICATIONS")
  - [ ] Category ID copied
- [ ] Staff role(s) created or identified
  - [ ] Staff role ID(s) copied
- [ ] Approval role created or identified
  - [ ] Approval role ID copied
- [ ] Ping role created or identified (can be same as staff)
  - [ ] Ping role ID copied
- [ ] Transcript channel created (e.g., "#ticket-logs")
  - [ ] Transcript channel ID copied
- [ ] Apply channel created (e.g., "#apply-here")

## Docker Setup (If Using Docker)

### 5. Docker Configuration
- [ ] Dockerfile exists and is configured correctly
- [ ] docker-compose.yml configured (if using)
- [ ] Volume mount configured: `./data:/data`
- [ ] Environment variables set in docker-compose.yml or Dockerfile

### 6. Data Directory
- [ ] `/data` directory exists or will be created by container
- [ ] Proper permissions set for data directory
- [ ] Volume is persistent (survives container restarts)

## Initial Bot Deployment

### 7. Start Bot
```bash
# Local development
npm start

# Docker
docker-compose up -d
# or
docker run -d -v ./data:/data your-bot-image
```

- [ ] Bot starts without errors
- [ ] Bot connects to Discord
- [ ] Console shows: "✅ Logged in as [Bot Name]"
- [ ] Bot appears online in Discord

### 8. Test Basic Functionality
- [ ] Bot responds to existing commands (e.g., `!help`)
- [ ] No errors in console

## Ticket System Configuration

### 9. Configure Ticket Panel

Run the setup command in Discord:
```
!ticketsetup apply "Apply" <categoryId> <pingRoleId> <staffRoleIds> <approveRoleId> <transcriptChannelId> "SOUTH | {username}"
```

- [ ] Command executed successfully
- [ ] Confirmation embed received
- [ ] No errors in console

**Example:**
```
!ticketsetup apply "Apply" 1234567890123456789 9876543210987654321 1111222233334444555,6666777788889999000 5555666677778888999 4444555566667777888 "SOUTH | {username}"
```

### 10. Verify Panel Configuration
```
!ticketpanels
```

- [ ] Panel appears in list
- [ ] All IDs are correct
- [ ] Roles are properly tagged
- [ ] Channels are properly tagged

### 11. Create Apply Panel
In the #apply-here channel:
```
!applypanel
```

- [ ] Apply button appears
- [ ] Embed displays correctly
- [ ] Button is clickable

## Testing Phase

### 12. Test Ticket Creation (As Regular User)

- [ ] Click "Apply" button
- [ ] Ticket channel is created (`ticket-001`)
- [ ] User can see and access the channel
- [ ] User can send messages
- [ ] "Ticket Opened" embed appears in transcript channel
- [ ] Control buttons appear (Close, Claim, Approve)

### 13. Test Message Logging

- [ ] Send message as regular user
- [ ] Send message as staff member
- [ ] Messages are logged (verify in transcript channel later)

### 14. Test Claim Functionality (As Staff)

- [ ] Click "Claim Ticket" button
- [ ] Confirmation message appears
- [ ] No errors in console

### 15. Test Close Functionality (As Staff or User)

Create a test ticket and:
```
Test Close:
```
- [ ] Click "Close Ticket" button
- [ ] "Ticket Closed" embed appears in transcript channel
- [ ] Staff message count is correct
- [ ] Close reason shows "No Reason Provided"
- [ ] Channel deletes after 5 seconds

### 16. Test Approve Functionality (As Staff)

Create another test ticket and:
```
Test Approve:
```
- [ ] Click "Approve" button
- [ ] Role is assigned to ticket author
- [ ] Nickname is changed (format: "SOUTH | username")
- [ ] "Ticket Closed" embed appears in transcript channel
- [ ] Close reason shows "Approved"
- [ ] Staff message count is included
- [ ] Channel deletes after 5 seconds

### 17. Test Duplicate Prevention

- [ ] User with open ticket tries to open another
- [ ] Error message appears with link to existing ticket
- [ ] No duplicate channel created

## Advanced Testing

### 18. Test Edge Cases

- [ ] Bot role moved below approval role (should fail gracefully)
- [ ] Bot missing "Manage Channels" permission (should show error)
- [ ] Invalid panel configuration (should show appropriate errors)
- [ ] Ticket author leaves server (verify no crashes)

### 19. Test Statistics Commands

```
!ticketstats
```
- [ ] Statistics display correctly
- [ ] Counts are accurate

```
!tickethealth
```
- [ ] Health check runs
- [ ] Status is "healthy" or shows issues
- [ ] No false positives

### 20. Test Multi-Guild (If Bot is in Multiple Servers)

In second server:
- [ ] Configure separate panel
- [ ] Create ticket
- [ ] Verify data is isolated
- [ ] Ticket IDs are separate
- [ ] No cross-contamination

## Production Deployment

### 21. Monitoring Setup

- [ ] Console logging working
- [ ] Error logging configured
- [ ] Log rotation set up (if applicable)

### 22. Backup Strategy

- [ ] Data directory backed up regularly
- [ ] Backup restoration tested
- [ ] Backup schedule established

### 23. Documentation

- [ ] Staff trained on ticket system
- [ ] User instructions posted (how to apply)
- [ ] Admin documentation accessible
- [ ] Troubleshooting guide available

### 24. Performance Check

- [ ] Bot responds quickly to button clicks
- [ ] No lag in ticket creation
- [ ] File operations complete in reasonable time
- [ ] No memory leaks after extended operation

## Post-Deployment

### 25. Monitor for 24 Hours

- [ ] Check logs for errors
- [ ] Monitor ticket creation rate
- [ ] Verify transcripts are saving correctly
- [ ] Check data directory size growth

### 26. User Feedback

- [ ] Staff can use system effectively
- [ ] Users understand application process
- [ ] No confusion about buttons
- [ ] Approval process works smoothly

### 27. Optimization (If Needed)

- [ ] Adjust nickname format if needed
- [ ] Modify embed colors/formatting
- [ ] Add additional panels for different ticket types
- [ ] Configure multiple apply channels

## Maintenance Schedule

### Weekly
- [ ] Check !tickethealth status
- [ ] Review !ticketstats
- [ ] Check for old unclaimed tickets

### Monthly
- [ ] Archive old transcripts (if needed)
- [ ] Review and update panel configurations
- [ ] Check data directory size

### As Needed
- [ ] Update bot dependencies
- [ ] Add new features
- [ ] Adjust configurations based on server needs

## Troubleshooting Quick Reference

### Issue: Tickets not creating
**Solution:**
1. Check bot permissions (Manage Channels)
2. Verify category ID is correct
3. Check console for errors
4. Run !tickethealth

### Issue: Role not assigned on approve
**Solution:**
1. Check bot role hierarchy
2. Verify bot has Manage Roles permission
3. Confirm role ID in panel config

### Issue: Nickname not changing
**Solution:**
1. Check bot role is above user's highest role
2. Verify bot has Manage Nicknames permission
3. Note: Cannot change server owner's nickname

### Issue: Transcripts not appearing
**Solution:**
1. Verify transcript channel ID
2. Check bot permissions in transcript channel
3. Ensure bot has Embed Links permission

### Issue: "Ticket system is not configured"
**Solution:**
1. Run !ticketsetup command
2. Verify panel was created with !ticketpanels

## Sign-Off

- [ ] All checks completed
- [ ] System tested thoroughly
- [ ] Staff trained
- [ ] Documentation complete
- [ ] Monitoring in place
- [ ] Backup strategy configured

**Deployment Date:** _______________

**Deployed By:** _______________

**Sign-Off:** _______________

---

## Support Resources

- **Documentation:** TICKET-README.md
- **Flow Diagrams:** TICKET-FLOW.md
- **Implementation Details:** IMPLEMENTATION-SUMMARY.md
- **Setup Guide:** examples/ticket-setup-guide.js

---

✅ **System Ready for Production**
