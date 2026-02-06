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
  if (!member || !staffRoleIds || !member.roles || !member.roles.cache) return false;
  return staffRoleIds.some(roleId => member.roles.cache.has(roleId));
}

/**
 * Create Apply Panel Message
 */
export function createApplyPanelMessage(customMessage = null) {
  const defaultTitle = '📋 Apply to Join';
  const defaultDescription = 'Click the button below to start your application.';
  
  const embed = new EmbedBuilder()
    .setTitle(defaultTitle)
    .setDescription(customMessage || defaultDescription)
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
      // Verify the channel still exists
      const existingChannel = guild.channels.cache.get(existingTicket.channelId);
      if (existingChannel) {
        return interaction.reply({
          content: `❌ You already have an open ticket: <#${existingTicket.channelId}>`,
          ephemeral: true
        });
      } else {
        // Channel was deleted, update ticket status to closed
        await updateTicket(guildId, existingTicket.ticketId, {
          status: 'closed',
          closeDate: new Date().toISOString(),
          closeReason: 'Channel deleted',
          closedBy: null
        });
        // Allow user to create new ticket
      }
    }

    await interaction.deferReply({ ephemeral: true });

    // Get next ticket ID
    const ticketId = await getNextTicketId(guildId);

    // Create ticket channel
    const channelName = `ticket-${ticketId}`;

    // Get category and validate it's actually a category
    let category = null;
    if (panel.ticketCategoryId) {
      const categoryChannel = guild.channels.cache.get(panel.ticketCategoryId);
      if (categoryChannel && categoryChannel.type === ChannelType.GuildCategory) {
        category = categoryChannel;
      } else {
        return interaction.editReply({
          content: '❌ The configured ticket category is invalid. Please contact an administrator to fix the ticket setup.'
        });
      }
    }

    // Fetch user and roles to ensure they're cached
    const ticketAuthor = await guild.members.fetch(userId).catch(() => null);
    if (!ticketAuthor) {
      return interaction.editReply({
        content: '❌ Could not fetch your user information. Please try again.'
      });
    }

    // Fetch all staff roles to ensure they're cached
    const staffRoles = [];
    for (const roleId of panel.staffRoleIds) {
      const role = await guild.roles.fetch(roleId).catch(() => null);
      if (role) {
        staffRoles.push(role);
      }
    }

    // Create channel with permissions
    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: category,
      permissionOverwrites: [
        {
          id: guild.id,
          deny: [PermissionFlagsBits.ViewChannel]
        },
        {
          id: ticketAuthor.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory
          ]
        },
        // Add staff roles
        ...staffRoles.map(role => ({
          id: role.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.ManageChannels
          ]
        }))
      ]
    });

    // Create ticket record
    const ticket = {
      ticketId,
      guildId,
      channelId: channel.id,
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
            { name: 'Ticket Name', value: channelName, inline: true },
            { name: 'Created By', value: `<@${userId}>`, inline: true },
            { name: 'Opened Date', value: formatDate(ticket.openDate), inline: false },
            { name: 'Ticket Type', value: panel.ticketTypeName, inline: true }
          )
          .setColor(0x57F287)
          .setTimestamp();

        await transcriptChannel.send({ embeds: [openedEmbed] });
      }
    }

    // Send header message in ticket channel
    const headerEmbed = new EmbedBuilder()
      .setTitle(`${panel.ticketTypeName} Ticket`)
      .setDescription(`Thank you for opening a ticket, <@${userId}>.\nStaff will be with you shortly.`)
      .setColor(0x5865F2)
      .setTimestamp();

    // Create control buttons
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

    // Ping role and user who created the ticket
    const pingMessage = `<@${userId}> ${panel.pingRoleId ? `<@&${panel.pingRoleId}>` : ''}`;
    await channel.send({ content: pingMessage, embeds: [headerEmbed], components: [row] });

    return interaction.editReply({
      content: `✅ Ticket created: ${channel}`,
      ephemeral: true
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

    await interaction.editReply({
      content: '✅ Ticket closed. Channel will be deleted in 5 seconds...'
    });

    // Delete channel after delay
    setTimeout(async () => {
      try {
        await interaction.channel.delete();
      } catch (error) {
        console.error('Failed to delete channel:', error);
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
