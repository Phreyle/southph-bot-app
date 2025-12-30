import 'dotenv/config';
import { Client, GatewayIntentBits, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import express from 'express';
import {
  InteractionType,
  InteractionResponseType,
  InteractionResponseFlags,
  MessageComponentTypes,
  verifyKeyMiddleware,
} from 'discord-interactions';
import { DiscordRequest } from './utils.js';
import { 
  deposit, 
  withdraw, 
  getBalance, 
  getActiveUsers, 
  CURRENCY 
} from './bank.js';

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
  }
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
  return new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🛡️ FFROA Role Call')
    .setDescription(
      `**__X UP ROLE!__**\n` +
      `**Location:** ${ffroaState.location}\n**Gear:** T${ffroaState.tier} Sets\n\n` +
      roleLines.join('\n') +
      `\n\n**Builds Thread:** <#1422948227405316208>`
    );
};

// Listen for messages in the FFROA thread
client.on('messageCreate', async (message) => {
  // Ignore bot messages and messages outside the active FFROA thread
  if (message.author.bot || !ffroaState.active || message.channelId !== ffroaState.threadId) {
    return;
  }

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

  let assignedRole = null;

  // Check which role the user is claiming
  for (const [roleKey, pattern] of Object.entries(rolePatterns)) {
    if (pattern.test(content)) {
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

      // Assign the new role
      ffroaState.roles[roleKey] = message.author.id;
      assignedRole = roleKey;
      break;
    }
  }

  // If a role was assigned, update the FFROA message
  if (assignedRole) {
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

  /**
   * Handle verification requests
   */
  if (type === InteractionType.PING) {
    return res.send({ type: InteractionResponseType.PONG });
  }

  /**
   * Handle slash command requests
   * See https://discord.com/developers/docs/interactions/application-commands#slash-commands
   */
  if (type === InteractionType.APPLICATION_COMMAND) {
    const { name } = data;

    // "/utc" command - Display current UTC time (Albion Online in-game time)
    if (name === 'utc') {
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
      const subcommand = data.options[0].name;
      const context = req.body.context;
      const userId = context === 0 ? req.body.member.user.id : req.body.user.id;

      // Subcommand: create
      if (subcommand === 'create') {
        if (ffroaState.active) {
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
        
        try {
          // First, acknowledge the interaction
          await res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: `✅ Creating FFROA thread: **${threadTitle}**...`,
              flags: 64 // EPHEMERAL
            },
          });

          // Create a thread in the channel
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

          // Post the FFROA message in the thread
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

        } catch (err) {
          console.error('Error creating thread:', err);
          ffroaState.active = false;
          ffroaState.roles[roleOption] = null;
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
      const threadTitle = data.options[0].value;
      const channelId = req.body.channel_id;

      try {
        // First, acknowledge the interaction
        await res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `✅ Creating CTA regear thread: **${threadTitle}**...`,
            flags: 64 // EPHEMERAL
          },
        });

        // Create a thread in the channel
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

      } catch (err) {
        console.error('Error creating CTA regear thread:', err);
      }
      return;
    }

    // "/ffregear" command - Create FF regear thread
    if (name === 'ffregear') {
      const threadTitle = data.options[0].value;
      const channelId = req.body.channel_id;

      try {
        // First, acknowledge the interaction
        await res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `✅ Creating FF regear thread: **${threadTitle}**...`,
            flags: 64 // EPHEMERAL
          },
        });

        // Create a thread in the channel
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

        // Create embed for FF regear
        const embed = new EmbedBuilder()
          .setColor(0x5865F2) // Discord blurple
          .setTitle('🛡️ FF REGEAR')
          .setDescription(
            `**SEND FF REGEAR HERE**`
          );

        // Post the message in the thread
        await DiscordRequest(`channels/${threadId}/messages`, {
          method: 'POST',
          body: {
            content:"<@&1344897722196430879>",
            embeds: [embed.toJSON()]
          },
        });

      } catch (err) {
        console.error('Error creating FF regear thread:', err);
      }
      return;
    }

    // "/bank" command - Bank economy system
    if (name === 'bank') {
      const subcommand = data.options[0].name;
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
    }

    // "/help" command - Show available commands
    if (name === 'help') {
      const helpMessage = `**South PH - Albion Online Guild Bot** 🛡️\n\n` +
        `**Available Commands:**\n` +
        `• \`/help\` - Show this help message\n\n` +
        `• \`/utc\` - Display current UTC time (Albion Online in-game time)\n` +
        `• \`/ffroa create [role] [title]\` - Create FFROA role callout\n` +
        `• \`/ctaregear [title]\` - Create CTA regear thread\n` +
        `• \`/ffregear [title]\` - Create FF regear thread\n` +
        `• \`/bank deposit/withdraw/balance/active\` - Bank economy system\n` +
        `*More commands coming soon!*`;

      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          flags: InteractionResponseFlags.IS_COMPONENTS_V2,
          components: [
            {
              type: MessageComponentTypes.TEXT_DISPLAY,
              content: helpMessage
            }
          ]
        },
      });
    }

    console.error(`unknown command: ${name}`);
    return res.status(400).json({ error: 'unknown command' });
  }

  console.error('unknown interaction type', type);
  return res.status(400).json({ error: 'unknown interaction type' });
});

app.listen(PORT, () => {
  console.log('Listening on port', PORT);
});
