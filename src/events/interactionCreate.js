import { InteractionResponseType } from 'discord-interactions';
import { DiscordRequest } from '../../utils.js';
import { 
  handleApplyTicket, 
  handleClaimTicket, 
  handleCloseTicket 
} from '../systems/ticket/ticket-system.js';
import { buildPaginatedHelpEmbeds, buildHelpNavigationButtons } from '../utils/embedBuilder.js';
import { registerUser } from '../systems/albion/albion.js';
import { EmbedBuilder } from 'discord.js';
import { buildContentEmbed, buildContentComponents, autoAssignFillPlayers } from '../services/contentService.js';
import { contentState } from '../config/contentState.js';

// Valid roles per content type
const CONTENT_VALID_ROLES = {
  roa:        ['tank', 'heal', 'mp', 'mp2', 'shadowcaller', 'blazing', 'flex'],
  roapvp:     ['tank', 'heal', 'blaze', 'sc', 'perma', 'lc', 'mp'],
  gcamps:     ['tank', 'heal', 'shadowcaller', 'blazing', 'badon'],
  tracking:   ['tank', 'heal', 'dpair', 'hpcut', 'flexdps'],
  avadungeon: ['tank', 'offtank', 'stun', 'mainhealer', 'partyhealer', 'shadowcaller', 'dps1', 'dps2', 'dps3', 'dps4'],
  rck:        ['tank', 'heal', 'longbow', 'realmbreaker', 'kingmaker', 'heron', 'bloodletter'],
  rcb:        ['tank', 'heal', 'realmcarving', 'longbow', 'brawl1', 'brawl2', 'brawl3'],
  cta:        ['tank', 'heal', 'dps', 'support', 'dtank'],
  ff:         ['tank', 'heal', 'dps'],
};
const FIXED_SLOT_TYPES  = ['roa', 'roapvp', 'gcamps', 'tracking', 'avadungeon', 'rck', 'rcb'];
const CATEGORY_TYPES    = ['cta', 'ff'];
const FILL_TYPES        = ['roa', 'roapvp', 'gcamps', 'avadungeon', 'rck', 'rcb'];

// Shared logic for all content button interactions
async function processContentButton(componentId, userId, client) {
  if (!contentState.active) {
    return { message: '❌ No active content callout.', updated: false };
  }
  const contentType = contentState.contentType;
  const validRoles  = CONTENT_VALID_ROLES[contentType] || [];
  let message = '';
  let updated = false;

  if (componentId === 'content_cancel') {
    let found = false;
    if (FIXED_SLOT_TYPES.includes(contentType)) {
      for (const [k, uid] of Object.entries(contentState.roles)) {
        if (uid === userId) { contentState.roles[k] = null; found = true; break; }
      }
      const idx = contentState.fill.indexOf(userId);
      if (idx > -1) { contentState.fill.splice(idx, 1); found = true; }
    } else if (CATEGORY_TYPES.includes(contentType)) {
      for (const [, list] of Object.entries(contentState.categories)) {
        const idx = list.indexOf(userId);
        if (idx > -1) { list.splice(idx, 1); found = true; break; }
      }
    }
    message = found ? '✅ You have been removed from the role call.' : 'ℹ️ You are not currently signed up.';
    updated = found;

  } else if (componentId === 'content_fill') {
    if (!FILL_TYPES.includes(contentType)) {
      message = '❌ Fill is only available for fixed-slot content types (not Tracking, CTA, or FF).';
    } else if (contentState.fill.includes(userId)) {
      message = 'ℹ️ You are already in the fill list.';
    } else {
      for (const [k, uid] of Object.entries(contentState.roles)) {
        if (uid === userId) contentState.roles[k] = null;
      }
      contentState.fill.push(userId);
      await autoAssignFillPlayers(client);
      message = '🔄 You have been added to the fill list!';
      updated = true;
    }

  } else {
    // content_role_[roleKey]
    const roleKey = componentId.replace('content_role_', '');
    if (!validRoles.includes(roleKey)) {
      message = `❌ This role is not valid for **${contentType.toUpperCase()}** content.`;
    } else if (CATEGORY_TYPES.includes(contentType)) {
      if (contentState.categories[roleKey].includes(userId)) {
        message = `ℹ️ You are already signed up as **${roleKey.toUpperCase()}**.`;
      } else {
        for (const [, list] of Object.entries(contentState.categories)) {
          const idx = list.indexOf(userId);
          if (idx > -1) list.splice(idx, 1);
        }
        contentState.categories[roleKey].push(userId);
        message = `✅ You've signed up as **${roleKey.toUpperCase()}**!`;
        updated = true;
      }
    } else {
      // Fixed slot
      if (contentState.roles[roleKey] && contentState.roles[roleKey] !== userId) {
        message = `❌ The **${roleKey.toUpperCase()}** slot is already taken by <@${contentState.roles[roleKey]}>!`;
      } else if (contentState.roles[roleKey] === userId) {
        message = `ℹ️ You are already signed up as **${roleKey.toUpperCase()}**.`;
      } else {
        for (const [k, uid] of Object.entries(contentState.roles)) {
          if (uid === userId) contentState.roles[k] = null;
        }
        const fillIdx = contentState.fill.indexOf(userId);
        if (fillIdx > -1) contentState.fill.splice(fillIdx, 1);
        contentState.roles[roleKey] = userId;
        await autoAssignFillPlayers(client);
        message = `✅ You've signed up as **${roleKey.toUpperCase()}**!`;
        updated = true;
      }
    }
  }

  return { message, updated };
}

export async function handleInteractionCreate(interaction) {
  try {
    // Handle button interactions
    if (!interaction.isButton()) return;

    const customId = interaction.customId;

    // Albion registration button handler
    if (customId.startsWith('albion_register_')) {
      // Parse custom ID: albion_register_userId_region_type_playerId
      const parts = customId.split('_');
      const userId = parts[2];
      const region = parts[3];
      const registerType = ['alliance', 'guild', 'player'].includes(parts[4]) ? parts[4] : 'guild';
      const playerIdStartIndex = ['alliance', 'guild', 'player'].includes(parts[4]) ? 5 : 4;
      const playerId = parts.slice(playerIdStartIndex).join('_'); // Handle IDs with underscores

      // Check if the button clicker is the same user who initiated registration
      if (interaction.user.id !== userId) {
        await interaction.reply({
          content: '❌ This registration is not for you. Please use `/register` to register your own character.',
          ephemeral: true
        });
        return;
      }

      // Defer the reply
      await interaction.deferReply({ ephemeral: true });

      // Perform registration with the player ID
      const result = await registerUser(interaction.guild, userId, region, null, playerId, registerType);

      if (!result.success) {
        await interaction.editReply({
          content: `❌ Registration failed: ${result.message}`
        });
        return;
      }

      // Success - send confirmation
      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('✅ Registration Successful')
        .setDescription(result.message)
        .addFields(
          { name: 'In-Game Name', value: result.data.ign, inline: true },
          { name: 'Type', value: (result.data.registerType || registerType).toUpperCase(), inline: true },
          { name: 'Region', value: region.toUpperCase(), inline: true }
        )
        .setTimestamp();

      if (result.data.guild) {
        embed.addFields({ name: 'Guild', value: result.data.guild, inline: true });
      }

      if (result.data.alliance) {
        embed.addFields({ name: 'Alliance', value: result.data.alliance, inline: true });
      }

      if (result.data.roleAssigned) {
        embed.addFields({ name: 'Role', value: `✅ ${result.data.roleName || 'Assigned'}`, inline: true });
      } else if (result.data.roleWarning) {
        embed.addFields({ name: 'Role', value: `⚠️ ${result.data.roleWarning}`, inline: false });
      }

      if (result.data.nicknameApplied) {
        embed.addFields({ name: 'Nickname', value: `✅ ${result.data.nickname}`, inline: false });
      } else if (result.data.nicknameWarning) {
        embed.addFields({ name: 'Nickname', value: `⚠️ ${result.data.nicknameWarning}`, inline: false });
      }

      await interaction.editReply({
        embeds: [embed]
      });

      // Try to delete the original selection message
      try {
        await interaction.message.delete();
      } catch (error) {
        console.log('Could not delete selection message:', error.message);
      }

      return;
    }

    // Content role-call button handlers
    if (customId.startsWith('content_role_') || customId === 'content_fill' || customId === 'content_cancel') {
      await interaction.deferReply({ ephemeral: true });
      try {
        const { message, updated } = await processContentButton(customId, interaction.user.id, interaction.client);
        if (updated) {
          const embed = buildContentEmbed();
          const components = buildContentComponents();
          await DiscordRequest(`channels/${contentState.channelId}/messages/${contentState.messageId}`, {
            method: 'PATCH',
            body: {
              embeds: [embed.toJSON()],
              components: components.map(r => r.toJSON())
            }
          });
        }
        await interaction.editReply({ content: message });
      } catch (err) {
        console.error('Error handling content button (gateway):', err);
        await interaction.editReply({ content: '❌ An error occurred. Please try again.' });
      }
      return;
    }

    // Ticket system buttons
    if (customId === 'apply_ticket') {
      await handleApplyTicket(interaction);
      return;
    }

    if (customId === 'ticket_claim') {
      await handleClaimTicket(interaction);
      return;
    }

    if (customId === 'ticket_close') {
      await handleCloseTicket(interaction);
      return;
    }

  } catch (error) {
    console.error('Error handling interaction:', error);
    
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '❌ An error occurred while processing your request.',
        ephemeral: true
      }).catch(console.error);
    }
  }
}

// Button interactions handler for Express endpoint
export async function handleButtonInteractions(req, res, client) {
  const componentId = req.body.data.custom_id;

  // Content role-call button handlers
  if (componentId.startsWith('content_role_') || componentId === 'content_fill' || componentId === 'content_cancel') {
    const userId = req.body.member?.user?.id || req.body.user?.id;

    // Acknowledge immediately with a deferred ephemeral reply
    res.send({
      type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
      data: { flags: 64 }
    });

    let replyContent = '';
    try {
      const { message, updated } = await processContentButton(componentId, userId, client);
      replyContent = message;
      if (updated) {
        const embed = buildContentEmbed();
        const components = buildContentComponents();
        await DiscordRequest(`channels/${contentState.channelId}/messages/${contentState.messageId}`, {
          method: 'PATCH',
          body: {
            embeds: [embed.toJSON()],
            components: components.map(r => r.toJSON())
          }
        });
      }
    } catch (err) {
      console.error('Error handling content button (express):', err);
      replyContent = '❌ An error occurred. Please try again.';
    }

    await DiscordRequest(`webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
      method: 'PATCH',
      body: { content: replyContent, flags: 64 }
    });
    return;
  }

  // Albion registration button handler
  if (componentId.startsWith('albion_register_')) {
    console.log('🎮 Albion registration button clicked');
    const parts = componentId.split('_');
    const requestUserId = parts[2];
    const region = parts[3];
    const registerType = ['alliance', 'guild', 'player'].includes(parts[4]) ? parts[4] : 'guild';
    const playerIdStartIndex = ['alliance', 'guild', 'player'].includes(parts[4]) ? 5 : 4;
    const playerId = parts.slice(playerIdStartIndex).join('_');
    
    const clickerId = req.body.member?.user?.id || req.body.user?.id;

    // Check if the button clicker is the same user who initiated registration
    if (clickerId !== requestUserId) {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: '❌ This registration is not for you. Please use `/register` to register your own character.',
          flags: 64
        }
      });
    }

    // Defer response
    res.send({
      type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
      data: { flags: 64 }
    });

    try {
      const guild = client.guilds.cache.get(req.body.guild_id);
      const result = await registerUser(guild, requestUserId, region, null, playerId, registerType);

      if (!result.success) {
        await DiscordRequest(`webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
          method: 'PATCH',
          body: {
            content: `❌ Registration failed: ${result.message}`,
            flags: 64
          }
        });
        return;
      }

      // Success
      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('✅ Registration Successful')
        .setDescription(result.message)
        .addFields(
          { name: 'In-Game Name', value: result.data.ign, inline: true },
          { name: 'Type', value: (result.data.registerType || registerType).toUpperCase(), inline: true },
          { name: 'Region', value: region.toUpperCase(), inline: true }
        )
        .setTimestamp();

      if (result.data.guild) {
        embed.addFields({ name: 'Guild', value: result.data.guild, inline: true });
      }

      if (result.data.alliance) {
        embed.addFields({ name: 'Alliance', value: result.data.alliance, inline: true });
      }

      if (result.data.roleAssigned) {
        embed.addFields({ name: 'Role', value: `✅ ${result.data.roleName || 'Assigned'}`, inline: true });
      } else if (result.data.roleWarning) {
        embed.addFields({ name: 'Role', value: `⚠️ ${result.data.roleWarning}`, inline: false });
      }

      if (result.data.nicknameApplied) {
        embed.addFields({ name: 'Nickname', value: `✅ ${result.data.nickname}`, inline: false });
      } else if (result.data.nicknameWarning) {
        embed.addFields({ name: 'Nickname', value: `⚠️ ${result.data.nicknameWarning}`, inline: false });
      }

      await DiscordRequest(`webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
        method: 'PATCH',
        body: {
          embeds: [embed.toJSON()],
          components: [], // Remove buttons
          flags: 64
        }
      });

    } catch (error) {
      console.error('Error in albion registration button:', error);
      await DiscordRequest(`webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
        method: 'PATCH',
        body: {
          content: '❌ An unexpected error occurred during registration.',
          flags: 64
        }
      });
    }
    return;
  }

  // Ticket system button handlers
  if (componentId === 'apply_ticket') {
    console.log('🎫 Apply ticket button clicked');
    const interaction = {
      customId: componentId,
      guildId: req.body.guild_id,
      user: req.body.member?.user || req.body.user,
      member: req.body.member,
      channelId: req.body.channel_id,
      guild: client.guilds.cache.get(req.body.guild_id),
      deferReply: async (options) => {
        return res.send({
          type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
          data: { flags: options?.ephemeral ? 64 : 0 }
        });
      },
      editReply: async (options) => {
        await DiscordRequest(`webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
          method: 'PATCH',
          body: {
            content: options.content,
            embeds: options.embeds?.map(e => e.toJSON?.() || e),
            flags: options.ephemeral ? 64 : 0
          }
        });
      },
      reply: async (options) => {
        if (!res.headersSent) {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: options.content,
              embeds: options.embeds?.map(e => e.toJSON?.() || e),
              flags: options.ephemeral ? 64 : 0
            }
          });
        }
      }
    };

    await handleApplyTicket(interaction);
    return;
  }

  if (componentId === 'ticket_claim') {
    console.log('✋ Claim ticket button clicked');
    const guild = client.guilds.cache.get(req.body.guild_id);
    const userId = req.body.member?.user?.id || req.body.user?.id;
    
    // Fetch the member from guild to get proper roles
    let guildMember = null;
    if (guild && userId) {
      try {
        guildMember = await guild.members.fetch(userId);
      } catch (error) {
        console.error('Failed to fetch member:', error);
      }
    }

    const interaction = {
      customId: componentId,
      guildId: req.body.guild_id,
      user: req.body.member?.user || req.body.user,
      member: guildMember,
      channelId: req.body.channel_id,
      guild: guild,
      reply: async (options) => {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: options.content,
            embeds: options.embeds?.map(e => e.toJSON?.() || e),
            flags: options.ephemeral ? 64 : 0
          }
        });
      }
    };

    await handleClaimTicket(interaction);
    return;
  }

  if (componentId === 'ticket_close') {
    console.log('🔒 Close ticket button clicked');
    const guild = client.guilds.cache.get(req.body.guild_id);
    const userId = req.body.member?.user?.id || req.body.user?.id;
    
    // Fetch the member from guild to get proper roles
    let guildMember = null;
    if (guild && userId) {
      try {
        guildMember = await guild.members.fetch(userId);
      } catch (error) {
        console.error('Failed to fetch member:', error);
      }
    }

    const interaction = {
      customId: componentId,
      guildId: req.body.guild_id,
      user: req.body.member?.user || req.body.user,
      member: guildMember,
      channelId: req.body.channel_id,
      guild: guild,
      channel: guild?.channels.cache.get(req.body.channel_id),
      deferReply: async (options) => {
        return res.send({
          type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
          data: { flags: options?.ephemeral ? 64 : 0 }
        });
      },
      editReply: async (options) => {
        await DiscordRequest(`webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
          method: 'PATCH',
          body: {
            content: options.content,
            embeds: options.embeds?.map(e => e.toJSON?.() || e),
            flags: options.ephemeral ? 64 : 0
          }
        });
      },
      reply: async (options) => {
        if (!res.headersSent) {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: options.content,
              embeds: options.embeds?.map(e => e.toJSON?.() || e),
              flags: options.ephemeral ? 64 : 0
            }
          });
        }
      },
      deferred: false
    };

    await handleCloseTicket(interaction);
    return;
  }

  // Help pagination buttons
  if (componentId.startsWith('help_prev_') || componentId.startsWith('help_next_')) {
    console.log('📖 Help pagination button clicked');
    const guildId = req.body.guild_id;
    const member = req.body.member;
    
    // Extract current page from button ID
    const currentPage = parseInt(componentId.split('_')[2]);
    const isNext = componentId.startsWith('help_next_');
    const newPage = isNext ? currentPage + 1 : currentPage - 1;
    
    // Build help pages
    const pages = buildPaginatedHelpEmbeds(member, guildId, true);
    
    // Validate page number
    if (newPage < 0 || newPage >= pages.length) {
      return res.send({
        type: InteractionResponseType.UPDATE_MESSAGE,
        data: {}
      });
    }
    
    // Build new navigation buttons
    const buttons = buildHelpNavigationButtons(newPage, pages.length);
    
    // Update the message with new page
    return res.send({
      type: InteractionResponseType.UPDATE_MESSAGE,
      data: {
        embeds: [pages[newPage].toJSON()],
        components: [buttons.toJSON()],
        flags: 64
      }
    });
  }

  console.error(`❌ Unknown component ID: ${componentId}`);
  return res.status(400).json({ error: 'unknown component' });
}
