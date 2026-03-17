/**
 * Ticket System - Guild-Scoped Discord Ticketing
 * Handles ticket creation, management, and transcripts
 */

import { 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits
} from 'discord.js';
import axios from 'axios';
import {
  loadTickets,
  saveTickets,
  getTicketByChannel,
  getOpenTicketByAuthor,
  addTicket,
  updateTicket,
  getTranscript,
  initTranscript,
  addTranscriptMessage,
  getPanel,
  getNextTicketId
} from './ticket-db.js';

/**
 * Format date to readable string
 */
function formatDate(date) {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Check if user has staff role
 */
function isStaff(member, staffRoleIds) {
  if (!member) return false;

  // Allow full-permission server staff even if role IDs are misconfigured.
  const permissionChecks = [
    PermissionFlagsBits.Administrator,
    PermissionFlagsBits.ManageGuild,
    PermissionFlagsBits.ManageChannels,
    PermissionFlagsBits.ManageThreads
  ];

  const memberPermissions = member.permissions;
  if (memberPermissions && typeof memberPermissions.has === 'function') {
    if (permissionChecks.some(permission => memberPermissions.has(permission))) {
      return true;
    }
  }

  if (!Array.isArray(staffRoleIds) || staffRoleIds.length === 0) return false;

  // Support both GuildMember roles cache and API member role arrays.
  if (member.roles?.cache) {
    return staffRoleIds.some(roleId => member.roles.cache.has(roleId));
  }

  if (Array.isArray(member.roles)) {
    return staffRoleIds.some(roleId => member.roles.includes(roleId));
  }

  return false;
}

/**
 * Create Apply Panel Message
 */
export function createApplyPanelMessage(customMessage = null) {
  const defaultTitle = '📋 Apply to Join';
  const defaultDescription = 'Click the button below to start your application.';
  
  // Parse \n in custom message to actual newlines
  const parsedMessage = customMessage ? customMessage.replace(/\\n/g, '\n') : defaultDescription;
  
  const embed = new EmbedBuilder()
    .setTitle(defaultTitle)
    .setDescription(parsedMessage)
    .setColor(0x5865F2);

  const button = new ButtonBuilder()
    .setCustomId('apply_ticket')
    .setLabel('Apply')
    .setStyle(ButtonStyle.Primary)
    .setEmoji('📝');

  const row = new ActionRowBuilder().addComponents(button);

  return { embeds: [embed], components: [row] };
}

/**
 * Handle ticket creation button
 */
export async function handleApplyTicket(interaction) {
  try {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    // Load panel config
    const panel = await getPanel(guildId, 'apply');
    if (!panel) {
      return interaction.reply({
        content: '❌ Ticket system is not configured for this server.',
        ephemeral: true
      });
    }

    // Get guild first
    const guild = interaction.guild;

    // Check for duplicate open tickets
    const existingTicket = await getOpenTicketByAuthor(guildId, userId, 'apply');
    if (existingTicket) {
      // Verify the forum post still exists and is not archived
      const existingThread = guild.channels.cache.get(existingTicket.channelId)
        || await guild.channels.fetch(existingTicket.channelId).catch(() => null);
      if (existingThread && !existingThread.archived) {
        return interaction.reply({
          content: `❌ You already have an open application: <#${existingTicket.channelId}>`,
          ephemeral: true
        });
      } else {
        // Post was deleted or archived, mark ticket closed and allow a new one
        await updateTicket(guildId, existingTicket.ticketId, {
          status: 'closed',
          closeDate: new Date().toISOString(),
          closeReason: 'Post deleted or archived',
          closedBy: null
        });
      }
    }

    await interaction.deferReply({ ephemeral: true });

    // Get next ticket ID
    const ticketId = await getNextTicketId(guildId);

    // Fetch applicant member
    const ticketAuthor = await guild.members.fetch(userId).catch(() => null);
    if (!ticketAuthor) {
      return interaction.editReply({
        content: '❌ Could not fetch your user information. Please try again.'
      });
    }

    const applicantName = ticketAuthor.displayName || ticketAuthor.user.username;

    // Get forum channel (cached or fetched)
    const threadParentChannel = panel.ticketCategoryId
      ? (guild.channels.cache.get(panel.ticketCategoryId)
        || await guild.channels.fetch(panel.ticketCategoryId).catch(() => null))
      : null;
    if (!threadParentChannel) {
      return interaction.editReply({
        content: '❌ The configured forum channel is invalid. Please contact an administrator to fix the ticket setup.'
      });
    }

    if (threadParentChannel.type !== ChannelType.GuildForum || !threadParentChannel.threads) {
      return interaction.editReply({
        content: '❌ Ticket setup error: the configured channel is not a Forum channel. Please run `!ticketsetup` using your applicants forum channel ID.'
      });
    }

    // Build the form content for the initial forum post
    const pingContent = `<@${userId}>${panel.pingRoleId ? ` <@&${panel.pingRoleId}>` : ''}`;

    const formEmbed = new EmbedBuilder()
      .setTitle('Guild Application Form')
      .setDescription(
        '1️⃣ Do you play on PC or Mobile?\n' +
        '2️⃣ Can you speak English?\n' +
        '3️⃣ Do you have experience in ZvZ or Small Scale PvP?\n' +
        "4️⃣ What's your nationality?\n" +
        '5️⃣ Why do you want to join our guild?\n' +
        "6️⃣ What's your main weapon/role for ZvZ / Small Scale / PvE?\n" +
        '7️⃣ Do you have a mic and can join voice comms during content?\n' +
        '8️⃣ What time do you usually play? (Specify in UTC)\n' +
        '9️⃣ Previous guilds and reason for leaving?\n' +
        '🔟 Are you willing to join in any contents, especially CTA, since we have an alliance?\n\n' +
        '📸 Please attach a screenshot of your in-game stats.\n' +
        ' *IMPORTANT NOTE*: inactive and active but not joining any contents will be kick from the guild'
      )
      .setColor(0xF1C40F);

    // Create a forum post — the initial message IS the post body
    const thread = await threadParentChannel.threads.create({
      name: `Ticket ${ticketId} | ${applicantName}`,
      message: {
        content: pingContent,
        embeds: [formEmbed]
      }
    });

    // Create ticket record
    const ticket = {
      ticketId,
      guildId,
      channelId: thread.id,
      panelId: 'apply',
      authorId: userId,
      claimedBy: null,
      closedBy: null,
      status: 'open',
      openDate: new Date().toISOString(),
      closeDate: null,
      closeReason: null
    };

    await addTicket(guildId, ticket);
    await initTranscript(guildId, ticketId);

    // Send "Ticket Opened" embed to transcript channel
    if (panel.transcriptChannelId) {
      const transcriptChannel = guild.channels.cache.get(panel.transcriptChannelId);
      if (transcriptChannel) {
        const openedEmbed = new EmbedBuilder()
          .setTitle('🎫 Ticket Opened')
          .addFields(
            { name: 'Thread Name', value: `Ticket ${ticketId} | ${applicantName}`, inline: true },
            { name: 'Created By', value: `<@${userId}>`, inline: true },
            { name: 'Opened Date', value: formatDate(ticket.openDate), inline: false },
            { name: 'Ticket Type', value: panel.ticketTypeName, inline: true }
          )
          .setColor(0x57F287)
          .setTimestamp();

        await transcriptChannel.send({ embeds: [openedEmbed] });
      }
    }

    // Send staff control buttons as a follow-up message in the forum post
    const headerEmbed = new EmbedBuilder()
      .setTitle(`${panel.ticketTypeName} Ticket`)
      .setDescription(`Please answer the questions above.\nStaff will review your application shortly.`)
      .setColor(0x5865F2)
      .setTimestamp();

    const closeButton = new ButtonBuilder()
      .setCustomId('ticket_close')
      .setLabel('Close Ticket')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🔒');

    const claimButton = new ButtonBuilder()
      .setCustomId('ticket_claim')
      .setLabel('Claim Ticket')
      .setStyle(ButtonStyle.Success)
      .setEmoji('✋');

    const row = new ActionRowBuilder().addComponents(closeButton, claimButton);

    await thread.send({ embeds: [headerEmbed], components: [row] });

    return interaction.editReply({
      content: `✅ Your application has been created: <#${thread.id}>`
    });

  } catch (error) {
    console.error('Error creating ticket:', error);
    
    if (interaction.deferred) {
      return interaction.editReply({
        content: '❌ Failed to create ticket. Please contact an administrator.',
        ephemeral: true
      });
    } else {
      return interaction.reply({
        content: '❌ Failed to create ticket. Please contact an administrator.',
        ephemeral: true
      });
    }
  }
}

/**
 * Handle claim ticket button
 */
export async function handleClaimTicket(interaction) {
  try {
    const guildId = interaction.guildId;
    const channelId = interaction.channelId;
    const userId = interaction.user.id;

    const ticket = await getTicketByChannel(guildId, channelId);
    if (!ticket) {
      return interaction.reply({
        content: '❌ This is not a valid ticket channel.',
        ephemeral: true
      });
    }

    const panel = await getPanel(guildId, ticket.panelId);
    if (!panel) {
      return interaction.reply({
        content: '❌ Panel configuration not found.',
        ephemeral: true
      });
    }

    // Check if user is staff
    const member = interaction.member;
    if (!isStaff(member, panel.staffRoleIds)) {
      return interaction.reply({
        content: '❌ Only staff members can claim tickets.',
        ephemeral: true
      });
    }

    // Update ticket
    await updateTicket(guildId, ticket.ticketId, {
      claimedBy: userId,
      status: 'claimed'
    });

    const embed = new EmbedBuilder()
      .setDescription(`✅ Ticket claimed by <@${userId}>`)
      .setColor(0x57F287)
      .setTimestamp();

    // Add transcript entry for claim
    await addTranscriptMessage(guildId, ticket.ticketId, {
      authorId: userId,
      authorTag: interaction.user.tag,
      content: `[SYSTEM] Ticket claimed by ${interaction.user.tag}`,
      createdAt: new Date().toISOString(),
      isStaff: true
    });

    // Update the message to disable the claim button
    try {
      const channel = interaction.guild.channels.cache.get(channelId);
      if (channel) {
        const messages = await channel.messages.fetch({ limit: 10 });
        const ticketMessage = messages.find(msg => 
          msg.author.bot && 
          msg.components.length > 0 && 
          msg.components[0].components.some(c => c.customId === 'ticket_claim')
        );

        if (ticketMessage) {
          // Disable the claim button
          const closeButton = new ButtonBuilder()
            .setCustomId('ticket_close')
            .setLabel('Close Ticket')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔒');

          const claimButton = new ButtonBuilder()
            .setCustomId('ticket_claim')
            .setLabel('Claimed')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('✅')
            .setDisabled(true);

          const row = new ActionRowBuilder().addComponents(closeButton, claimButton);

          await ticketMessage.edit({
            embeds: ticketMessage.embeds,
            components: [row]
          });
        }
      }
    } catch (error) {
      console.error('Failed to update claim button:', error);
    }

    return interaction.reply({ embeds: [embed] });

  } catch (error) {
    console.error('Error claiming ticket:', error);
    return interaction.reply({
      content: '❌ Failed to claim ticket.',
      ephemeral: true
    });
  }
}

/**
 * Handle close ticket button
 */
export async function handleCloseTicket(interaction) {
  try {
    const guildId = interaction.guildId;
    const channelId = interaction.channelId;
    const userId = interaction.user.id;

    const ticket = await getTicketByChannel(guildId, channelId);
    if (!ticket) {
      return interaction.reply({
        content: '❌ This is not a valid ticket channel.',
        ephemeral: true
      });
    }

    const panel = await getPanel(guildId, ticket.panelId);
    if (!panel) {
      return interaction.reply({
        content: '❌ Panel configuration not found.',
        ephemeral: true
      });
    }

    // Check if user is staff or ticket author
    const member = interaction.member;
    const isUserStaff = isStaff(member, panel.staffRoleIds);
    const isAuthor = userId === ticket.authorId;

    if (!isUserStaff && !isAuthor) {
      return interaction.reply({
        content: '❌ Only staff members or the ticket author can close this ticket.',
        ephemeral: true
      });
    }

    await interaction.deferReply();

    // Get transcript
    const transcript = await getTranscript(guildId, ticket.ticketId);

    // Update ticket
    const closeDate = new Date().toISOString();
    await updateTicket(guildId, ticket.ticketId, {
      closedBy: userId,
      status: 'closed',
      closeDate,
      closeReason: 'No Reason Provided'
    });

    // Send "Ticket Closed" embed to transcript channel
    if (panel.transcriptChannelId) {
      const transcriptChannel = interaction.guild.channels.cache.get(panel.transcriptChannelId);
      if (transcriptChannel) {
        const fields = [
          { name: 'Ticket Name', value: `ticket-${ticket.ticketId}`, inline: true },
          { name: 'Ticket Author', value: `<@${ticket.authorId}>`, inline: true },
          { name: 'Closed By', value: `<@${userId}>`, inline: true },
          { name: 'Claimed By', value: ticket.claimedBy ? `<@${ticket.claimedBy}>` : 'Unclaimed', inline: true },
          { name: 'Open Date', value: formatDate(ticket.openDate), inline: true },
          { name: 'Close Date', value: formatDate(closeDate), inline: true },
          { 
            name: 'Staff Message Count', 
            value: transcript ? String(transcript.staffMessageCount) : '0',
            inline: true 
          },
          { 
            name: 'Total Messages', 
            value: transcript ? String(transcript.messages.length) : '0',
            inline: true 
          }
        ];

        const closedEmbed = new EmbedBuilder()
          .setTitle('🔒 Ticket Closed')
          .addFields(fields)
          .setColor(0xED4245)
          .setTimestamp();

        await transcriptChannel.send({ embeds: [closedEmbed] });
      }
    }

    const isThread = interaction.channel.isThread();
    await interaction.editReply({
      content: isThread
        ? '✅ Ticket closed. Thread will be archived in 5 seconds...'
        : '✅ Ticket closed. Channel will be deleted in 5 seconds...'
    });

    // Archive thread or delete channel after delay
    setTimeout(async () => {
      try {
        if (isThread) {
          await interaction.channel.setLocked(true);
          await interaction.channel.setArchived(true);
        } else {
          await interaction.channel.delete();
        }
      } catch (error) {
        console.error('Failed to close ticket channel/thread:', error);
      }
    }, 5000);

  } catch (error) {
    console.error('Error closing ticket:', error);
    
    if (interaction.deferred) {
      return interaction.editReply({
        content: '❌ Failed to close ticket.',
      });
    } else {
      return interaction.reply({
        content: '❌ Failed to close ticket.',
        ephemeral: true
      });
    }
  }
}

/**
 * Handle message logging in ticket channels
 */
export async function handleTicketMessage(message) {
  try {
    // Ignore bots
    if (message.author.bot) return;

    const guildId = message.guildId;
    const channelId = message.channelId;

    // Check if message is in a ticket channel
    const ticket = await getTicketByChannel(guildId, channelId);
    if (!ticket) return;

    // Get panel config
    const panel = await getPanel(guildId, ticket.panelId);
    if (!panel) return;

    // Check if author is staff
    const member = message.member;
    const isUserStaff = isStaff(member, panel.staffRoleIds);

    // Create transcript message
    const transcriptMessage = {
      authorId: message.author.id,
      authorTag: message.author.tag,
      isStaff: isUserStaff,
      content: message.content,
      createdAt: message.createdAt.toISOString()
    };

    // Add to transcript
    await addTranscriptMessage(guildId, ticket.ticketId, transcriptMessage);

  } catch (error) {
    console.error('Error logging ticket message:', error);
  }
}
