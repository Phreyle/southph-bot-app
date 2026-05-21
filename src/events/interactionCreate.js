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
import { buildContentEmbed, buildContentComponents, buildMethodSelector, buildPresetNondpsMessage, buildPresetDpsMessage, buildCustomRoleModal, buildContinueToDetailsButton, buildContentDetailsModal, buildContentPreviewEmbed, buildPreviewComponents, buildDuplicatesStep, autoAssignFillPlayers, getRoleDisplayName, getBaseKey, ROLE_MAP } from '../services/contentService.js';
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

      // Step 1 result: party size chosen → show method buttons
      if (customId === 'content_size_select') {
        const partySize = parseInt(interaction.values[0]);
        const userId = interaction.user.id;
        pendingCreations.set(userId, {
          partySize,
          method: null,
          assignedRoles: [],
          customRoleNames: {},
          presetTank: [],
          presetHeal: [],
          presetSupport: [],
          presetDpsG1: [],
          presetDpsG2: [],
          presetDpsG3: [],
          presetDpsG4: [],
        });
        await interaction.update({
          content: `**Step 2 of 4** — Party size: **${partySize}**\nHow do you want to assign roles?`,
          components: buildMethodSelector(),
        });
        return;
      }

      // Step 3a (Preset): Tank/Heal/Support selects — update state and re-render non-DPS message
      for (const [field, id] of [
        ['presetTank', 'content_preset_tank'],
        ['presetHeal', 'content_preset_heal'],
        ['presetSupport', 'content_preset_support'],
      ]) {
        if (customId === id) {
          const userId = interaction.user.id;
          const pending = pendingCreations.get(userId);
          if (!pending) {
            await interaction.reply({ content: '❌ Session expired. Run `/content create` again.', ephemeral: true });
            return;
          }
          pending[field] = interaction.values;
          pendingCreations.set(userId, pending);
          const { content, components } = buildPresetNondpsMessage(pending.partySize, pending.presetTank, pending.presetHeal, pending.presetSupport);
          await interaction.update({ content, components });
          return;
        }
      }

      // Step 3b (Preset): DPS group selects — update state and re-render DPS message
      for (const [field, id] of [
        ['presetDpsG1', 'content_preset_dps_g1'],
        ['presetDpsG2', 'content_preset_dps_g2'],
        ['presetDpsG3', 'content_preset_dps_g3'],
        ['presetDpsG4', 'content_preset_dps_g4'],
      ]) {
        if (customId === id) {
          const userId = interaction.user.id;
          const pending = pendingCreations.get(userId);
          if (!pending) {
            await interaction.reply({ content: '❌ Session expired. Run `/content create` again.', ephemeral: true });
            return;
          }
          pending[field] = interaction.values;
          pendingCreations.set(userId, pending);
          const nondpsCount = (pending.presetTank?.length || 0) + (pending.presetHeal?.length || 0) + (pending.presetSupport?.length || 0);
          const { content, components } = buildPresetDpsMessage(pending.partySize, nondpsCount, pending.presetDpsG1, pending.presetDpsG2, pending.presetDpsG3, pending.presetDpsG4);
          await interaction.update({ content, components });
          return;
        }
      }

      // Step 3c (Preset): dupe select — store selected bases for the Add button
      if (customId === 'content_preset_dupe_select') {
        const userId = interaction.user.id;
        const pending = pendingCreations.get(userId);
        if (!pending) {
          await interaction.reply({ content: '❌ Session expired. Run `/content create` again.', ephemeral: true });
          return;
        }
        pending.presetDupeSelected = interaction.values;
        pendingCreations.set(userId, pending);
        await interaction.deferUpdate();
        return;
      }

      return;
    }

    // Handle modal submits (content creation flow)
    if (interaction.isModalSubmit()) {
      const customId = interaction.customId;

      // Custom role modal — parse one role per line
      if (customId === 'content_custom_modal') {
        const userId = interaction.user.id;
        const pending = pendingCreations.get(userId);
        if (!pending) {
          await interaction.reply({ content: '❌ Session expired. Run `/content create` again.', ephemeral: true });
          return;
        }

        const rawText = interaction.fields.getTextInputValue('custom_roles_text').trim();
        const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);

        if (lines.length !== pending.partySize) {
          await interaction.reply({
            content: `❌ You entered **${lines.length}** roles but party size is **${pending.partySize}**. Please try again and enter exactly ${pending.partySize} roles (one per line).`,
            ephemeral: true,
          });
          return;
        }

        pending.assignedRoles = [];
        pending.customRoleNames = {};
        lines.forEach((name, i) => {
          const key = `custom_${i}`;
          pending.assignedRoles.push(key);
          pending.customRoleNames[key] = name;
        });
        pendingCreations.set(userId, pending);

        await interaction.deferReply({ ephemeral: true });
        await interaction.editReply({
          content: `✅ All **${pending.partySize}** custom roles set!\n\nClick below to set the title, time, and demass notice:`,
          components: buildContinueToDetailsButton(),
        });
        return;
      }

      // Content details modal → show preview
      if (customId === 'content_create_modal') {
        const userId = interaction.user.id;
        const title = interaction.fields.getTextInputValue('modal_title').trim();
        const time = interaction.fields.getTextInputValue('modal_time').trim();
        const demassNotice = interaction.fields.getTextInputValue('modal_demass')?.trim() || '';

        const pending = pendingCreations.get(userId);
        if (!pending?.assignedRoles?.length) {
          await interaction.reply({ content: '❌ Session expired. Run `/content create` again.', ephemeral: true });
          return;
        }

        // Store details in pending (not yet live)
        pending.title = title;
        pending.time = time;
        pending.demassNotice = demassNotice;
        pendingCreations.set(userId, pending);

        await interaction.deferReply({ ephemeral: true });
        const previewEmbed = buildContentPreviewEmbed(pending);
        await interaction.editReply({
          content: '**Step 4 of 4** — Review your content callout:',
          embeds: [previewEmbed],
          components: buildPreviewComponents(),
        });
        return;
      }
      return;
    }

    // Handle button interactions

    const customId = interaction.customId;

    // ── Content creation wizard buttons ──────────────────────────────────────

    // Step 2 → Custom: open single multiline modal
    if (customId === 'content_method_custom') {
      const userId = interaction.user.id;
      const pending = pendingCreations.get(userId);
      if (!pending) {
        await interaction.reply({ content: '❌ Session expired. Run `/content create` again.', ephemeral: true });
        return;
      }
      pending.method = 'custom';
      pendingCreations.set(userId, pending);
      await interaction.showModal(buildCustomRoleModal(pending.partySize));
      return;
    }

    // Step 2 → Preset: show non-DPS selection (first preset message)
    if (customId === 'content_method_dropdown') {
      const userId = interaction.user.id;
      const pending = pendingCreations.get(userId);
      if (!pending) {
        await interaction.reply({ content: '❌ Session expired. Run `/content create` again.', ephemeral: true });
        return;
      }
      pending.method = 'dropdown';
      pendingCreations.set(userId, pending);
      const { content, components } = buildPresetNondpsMessage(pending.partySize, [], [], []);
      await interaction.update({ content, components });
      return;
    }

    // Step 3 (Preset): navigate to DPS selection
    if (customId === 'content_preset_to_dps') {
      const userId = interaction.user.id;
      const pending = pendingCreations.get(userId);
      if (!pending) {
        await interaction.reply({ content: '❌ Session expired. Run `/content create` again.', ephemeral: true });
        return;
      }
      const nondpsCount = (pending.presetTank?.length || 0) + (pending.presetHeal?.length || 0) + (pending.presetSupport?.length || 0);
      const { content, components } = buildPresetDpsMessage(pending.partySize, nondpsCount, pending.presetDpsG1 || [], pending.presetDpsG2 || [], pending.presetDpsG3 || [], pending.presetDpsG4 || []);
      await interaction.update({ content, components });
      return;
    }

    // Step 3 (Preset): navigate back to non-DPS selection
    if (customId === 'content_preset_to_nondps') {
      const userId = interaction.user.id;
      const pending = pendingCreations.get(userId);
      if (!pending) {
        await interaction.reply({ content: '❌ Session expired. Run `/content create` again.', ephemeral: true });
        return;
      }
      const { content, components } = buildPresetNondpsMessage(pending.partySize, pending.presetTank || [], pending.presetHeal || [], pending.presetSupport || []);
      await interaction.update({ content, components });
      return;
    }

    // Step 3 (Preset): confirm selection — validate count then open details modal
    if (customId === 'content_preset_confirm') {
      const userId = interaction.user.id;
      const pending = pendingCreations.get(userId);
      if (!pending) {
        await interaction.reply({ content: '❌ Session expired. Run `/content create` again.', ephemeral: true });
        return;
      }
      const combined = [
        ...(pending.presetTank || []),
        ...(pending.presetHeal || []),
        ...(pending.presetSupport || []),
        ...(pending.presetDpsG1 || []),
        ...(pending.presetDpsG2 || []),
        ...(pending.presetDpsG3 || []),
        ...(pending.presetDpsG4 || []),
      ];
      if (combined.length !== pending.partySize) {
        await interaction.reply({
          content: `❌ You selected **${combined.length}** roles but party size is **${pending.partySize}**. Please select exactly ${pending.partySize} roles.`,
          ephemeral: true,
        });
        return;
      }
      pending.assignedRoles = combined;
      pending.presetDupeSelected = [];
      pendingCreations.set(userId, pending);
      const { content: dupeContent, components: dupeComponents } = buildDuplicatesStep(pending);
      await interaction.update({ content: dupeContent, components: dupeComponents });
      return;
    }

    // Step 3c (Preset): add one extra copy of each selected role
    if (customId === 'content_preset_add_dupe') {
      const userId = interaction.user.id;
      const pending = pendingCreations.get(userId);
      if (!pending) {
        await interaction.reply({ content: '❌ Session expired. Run `/content create` again.', ephemeral: true });
        return;
      }
      const toAdd = pending.presetDupeSelected || [];
      if (toAdd.length === 0) {
        await interaction.reply({ content: 'ℹ️ No roles selected. Pick a role from the list first.', ephemeral: true });
        return;
      }
      for (const base of toAdd) {
        const existing = pending.assignedRoles.filter(k => getBaseKey(k) === base).length;
        pending.assignedRoles.push(`${base}_${existing + 1}`);
      }
      pending.presetDupeSelected = [];
      pendingCreations.set(userId, pending);
      const { content, components } = buildDuplicatesStep(pending);
      await interaction.update({ content, components });
      return;
    }

    // Step 3c (Preset): done with duplicates — open details modal
    if (customId === 'content_preset_finalize') {
      const userId = interaction.user.id;
      const pending = pendingCreations.get(userId);
      if (!pending?.assignedRoles?.length) {
        await interaction.reply({ content: '❌ Session expired. Run `/content create` again.', ephemeral: true });
        return;
      }
      await interaction.showModal(buildContentDetailsModal());
      return;
    }

    // Step 3c (Preset): add one extra copy of each selected role
    if (customId === 'content_preset_add_dupe') {
      const userId = interaction.user.id;
      const pending = pendingCreations.get(userId);
      if (!pending) {
        await interaction.reply({ content: '❌ Session expired. Run `/content create` again.', ephemeral: true });
        return;
      }
      const toAdd = pending.presetDupeSelected || [];
      if (toAdd.length === 0) {
        await interaction.reply({ content: 'ℹ️ No roles selected. Pick a role from the list first.', ephemeral: true });
        return;
      }
      for (const base of toAdd) {
        const existing = pending.assignedRoles.filter(k => getBaseKey(k) === base).length;
        pending.assignedRoles.push(`${base}_${existing + 1}`);
      }
      pending.presetDupeSelected = [];
      pendingCreations.set(userId, pending);
      const { content, components } = buildDuplicatesStep(pending);
      await interaction.update({ content, components });
      return;
    }

    // Step 3c (Preset): done with duplicates — open details modal
    if (customId === 'content_preset_finalize') {
      const userId = interaction.user.id;
      const pending = pendingCreations.get(userId);
      if (!pending?.assignedRoles?.length) {
        await interaction.reply({ content: '❌ Session expired. Run `/content create` again.', ephemeral: true });
        return;
      }
      await interaction.showModal(buildContentDetailsModal());
      return;
    }

    // Step 3 → 4: open content details modal (custom path)
    if (customId === 'content_details_btn') {
      await interaction.showModal(buildContentDetailsModal());
      return;
    }

    // Step 5: publish — create thread and go live
    if (customId === 'content_preview_publish') {
      const userId = interaction.user.id;
      const channelId = interaction.channelId;
      const pending = pendingCreations.get(userId);
      if (!pending?.assignedRoles?.length || !pending?.title) {
        await interaction.reply({ content: '❌ Session expired. Run `/content create` again.', ephemeral: true });
        return;
      }

      await interaction.deferReply({ ephemeral: true });
      try {
        // Commit pending state to contentState
        contentState.active = true;
        contentState.title = pending.title;
        contentState.time = pending.time;
        contentState.demassNotice = pending.demassNotice;
        contentState.activeRoles = pending.assignedRoles;
        contentState.roles = Object.fromEntries(pending.assignedRoles.map(k => [k, null]));
        contentState.customRoleNames = pending.customRoleNames || {};
        contentState.fill = [];
        pendingCreations.delete(userId);

        const embed = buildContentEmbed();
        const threadResponse = await DiscordRequest(`channels/${channelId}/threads`, {
          method: 'POST',
          body: { name: pending.title, type: 11, auto_archive_duration: 1440 },
        });
        const threadData = await threadResponse.json();
        const threadId = threadData.id;

        const messageResponse = await DiscordRequest(`channels/${threadId}/messages`, {
          method: 'POST',
          body: {
            content: '<@&1344897722196430879>',
            embeds: [embed.toJSON()],
            components: buildContentComponents().map(r => r.toJSON()),
          },
        });
        const messageData = await messageResponse.json();

        contentState.messageId = messageData.id;
        contentState.channelId = threadId;
        contentState.threadId = threadId;

        await interaction.editReply({ content: `✅ Content callout published: **${pending.title}**` });
      } catch (err) {
        console.error('❌ Error publishing content (gateway):', err);
        contentState.active = false;
        await interaction.editReply({ content: '❌ Failed to create content thread. Please try again.' });
      }
      return;
    }

    // Step 5: edit details — re-open modal
    if (customId === 'content_preview_edit') {
      await interaction.showModal(buildContentDetailsModal());
      return;
    }

    // ── Albion registration button handler ────────────────────────────────────
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
  const userId = req.body.member?.user?.id || req.body.user?.id;

  // ── Content creation wizard (Express path) ────────────────────────────────

  // Step 1 result: party size chosen → show method buttons
  if (componentId === 'content_size_select') {
    const partySize = parseInt(req.body.data.values[0]);
    pendingCreations.set(userId, {
      partySize,
      method: null,
      assignedRoles: [],
      customRoleNames: {},
      presetTank: [],
      presetHeal: [],
      presetSupport: [],
      presetDpsG1: [],
      presetDpsG2: [],
      presetDpsG3: [],
      presetDpsG4: [],
    });
    return res.send({
      type: InteractionResponseType.UPDATE_MESSAGE,
      data: {
        content: `**Step 2 of 4** — Party size: **${partySize}**\nHow do you want to assign roles?`,
        components: buildMethodSelector().map(r => r.toJSON()),
      },
    });
  }

  // Step 2 → Custom: open single multiline modal
  if (componentId === 'content_method_custom') {
    const pending = pendingCreations.get(userId);
    if (!pending) {
      return res.send({ type: 4, data: { content: '❌ Session expired. Run `/content create` again.', flags: 64 } });
    }
    pending.method = 'custom';
    pendingCreations.set(userId, pending);
    return res.send({ type: 9, data: buildCustomRoleModal(pending.partySize).toJSON() });
  }

  // Step 2 → Preset: show non-DPS selection (first preset message)
  if (componentId === 'content_method_dropdown') {
    const pending = pendingCreations.get(userId);
    if (!pending) {
      return res.send({ type: 4, data: { content: '❌ Session expired. Run `/content create` again.', flags: 64 } });
    }
    pending.method = 'dropdown';
    pendingCreations.set(userId, pending);
    const { content, components } = buildPresetNondpsMessage(pending.partySize, [], [], []);
    return res.send({
      type: InteractionResponseType.UPDATE_MESSAGE,
      data: { content, components: components.map(r => r.toJSON()) },
    });
  }

  // Step 3a (Preset): Tank/Heal/Support selects — update state and re-render non-DPS message
  for (const [field, id] of [
    ['presetTank', 'content_preset_tank'],
    ['presetHeal', 'content_preset_heal'],
    ['presetSupport', 'content_preset_support'],
  ]) {
    if (componentId === id) {
      const pending = pendingCreations.get(userId);
      if (!pending) {
        return res.send({ type: 4, data: { content: '❌ Session expired. Run `/content create` again.', flags: 64 } });
      }
      pending[field] = req.body.data.values;
      pendingCreations.set(userId, pending);
      const { content, components } = buildPresetNondpsMessage(pending.partySize, pending.presetTank, pending.presetHeal, pending.presetSupport);
      return res.send({
        type: InteractionResponseType.UPDATE_MESSAGE,
        data: { content, components: components.map(r => r.toJSON()) },
      });
    }
  }

  // Step 3b (Preset): DPS group selects — update state and re-render DPS message
  for (const [field, id] of [
    ['presetDpsG1', 'content_preset_dps_g1'],
    ['presetDpsG2', 'content_preset_dps_g2'],
    ['presetDpsG3', 'content_preset_dps_g3'],
    ['presetDpsG4', 'content_preset_dps_g4'],
  ]) {
    if (componentId === id) {
      const pending = pendingCreations.get(userId);
      if (!pending) {
        return res.send({ type: 4, data: { content: '❌ Session expired. Run `/content create` again.', flags: 64 } });
      }
      pending[field] = req.body.data.values;
      pendingCreations.set(userId, pending);
      const nondpsCount = (pending.presetTank?.length || 0) + (pending.presetHeal?.length || 0) + (pending.presetSupport?.length || 0);
      const { content, components } = buildPresetDpsMessage(pending.partySize, nondpsCount, pending.presetDpsG1, pending.presetDpsG2, pending.presetDpsG3, pending.presetDpsG4);
      return res.send({
        type: InteractionResponseType.UPDATE_MESSAGE,
        data: { content, components: components.map(r => r.toJSON()) },
      });
    }
  }

  // Step 3 (Preset): navigate to DPS selection
  if (componentId === 'content_preset_to_dps') {
    const pending = pendingCreations.get(userId);
    if (!pending) {
      return res.send({ type: 4, data: { content: '❌ Session expired. Run `/content create` again.', flags: 64 } });
    }
    const nondpsCount = (pending.presetTank?.length || 0) + (pending.presetHeal?.length || 0) + (pending.presetSupport?.length || 0);
    const { content, components } = buildPresetDpsMessage(pending.partySize, nondpsCount, pending.presetDpsG1 || [], pending.presetDpsG2 || [], pending.presetDpsG3 || [], pending.presetDpsG4 || []);
    return res.send({
      type: InteractionResponseType.UPDATE_MESSAGE,
      data: { content, components: components.map(r => r.toJSON()) },
    });
  }

  // Step 3 (Preset): navigate back to non-DPS selection
  if (componentId === 'content_preset_to_nondps') {
    const pending = pendingCreations.get(userId);
    if (!pending) {
      return res.send({ type: 4, data: { content: '❌ Session expired. Run `/content create` again.', flags: 64 } });
    }
    const { content, components } = buildPresetNondpsMessage(pending.partySize, pending.presetTank || [], pending.presetHeal || [], pending.presetSupport || []);
    return res.send({
      type: InteractionResponseType.UPDATE_MESSAGE,
      data: { content, components: components.map(r => r.toJSON()) },
    });
  }

  // Step 3 (Preset): confirm selection — validate count then open details modal
  if (componentId === 'content_preset_confirm') {
    const pending = pendingCreations.get(userId);
    if (!pending) {
      return res.send({ type: 4, data: { content: '❌ Session expired. Run `/content create` again.', flags: 64 } });
    }
    const combined = [
      ...(pending.presetTank || []),
      ...(pending.presetHeal || []),
      ...(pending.presetSupport || []),
      ...(pending.presetDpsG1 || []),
      ...(pending.presetDpsG2 || []),
      ...(pending.presetDpsG3 || []),
      ...(pending.presetDpsG4 || []),
    ];
    if (combined.length !== pending.partySize) {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `❌ You selected **${combined.length}** roles but party size is **${pending.partySize}**. Please select exactly ${pending.partySize} roles.`,
          flags: 64,
        },
      });
    }
    pending.assignedRoles = combined;
    pendingCreations.set(userId, pending);
    return res.send({ type: 9, data: buildContentDetailsModal().toJSON() });
  }

  // Step 3 → 4: open content details modal
  if (componentId === 'content_details_btn') {
    return res.send({ type: 9, data: buildContentDetailsModal().toJSON() });
  }

  // Step 5: publish — create thread and go live
  if (componentId === 'content_preview_publish') {
    const channelId = req.body.channel_id;
    const pending = pendingCreations.get(userId);
    if (!pending?.assignedRoles?.length || !pending?.title) {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: '❌ Session expired. Run `/content create` again.', flags: 64 },
      });
    }

    res.send({
      type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
      data: { flags: 64 },
    });

    try {
      contentState.active = true;
      contentState.title = pending.title;
      contentState.time = pending.time;
      contentState.demassNotice = pending.demassNotice;
      contentState.activeRoles = pending.assignedRoles;
      contentState.roles = Object.fromEntries(pending.assignedRoles.map(k => [k, null]));
      contentState.customRoleNames = pending.customRoleNames || {};
      contentState.fill = [];
      pendingCreations.delete(userId);

      const embed = buildContentEmbed();
      const threadResponse = await DiscordRequest(`channels/${channelId}/threads`, {
        method: 'POST',
        body: { name: pending.title, type: 11, auto_archive_duration: 1440 },
      });
      const threadData = await threadResponse.json();
      const threadId = threadData.id;

      const messageResponse = await DiscordRequest(`channels/${threadId}/messages`, {
        method: 'POST',
        body: {
          content: '<@&1344897722196430879>',
          embeds: [embed.toJSON()],
          components: buildContentComponents().map(r => r.toJSON()),
        },
      });
      const messageData = await messageResponse.json();

      contentState.messageId = messageData.id;
      contentState.channelId = threadId;
      contentState.threadId = threadId;

      await DiscordRequest(`webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
        method: 'PATCH',
        body: { content: `✅ Content callout published: **${pending.title}**`, flags: 64 },
      });
    } catch (err) {
      console.error('❌ Error publishing content (express):', err);
      contentState.active = false;
      await DiscordRequest(`webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
        method: 'PATCH',
        body: { content: '❌ Failed to create content thread. Please try again.', flags: 64 },
      });
    }
    return;
  }

  // Step 5: edit details — re-open modal
  if (componentId === 'content_preview_edit') {
    return res.send({ type: 9, data: buildContentDetailsModal().toJSON() });
  }

  // ── Active content role-call button handlers ──────────────────────────────

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
  const userId = req.body.member?.user?.id || req.body.user?.id;
  const modalComponents = req.body.data.components;

  // ── Custom role modal — parse one role per line ───────────────────────────
  if (customId === 'content_custom_modal') {
    const pending = pendingCreations.get(userId);
    if (!pending) {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: '❌ Session expired. Run `/content create` again.', flags: 64 },
      });
    }

    const rawField = modalComponents
      .flatMap(row => row.components)
      .find(c => c.custom_id === 'custom_roles_text');
    const rawText = (rawField?.value || '').trim();
    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);

    if (lines.length !== pending.partySize) {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `❌ You entered **${lines.length}** roles but party size is **${pending.partySize}**. Please try again and enter exactly ${pending.partySize} roles (one per line).`,
          flags: 64,
        },
      });
    }

    pending.assignedRoles = [];
    pending.customRoleNames = {};
    lines.forEach((name, i) => {
      const key = `custom_${i}`;
      pending.assignedRoles.push(key);
      pending.customRoleNames[key] = name;
    });
    pendingCreations.set(userId, pending);

    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: `✅ All **${pending.partySize}** custom roles set!\n\nClick below to set the title, time, and demass notice:`,
        flags: 64,
        components: buildContinueToDetailsButton().map(r => r.toJSON()),
      },
    });
  }

  // ── Content details modal → show preview ───────────────────────────────────
  if (customId === 'content_create_modal') {
    const channelId = req.body.channel_id;

    const title = modalComponents[0].components[0].value?.trim() || '';
    const time = modalComponents[1].components[0].value?.trim() || '';
    const demassNotice = modalComponents[2]?.components[0]?.value?.trim() || '';

    const pending = pendingCreations.get(userId);
    if (!pending?.assignedRoles?.length) {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: '❌ Session expired. Run `/content create` again.', flags: 64 },
      });
    }

    pending.title = title;
    pending.time = time;
    pending.demassNotice = demassNotice;
    pendingCreations.set(userId, pending);

    const previewEmbed = buildContentPreviewEmbed(pending);
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: '**Step 4 of 4** — Review your content callout:',
        flags: 64,
        embeds: [previewEmbed.toJSON()],
        components: buildPreviewComponents().map(r => r.toJSON()),
      },
    });
  }

  return res.status(400).json({ error: 'unknown modal' });
}
