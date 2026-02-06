/**
 * Ticket Setup Commands - Administrative configuration
 * Commands to manage ticket panels per guild
 */

import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { savePanels, loadPanels } from './ticket-db.js';
import { getTicketStats, ticketSystemHealthCheck } from './ticket-utils.js';

/**
 * Setup ticket panel configuration
 * Usage: !ticketsetup <panelId> <ticketType> <categoryId> <pingRoleId> <staffRoleIds> <approveRoleId> <transcriptChannelId> <nicknameFormat>
 */
export async function setupTicketPanel(message, args) {
  // Check permissions
  if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return message.reply('❌ You need Administrator permission to use this command.');
  }

  if (args.length < 7) {
    return message.reply(
      '❌ Usage: `!ticketsetup <panelId> <ticketType> <categoryId> <pingRoleId> <staffRoleIds> <approveRoleId> <transcriptChannelId> [nicknameFormat]`\n' +
      'Example: `!ticketsetup apply "Apply" 123456 789012 345678,901234 567890 111213 "SOUTH | {username}"`\n' +
      'Note: staffRoleIds should be comma-separated (no spaces)'
    );
  }

  const panelId = args[0];
  const ticketTypeName = args[1].replace(/"/g, '');
  const ticketCategoryId = args[2];
  const pingRoleId = args[3];
  const staffRoleIds = args[4].split(',');
  const approveRoleId = args[5];
  const transcriptChannelId = args[6];
  const nicknameFormat = args[7] ? args.slice(7).join(' ').replace(/"/g, '') : 'SOUTH | {username}';

  try {
    const guildId = message.guildId;
    const panels = await loadPanels(guildId);

    // Check if panel already exists
    const existingIndex = panels.findIndex(p => p.panelId === panelId);
    
    const newPanel = {
      panelId,
      ticketTypeName,
      ticketCategoryId,
      pingRoleId,
      staffRoleIds,
      approveRoleId,
      nicknameFormat,
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
        { name: 'Approve Role', value: `<@&${approveRoleId}>`, inline: true },
        { name: 'Transcript Channel', value: `<#${transcriptChannelId}>`, inline: true },
        { name: 'Staff Roles', value: staffRoleIds.map(id => `<@&${id}>`).join(', '), inline: false },
        { name: 'Nickname Format', value: nicknameFormat, inline: false }
      )
      .setColor(0x57F287)
      .setTimestamp();

    return message.reply({ embeds: [embed] });

  } catch (error) {
    console.error('Error setting up ticket panel:', error);
    return message.reply('❌ Failed to setup ticket panel. Check the console for details.');
  }
}

/**
 * List all ticket panels
 * Usage: !ticketpanels
 */
export async function listTicketPanels(message) {
  try {
    const guildId = message.guildId;
    const panels = await loadPanels(guildId);

    if (panels.length === 0) {
      return message.reply('❌ No ticket panels configured for this server.');
    }

    const embed = new EmbedBuilder()
      .setTitle('🎫 Ticket Panels')
      .setColor(0x5865F2)
      .setTimestamp();

    for (const panel of panels) {
      embed.addFields({
        name: `${panel.ticketTypeName} (${panel.panelId})`,
        value: [
          `Category: <#${panel.ticketCategoryId}>`,
          `Ping Role: <@&${panel.pingRoleId}>`,
          `Approve Role: <@&${panel.approveRoleId}>`,
          `Transcript: <#${panel.transcriptChannelId}>`,
          `Staff Roles: ${panel.staffRoleIds.map(id => `<@&${id}>`).join(', ')}`,
          `Nickname: ${panel.nicknameFormat}`
        ].join('\n'),
        inline: false
      });
    }

    return message.reply({ embeds: [embed] });

  } catch (error) {
    console.error('Error listing ticket panels:', error);
    return message.reply('❌ Failed to list ticket panels.');
  }
}

/**
 * Delete a ticket panel
 * Usage: !ticketdelete <panelId>
 */
export async function deleteTicketPanel(message, args) {
  // Check permissions
  if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return message.reply('❌ You need Administrator permission to use this command.');
  }

  if (args.length < 1) {
    return message.reply('❌ Usage: `!ticketdelete <panelId>`');
  }

  const panelId = args[0];

  try {
    const guildId = message.guildId;
    const panels = await loadPanels(guildId);

    const index = panels.findIndex(p => p.panelId === panelId);
    if (index === -1) {
      return message.reply(`❌ Panel "${panelId}" not found.`);
    }

    panels.splice(index, 1);
    await savePanels(guildId, panels);

    return message.reply(`✅ Ticket panel "${panelId}" deleted.`);

  } catch (error) {
    console.error('Error deleting ticket panel:', error);
    return message.reply('❌ Failed to delete ticket panel.');
  }
}

/**
 * Get ticket statistics
 * Usage: !ticketstats
 */
export async function getTicketStatsCommand(message) {
  try {
    const guildId = message.guildId;
    const stats = await getTicketStats(guildId);

    if (!stats) {
      return message.reply('❌ Failed to retrieve ticket statistics.');
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

    return message.reply({ embeds: [embed] });

  } catch (error) {
    console.error('Error getting ticket stats:', error);
    return message.reply('❌ Failed to retrieve ticket statistics.');
  }
}

/**
 * Health check for ticket system
 * Usage: !tickethealth
 */
export async function ticketHealthCommand(message) {
  // Check permissions
  if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return message.reply('❌ You need Administrator permission to use this command.');
  }

  try {
    const guildId = message.guildId;
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
        value: health.issues.join('\n'),
        inline: false
      });
    }

    return message.reply({ embeds: [embed] });

  } catch (error) {
    console.error('Error running health check:', error);
    return message.reply('❌ Failed to run health check.');
  }
}
