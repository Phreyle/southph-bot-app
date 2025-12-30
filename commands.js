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

// Help command
const HELP_COMMAND = {
  name: 'help',
  description: 'Show available bot commands and information',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
};

// FFROA command for Albion Online role callout with subcommands
const FFROA_COMMAND = {
  name: 'ffroa',
  description: 'Manage FFROA role callout for Brecilien',
  options: [
    {
      type: 1, // SUB_COMMAND
      name: 'create',
      description: 'Create a new FFROA role callout (only once until reset)',
      options: [
        {
          type: 3,
          name: 'role',
          description: 'Your role for the raid',
          required: true,
          choices: [
            { name: 'Tank', value: 'tank' },
            { name: 'Heal', value: 'heal' },
            { name: 'Shadowcaller', value: 'shadowcaller' },
            { name: 'Blazing', value: 'blazing' },
            { name: 'MP', value: 'mp' },
            { name: 'MP2', value: 'mp2' },
            { name: 'Flex (MP/LC/ARCTIC/PERMA)', value: 'flex' },
          ],
        },
        {
          type: 3,
          name: 'title',
          description: 'Title for the FFROA thread',
          required: true,
        },
        {
          type: 3,
          name: 'location',
          description: 'Location for the raid (e.g., Brecilien, Caerleon)',
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
          description: 'The role slot to assign',
          required: true,
          choices: [
            { name: 'Tank', value: 'tank' },
            { name: 'Heal', value: 'heal' },
            { name: 'Shadowcaller', value: 'shadowcaller' },
            { name: 'Blazing', value: 'blazing' },
            { name: 'MP', value: 'mp' },
            { name: 'MP2', value: 'mp2' },
            { name: 'Flex (MP/LC/ARCTIC/PERMA)', value: 'flex' },
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
          description: 'The role slot to clear',
          required: true,
          choices: [
            { name: 'Tank', value: 'tank' },
            { name: 'Heal', value: 'heal' },
            { name: 'Shadowcaller', value: 'shadowcaller' },
            { name: 'Blazing', value: 'blazing' },
            { name: 'MP', value: 'mp' },
            { name: 'MP2', value: 'mp2' },
            { name: 'Flex (MP/LC/ARCTIC/PERMA)', value: 'flex' },
          ],
        },
      ],
    },
    {
      type: 1, // SUB_COMMAND
      name: 'reset',
      description: 'Reset the FFROA callout (allows creating a new one)',
    },
  ],
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
};

// CTA Regear command
const CTAREGEAR_COMMAND = {
  name: 'ctaregear',
  description: 'Create a CTA regear thread',
  options: [
    {
      type: 3,
      name: 'title',
      description: 'Title for the regear thread',
      required: true,
    },
  ],
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
};

// FF Regear command
const FFREGEAR_COMMAND = {
  name: 'ffregear',
  description: 'Create an FF regear thread',
  options: [
    {
      type: 3,
      name: 'title',
      description: 'Title for the regear thread',
      required: true,
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
  ],
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
};

const ALL_COMMANDS = [UTC_COMMAND, HELP_COMMAND, FFROA_COMMAND, CTAREGEAR_COMMAND, FFREGEAR_COMMAND, BANK_COMMAND];

InstallGlobalCommands(process.env.APP_ID, ALL_COMMANDS);
