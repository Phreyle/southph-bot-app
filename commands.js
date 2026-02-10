import 'dotenv/config';
import { InstallGlobalCommands } from './utils.js';

// UTC command for Albion Online in-game time
const UTC_COMMAND = {
  name: 'utc',
  description: 'Display current UTC time (Albion Online in-game time)',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
};

// Info command for Albion Online player lookup
const INFO_COMMAND = {
  name: 'info',
  description: 'Search for an Albion Online player across all regions',
  options: [
    {
      type: 3, // STRING
      name: 'playername',
      description: 'The player name to search for',
      required: true,
    },
  ],
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
};

// Help command
const HELP_COMMAND = {
  name: 'help',
  description: 'Show available bot commands and information',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
};

// Content command for Albion Online content callouts (ROA/CTA/GCAMPS/FF)
const CONTENT_COMMAND = {
  name: 'content',
  description: 'Manage content callouts',
  options: [
    {
      type: 1, // SUB_COMMAND
      name: 'create',
      description: 'Create a new content callout',
      options: [
        {
          type: 3,
          name: 'content_type',
          description: 'Type of content',
          required: true,
          choices: [
            { name: 'ROA', value: 'roa' },
            { name: 'CTA', value: 'cta' },
            { name: 'GCAMPS', value: 'gcamps' },
            { name: 'FF', value: 'ff' },
            { name: 'Tracking', value: 'tracking' },
            { name: 'Ava Dungeon', value: 'avadungeon' }
          ],
        },
        {
          type: 3,
          name: 'title',
          description: 'Title for the content thread',
          required: true,
        },
        {
          type: 3,
          name: 'zone',
          description: 'Zone/Location (e.g., Brecilien, Caerleon)',
          required: true,
        },
        {
          type: 4, // INTEGER
          name: 'tier',
          description: 'Gear tier requirement (1-12)',
          required: true,
          min_value: 1,
          max_value: 12,
        },
        {
          type: 3,
          name: 'time',
          description: 'Time for the content (e.g., 20:00 UTC)',
          required: true,
        },
        {
          type: 3,
          name: 'demass_notice',
          description: 'demass notice message',
          required: false,
        }
      ],
    },
    {
      type: 1, // SUB_COMMAND
      name: 'adduser',
      description: 'Add a user to a role slot',
      options: [
        {
          type: 6, // USER
          name: 'user',
          description: 'The user to add',
          required: true,
        },
        {
          type: 3,
          name: 'role',
          description: 'The role slot to assign (ROA/GCAMPS use fixed roles, CTA/FF use categories)',
          required: true,
          choices: [
            { name: '🛡️ Tank', value: 'tank' },
            { name: '💚 Heal', value: 'heal' },
            { name: '🗡️ DPS (CTA/FF)', value: 'dps' },
            { name: '🛡️ Support (CTA/FF)', value: 'support' },
            { name: '🏃 Dtank (CTA/FF)', value: 'dtank' },
            { name: '🔮 Shadowcaller (ROA/GCAMPS)', value: 'shadowcaller' },
            { name: '🔥 Blazing (ROA/GCAMPS)', value: 'blazing' },
            { name: '⚔️ MP (ROA only)', value: 'mp' },
            { name: '⚔️ MP2 (ROA only)', value: 'mp2' },
            { name: '✨ Flex/MP/LC/ARCTIC/PERMA (ROA only)', value: 'flex' },
            { name: '🗡️ Badon (GCAMPS only)', value: 'badon' },
            { name: '🗡️ DPAIR (Tracking only)', value: 'dpair' },
            { name: '⚔️ HP CUT(RB/FORCEPULSE) (Tracking only)', value: 'hpcut' },
            { name: '✨ FLEX DPS (Tracking only)', value: 'flexdps' },
          ],
        },
      ],
    },
    {
      type: 1, // SUB_COMMAND
      name: 'removeuser',
      description: 'Remove a user from a role slot',
      options: [
        {
          type: 3,
          name: 'role',
          description: 'The role slot to clear (ROA/GCAMPS use fixed roles)',
          required: true,
          choices: [
            { name: '🛡️ Tank', value: 'tank' },
            { name: '💚 Heal', value: 'heal' },
            { name: '🗡️ DPS (CTA/FF)', value: 'dps' },
            { name: '🛡️ Support (CTA/FF)', value: 'support' },
            { name: '🏃 Dtank (CTA/FF)', value: 'dtank' },
            { name: '🔮 Shadowcaller (ROA/GCAMPS)', value: 'shadowcaller' },
            { name: '🔥 Blazing (ROA/GCAMPS)', value: 'blazing' },
            { name: '⚔️ MP (ROA only)', value: 'mp' },
            { name: '⚔️ MP2 (ROA only)', value: 'mp2' },
            { name: '✨ Flex (ROA only)', value: 'flex' },
            { name: '🗡️ Badon (GCAMPS only)', value: 'badon' },
            { name: '🗡️ DPAIR (Tracking only)', value: 'dpair' },
            { name: '⚔️ HP CUT(RB/FORCEPULSE) (Tracking only)', value: 'hpcut' },
            { name: '✨ FLEX DPS (Tracking only)', value: 'flexdps' },
          ],
        },
      ],
    },
    {
      type: 1, // SUB_COMMAND
      name: 'reset',
      description: 'Reset the content callout (allows creating a new one)',
    },
  ],
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
};

// Unified Regear command
const REGEAR_COMMAND = {
  name: 'regear',
  description: 'Manage regear threads',
  options: [
    {
      type: 1, // SUB_COMMAND
      name: 'create',
      description: 'Create a new regear thread',
      options: [
        {
          type: 3,
          name: 'content_type',
          description: 'Type of content',
          required: true,
          choices: [
            { name: 'CTA', value: 'cta' },
            { name: 'FF', value: 'ff' },
          ],
        },
        {
          type: 3,
          name: 'title',
          description: 'Title for the regear thread',
          required: true,
        },
        {
          type: 3,
          name: 'time',
          description: 'Time for the regear (e.g., 20:00 UTC)',
          required: true,
        },
      ],
    },
    {
      type: 1, // SUB_COMMAND
      name: 'close',
      description: 'Close a regear thread (locks & marks complete)',
    },
  ],
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
};

// Bank command with subcommands
const BANK_COMMAND = {
  name: 'bank',
  description: 'Bank economy system',
  options: [
    {
      type: 1, // SUB_COMMAND
      name: 'deposit',
      description: 'Deposit money to a user (Admin only)',
      options: [
        {
          type: 6, // USER
          name: 'user',
          description: 'The user to deposit money to',
          required: true,
        },
        {
          type: 4, // INTEGER
          name: 'amount',
          description: 'Amount to deposit',
          required: true,
          min_value: 1,
        },
      ],
    },
    {
      type: 1, // SUB_COMMAND
      name: 'withdraw',
      description: 'Withdraw money from a user (Admin only)',
      options: [
        {
          type: 6, // USER
          name: 'user',
          description: 'The user to withdraw money from',
          required: true,
        },
        {
          type: 4, // INTEGER
          name: 'amount',
          description: 'Amount to withdraw',
          required: true,
          min_value: 1,
        },
      ],
    },
    {
      type: 1, // SUB_COMMAND
      name: 'balance',
      description: 'Check balance',
      options: [
        {
          type: 6, // USER
          name: 'user',
          description: 'Check another user\'s balance (optional)',
          required: false,
        },
      ],
    },
    {
      type: 1, // SUB_COMMAND
      name: 'active',
      description: 'List all users with money',
    },
    {
      type: 1, // SUB_COMMAND
      name: 'clear',
      description: 'Clear a specific user\'s balance (Admin only)',
      options: [
        {
          type: 6, // USER
          name: 'user',
          description: 'The user to clear balance from',
          required: true,
        },
      ],
    },
    {
      type: 1, // SUB_COMMAND
      name: 'clearall',
      description: 'Clear all users\' balances (Admin only)',
    },
  ],
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
};

// Permissions management command
const PERMS_COMMAND = {
  name: 'perms',
  description: 'Manage role permissions (Admin only)',
  options: [
    {
      type: 1, // SUB_COMMAND
      name: 'list',
      description: 'View all assigned role permissions',
    },
    {
      type: 1, // SUB_COMMAND
      name: 'add',
      description: 'Grant permission to a role',
      options: [
        {
          type: 3, // STRING
          name: 'type',
          description: 'Permission type',
          required: true,
          choices: [
            { name: 'Bank Admin', value: 'bank' },
            { name: 'CTA Regear', value: 'cta' },
          ],
        },
        {
          type: 8, // ROLE
          name: 'role',
          description: 'The role to grant permission to',
          required: true,
        },
      ],
    },
    {
      type: 1, // SUB_COMMAND
      name: 'remove',
      description: 'Revoke permission from a role',
      options: [
        {
          type: 3, // STRING
          name: 'type',
          description: 'Permission type',
          required: true,
          choices: [
            { name: 'Bank Admin', value: 'bank' },
            { name: 'CTA Regear', value: 'cta' },
          ],
        },
        {
          type: 8, // ROLE
          name: 'role',
          description: 'The role to revoke permission from',
          required: true,
        },
      ],
    },
  ],
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
};

// Ticket management command (Admin only)
const TICKET_COMMAND = {
  name: 'ticket',
  description: 'Manage ticket system panels (Admin only)',
  options: [
    {
      type: 1, // SUB_COMMAND
      name: 'setup',
      description: 'Setup or update a ticket panel',
      options: [
        {
          type: 3, // STRING
          name: 'panel_id',
          description: 'Unique panel identifier (e.g., "apply", "support")',
          required: true,
        },
        {
          type: 3,
          name: 'ticket_type',
          description: 'Display name for this ticket type (e.g., "Apply", "Support")',
          required: true,
        },
        {
          type: 3, // STRING
          name: 'category',
          description: 'Category ID where ticket channels will be created',
          required: true,
        },
        {
          type: 8, // ROLE
          name: 'ping_role',
          description: 'Role to ping when a ticket is created',
          required: true,
        },
        {
          type: 3,
          name: 'staff_roles',
          description: 'Staff role IDs (comma-separated, no spaces)',
          required: true,
        },
        {
          type: 7, // CHANNEL
          name: 'transcript_channel',
          description: 'Channel where ticket transcripts will be posted',
          required: true,
        },
      ],
    },
    {
      type: 1, // SUB_COMMAND
      name: 'list',
      description: 'List all configured ticket panels',
    },
    {
      type: 1, // SUB_COMMAND
      name: 'delete',
      description: 'Delete a ticket panel',
      options: [
        {
          type: 3,
          name: 'panel_id',
          description: 'Panel ID to delete',
          required: true,
        },
      ],
    },
    {
      type: 1, // SUB_COMMAND
      name: 'stats',
      description: 'View ticket statistics',
    },
    {
      type: 1, // SUB_COMMAND
      name: 'health',
      description: 'Run ticket system health check',
    },
    {
      type: 1, // SUB_COMMAND
      name: 'panel',
      description: 'Send the apply panel with button to current channel',
      options: [
        {
          type: 3,
          name: 'panel_id',
          description: 'Panel ID to send (default: apply)',
          required: false,
        },
        {
          type: 3,
          name: 'message',
          description: 'Custom message for the panel (e.g., "Join our guild! Click Apply below.")',
          required: false,
        },
      ],
    },
    {
      type: 1, // SUB_COMMAND
      name: 'reset',
      description: 'Reset all ticket data and counter (WARNING: Deletes all ticket history!)',
    },
  ],
  type: 1,
  default_member_permissions: '8', // Administrator only
  integration_types: [0],
  contexts: [0],
};

const ALL_COMMANDS = [UTC_COMMAND, INFO_COMMAND, HELP_COMMAND, CONTENT_COMMAND, REGEAR_COMMAND, BANK_COMMAND, PERMS_COMMAND, TICKET_COMMAND];

InstallGlobalCommands(process.env.APP_ID, ALL_COMMANDS);
