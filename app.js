import 'dotenv/config';
import { Client, GatewayIntentBits, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  InteractionType,
  InteractionResponseType,
  InteractionResponseFlags,
  MessageComponentTypes,
  ButtonStyleTypes,
  verifyKeyMiddleware,
} from 'discord-interactions';
import { DiscordRequest } from './utils.js';
import { 
  deposit, 
  withdraw, 
  getBalance, 
  getActiveUsers, 
  clearUser,
  clearAll,
  CURRENCY 
} from './bank.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Interaction received at', Date.now());

// Prefix configuration
const PREFIX_FILE = path.join(__dirname, 'prefix-config.json');

function getPrefix() {
  try {
    const data = fs.readFileSync(PREFIX_FILE, 'utf8');
    const config = JSON.parse(data);
    return config.prefix || '!';
  } catch (error) {
    return '!';
  }
}

function setPrefix(newPrefix) {
  try {
    fs.writeFileSync(PREFIX_FILE, JSON.stringify({ prefix: newPrefix }, null, 2), 'utf8');
    console.log(`✅ Prefix changed to: ${newPrefix}`);
    return true;
  } catch (error) {
    console.error('❌ Error saving prefix:', error);
    return false;
  }
}
// Create an express app
const app = express();
// Get port, or default to 3000
const PORT = process.env.PORT || 3000;

// Custom emoji configuration - Replace with your server's emoji IDs
// To get emoji ID: Type \:emoji_name: in Discord and copy the numbers
const CUSTOM_EMOJIS = {
  OFFTANK: '<:OFFTANK:1388541334637379695>',  // Replace YOUR_EMOJI_ID_HERE with actual ID
  HEALER: '<:HEALER:1388541939317473350>',
  DEBUFF: '<:DEBUFF:1388542342788677834>',
  DPS: '<:DPS:1388541739815669792>',
};

// Storage for FFROA state (in production, use a database)
const ffroaState = {
  active: false,
  messageId: null,
  channelId: null,
  threadId: null,
  location: 'Brecilien',
  tier: 7,
  roles: {
    tank: null,
    heal: null,
    shadowcaller: null,
    blazing: null,
    mp: null,
    mp2: null,
    flex: null
  },
  fill: [] // Array of user IDs who want to fill any remaining slots
};
// Create a Discord client
const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ] 
});

client.once('clientReady', () => {
  console.log(`Gateway connected as ${client.user.tag}`);
});

// Helper function to build the FFROA embed
const buildFFROAEmbed = () => {
  const roleLines = [
    `**1. ${CUSTOM_EMOJIS.OFFTANK} TANK**   ${ffroaState.roles.tank ? '➡️ <@' + ffroaState.roles.tank + '>' : ''}`,
    `**2. ${CUSTOM_EMOJIS.HEALER} HEALER**   ${ffroaState.roles.heal ? '➡️ <@' + ffroaState.roles.heal + '>' : ''}`,
    `**3. ${CUSTOM_EMOJIS.DEBUFF} SHADOWCALLER**   ${ffroaState.roles.shadowcaller ? '➡️ <@' + ffroaState.roles.shadowcaller + '>' : ''}`,
    `**4. ${CUSTOM_EMOJIS.DPS} BLAZING**   ${ffroaState.roles.blazing ? '➡️ <@' + ffroaState.roles.blazing + '>' : ''}`,
    `**5. ${CUSTOM_EMOJIS.DPS} MIST PIERCER**   ${ffroaState.roles.mp ? '➡️ <@' + ffroaState.roles.mp + '>' : ''}`,
    `**6. ${CUSTOM_EMOJIS.DPS} MIST PIERCER**   ${ffroaState.roles.mp2 ? '➡️ <@' + ffroaState.roles.mp2 + '>' : ''}`,
    `**7. ${CUSTOM_EMOJIS.DPS} MP / LC / ARCTIC / PERMA**   ${ffroaState.roles.flex ? '➡️ <@' + ffroaState.roles.flex + '>' : ''}`
  ];
  
  // Count filled slots
  const filledSlots = Object.values(ffroaState.roles).filter(v => v !== null).length;
  const totalSlots = 7;
  const fillCount = ffroaState.fill.length;
  
  // Build fill section
  let fillSection = '';
  if (fillCount > 0) {
    fillSection = `\n\n**🔄 FILL (${fillCount}):** ${ffroaState.fill.map(id => `<@${id}>`).join(', ')}`;
  }
  
  return new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🛡️ FFROA Role Call')
    .setDescription(
      `**__X UP ROLE!__**\n` +
      `**Location:** ${ffroaState.location}\n**Gear:** T${ffroaState.tier} Sets\n` +
      `**Status:** ${filledSlots + fillCount}/${totalSlots} ${fillCount > 0 ? `(${fillCount} FILL)` : ''}\n\n` +
      roleLines.join('\n') +
      fillSection +
      `\n\n**Builds Thread:** <#1422948227405316208>`
    );
};

// Listen for messages in the FFROA thread
client.on('messageCreate', async (message) => {
  // Ignore bot messages
  if (message.author.bot) return;

  const prefix = getPrefix();

  // Handle FFROA thread messages
  if (ffroaState.active && message.channelId === ffroaState.threadId) {
    const content = message.content.toLowerCase().trim();
    
    // Pattern matching for "x [role]" format
    const rolePatterns = {
      tank: /^x\s+(tank|t)$/i,
      heal: /^x\s+(heal|healer|h)$/i,
      shadowcaller: /^x\s+(shadowcaller|sc|shadow)$/i,
      blazing: /^x\s+(blazing|blaze|b)$/i,
      mp: /^x\s+(mp|mist\s*piercer)$/i,
      mp2: /^x\s+(mp2|mist\s*piercer\s*2)$/i,
      flex: /^x\s+(flex|f|perma|arctic|LC)$/i
    };

    // Check for "x fill" command
    if (/^x\s+fill$/i.test(content)) {
      // Check if user is already in fill
      if (ffroaState.fill.includes(message.author.id)) {
        await message.react('ℹ️');
        return;
      }

      // Check if user already has a role - remove them from it
      for (const [roleKey, userId] of Object.entries(ffroaState.roles)) {
        if (userId === message.author.id) {
          ffroaState.roles[roleKey] = null;
          break;
        }
      }

      // Add to fill list
      ffroaState.fill.push(message.author.id);

      // Check if we can auto-assign fill players
      await autoAssignFillPlayers();

      try {
        const embed = buildFFROAEmbed();
        await DiscordRequest(`channels/${ffroaState.channelId}/messages/${ffroaState.messageId}`, {
          method: 'PATCH',
          body: {
            embeds: [embed.toJSON()]
          },
        });
        await message.react('🔄');
      } catch (err) {
        console.error('Error updating FFROA message:', err);
        await message.reply('❌ Failed to update the FFROA board.');
      }
      return;
    }

    let assignedRole = null;

    // Check which role the user is claiming
    for (const [roleKey, pattern] of Object.entries(rolePatterns)) {
      if (pattern.test(content)) {
        // Count filled slots and fill players
        const filledSlots = Object.values(ffroaState.roles).filter(v => v !== null).length;
        const fillCount = ffroaState.fill.length;
        const totalSlots = 7;
        const availableSlots = totalSlots - filledSlots - fillCount;

        // Check if there are available slots (considering fill players reserve slots)
        if (availableSlots <= 0 && !ffroaState.roles[roleKey]) {
          await message.reply(`❌ No slots available! ${fillCount} slot(s) are reserved for FILL players. Current status: ${filledSlots + fillCount}/${totalSlots}`);
          return;
        }

        // Check if role is already taken by someone else
        if (ffroaState.roles[roleKey] && ffroaState.roles[roleKey] !== message.author.id) {
          await message.reply(`❌ ${roleKey.toUpperCase()} slot is already taken by <@${ffroaState.roles[roleKey]}>!`);
          return;
        }

        // If user already has this role, ignore (no change needed)
        if (ffroaState.roles[roleKey] === message.author.id) {
          await message.react('ℹ️');
          return;
        }

        // Remove user from any other role they currently have
        for (const [existingRoleKey, existingUserId] of Object.entries(ffroaState.roles)) {
          if (existingUserId === message.author.id) {
            ffroaState.roles[existingRoleKey] = null;
          }
        }

        // Remove user from fill list if they were in it
        const fillIndex = ffroaState.fill.indexOf(message.author.id);
        if (fillIndex > -1) {
          ffroaState.fill.splice(fillIndex, 1);
        }

        // Assign the new role
        ffroaState.roles[roleKey] = message.author.id;
        assignedRole = roleKey;
        break;
      }
    }

    // If a role was assigned, update the FFROA message and check for auto-assignment
    if (assignedRole) {
      // Check if we need to auto-assign fill players
      await autoAssignFillPlayers();

      try {
        const embed = buildFFROAEmbed();
        await DiscordRequest(`channels/${ffroaState.channelId}/messages/${ffroaState.messageId}`, {
          method: 'PATCH',
          body: {
            embeds: [embed.toJSON()]
          },
        });

        await message.react('✅');
      } catch (err) {
        console.error('Error updating FFROA message:', err);
        await message.reply('❌ Failed to update the FFROA board.');
      }
    }
    return;
  }

  // Auto-assign fill players to empty slots
  async function autoAssignFillPlayers() {
    const roleKeys = ['tank', 'heal', 'shadowcaller', 'blazing', 'mp', 'mp2', 'flex'];
    
    while (ffroaState.fill.length > 0) {
      // Find first empty slot
      const emptySlot = roleKeys.find(key => ffroaState.roles[key] === null);
      
      if (!emptySlot) {
        // No empty slots, break
        break;
      }

      // Assign first fill player to empty slot
      const fillPlayerId = ffroaState.fill.shift();
      ffroaState.roles[emptySlot] = fillPlayerId;

      // Try to notify the player (optional, might need channel reference)
      try {
        const channel = await client.channels.fetch(ffroaState.threadId);
        if (channel) {
          await channel.send(`✅ <@${fillPlayerId}> has been automatically assigned to **${emptySlot.toUpperCase()}**!`);
        }
      } catch (err) {
        console.error('Error notifying fill player:', err);
      }
    }
  }

  // Handle text commands with prefix
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/\s+/);
  const command = args.shift().toLowerCase();

  console.log(`📝 Text command received: ${prefix}${command}`);

  // !utc command
  if (command === 'utc' || command === 'time') {
    const now = new Date();
    const hours = String(now.getUTCHours()).padStart(2, '0');
    const minutes = String(now.getUTCMinutes()).padStart(2, '0');
    const seconds = String(now.getUTCSeconds()).padStart(2, '0');
    const utcTime = `${hours}:${minutes}:${seconds}`;

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setDescription(`⏰ UTC Time Now: **${utcTime}**`);

    await message.reply({ embeds: [embed] });
    return;
  }

  // !bank or !bal command
  if (command === 'bank' || command === 'bal' || command === 'balance') {
    const subcommand = args[0]?.toLowerCase();
    
    if (!subcommand || subcommand === 'balance' || subcommand === 'bal') {
      // Show own balance or mentioned user's balance
      const mentionedUser = message.mentions.users.first();
      const targetUserId = mentionedUser?.id || message.author.id;
      const balance = getBalance(targetUserId);

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('💰 Bank Balance')
        .setDescription(
          `**User:** <@${targetUserId}>\n` +
          `**Balance:** ${CURRENCY}${balance.toLocaleString()}`
        )
        .setTimestamp();

      await message.reply({ embeds: [embed] });
      return;
    }

    // Check admin permission for admin commands
    const isAdmin = message.member.permissions.has(PermissionFlagsBits.Administrator);

    if (subcommand === 'deposit' || subcommand === 'dep') {
      if (!isAdmin) {
        await message.reply('❌ You need Administrator permission to use this command.');
        return;
      }

      const mentionedUser = message.mentions.users.first();
      const amount = parseInt(args[1]);

      if (!mentionedUser || !amount || amount <= 0) {
        await message.reply(`❌ Usage: \`${prefix}bank deposit @user <amount>\``);
        return;
      }

      const result = deposit(mentionedUser.id, amount);

      const embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('💰 Deposit Successful')
        .setDescription(
          `**User:** <@${mentionedUser.id}>\n` +
          `**Deposited:** ${CURRENCY}${amount.toLocaleString()}\n` +
          `**New Balance:** ${CURRENCY}${result.newBalance.toLocaleString()}`
        )
        .setTimestamp();

      await message.reply({ embeds: [embed] });
      return;
    }

    if (subcommand === 'withdraw' || subcommand === 'with') {
      if (!isAdmin) {
        await message.reply('❌ You need Administrator permission to use this command.');
        return;
      }

      const mentionedUser = message.mentions.users.first();
      const amount = parseInt(args[1]);

      if (!mentionedUser || !amount || amount <= 0) {
        await message.reply(`❌ Usage: \`${prefix}bank withdraw @user <amount>\``);
        return;
      }

      const result = withdraw(mentionedUser.id, amount);

      if (!result.success) {
        await message.reply(`❌ ${result.error}`);
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle('💸 Withdrawal Successful')
        .setDescription(
          `**User:** <@${mentionedUser.id}>\n` +
          `**Withdrawn:** ${CURRENCY}${amount.toLocaleString()}\n` +
          `**New Balance:** ${CURRENCY}${result.newBalance.toLocaleString()}`
        )
        .setTimestamp();

      await message.reply({ embeds: [embed] });
      return;
    }

    if (subcommand === 'active' || subcommand === 'list') {
      const activeUsers = getActiveUsers();

      if (activeUsers.length === 0) {
        await message.reply('📊 No users currently have money in the bank.');
        return;
      }

      const userList = activeUsers
        .map(([uid, bal]) => `<@${uid}> — ${CURRENCY}${bal.toLocaleString()}`)
        .join('\n');

      const embed = new EmbedBuilder()
        .setColor(0xf39c12)
        .setTitle('📊 Active Bank Users')
        .setDescription(userList)
        .setFooter({ text: `Total users: ${activeUsers.length}` })
        .setTimestamp();

      await message.reply({ embeds: [embed] });
      return;
    }

    if (subcommand === 'clear') {
      if (!isAdmin) {
        await message.reply('❌ You need Administrator permission to use this command.');
        return;
      }

      const mentionedUser = message.mentions.users.first();

      if (!mentionedUser) {
        await message.reply(`❌ Usage: \`${prefix}bank clear @user\``);
        return;
      }

      const result = clearUser(mentionedUser.id);

      if (!result.success) {
        await message.reply(`❌ ${result.error}`);
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0xe67e22)
        .setTitle('🗑️ Balance Cleared')
        .setDescription(
          `**User:** <@${mentionedUser.id}>\n` +
          `**Cleared Amount:** ${CURRENCY}${result.clearedAmount.toLocaleString()}\n` +
          `**New Balance:** ${CURRENCY}0`
        )
        .setTimestamp();

      await message.reply({ embeds: [embed] });
      return;
    }

    if (subcommand === 'clearall') {
      if (!isAdmin) {
        await message.reply('❌ You need Administrator permission to use this command.');
        return;
      }

      const result = clearAll();

      if (!result.success) {
        await message.reply(`❌ ${result.error}`);
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0xc0392b)
        .setTitle('🗑️ All Balances Cleared')
        .setDescription(
          `**Cleared Users:** ${result.clearedUsers}\n` +
          `**All balances have been reset to ${CURRENCY}0**`
        )
        .setTimestamp();

      await message.reply({ embeds: [embed] });
      return;
    }

    // Invalid subcommand
    await message.reply(
      `❌ Invalid subcommand. Available: \`balance\`, \`deposit\`, \`withdraw\`, \`active\`, \`clear\`, \`clearall\``
    );
    return;
  }

  // !prefix command - Change bot prefix (Admin only)
  if (command === 'prefix') {
    const isAdmin = message.member.permissions.has(PermissionFlagsBits.Administrator);
    
    if (!isAdmin) {
      await message.reply('❌ You need Administrator permission to change the prefix.');
      return;
    }

    const newPrefix = args[0];

    if (!newPrefix) {
      await message.reply(`📝 Current prefix: \`${prefix}\`\nUsage: \`${prefix}prefix <new_prefix>\``);
      return;
    }

    if (newPrefix.length > 3) {
      await message.reply('❌ Prefix must be 3 characters or less.');
      return;
    }

    if (setPrefix(newPrefix)) {
      await message.reply(`✅ Prefix changed from \`${prefix}\` to \`${newPrefix}\``);
    } else {
      await message.reply('❌ Failed to change prefix.');
    }
    return;
  }

  // !help command
  if (command === 'help' || command === 'commands') {
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📖 South PH Bot - Command Help')
      .setDescription(
        `**Current Prefix:** \`${prefix}\`\n\n` +
        `**👤 User Commands** (Available to All Members):\n` +
        `• \`${prefix}help\` - Show this help message\n` +
        `• \`${prefix}utc\` or \`${prefix}time\` - Display UTC time\n` +
        `• \`${prefix}bal [@user]\` - Check balance\n` +
        `• \`${prefix}bank active\` - List all bank users\n\n` +
        `**🛡️ Admin Commands** (Requires Admin Permissions):\n` +
        `• \`${prefix}prefix <new>\` - Change prefix\n` +
        `• \`${prefix}bank deposit @user <amount>\` - Deposit silver\n` +
        `• \`${prefix}bank withdraw @user <amount>\` - Withdraw silver\n` +
        `• \`${prefix}bank clear @user\` - Clear user balance\n` +
        `• \`${prefix}bank clearall\` - Clear all balances\n\n` +
        `*Slash commands (/) are also available! Use \`/help\` for an interactive menu.*`
      )
      .setFooter({ text: 'South PH - Albion Online Guild Bot' });

    await message.reply({ embeds: [embed] });
    return;
  }
});

// Login to Discord
client.login(process.env.DISCORD_TOKEN);

/**
 * Interactions endpoint URL where Discord will send HTTP requests
 * Parse request body and verifies incoming requests using discord-interactions package
 */
app.post('/interactions', verifyKeyMiddleware(process.env.PUBLIC_KEY), async function (req, res) {
  // Interaction type and data
  const { type, id, data } = req.body;

  // DEBUG: Log all incoming interactions
  console.log('========================================');
  console.log('📥 INTERACTION RECEIVED');
  console.log('Time:', new Date().toISOString());
  console.log('Type:', type);
  console.log('ID:', id);
  console.log('Data:', JSON.stringify(data, null, 2));
  console.log('========================================');

  /**
   * Handle verification requests
   */
  if (type === InteractionType.PING) {
    console.log('✅ PING received, responding with PONG');
    return res.send({ type: InteractionResponseType.PONG });
  }

  /**
   * Handle slash command requests
   * See https://discord.com/developers/docs/interactions/application-commands#slash-commands
   */
  if (type === InteractionType.APPLICATION_COMMAND) {
    const { name } = data;
    console.log(`🔧 Processing slash command: /${name}`);

    // "/utc" command - Display current UTC time (Albion Online in-game time)
    if (name === 'utc') {
      console.log('⏰ Executing /utc command');
      const now = new Date();
      const hours = String(now.getUTCHours()).padStart(2, '0');
      const minutes = String(now.getUTCMinutes()).padStart(2, '0');
      const seconds = String(now.getUTCSeconds()).padStart(2, '0');
      const utcTime = `${hours}:${minutes}:${seconds}`;

      const embed = new EmbedBuilder()
        .setColor(0x5865F2) // Discord blurple color
        .setDescription(`⏰ UTC Time Now: **${utcTime}**`); // inline code block for background effect

      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          embeds: [embed.toJSON()]
        },
      });
    }

    // "/ffroa" command - Manage FFROA role callout
    if (name === 'ffroa') {
      console.log('🛡️ Executing /ffroa command');
      const subcommand = data.options[0].name;
      console.log(`   Subcommand: ${subcommand}`);
      const context = req.body.context;
      const userId = context === 0 ? req.body.member.user.id : req.body.user.id;

      // Subcommand: create
      if (subcommand === 'create') {
        console.log('   Creating FFROA thread...');
        if (ffroaState.active) {
          console.log('   ❌ FFROA already active');
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: '❌ An FFROA callout is already active! Use `/ffroa reset` to clear it first.',
              flags: 64 // EPHEMERAL
            },
          });
        }

        const roleOption = data.options[0].options[0].value;
        const threadTitle = data.options[0].options[1].value;
        const location = data.options[0].options[2].value;
        const tier = data.options[0].options[3].value;
        const channelId = req.body.channel_id;
        
        ffroaState.active = true;
        ffroaState.location = location;
        ffroaState.tier = tier;
        ffroaState.roles[roleOption] = userId;

        const embed = buildFFROAEmbed();
        
        // Defer the response to give us time to create the thread
        console.log('   ⏳ Deferring response...');
        res.send({
          type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            flags: 64 // EPHEMERAL
          }
        });

        try {
          // Create a thread in the channel
          console.log('   📝 Creating thread...');
          const threadResponse = await DiscordRequest(`channels/${channelId}/threads`, {
            method: 'POST',
            body: {
              name: threadTitle,
              type: 11, // PUBLIC_THREAD
              auto_archive_duration: 1440 // 24 hours
            },
          });
          const threadData = await threadResponse.json();
          const threadId = threadData.id;
          console.log(`   ✅ Thread created: ${threadId}`);

          // Post the FFROA message in the thread
          console.log('   📤 Posting message in thread...');
          const messageResponse = await DiscordRequest(`channels/${threadId}/messages`, {
            method: 'POST',
            body: {
            content:"<@&1344897722196430879>",
            embeds: [embed.toJSON()]
            },
          });
          const messageData = await messageResponse.json();

          // Store the message and channel info
          ffroaState.messageId = messageData.id;
          ffroaState.channelId = threadId;
          ffroaState.threadId = threadId;
          console.log('   ✅ FFROA state saved');

          // Follow up with success message
          console.log('   📨 Sending follow-up message...');
          await DiscordRequest(`webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
            method: 'PATCH',
            body: {
              content: `✅ FFROA thread created: **${threadTitle}**`,
              flags: 64
            },
          });
          console.log('   ✅ /ffroa create completed successfully');

        } catch (err) {
          console.error('   ❌ Error creating thread:', err);
          ffroaState.active = false;
          ffroaState.roles[roleOption] = null;
          
          // Follow up with error message
          await DiscordRequest(`webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
            method: 'PATCH',
            body: {
              content: '❌ Failed to create FFROA thread.',
              flags: 64
            },
          });
        }
        return;
      }

      // Subcommand: adduser
      if (subcommand === 'adduser') {
        if (!ffroaState.active) {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: '❌ No active FFROA callout! Use `/ffroa create [role]` first.',
              flags: 64 // EPHEMERAL
            },
          });
        }

        const targetUserId = data.options[0].options[0].value;
        const roleOption = data.options[0].options[1].value;

        if (ffroaState.roles[roleOption]) {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: `❌ The ${roleOption.toUpperCase()} slot is already filled!`,
              flags: 64 // EPHEMERAL
            },
          });
        }

        ffroaState.roles[roleOption] = targetUserId;
        const embed = buildFFROAEmbed();

        // Update the original message
        try {
          await DiscordRequest(`channels/${ffroaState.channelId}/messages/${ffroaState.messageId}`, {
            method: 'PATCH',
            body: {
              embeds: [embed.toJSON()]
            },
          });

          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: `✅ <@${targetUserId}> added to **${roleOption.toUpperCase()}**`,
              flags: 64 // EPHEMERAL
            },
          });
        } catch (err) {
          console.error('Error updating message:', err);
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: '❌ Failed to update the FFROA message.',
              flags: 64 // EPHEMERAL
            },
          });
        }
      }

      // Subcommand: removeuser
      if (subcommand === 'removeuser') {
        if (!ffroaState.active) {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: '❌ No active FFROA callout! Use `/ffroa create [role]` first.',
              flags: 64 // EPHEMERAL
            },
          });
        }

        const roleOption = data.options[0].options[0].value;

        if (!ffroaState.roles[roleOption]) {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: `❌ The ${roleOption.toUpperCase()} slot is already empty!`,
              flags: 64 // EPHEMERAL
            },
          });
        }

        ffroaState.roles[roleOption] = null;
        const embed = buildFFROAEmbed();

        // Update the original message
        try {
          await DiscordRequest(`channels/${ffroaState.channelId}/messages/${ffroaState.messageId}`, {
            method: 'PATCH',
            body: {
              embeds: [embed.toJSON()]
            },
          });

          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: `✅ Removed user from **${roleOption.toUpperCase()}**`,
              flags: 64 // EPHEMERAL
            },
          });
        } catch (err) {
          console.error('Error updating message:', err);
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: '❌ Failed to update the FFROA message.',
              flags: 64 // EPHEMERAL
            },
          });
        }
      }

      // Subcommand: reset
      if (subcommand === 'reset') {
        ffroaState.active = false;
        ffroaState.messageId = null;
        ffroaState.channelId = null;
        ffroaState.threadId = null;
        ffroaState.location = 'Brecilien';
        ffroaState.tier = 7;
        ffroaState.roles = {
          tank: null,
          heal: null,
          shadowcaller: null,
          blazing: null,
          mp: null,
          mp2: null,
          flex: null
        };

        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: '✅ FFROA callout has been reset! You can now create a new one with `/ffroa create [role]`.',
            flags: 64 // EPHEMERAL
          },
        });
      }
    }

    // "/ctaregear" command - Create CTA regear thread
    if (name === 'ctaregear') {
      console.log('⚔️ Executing /ctaregear command');
      const threadTitle = data.options[0].value;
      const channelId = req.body.channel_id;

      // Defer the response
      console.log('   ⏳ Deferring response...');
      res.send({
        type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          flags: 64 // EPHEMERAL
        }
      });

      try {
        // Create a thread in the channel
        console.log('   📝 Creating CTA regear thread...');
        const threadResponse = await DiscordRequest(`channels/${channelId}/threads`, {
          method: 'POST',
          body: {
            name: threadTitle,
            type: 11, // PUBLIC_THREAD
            auto_archive_duration: 1440 // 24 hours
          },
        });
        const threadData = await threadResponse.json();
        const threadId = threadData.id;
        console.log(`   ✅ CTA thread created: ${threadId}`);

        // Create embed for CTA regear
        const embed = new EmbedBuilder()
          .setColor(0xe74c3c) // Red color for CTA
          .setTitle('⚔️ CTA REGEAR')
          .setDescription(
            `**SEND REGEAR HERE**\n` +
            `**INCLUDE OC BREAK**`
          );

        // Post the message in the thread
        await DiscordRequest(`channels/${threadId}/messages`, {
          method: 'POST',
          body: {
            content:"<@&1344897722196430879>",
            embeds: [embed.toJSON()]
          },
        });

        // Follow up with success message
        await DiscordRequest(`webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
          method: 'PATCH',
          body: {
            content: `✅ CTA regear thread created: **${threadTitle}**`,
            flags: 64
          },
        });
        console.log('   ✅ /ctaregear completed successfully');

      } catch (err) {
        console.error('   ❌ Error creating CTA regear thread:', err);
        
        // Follow up with error message
        await DiscordRequest(`webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
          method: 'PATCH',
          body: {
            content: '❌ Failed to create CTA regear thread.',
            flags: 64
          },
        });
      }
      return;
    }

    // "/ffregear" command - Create FF regear thread
    if (name === 'ffregear') {
      console.log('🛡️ Executing /ffregear command');
      const threadTitle = data.options[0].value;
      const channelId = req.body.channel_id;

      // Defer the response
      console.log('   ⏳ Deferring response...');
      res.send({
        type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          flags: 64 // EPHEMERAL
        }
      });

      try {
        // Create a thread in the channel
        console.log('   📝 Creating FF regear thread...');
        const threadResponse = await DiscordRequest(`channels/${channelId}/threads`, {
          method: 'POST',
          body: {
            name: threadTitle,
            type: 11, // PUBLIC_THREAD
            auto_archive_duration: 1440 // 24 hours
          },
        });
        const threadData = await threadResponse.json();
        const threadId = threadData.id;
        console.log(`   ✅ FF thread created: ${threadId}`);

        // Create embed for FF regear
        const embed = new EmbedBuilder()
          .setColor(0x5865F2) // Discord blurple
          .setTitle('🛡️ FF REGEAR')
          .setDescription(
            `**SEND FF REGEAR HERE**`
          );

        // Post the message in the thread
        console.log('   📤 Posting FF message in thread...');
        await DiscordRequest(`channels/${threadId}/messages`, {
          method: 'POST',
          body: {
            content:"<@&1344897722196430879>",
            embeds: [embed.toJSON()]
          },
        });

        // Follow up with success message
        console.log('   📨 Sending follow-up message...');
        await DiscordRequest(`webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
          method: 'PATCH',
          body: {
            content: `✅ FF regear thread created: **${threadTitle}**`,
            flags: 64
          },
        });
        console.log('   ✅ /ffregear completed successfully');

      } catch (err) {
        console.error('   ❌ Error creating FF regear thread:', err);
        
        // Follow up with error message
        await DiscordRequest(`webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
          method: 'PATCH',
          body: {
            content: '❌ Failed to create FF regear thread.',
            flags: 64
          },
        });
      }
      return;
    }

    // "/bank" command - Bank economy system
    if (name === 'bank') {
      console.log('💰 Executing /bank command');
      const subcommand = data.options[0].name;
      console.log(`   Subcommand: ${subcommand}`);
      const context = req.body.context;
      const userId = context === 0 ? req.body.member.user.id : req.body.user.id;
      const member = req.body.member;

      // Check admin permission for deposit/withdraw
      const isAdmin = member && member.permissions && 
        (BigInt(member.permissions) & BigInt(PermissionFlagsBits.Administrator)) === BigInt(PermissionFlagsBits.Administrator);

      // Subcommand: deposit
      if (subcommand === 'deposit') {
        if (!isAdmin) {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: '❌ You need Administrator permission to use this command.',
              flags: 64 // EPHEMERAL
            },
          });
        }

        const targetUserId = data.options[0].options[0].value;
        const amount = data.options[0].options[1].value;

        const result = deposit(targetUserId, amount);

        if (!result.success) {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: `❌ ${result.error}`,
              flags: 64 // EPHEMERAL
            },
          });
        }

        const embed = new EmbedBuilder()
          .setColor(0x2ecc71) // Green
          .setTitle('💰 Deposit Successful')
          .setDescription(
            `**User:** <@${targetUserId}>\n` +
            `**Deposited:** ${CURRENCY}${amount.toLocaleString()}\n` +
            `**New Balance:** ${CURRENCY}${result.newBalance.toLocaleString()}`
          )
          .setTimestamp();

        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            embeds: [embed.toJSON()]
          },
        });
      }

      // Subcommand: withdraw
      if (subcommand === 'withdraw') {
        if (!isAdmin) {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: '❌ You need Administrator permission to use this command.',
              flags: 64 // EPHEMERAL
            },
          });
        }

        const targetUserId = data.options[0].options[0].value;
        const amount = data.options[0].options[1].value;

        const result = withdraw(targetUserId, amount);

        if (!result.success) {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: `❌ ${result.error}`,
              flags: 64 // EPHEMERAL
            },
          });
        }

        const embed = new EmbedBuilder()
          .setColor(0xe74c3c) // Red
          .setTitle('💸 Withdrawal Successful')
          .setDescription(
            `**User:** <@${targetUserId}>\n` +
            `**Withdrawn:** ${CURRENCY}${amount.toLocaleString()}\n` +
            `**New Balance:** ${CURRENCY}${result.newBalance.toLocaleString()}`
          )
          .setTimestamp();

        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            embeds: [embed.toJSON()]
          },
        });
      }

      // Subcommand: balance
      if (subcommand === 'balance') {
        const targetUserId = data.options[0].options?.[0]?.value || userId;
        const balance = getBalance(targetUserId);

        const embed = new EmbedBuilder()
          .setColor(0x5865F2) // Discord blurple
          .setTitle('💰 Bank Balance')
          .setDescription(
            `**User:** <@${targetUserId}>\n` +
            `**Balance:** ${CURRENCY}${balance.toLocaleString()}`
          )
          .setTimestamp();

        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            embeds: [embed.toJSON()]
          },
        });
      }

      // Subcommand: active
      if (subcommand === 'active') {
        const activeUsers = getActiveUsers();

        if (activeUsers.length === 0) {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: '📊 No users currently have money in the bank.',
            },
          });
        }

        const userList = activeUsers
          .map(([uid, bal]) => `<@${uid}> — ${CURRENCY}${bal.toLocaleString()}`)
          .join('\n');

        const embed = new EmbedBuilder()
          .setColor(0xf39c12) // Orange
          .setTitle('📊 Active Bank Users')
          .setDescription(userList)
          .setFooter({ text: `Total users: ${activeUsers.length}` })
          .setTimestamp();

        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            embeds: [embed.toJSON()]
          },
        });
      }

      // Subcommand: clear
      if (subcommand === 'clear') {
        if (!isAdmin) {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: '❌ You need Administrator permission to use this command.',
              flags: 64 // EPHEMERAL
            },
          });
        }

        const targetUserId = data.options[0].options[0].value;
        const result = clearUser(targetUserId);

        if (!result.success) {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: `❌ ${result.error}`,
              flags: 64 // EPHEMERAL
            },
          });
        }

        const embed = new EmbedBuilder()
          .setColor(0xe67e22) // Orange
          .setTitle('🗑️ Balance Cleared')
          .setDescription(
            `**User:** <@${targetUserId}>\n` +
            `**Cleared Amount:** ${CURRENCY}${result.clearedAmount.toLocaleString()}\n` +
            `**New Balance:** ${CURRENCY}0`
          )
          .setTimestamp();

        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            embeds: [embed.toJSON()]
          },
        });
      }

      // Subcommand: clearall
      if (subcommand === 'clearall') {
        if (!isAdmin) {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: '❌ You need Administrator permission to use this command.',
              flags: 64 // EPHEMERAL
            },
          });
        }

        const result = clearAll();

        if (!result.success) {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: `❌ ${result.error}`,
              flags: 64 // EPHEMERAL
            },
          });
        }

        const embed = new EmbedBuilder()
          .setColor(0xc0392b) // Dark Red
          .setTitle('🗑️ All Balances Cleared')
          .setDescription(
            `**Cleared Users:** ${result.clearedUsers}\n` +
            `**All balances have been reset to ${CURRENCY}0**`
          )
          .setTimestamp();

        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            embeds: [embed.toJSON()]
          },
        });
      }
    }

    // "/help" command - Show available commands
    if (name === 'help') {
      console.log('❓ Executing /help command');
      const welcomeMessage = `📖 **South PH Bot - Command Help**\n\n` +
        `Welcome! Choose which commands you'd like to see:\n` +
        `• **User Commands** - Available to all members\n` +
        `• **Admin Commands** - Requires administrator permissions\n\n` +
        `_Click the buttons below to view commands_`;

      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          flags: InteractionResponseFlags.IS_COMPONENTS_V2,
          components: [
            {
              type: MessageComponentTypes.TEXT_DISPLAY,
              content: welcomeMessage
            },
            {
              type: MessageComponentTypes.ACTION_ROW,
              components: [
                {
                  type: MessageComponentTypes.BUTTON,
                  custom_id: 'help_user_commands',
                  label: '👤 User Commands',
                  style: ButtonStyleTypes.PRIMARY,
                },
                {
                  type: MessageComponentTypes.BUTTON,
                  custom_id: 'help_admin_commands',
                  label: '🛡️ Admin Commands',
                  style: ButtonStyleTypes.SECONDARY,
                },
              ],
            },
          ],
        },
      });
    }

    console.error(`❌ Unknown command: ${name}`);
    return res.status(400).json({ error: 'unknown command' });
  }

  /**
   * Handle button and component interactions
   */
  if (type === InteractionType.MESSAGE_COMPONENT) {
    const componentId = data.custom_id;
    console.log(`🔘 Processing button interaction: ${componentId}`);

    // User Commands button
    if (componentId === 'help_user_commands') {
      const prefix = process.env.DEFAULT_PREFIX || '!';
      const userCommandsMessage = `👤 **User Commands** - Available to All Members\n\n` +
        `**General Commands:**\n` +
        `• \`/help\` or \`${prefix}help\` - Show this help menu\n` +
        `• \`/utc\` or \`${prefix}utc\` - Display current UTC time (Albion Online in-game time)\n\n` +
        `**Bank Commands:**\n` +
        `• \`/bank balance [@user]\` or \`${prefix}bal [@user]\` - Check your balance or another user's balance\n` +
        `• \`/bank active\` or \`${prefix}bank active\` - View all active bank users\n\n` +
        `**Regear & Event Commands:**\n` +
        `• \`/ctaregear [title]\` - Create a CTA (Call to Action) regear thread\n` +
        `• \`/ffregear [title]\` - Create a FF (Faction Warfare) regear thread\n\n` +
        `_Need admin commands? Click the Admin Commands button!_`;

      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          flags: 64, // EPHEMERAL - only visible to the user who clicked
          content: userCommandsMessage
        },
      });
    }

    // Admin Commands button
    if (componentId === 'help_admin_commands') {
      const prefix = process.env.DEFAULT_PREFIX || '!';
      const adminCommandsMessage = `🛡️ **Admin Commands** - Requires Administrator Permissions\n\n` +
        `**Prefix Management:**\n` +
        `• \`${prefix}prefix <new>\` - Change the bot's text command prefix\n\n` +
        `**Bank Management:**\n` +
        `• \`/bank deposit @user <amount>\` or \`${prefix}bank deposit @user <amount>\` - Add silver to a user's account\n` +
        `• \`/bank withdraw @user <amount>\` or \`${prefix}bank withdraw @user <amount>\` - Remove silver from a user's account\n` +
        `• \`/bank clear @user\` or \`${prefix}bank clear @user\` - Clear a specific user's balance\n` +
        `• \`/bank clearall\` or \`${prefix}bank clearall\` - Clear all user balances (use with caution!)\n\n` +
        `**FF ROA Management:**\n` +
        `• \`/ffroa create\` - Create a new FF ROA (Return on Assets) callout\n` +
        `• \`/ffroa reset\` - Reset the current FF ROA callout\n` +
        `• \`/ffroa adduser\` - Add a user to a role in the FF ROA\n` +
        `• \`/ffroa removeuser\` - Remove a user from a role in the FF ROA\n\n` +
        `_These commands require administrator permissions to use._`;

      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          flags: 64, // EPHEMERAL - only visible to the user who clicked
          content: adminCommandsMessage
        },
      });
    }

    console.error(`❌ Unknown component ID: ${componentId}`);
    return res.status(400).json({ error: 'unknown component' });
  }

  console.error('❌ Unknown interaction type:', type);
  return res.status(400).json({ error: 'unknown interaction type' });
});

app.listen(PORT, () => {
  console.log('Listening on port ', PORT, ' ✅');
});
