import { InteractionResponseType } from 'discord-interactions';
import { DiscordRequest } from '../../utils.js';
import { 
  handleApplyTicket, 
  handleClaimTicket, 
  handleCloseTicket 
} from '../systems/ticket/ticket-system.js';
import { buildPaginatedHelpEmbeds, buildHelpNavigationButtons } from '../utils/embedBuilder.js';
import { registerUser } from '../systems/albion/albion.js';
import { EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import { buildContentEmbed, buildContentComponents, buildRoleSelector, autoAssignFillPlayers } from '../services/contentService.js';
import { contentState, pendingCreations } from '../config/contentState.js';

// Shared logic for all content button interactions
async function processContentButton(componentId, userId, client) {
  if (!contentState.active) {
    return { message: '❌ No active content callout.', updated: false };
  }
  let message = '';
  let updated = false;

  if (componentId === 'content_cancel') {
    let found = false;
    for (const [k, uid] of Object.entries(contentState.roles)) {
      if (uid === userId) { contentState.roles[k] = null; found = true; break; }
    }
    const idx = contentState.fill.indexOf(userId);
    if (idx > -1) { contentState.fill.splice(idx, 1); found = true; }
    message = found ? '✅ You have been removed from the role call.' : 'ℹ️ You are not currently signed up.';
    updated = found;

  } else if (componentId === 'content_fill') {
    if (contentState.fill.includes(userId)) {
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
    if (!contentState.activeRoles.includes(roleKey)) {
      message = `❌ This role is not part of the current content.`;
    } else if (contentState.roles[roleKey] && contentState.roles[roleKey] !== userId) {
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

  return { message, updated };
}

export async function handleInteractionCreate(interaction) {
  try {
    // Handle string select menus (content creation flow)
    if (interaction.isStringSelectMenu()) {
      const customId = interaction.customId;

      if (customId === 'content_size_select') {
        const partySize = parseInt(interaction.values[0]);
        const userId = interaction.user.id;
        pendingCreations.set(userId, { partySize });
        await interaction.update({
          content: `**Step 2/3** — Pick exactly **${partySize}** roles for your party:`,
          components: buildRoleSelector(partySize)
        });
        return;
      }

      if (customId === 'content_role_select') {
        const roles = interaction.values;
        const userId = interaction.user.id;
        const pending = pendingCreations.get(userId) || {};
        pendingCreations.set(userId, { ...pending, roles });

        const modal = new ModalBuilder()
          .setCustomId('content_create_modal')
          .setTitle('Content Details')
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('modal_title')
                .setLabel('Content Title')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('e.g. ROA Sunday Run')
                .setRequired(true)
                .setMaxLength(100)
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('modal_time')
                .setLabel('Time (e.g. 20:00 UTC)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('20:00 UTC')
                .setRequired(true)
                .setMaxLength(50)
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('modal_demass')
                .setLabel('Demass Notice (optional)')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Leave blank if no demass notice')
                .setRequired(false)
                .setMaxLength(500)
            )
          );
        await interaction.showModal(modal);
        return;
      }
      return;
    }

    // Handle modal submits (content creation step 3)
    if (interaction.isModalSubmit()) {
      const customId = interaction.customId;
      if (customId === 'content_create_modal') {
        const userId = interaction.user.id;
        const channelId = interaction.channelId;
        const title = interaction.fields.getTextInputValue('modal_title');
        const time = interaction.fields.getTextInputValue('modal_time');
        const demassNotice = interaction.fields.getTextInputValue('modal_demass') || '';

        const pending = pendingCreations.get(userId);
        if (!pending?.roles?.length) {
          await interaction.reply({ content: '❌ Session expired. Please run `/content create` again.', ephemeral: true });
          return;
        }

        contentState.active = true;
        contentState.title = title;
        contentState.time = time;
        contentState.demassNotice = demassNotice;
        contentState.activeRoles = pending.roles;
        contentState.roles = Object.fromEntries(pending.roles.map(k => [k, null]));
        contentState.fill = [];
        pendingCreations.delete(userId);

        await interaction.deferReply({ ephemeral: true });
        try {
          const embed = buildContentEmbed();
          const threadResponse = await DiscordRequest(`channels/${channelId}/threads`, {
            method: 'POST',
            body: { name: title, type: 11, auto_archive_duration: 1440 }
          });
          const threadData = await threadResponse.json();
          const threadId = threadData.id;

          const messageResponse = await DiscordRequest(`channels/${threadId}/messages`, {
            method: 'POST',
            body: {
              content: '<@&1344897722196430879>',
              embeds: [embed.toJSON()],
              components: buildContentComponents().map(r => r.toJSON())
            }
          });
          const messageData = await messageResponse.json();

          contentState.messageId = messageData.id;
          contentState.channelId = threadId;
          contentState.threadId = threadId;

          await interaction.editReply({ content: `✅ Content thread created: **${title}**` });
        } catch (err) {
          console.error('❌ Error creating content thread (gateway modal):', err);
          contentState.active = false;
          await interaction.editReply({ content: '❌ Failed to create content thread. Please try again.' });
        }
        return;
      }
      return;
    }

    // Handle button interactions

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

  // Content size select menu handler
  if (componentId === 'content_size_select') {
    const partySize = parseInt(req.body.data.values[0]);
    const userId = req.body.member?.user?.id || req.body.user?.id;
    pendingCreations.set(userId, { partySize });
    return res.send({
      type: InteractionResponseType.UPDATE_MESSAGE,
      data: {
        content: `**Step 2/3** — Pick exactly **${partySize}** roles for your party:`,
        components: buildRoleSelector(partySize).map(r => r.toJSON())
      }
    });
  }

  // Content role select menu handler — opens modal
  if (componentId === 'content_role_select') {
    const userId = req.body.member?.user?.id || req.body.user?.id;
    const roles = req.body.data.values;
    const pending = pendingCreations.get(userId) || {};
    pendingCreations.set(userId, { ...pending, roles });
    return res.send({
      type: 9, // MODAL
      data: {
        custom_id: 'content_create_modal',
        title: 'Content Details',
        components: [
          { type: 1, components: [{ type: 4, custom_id: 'modal_title', label: 'Content Title', style: 1, placeholder: 'e.g. ROA Sunday Run', required: true, max_length: 100 }] },
          { type: 1, components: [{ type: 4, custom_id: 'modal_time', label: 'Time (e.g. 20:00 UTC)', style: 1, placeholder: '20:00 UTC', required: true, max_length: 50 }] },
          { type: 1, components: [{ type: 4, custom_id: 'modal_demass', label: 'Demass Notice (optional)', style: 2, placeholder: 'Leave blank if no demass notice', required: false, max_length: 500 }] }
        ]
      }
    });
  }

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

// Modal submit handler for Express endpoint (interaction type 5)
export async function handleModalSubmit(req, res, client) {
  const customId = req.body.data.custom_id;
  if (customId !== 'content_create_modal') {
    return res.status(400).json({ error: 'unknown modal' });
  }

  const userId = req.body.member?.user?.id || req.body.user?.id;
  const channelId = req.body.channel_id;
  const modalComponents = req.body.data.components;

  const title = modalComponents[0].components[0].value;
  const time = modalComponents[1].components[0].value;
  const demassNotice = modalComponents[2]?.components[0]?.value || '';

  const pending = pendingCreations.get(userId);
  if (!pending?.roles?.length) {
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: '❌ Session expired. Please run `/content create` again.', flags: 64 }
    });
  }

  contentState.active = true;
  contentState.title = title;
  contentState.time = time;
  contentState.demassNotice = demassNotice;
  contentState.activeRoles = pending.roles;
  contentState.roles = Object.fromEntries(pending.roles.map(k => [k, null]));
  contentState.fill = [];
  pendingCreations.delete(userId);

  // Acknowledge the modal
  res.send({
    type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
    data: { flags: 64 }
  });

  try {
    const embed = buildContentEmbed();
    const threadResponse = await DiscordRequest(`channels/${channelId}/threads`, {
      method: 'POST',
      body: { name: title, type: 11, auto_archive_duration: 1440 }
    });
    const threadData = await threadResponse.json();
    const threadId = threadData.id;

    const messageResponse = await DiscordRequest(`channels/${threadId}/messages`, {
      method: 'POST',
      body: {
        content: '<@&1344897722196430879>',
        embeds: [embed.toJSON()],
        components: buildContentComponents().map(r => r.toJSON())
      }
    });
    const messageData = await messageResponse.json();

    contentState.messageId = messageData.id;
    contentState.channelId = threadId;
    contentState.threadId = threadId;

    await DiscordRequest(`webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
      method: 'PATCH',
      body: { content: `✅ Content thread created: **${title}**`, flags: 64 }
    });
  } catch (err) {
    console.error('❌ Error creating content thread from modal:', err);
    contentState.active = false;
    await DiscordRequest(`webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
      method: 'PATCH',
      body: { content: '❌ Failed to create content thread. Please try again.', flags: 64 }
    });
  }
}
