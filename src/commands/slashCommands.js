import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import axios from 'axios';
import { InteractionResponseType } from 'discord-interactions';
import { DiscordRequest } from '../../utils.js';
import { deposit, withdraw, getBalance, getActiveUsers, clearUser, clearAll, CURRENCY } from '../systems/bank/bank.js';
import { loadPermissions, savePermissions } from '../database/guildData.js';
import { hasPermissionSlash } from '../utils/permissions.js';
import { buildHelpEmbed, buildPaginatedHelpEmbeds, buildHelpNavigationButtons } from '../utils/embedBuilder.js';
import { contentState } from '../config/contentState.js';
import { buildContentEmbed, autoAssignFillPlayers } from '../services/contentService.js';
import { savePanels, loadPanels } from '../systems/ticket/ticket-db.js';
import { getTicketStats, ticketSystemHealthCheck } from '../systems/ticket/ticket-utils.js';

export async function handleSlashCommands(req, res, client) {
  const { name } = req.body.data;

  // "/utc" command - Display current UTC time (Albion Online in-game time)
  if (name === 'utc') {
    const now = new Date();
    const hours = String(now.getUTCHours()).padStart(2, '0');
    const minutes = String(now.getUTCMinutes()).padStart(2, '0');
    const seconds = String(now.getUTCSeconds()).padStart(2, '0');
    const utcTime = `${hours}:${minutes}:${seconds}`;

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setDescription(`⏰ UTC Time Now: **${utcTime}**`);

    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        embeds: [embed.toJSON()]
      },
    });
  }

  // "/info" command - Search for Albion Online player across all regions
  if (name === 'info') {
    const playerName = req.body.data.options[0].value;

    // Define the three regions
    const regions = [
      { name: 'Americas', baseUrl: 'https://gameinfo.albiononline.com/api/gameinfo' },
      { name: 'Europe', baseUrl: 'https://gameinfo-ams.albiononline.com/api/gameinfo' },
      { name: 'Asia', baseUrl: 'https://gameinfo-sgp.albiononline.com/api/gameinfo' }
    ];

    try {
      // Search for player across all regions
      const searchPromises = regions.map(async (region) => {
        try {
          const searchResponse = await axios.get(`${region.baseUrl}/search?q=${encodeURIComponent(playerName)}`, {
            timeout: 5000
          });

          const players = searchResponse.data.players || [];
          if (players.length === 0) {
            return null;
          }

          // Find exact match (case-insensitive)
          const exactMatch = players.find(p => p.Name.toLowerCase() === playerName.toLowerCase());
          const playerId = exactMatch ? exactMatch.Id : players[0].Id;

          // Fetch detailed player info
          const playerResponse = await axios.get(`${region.baseUrl}/players/${playerId}`, {
            timeout: 5000
          });

          return {
            region: region.name,
            data: playerResponse.data
          };
        } catch (error) {
          // If player not found or error in this region, return null
          return null;
        }
      });

      const results = await Promise.all(searchPromises);
      const foundPlayers = results.filter(result => result !== null);

      if (foundPlayers.length === 0) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `❌ Player **${playerName}** not found in any region.`,
            flags: 64 // EPHEMERAL
          },
        });
      }

      // Build embed with player info from all regions
      const embed = new EmbedBuilder()
        .setColor(0xF0B900)
        .setTitle(`🔍 Player Search: ${playerName}`)
        .setTimestamp();

      foundPlayers.forEach((playerInfo) => {
        const player = playerInfo.data;
        const region = playerInfo.region;

        let fieldValue = `**Player ID:** ${player.Id}\n`;
        
        if (player.GuildId && player.GuildName) {
          fieldValue += `**Guild:** ${player.GuildName}\n`;
        } else {
          fieldValue += `**Guild:** None\n`;
        }

        if (player.AllianceId && player.AllianceName) {
          fieldValue += `**Alliance:** ${player.AllianceName}\n`;
        } else {
          fieldValue += `**Alliance:** None\n`;
        }

        if (player.KillFame !== undefined) {
          fieldValue += `**Kill Fame:** ${player.KillFame.toLocaleString()}\n`;
        }

        if (player.DeathFame !== undefined) {
          fieldValue += `**Death Fame:** ${player.DeathFame.toLocaleString()}\n`;
        }

        if (player.LifetimeStatistics) {
          const stats = player.LifetimeStatistics;
          if (stats.PvE && stats.PvE.Total) {
            fieldValue += `**PvE Fame:** ${stats.PvE.Total.toLocaleString()}\n`;
          }
        }

        embed.addFields({
          name: `📍 ${region}`,
          value: fieldValue,
          inline: false
        });
      });

      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          embeds: [embed.toJSON()]
        },
      });

    } catch (error) {
      console.error('Error fetching player info:', error);
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: '❌ An error occurred while fetching player information. Please try again later.',
          flags: 64
        },
      });
    }
  }

  // "/content" command - Manage content callouts
  if (name === 'content') {
    console.log('🎮 Executing /content command');
    const subcommand = req.body.data.options[0].name;
    console.log(`   Subcommand: ${subcommand}`);
    const context = req.body.context;
    const userId = context === 0 ? req.body.member.user.id : req.body.user.id;

    // Subcommand: create
    if (subcommand === 'create') {
      console.log('   Creating content thread...');
      if (contentState.active) {
        console.log('   ❌ Content already active');
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: '❌ A content callout is already active! Use `/content reset` to clear it first.',
            flags: 64
          },
        });
      }

      const contentType = req.body.data.options[0].options[0].value;
      const threadTitle = req.body.data.options[0].options[1].value;
      const zone = req.body.data.options[0].options[2].value;
      const tier = req.body.data.options[0].options[3].value;
      const time = req.body.data.options[0].options[4].value;
      const demassNotice = req.body.data.options[0].options[5]?.value || '';
      const targetCount = req.body.data.options[0].options[6]?.value || 10;
      const channelId = req.body.channel_id;

      // Reset contentState
      contentState.active = true;
      contentState.contentType = contentType;
      contentState.title = threadTitle;
      contentState.zone = zone;
      contentState.tier = tier;
      contentState.time = time;
      contentState.demassNotice = demassNotice;
      contentState.targetCount = targetCount;

      // Reset roles (for ROA/GCAMPS/Tracking)
      contentState.roles = {
        tank: null,
        heal: null,
        mp: null,
        mp2: null,
        shadowcaller: null,
        blazing: null,
        flex: null,
        badon: null,
        dpair: null,
        hpcut: null,
        flexdps: null
      };

      // Reset categories (for CTA/FF)
      contentState.categories = {
        tank: [],
        heal: [],
        dps: [],
        support: [],
        dtank: []
      };

      contentState.fill = [];

      const embed = buildContentEmbed();

      // Defer the response to give us time to create the thread
      console.log('   ⏳ Deferring response...');
      res.send({
        type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          flags: 64
        }
      });

      try {
        // Create a thread in the channel
        console.log('   📝 Creating thread...');
        const threadResponse = await DiscordRequest(`channels/${channelId}/threads`, {
          method: 'POST',
          body: {
            name: threadTitle,
            type: 11,
            auto_archive_duration: 1440
          },
        });
        const threadData = await threadResponse.json();
        const threadId = threadData.id;
        console.log(`   ✅ Thread created: ${threadId}`);

        // Post the content message in the thread
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
        contentState.messageId = messageData.id;
        contentState.channelId = threadId;
        contentState.threadId = threadId;
        console.log('   ✅ Content state saved');

        // Follow up with success message
        console.log('   📨 Sending follow-up message...');
        await DiscordRequest(`webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
          method: 'PATCH',
          body: {
            content: `✅ ${contentType.toUpperCase()} content thread created: **${threadTitle}**`,
            flags: 64
          },
        });
        console.log('   ✅ /content create completed successfully');

      } catch (err) {
        console.error('   ❌ Error creating thread:', err);
        contentState.active = false;

        // Follow up with error message
        await DiscordRequest(`webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
          method: 'PATCH',
          body: {
            content: '❌ Failed to create content thread.',
            flags: 64
          },
        });
      }
      return;
    }

    // Subcommand: adduser
    if (subcommand === 'adduser') {
      if (!contentState.active) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: '❌ No active content callout! Use `/content create` first.',
            flags: 64
          },
        });
      }

      const targetUserId = req.body.data.options[0].options[0].value;
      const roleOption = req.body.data.options[0].options[1].value;

      // Validate role for content type
      const validRoles = {
        'roa': ['tank', 'heal', 'mp', 'mp2', 'shadowcaller', 'blazing', 'flex'],
        'gcamps': ['tank', 'heal', 'shadowcaller', 'blazing', 'badon'],
        'tracking': ['tank', 'heal', 'dpair', 'hpcut', 'flexdps'],
        'cta': ['tank', 'heal', 'dps', 'support', 'dtank'],
        'ff': ['tank', 'heal', 'dps']
      };

      if (!validRoles[contentState.contentType].includes(roleOption)) {
        const contentTypeName = contentState.contentType.toUpperCase();
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `❌ The role **${roleOption}** is not valid for **${contentTypeName}** content!\n\nValid roles for ${contentTypeName}: ${validRoles[contentState.contentType].map(r => `\`${r}\``).join(', ')}`,
            flags: 64
          },
        });
      }

      if (contentState.roles[roleOption]) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `❌ The ${roleOption.toUpperCase()} slot is already filled!`,
            flags: 64
          },
        });
      }

      contentState.roles[roleOption] = targetUserId;

      // Check if we need to auto-assign fill players after adding user
      await autoAssignFillPlayers(client);

      const embed = buildContentEmbed();

      // Update the original message
      try {
        await DiscordRequest(`channels/${contentState.channelId}/messages/${contentState.messageId}`, {
          method: 'PATCH',
          body: {
            embeds: [embed.toJSON()]
          },
        });

        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `✅ <@${targetUserId}> added to **${roleOption.toUpperCase()}**`,
            flags: 64
          },
        });
      } catch (err) {
        console.error('Error updating message:', err);
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: '❌ Failed to update the content message.',
            flags: 64
          },
        });
      }
    }

    // Subcommand: removeuser
    if (subcommand === 'removeuser') {
      if (!contentState.active) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: '❌ No active content callout! Use `/content create` first.',
            flags: 64
          },
        });
      }

      const roleOption = req.body.data.options[0].options[0].value;

      // Validate role for content type
      const validRoles = {
        'roa': ['tank', 'heal', 'mp', 'mp2', 'shadowcaller', 'blazing', 'flex'],
        'gcamps': ['tank', 'heal', 'shadowcaller', 'blazing', 'badon'],
        'tracking': ['tank', 'heal', 'dpair', 'hpcut', 'flexdps'],
        'cta': ['tank', 'heal', 'dps', 'support', 'dtank'],
        'ff': ['tank', 'heal', 'dps']
      };

      if (!validRoles[contentState.contentType].includes(roleOption)) {
        const contentTypeName = contentState.contentType.toUpperCase();
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `❌ The role **${roleOption}** is not valid for **${contentTypeName}** content!\n\nValid roles for ${contentTypeName}: ${validRoles[contentState.contentType].map(r => `\`${r}\``).join(', ')}`,
            flags: 64
          },
        });
      }

      if (!contentState.roles[roleOption]) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `❌ The ${roleOption.toUpperCase()} slot is already empty!`,
            flags: 64
          },
        });
      }

      contentState.roles[roleOption] = null;

      // Check if we need to auto-assign fill players after removing user
      await autoAssignFillPlayers(client);

      const embed = buildContentEmbed();

      // Update the original message
      try {
        await DiscordRequest(`channels/${contentState.channelId}/messages/${contentState.messageId}`, {
          method: 'PATCH',
          body: {
            embeds: [embed.toJSON()]
          },
        });

        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `✅ Removed user from **${roleOption.toUpperCase()}**`,
            flags: 64
          },
        });
      } catch (err) {
        console.error('Error updating message:', err);
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: '❌ Failed to update the content message.',
            flags: 64
          },
        });
      }
    }

    // Subcommand: reset
    if (subcommand === 'reset') {
      contentState.active = false;
      contentState.messageId = null;
      contentState.channelId = null;
      contentState.threadId = null;
      contentState.contentType = 'ff';
      contentState.title = '';
      contentState.zone = 'Brecilien';
      contentState.tier = 7;
      contentState.time = '';
      contentState.demassNotice = '';
      contentState.targetCount = 10;
      contentState.roles = {
        tank: null,
        heal: null,
        shadowcaller: null,
        blazing: null,
        badon: null
      };
      contentState.categories = {
        tank: [],
        heal: [],
        dps: [],
        support: [],
        dtank: []
      };
      contentState.fill = [];

      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: '✅ Content callout has been reset! You can now create a new one with `/content create`.',
          flags: 64
        },
      });
    }
  }

  // "/regear" command - Manage regear threads (unified CTA/FF)
  if (name === 'regear') {
    console.log('⚔️ Executing /regear command');
    
    const subcommand = req.body.data.options[0].name;
    const member = req.body.member;
    const guildId = req.body.guild_id;

    // Subcommand: create
    if (subcommand === 'create') {
      console.log('   Creating new regear thread...');

      // Check permission for CTA regear
      const contentType = req.body.data.options[0].options[0].value;
      if (contentType === 'cta' && !hasPermissionSlash(member, 'ctaRegearRoles', guildId)) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: '❌ You need Administrator permission or an authorized role to use this command for CTA regear.',
            flags: 64
          },
        });
      }

      const threadTitle = req.body.data.options[0].options[1].value;
      const time = req.body.data.options[0].options[2].value;
      const channelId = req.body.channel_id;

      // Defer the response
      console.log('   ⏳ Deferring response...');
      res.send({
        type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          flags: 64
        }
      });

      try {
        // Create a thread in the channel
        console.log(`   📝 Creating ${contentType.toUpperCase()} regear thread...`);
        const threadResponse = await DiscordRequest(`channels/${channelId}/threads`, {
          method: 'POST',
          body: {
            name: threadTitle,
            type: 11,
            auto_archive_duration: 1440
          },
        });
        const threadData = await threadResponse.json();
        const threadId = threadData.id;
        console.log(`   ✅ Thread created: ${threadId}`);

        // Create embed based on content type
        const embedColor = contentType === 'cta' ? 0xe74c3c : 0x5865F2;
        const embedTitle = contentType === 'cta' ? '⚔️ CTA REGEAR' : '🛡️ FF REGEAR';
        const embedDescription = contentType === 'cta'
          ? `**SEND REGEAR HERE**\n**INCLUDE OC BREAK**\n**Time:** ${time}`
          : `**SEND REGEAR HERE**\n**Time:** ${time}`;

        const embed = new EmbedBuilder()
          .setColor(embedColor)
          .setTitle(embedTitle)
          .setDescription(embedDescription);

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
            content: `✅ ${contentType.toUpperCase()} regear thread created: **${threadTitle}**`,
            flags: 64
          },
        });
        console.log(`   ✅ /regear create ${contentType} completed successfully`);

      } catch (err) {
        console.error(`   ❌ Error creating ${contentType} regear thread:`, err);

        // Follow up with error message
        await DiscordRequest(`webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
          method: 'PATCH',
          body: {
            content: `❌ Failed to create ${contentType.toUpperCase()} regear thread.`,
            flags: 64
          },
        });
      }
      return;
    }

    // Subcommand: close
    if (subcommand === 'close') {
      console.log('   Closing regear thread...');

      // Check permission for regear close
      if (!hasPermissionSlash(member, 'ctaRegearRoles', guildId)) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: '❌ You need Administrator permission or an authorized role to close regear threads.',
            flags: 64
          },
        });
      }

      const channelId = req.body.channel_id;

      // Defer the response
      console.log('   ⏳ Deferring response...');
      res.send({
        type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          flags: 64
        }
      });

      try {
        // Get channel/thread info
        const channelResponse = await DiscordRequest(`channels/${channelId}`, {
          method: 'GET'
        });
        const channelData = await channelResponse.json();

        // Check if this is a thread
        if (channelData.type !== 11 && channelData.type !== 12) {
          await DiscordRequest(`webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
            method: 'PATCH',
            body: {
              content: '❌ This command must be used inside a thread.',
              flags: 64
            },
          });
          return;
        }

        const currentName = channelData.name;

        // Check if already closed (idempotency)
        if (currentName.includes('[✓]') || currentName.includes('(REGEARED)') || 
            currentName.includes('(CLEARED)') || currentName.includes('(COMPLETED)')) {
          await DiscordRequest(`webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
            method: 'PATCH',
            body: {
              content: '⚠️ This thread is already closed.',
              flags: 64
            },
          });
          return;
        }

        // Rename thread with [✓] suffix
        const newName = `${currentName} [✓]`;
        
        // Update thread: rename and lock
        await DiscordRequest(`channels/${channelId}`, {
          method: 'PATCH',
          body: {
            name: newName.substring(0, 100),
            locked: true,
            archived: false
          },
        });

        console.log(`   ✅ Thread closed: ${currentName} → ${newName}`);

        // Try to send follow-up message
        try {
          await DiscordRequest(`webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
            method: 'PATCH',
            body: {
              content: `✅ Thread closed and locked.`,
              flags: 64
            },
          });
        } catch (webhookErr) {
          console.log('   ⚠️ Thread closed successfully but could not send confirmation message (token expired)');
        }

      } catch (err) {
        console.error('   ❌ Error closing regear thread:', err);

        // Try to send error message
        try {
          await DiscordRequest(`webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
            method: 'PATCH',
            body: {
              content: '❌ Failed to close regear thread.',
              flags: 64
            },
          });
        } catch (webhookErr) {
          console.log('   ⚠️ Could not send error message (token expired)');
        }
      }
      return;
    }
  }

  // "/bank" command - Bank economy system
  if (name === 'bank') {
    console.log('💰 Executing /bank command');
    const subcommand = req.body.data.options[0].name;
    console.log(`   Subcommand: ${subcommand}`);
    const context = req.body.context;
    const userId = context === 0 ? req.body.member?.user?.id : req.body.user?.id;
    const member = req.body.member;
    const guildId = req.body.guild_id;

    // Bank commands only work in guilds
    if (!guildId) {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: '❌ Bank commands can only be used in a server.',
          flags: 64
        },
      });
    }

    // Check admin permission for deposit/withdraw
    const hasAdminPermission = hasPermissionSlash(member, 'bankAdminRoles', guildId);

    // Subcommand: deposit
    if (subcommand === 'deposit') {
      if (!hasAdminPermission) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: '❌ You need Administrator permission or an authorized role to use this command.',
            flags: 64
          },
        });
      }

      const targetUserId = req.body.data.options[0].options[0].value;
      const amount = req.body.data.options[0].options[1].value;

      const result = deposit(guildId, targetUserId, amount);

      if (!result.success) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `❌ ${result.error}`,
            flags: 64
          },
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0x2ecc71)
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
      if (!hasAdminPermission) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: '❌ You need Administrator permission or an authorized role to use this command.',
            flags: 64
          },
        });
      }

      const targetUserId = req.body.data.options[0].options[0].value;
      const amount = req.body.data.options[0].options[1].value;

      const result = withdraw(guildId, targetUserId, amount);

      if (!result.success) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `❌ ${result.error}`,
            flags: 64
          },
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
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
      const targetUserId = req.body.data.options[0]?.options?.[0]?.value || userId;
      
      if (!targetUserId) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: '❌ Unable to determine user for balance check.',
            flags: 64
          },
        });
      }

      const balance = getBalance(guildId, targetUserId);

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
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
      const activeUsers = getActiveUsers(guildId);

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
        .setColor(0xf39c12)
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
      if (!hasAdminPermission) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: '❌ You need Administrator permission or an authorized role to use this command.',
            flags: 64
          },
        });
      }

      const targetUserId = req.body.data.options[0].options[0].value;
      const result = clearUser(guildId, targetUserId);

      if (!result.success) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `❌ ${result.error}`,
            flags: 64
          },
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0xe67e22)
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
      if (!hasAdminPermission) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: '❌ You need Administrator permission or an authorized role to use this command.',
            flags: 64
          },
        });
      }

      const result = clearAll(guildId);

      if (!result.success) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `❌ ${result.error}`,
            flags: 64
          },
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0xc0392b)
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

  // "/ticket" command - Ticket system management (Admin only)
  if (name === 'ticket') {
    console.log('🎫 Executing /ticket command');
    const subcommand = req.body.data.options[0].name;
    const member = req.body.member;
    const guildId = req.body.guild_id;

    // Check for administrator permission
    if (!member || !member.permissions || (BigInt(member.permissions) & BigInt(PermissionFlagsBits.Administrator)) !== BigInt(PermissionFlagsBits.Administrator)) {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: '❌ You need Administrator permission to use this command.',
          flags: 64
        },
      });
    }

    // Subcommand: setup
    if (subcommand === 'setup') {
      const options = req.body.data.options[0].options;
      const panelId = options.find(o => o.name === 'panel_id').value;
      const ticketTypeName = options.find(o => o.name === 'ticket_type').value;
      const ticketCategoryId = options.find(o => o.name === 'category').value;
      const pingRoleId = options.find(o => o.name === 'ping_role').value;
      const staffRoleIds = options.find(o => o.name === 'staff_roles').value.split(',').map(id => id.trim());
      const transcriptChannelId = options.find(o => o.name === 'transcript_channel').value;

      try {
        const panels = await loadPanels(guildId);
        const existingIndex = panels.findIndex(p => p.panelId === panelId);
        
        const newPanel = {
          panelId,
          ticketTypeName,
          ticketCategoryId,
          pingRoleId,
          staffRoleIds,
          transcriptChannelId
        };

        if (existingIndex >= 0) {
          panels[existingIndex] = newPanel;
        } else {
          panels.push(newPanel);
        }

        await savePanels(guildId, panels);

        const embed = new EmbedBuilder()
          .setTitle('✅ Ticket Panel Configured')
          .addFields(
            { name: 'Panel ID', value: panelId, inline: true },
            { name: 'Ticket Type', value: ticketTypeName, inline: true },
            { name: 'Category', value: `<#${ticketCategoryId}>`, inline: true },
            { name: 'Ping Role', value: `<@&${pingRoleId}>`, inline: true },
            { name: 'Transcript Channel', value: `<#${transcriptChannelId}>`, inline: true },
            { name: 'Staff Roles', value: staffRoleIds.map(id => `<@&${id}>`).join(', '), inline: false }
          )
          .setColor(0x57F287)
          .setTimestamp();

        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            embeds: [embed.toJSON()],
            flags: 64
          },
        });

      } catch (error) {
        console.error('Error setting up ticket panel:', error);
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: '❌ Failed to setup ticket panel. Check the console for details.',
            flags: 64
          },
        });
      }
    }

    // Subcommand: list
    if (subcommand === 'list') {
      try {
        const panels = await loadPanels(guildId);

        if (panels.length === 0) {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: '❌ No ticket panels configured for this server.',
              flags: 64
            },
          });
        }

        const embed = new EmbedBuilder()
          .setTitle('🎫 Ticket Panels')
          .setColor(0x5865F2)
          .setTimestamp();

        for (const panel of panels) {
          const fields = [
            `Category: <#${panel.ticketCategoryId}>`,
            `Ping Role: <@&${panel.pingRoleId}>`,
            `Transcript: <#${panel.transcriptChannelId}>`,
            `Staff Roles: ${panel.staffRoleIds.map(id => `<@&${id}>`).join(', ')}`
          ];

          embed.addFields({
            name: `${panel.ticketTypeName} (${panel.panelId})`,
            value: fields.join('\n'),
            inline: false
          });
        }

        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            embeds: [embed.toJSON()],
            flags: 64
          },
        });

      } catch (error) {
        console.error('Error listing ticket panels:', error);
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: '❌ Failed to list ticket panels.',
            flags: 64
          },
        });
      }
    }

    // Subcommand: delete
    if (subcommand === 'delete') {
      const panelId = req.body.data.options[0].options[0].value;

      try {
        const panels = await loadPanels(guildId);
        const index = panels.findIndex(p => p.panelId === panelId);
        
        if (index === -1) {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: `❌ Panel "${panelId}" not found.`,
              flags: 64
            },
          });
        }

        panels.splice(index, 1);
        await savePanels(guildId, panels);

        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `✅ Ticket panel "${panelId}" deleted.`,
            flags: 64
          },
        });

      } catch (error) {
        console.error('Error deleting ticket panel:', error);
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: '❌ Failed to delete ticket panel.',
            flags: 64
          },
        });
      }
    }

    // Subcommand: stats
    if (subcommand === 'stats') {
      try {
        const stats = await getTicketStats(guildId);

        if (!stats) {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: '❌ Failed to retrieve ticket statistics.',
              flags: 64
            },
          });
        }

        const embed = new EmbedBuilder()
          .setTitle('📊 Ticket Statistics')
          .addFields(
            { name: 'Total Tickets', value: String(stats.total), inline: true },
            { name: 'Open', value: String(stats.open), inline: true },
            { name: 'Claimed', value: String(stats.claimed), inline: true },
            { name: 'Closed', value: String(stats.closed), inline: true },
            { name: 'Approved', value: String(stats.approved), inline: true },
            { name: 'Last Ticket ID', value: String(stats.lastTicketId), inline: true }
          )
          .setColor(0x5865F2)
          .setTimestamp();

        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            embeds: [embed.toJSON()],
            flags: 64
          },
        });

      } catch (error) {
        console.error('Error getting ticket stats:', error);
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: '❌ Failed to retrieve ticket statistics.',
            flags: 64
          },
        });
      }
    }

    // Subcommand: health
    if (subcommand === 'health') {
      try {
        const health = await ticketSystemHealthCheck(guildId);

        const statusEmoji = {
          healthy: '✅',
          warning: '⚠️',
          error: '❌'
        }[health.status];

        const embed = new EmbedBuilder()
          .setTitle(`${statusEmoji} Ticket System Health Check`)
          .addFields(
            { name: 'Status', value: health.status.toUpperCase(), inline: true },
            { name: 'Panels', value: String(health.stats?.panels || 0), inline: true },
            { name: 'Total Tickets', value: String(health.stats?.totalTickets || 0), inline: true }
          )
          .setColor(health.status === 'healthy' ? 0x57F287 : health.status === 'warning' ? 0xFEE75C : 0xED4245)
          .setTimestamp();

        if (health.issues.length > 0) {
          embed.addFields({
            name: 'Issues',
            value: health.issues.join('\\n'),
            inline: false
          });
        }

        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            embeds: [embed.toJSON()],
            flags: 64
          },
        });

      } catch (error) {
        console.error('Error running health check:', error);
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: '❌ Failed to run health check.',
            flags: 64
          },
        });
      }
    }

    // Subcommand: panel
    if (subcommand === 'panel') {
      try {
        const panelId = req.body.data.options[0].options?.[0]?.value || 'apply';

        // Verify panel exists
        const panels = await loadPanels(guildId);
        const panel = panels.find(p => p.panelId === panelId);

        if (!panel) {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: `❌ Panel "${panelId}" not found. Use \`/ticket list\` to see available panels.`,
              flags: 64
            },
          });
        }

        // Get channel from client
        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: '❌ Could not find guild.',
              flags: 64
            },
          });
        }

        const channelId = req.body.channel_id;
        const channel = guild.channels.cache.get(channelId);
        if (!channel) {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: '❌ Could not find channel.',
              flags: 64
            },
          });
        }

        // Import createApplyPanelMessage function
        const { createApplyPanelMessage } = await import('../systems/ticket/ticket-system.js');
        const panelMessage = createApplyPanelMessage();
        await channel.send(panelMessage);

        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `✅ ${panel.ticketTypeName} panel sent to <#${channelId}>!`,
            flags: 64
          },
        });

      } catch (error) {
        console.error('Error sending ticket panel:', error);
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: '❌ Failed to send ticket panel.',
            flags: 64
          },
        });
      }
    }
  }

  // "/help" command - Show available commands with pagination
  if (name === 'help') {
    console.log('❓ Executing /help command');
    const guildId = req.body.guild_id;
    const member = req.body.member;
    
    const pages = buildPaginatedHelpEmbeds(member, guildId, true);
    
    // If only one page, send without buttons
    if (pages.length === 1) {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          embeds: [pages[0].toJSON()],
          flags: 64
        },
      });
    }
    
    // Multiple pages - send with navigation buttons
    const buttons = buildHelpNavigationButtons(0, pages.length);
    
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        embeds: [pages[0].toJSON()],
        components: [buttons.toJSON()],
        flags: 64
      },
    });
  }

  // "/perms" command - Manage role permissions (Admin only)
  if (name === 'perms') {
    console.log('🔐 Executing /perms command');
    const member = req.body.member;
    const subcommand = req.body.data.options[0].name;
    
    // Check if user is Discord Administrator
    const isAdmin = member && member.permissions && 
      (BigInt(member.permissions) & BigInt(PermissionFlagsBits.Administrator)) === BigInt(PermissionFlagsBits.Administrator);
    
    if (!isAdmin) {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: '❌ You need Administrator permission to manage permissions.',
          flags: 64
        },
      });
    }

    // Subcommand: list
    if (subcommand === 'list') {
      const guildId = req.body.guild_id;
      const permissions = loadPermissions(guildId);
      const bankRoles = permissions.bankAdminRoles.map(id => `<@&${id}>`).join('\n') || '*None*';
      const ctaRoles = permissions.ctaRegearRoles.map(id => `<@&${id}>`).join('\n') || '*None*';
      
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🔐 Current Role Permissions')
        .addFields(
          { name: '💰 Bank Admin Roles', value: bankRoles, inline: false },
          { name: '⚔️ CTA Regear Roles', value: ctaRoles, inline: false }
        )
        .setFooter({ text: 'Administrators always have access to all commands' })
        .setTimestamp();
      
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          embeds: [embed.toJSON()],
          flags: 64
        },
      });
    }

    // Subcommand: add
    if (subcommand === 'add') {
      const guildId = req.body.guild_id;
      const permType = req.body.data.options[0].options[0].value;
      const roleId = req.body.data.options[0].options[1].value;
      
      let configKey;
      let displayName;
      if (permType === 'bank') {
        configKey = 'bankAdminRoles';
        displayName = 'Bank Admin';
      } else if (permType === 'cta') {
        configKey = 'ctaRegearRoles';
        displayName = 'CTA Regear';
      } else {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: '❌ Invalid permission type.',
            flags: 64
          },
        });
      }

      const permissions = loadPermissions(guildId);

      if (permissions[configKey].includes(roleId)) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `❌ Role <@&${roleId}> already has ${displayName} permission.`,
            flags: 64
          },
        });
      }
      
      permissions[configKey].push(roleId);
      savePermissions(guildId, permissions);
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `✅ Added <@&${roleId}> to ${displayName} permissions.`,
          flags: 64
        },
      });
    }

    // Subcommand: remove
    if (subcommand === 'remove') {
      const guildId = req.body.guild_id;
      const permType = req.body.data.options[0].options[0].value;
      const roleId = req.body.data.options[0].options[1].value;
      
      let configKey;
      let displayName;
      if (permType === 'bank') {
        configKey = 'bankAdminRoles';
        displayName = 'Bank Admin';
      } else if (permType === 'cta') {
        configKey = 'ctaRegearRoles';
        displayName = 'CTA Regear';
      } else {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: '❌ Invalid permission type.',
            flags: 64
          },
        });
      }

      const permissions = loadPermissions(guildId);
      const index = permissions[configKey].indexOf(roleId);
      
      if (index === -1) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `❌ Role <@&${roleId}> doesn't have ${displayName} permission.`,
            flags: 64
          },
        });
      }
      
      permissions[configKey].splice(index, 1);
      savePermissions(guildId, permissions);
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `✅ Removed <@&${roleId}> from ${displayName} permissions.`,
          flags: 64
        },
      });
    }
  }

  console.error(`❌ Unknown command: ${name}`);
  return res.status(400).json({ error: 'unknown command' });
}
