/**
 * Ticket System Quick Setup Guide
 * 
 * This file contains instructions and examples for setting up the ticketing system.
 * Follow the steps below in your Discord server.
 */

/*
 * STEP 1: PREPARE YOUR SERVER
 * ============================
 * 
 * Create the following before configuring:
 * 
 * 1. A category for tickets (e.g., "📋 APPLICATIONS")
 *    - Right-click channel list > Create Category
 *    - Get ID: Enable Developer Mode > Right-click category > Copy ID
 * 
 * 2. Staff role(s) (e.g., "Staff", "Moderator")
 *    - Server Settings > Roles > Create or select existing
 *    - Get ID: Right-click role > Copy ID
 * 
 * 3. A role to assign on approval (e.g., "Member", "Approved")
 *    - Server Settings > Roles > Create or select existing
 *    - Get ID: Right-click role > Copy ID
 * 
 * 4. A role to ping for new tickets (e.g., "Support")
 *    - Can be same as staff role
 *    - Get ID: Right-click role > Copy ID
 * 
 * 5. A transcript channel (e.g., "#ticket-logs")
 *    - Create a text channel
 *    - Get ID: Right-click channel > Copy ID
 * 
 * 6. A channel for the apply button (e.g., "#apply-here")
 *    - Create a text channel
 */

/*
 * STEP 2: CONFIGURE PANEL
 * ========================
 * 
 * Run this command in Discord (replace IDs with your actual IDs):
 * 
 * !ticketsetup apply "Apply" CATEGORY_ID PING_ROLE_ID STAFF_ROLE_ID1,STAFF_ROLE_ID2 APPROVE_ROLE_ID TRANSCRIPT_CHANNEL_ID "SOUTH | {username}"
 * 
 * EXAMPLE with real-looking IDs:
 * !ticketsetup apply "Apply" 1234567890123456789 9876543210987654321 1111222233334444555,6666777788889999000 5555666677778888999 4444555566667777888 "SOUTH | {username}"
 * 
 * EXPLANATION:
 * - apply                     = Panel ID (identifier)
 * - "Apply"                   = Display name in embeds
 * - 1234567890123456789       = Category ID where tickets are created
 * - 9876543210987654321       = Role to ping when ticket opens
 * - 1111222233334444555,6666  = Staff role IDs (comma-separated, no spaces)
 * - 5555666677778888999       = Role to assign on approval
 * - 4444555566667777888       = Transcript channel ID
 * - "SOUTH | {username}"      = Nickname format (optional, this is default)
 */

/*
 * STEP 3: CREATE APPLY BUTTON
 * ============================
 * 
 * In the #apply-here channel, run:
 * 
 * !applypanel
 * 
 * This creates a message with the "Apply" button.
 */

/*
 * STEP 4: TEST THE SYSTEM
 * ========================
 * 
 * 1. Click the "Apply" button as a regular user
 * 2. Verify ticket channel is created
 * 3. Send a message in the ticket
 * 4. As staff, click "Claim Ticket"
 * 5. As staff, click "Approve"
 * 6. Check that:
 *    - Role was assigned
 *    - Nickname was changed
 *    - Transcript was posted
 *    - Channel was deleted
 */

/*
 * BOT PERMISSIONS REQUIRED
 * =========================
 * 
 * The bot needs these permissions:
 * 
 * - View Channels
 * - Send Messages
 * - Embed Links
 * - Manage Channels (to create ticket channels)
 * - Manage Roles (to assign approval role)
 * - Manage Nicknames (to change nickname)
 * - Read Message History
 * 
 * Grant these in Server Settings > Roles > [Bot Role]
 */

/*
 * ADDITIONAL COMMANDS
 * ===================
 * 
 * View all panels:
 * !ticketpanels
 * 
 * Delete a panel:
 * !ticketdelete apply
 * 
 * Update a panel:
 * Run !ticketsetup again with the same panelId
 */

/*
 * TROUBLESHOOTING
 * ===============
 * 
 * Issue: Bot can't create channels
 * Fix: Grant "Manage Channels" permission
 * 
 * Issue: Role not assigned on approve
 * Fix: 
 *   1. Move bot role above the target role in Server Settings > Roles
 *   2. Grant "Manage Roles" permission
 * 
 * Issue: Nickname not changing
 * Fix:
 *   1. Move bot role above user's highest role
 *   2. Grant "Manage Nicknames" permission
 *   3. Note: Server owner nicknames cannot be changed
 * 
 * Issue: "Ticket system is not configured"
 * Fix: Run !ticketsetup first
 * 
 * Issue: Transcripts not appearing
 * Fix: Check transcript channel ID and bot permissions in that channel
 */

// Example: Getting IDs with Developer Mode
// 1. User Settings > App Settings > Advanced > Enable Developer Mode
// 2. Right-click any channel/role/user > Copy ID

export default {
  exampleCommand: '!ticketsetup apply "Apply" 1234567890123456789 9876543210987654321 1111222233334444555,6666777788889999000 5555666677778888999 4444555566667777888 "SOUTH | {username}"',
  requiredPermissions: [
    'ViewChannel',
    'SendMessages',
    'EmbedLinks',
    'ManageChannels',
    'ManageRoles',
    'ManageNicknames',
    'ReadMessageHistory'
  ]
};
