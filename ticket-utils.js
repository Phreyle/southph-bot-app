/**
 * Ticket System Utilities
 * Helper functions for maintenance and bulk operations
 */

import { loadTickets, loadTranscripts, loadPanels, loadMeta } from './ticket-db.js';

/**
 * Get ticket statistics for a guild
 */
export async function getTicketStats(guildId) {
  try {
    const tickets = await loadTickets(guildId);
    const meta = await loadMeta(guildId);

    const stats = {
      total: tickets.length,
      open: tickets.filter(t => t.status === 'open').length,
      claimed: tickets.filter(t => t.status === 'claimed').length,
      closed: tickets.filter(t => t.status === 'closed').length,
      approved: tickets.filter(t => t.status === 'approved').length,
      lastTicketId: meta.lastTicketId
    };

    return stats;
  } catch (error) {
    console.error('Error getting ticket stats:', error);
    return null;
  }
}

/**
 * Get all open tickets for a guild
 */
export async function getOpenTickets(guildId) {
  try {
    const tickets = await loadTickets(guildId);
    return tickets.filter(t => t.status === 'open' || t.status === 'claimed');
  } catch (error) {
    console.error('Error getting open tickets:', error);
    return [];
  }
}

/**
 * Get tickets by user
 */
export async function getUserTickets(guildId, userId) {
  try {
    const tickets = await loadTickets(guildId);
    return tickets.filter(t => t.authorId === userId);
  } catch (error) {
    console.error('Error getting user tickets:', error);
    return [];
  }
}

/**
 * Get transcript for a ticket
 */
export async function getTicketTranscript(guildId, ticketId) {
  try {
    const transcripts = await loadTranscripts(guildId);
    return transcripts.find(t => t.ticketId === ticketId);
  } catch (error) {
    console.error('Error getting transcript:', error);
    return null;
  }
}

/**
 * Format transcript as readable text
 */
export function formatTranscript(transcript) {
  if (!transcript) return 'No transcript found.';

  let text = `=== TICKET #${transcript.ticketId} TRANSCRIPT ===\n\n`;
  text += `Total Messages: ${transcript.messages.length}\n`;
  text += `Staff Messages: ${transcript.staffMessageCount}\n\n`;
  text += '--- MESSAGES ---\n\n';

  for (const msg of transcript.messages) {
    const staffBadge = msg.isStaff ? '[STAFF] ' : '';
    const timestamp = new Date(msg.createdAt).toLocaleString();
    text += `[${timestamp}] ${staffBadge}${msg.authorTag}:\n${msg.content}\n\n`;
  }

  return text;
}

/**
 * Validate panel configuration
 */
export function validatePanel(panel) {
  const errors = [];

  if (!panel.panelId) errors.push('Missing panelId');
  if (!panel.ticketTypeName) errors.push('Missing ticketTypeName');
  if (!panel.ticketCategoryId) errors.push('Missing ticketCategoryId');
  if (!panel.pingRoleId) errors.push('Missing pingRoleId');
  if (!panel.staffRoleIds || panel.staffRoleIds.length === 0) {
    errors.push('Missing or empty staffRoleIds');
  }
  if (!panel.approveRoleId) errors.push('Missing approveRoleId');
  if (!panel.transcriptChannelId) errors.push('Missing transcriptChannelId');
  if (!panel.nicknameFormat) errors.push('Missing nicknameFormat');

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Health check for ticket system
 */
export async function ticketSystemHealthCheck(guildId) {
  const health = {
    guild: guildId,
    status: 'healthy',
    issues: []
  };

  try {
    // Check panels
    const panels = await loadPanels(guildId);
    if (panels.length === 0) {
      health.issues.push('No panels configured');
    } else {
      for (const panel of panels) {
        const validation = validatePanel(panel);
        if (!validation.valid) {
          health.issues.push(`Panel ${panel.panelId}: ${validation.errors.join(', ')}`);
        }
      }
    }

    // Check tickets
    const tickets = await loadTickets(guildId);
    const openTickets = tickets.filter(t => t.status === 'open' || t.status === 'claimed');
    
    // Check transcripts
    const transcripts = await loadTranscripts(guildId);
    for (const ticket of tickets) {
      const transcript = transcripts.find(t => t.ticketId === ticket.ticketId);
      if (!transcript) {
        health.issues.push(`Missing transcript for ticket ${ticket.ticketId}`);
      }
    }

    // Check meta
    const meta = await loadMeta(guildId);
    if (meta.lastTicketId < tickets.length) {
      health.issues.push('Ticket counter may be out of sync');
    }

    health.stats = {
      panels: panels.length,
      totalTickets: tickets.length,
      openTickets: openTickets.length,
      transcripts: transcripts.length,
      lastTicketId: meta.lastTicketId
    };

    if (health.issues.length > 0) {
      health.status = 'warning';
    }

  } catch (error) {
    health.status = 'error';
    health.issues.push(`System error: ${error.message}`);
  }

  return health;
}

/**
 * Get ticket age in hours
 */
export function getTicketAge(ticket) {
  const openDate = new Date(ticket.openDate);
  const now = new Date();
  const diffMs = now - openDate;
  return Math.floor(diffMs / (1000 * 60 * 60));
}

/**
 * Get old unclaimed tickets (open for more than X hours)
 */
export async function getOldUnclaimedTickets(guildId, hoursThreshold = 24) {
  try {
    const tickets = await loadTickets(guildId);
    return tickets.filter(t => {
      if (t.status !== 'open') return false;
      const age = getTicketAge(t);
      return age >= hoursThreshold;
    });
  } catch (error) {
    console.error('Error getting old tickets:', error);
    return [];
  }
}
