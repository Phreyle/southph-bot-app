import { EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { loadPrefix } from '../database/guildData.js';
import { hasPermission, hasPermissionSlash } from './permissions.js';

// Build help embed based on user permissions
export function buildHelpEmbed(member, guildId, isSlashCommand = false) {
  const prefix = loadPrefix(guildId).prefix;
  
  // Check permissions
  const isAdmin = isSlashCommand 
    ? (member && member.permissions && (BigInt(member.permissions) & BigInt(PermissionFlagsBits.Administrator)) === BigInt(PermissionFlagsBits.Administrator))
    : (member && member.permissions && member.permissions.has(PermissionFlagsBits.Administrator));
  
  const hasBankPerms = isSlashCommand 
    ? hasPermissionSlash(member, 'bankAdminRoles', guildId)
    : hasPermission(member, 'bankAdminRoles');
  
  const hasCtaPerms = isSlashCommand 
    ? hasPermissionSlash(member, 'ctaRegearRoles', guildId)
    : hasPermission(member, 'ctaRegearRoles');

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('📖 South PH Bot - Command Help')
    .setFooter({ text: 'South PH - Albion Online Guild Bot' })
    .setTimestamp();

  let description = `**Current Prefix:** \`${prefix}\`\n\n`;

  // User Commands (Always shown)
  description += `**👤 User Commands** (Available to All Members):\n`;
  description += `• \`/help\` or \`${prefix}help\` - Show this help menu\n`;
  description += `• \`/utc\` or \`${prefix}utc\` - Display current UTC time\n`;
  description += `• \`/info <playername>\` - Search for an Albion player\n`;
  description += `• \`/bank balance [@user]\` or \`${prefix}bal [@user]\` - Check balance\n`;
  description += `• \`/bank active\` or \`${prefix}bank active\` - List all bank users\n`;
  description += `• \`/register <region> <ign>\` or \`${prefix}register <region> <ign>\` - Register your Albion character\n`;
  description += `• \`/unregister\` or \`${prefix}unregister\` - Unregister your character\n`;
  description += `• \`/config view\` or \`${prefix}config\` - View guild verification settings\n`;
  description += `• In content threads: \`x [role]\` - Claim a role (tank, heal, etc.)\n`;
  description += `• In content threads: \`x fill\` - Sign up to fill any slot\n\n`;

  // Bank Admin Commands
  if (hasBankPerms || isAdmin) {
    description += `**💰 Bank Admin Commands** ${isAdmin ? '(Administrator)' : '(Authorized Role)'}:\n`;
    description += `• \`/bank deposit @user <amount>\` or \`${prefix}bank deposit @user <amount>\`\n`;
    description += `• \`/bank withdraw @user <amount>\` or \`${prefix}bank withdraw @user <amount>\`\n`;
    description += `• \`/bank clear @user\` or \`${prefix}bank clear @user\`\n`;
    description += `• \`/bank clearall\` or \`${prefix}bank clearall\`\n\n`;
  }

  // CTA Regear Commands
  if (hasCtaPerms || isAdmin) {
    description += `**⚔️ Regear Commands** ${isAdmin ? '(Administrator)' : '(Authorized Role)'}:\n`;
    description += `• \`/regear create [cta|ff] [title] [time]\` - Create a regear thread\n`;
    description += `• \`/regear close\` - Close and lock the current regear thread\n\n`;
  }

  // Full Admin Commands (Only for Discord Administrators)
  if (isAdmin) {
    description += `**🛡️ Administrator Commands** (Discord Admin Only):\n`;
    description += `• \`${prefix}prefix <new>\` - Change bot prefix\n`;
    description += `• \`/perms list\` or \`${prefix}perms list\` - View role permissions\n`;
    description += `• \`/perms add <bank|cta> @role\` - Grant role permission\n`;
    description += `• \`/perms remove <bank|cta> @role\` - Revoke role permission\n`;
    description += `• \`/set guild <region> <guild_name>\` - Configure Albion guild\n`;
    description += `• \`/set register-role @role\` - Set verified member role\n`;
    description += `• \`/set guild-tag <tag>\` - Set guild tag for nicknames\n`;
    description += `• \`/set nickname-format <format>\` - Set nickname format\n`;
    description += `• \`/forceunregister <ign>\` or \`${prefix}forceunregister <ign>\` - Force unregister by IGN\n`;
    description += `• \`/purge confirm\` or \`${prefix}purge confirm\` - Remove invalid registrations\n`;
    description += `• \`/content create [type] [title] [zone] [tier] [time]\` - Create content callout\n`;
    description += `• \`/content reset\` - Reset content callout\n`;
    description += `• \`/content adduser @user [role]\` - Add user to content role\n`;
    description += `• \`/content removeuser [role]\` - Remove user from content role\n`;
    description += `• \`/ticket setup\` - Setup a ticket panel\n`;
    description += `• \`/ticket list\` - List all ticket panels\n`;
    description += `• \`/ticket panel [panel_id]\` - Send apply button panel\n`;
    description += `• \`/ticket delete <panel_id>\` - Delete a ticket panel\n`;
    description += `• \`/ticket stats\` - View ticket statistics\n`;
    description += `• \`/ticket health\` - Run ticket system health check\n\n`;
  }

  // Show permission status if user has special permissions
  if (!isAdmin && (hasBankPerms || hasCtaPerms)) {
    description += `*You have special permissions granted via role assignment.*\n`;
  }

  embed.setDescription(description);
  return embed;
}

/**
 * Build paginated help embeds
 * Returns array of embeds for pagination
 */
export function buildPaginatedHelpEmbeds(member, guildId, isSlashCommand = false) {
  const prefix = loadPrefix(guildId).prefix;
  
  // Check permissions
  const isAdmin = isSlashCommand 
    ? (member && member.permissions && (BigInt(member.permissions) & BigInt(PermissionFlagsBits.Administrator)) === BigInt(PermissionFlagsBits.Administrator))
    : (member && member.permissions && member.permissions.has(PermissionFlagsBits.Administrator));
  
  const hasBankPerms = isSlashCommand 
    ? hasPermissionSlash(member, 'bankAdminRoles', guildId)
    : hasPermission(member, 'bankAdminRoles');
  
  const hasCtaPerms = isSlashCommand 
    ? hasPermissionSlash(member, 'ctaRegearRoles', guildId)
    : hasPermission(member, 'ctaRegearRoles');

  const pages = [];

  // Page 1: User Commands
  const page1 = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('📖 South PH Bot - Command Help (Page 1)')
    .setDescription(
      `**Current Prefix:** \`${prefix}\`\n\n` +
      `**👤 User Commands** (Available to All Members):\n` +
      `• \`/help\` or \`${prefix}help\` - Show this help menu\n` +
      `• \`/utc\` or \`${prefix}utc\` - Display current UTC time\n` +
      `• \`/info <playername>\` - Search for an Albion player across all regions\n` +
      `• \`/bank balance [@user]\` or \`${prefix}bal [@user]\` - Check bank balance\n` +
      `• \`/bank active\` or \`${prefix}bank active\` - List all bank users\n\n` +
      `**🎮 Albion Guild Verification:**\n` +
      `• \`/register <region> <ign>\` or \`${prefix}register <region> <ign>\`\n` +
      `  Register your Albion character (verifies guild membership)\n` +
      `• \`/unregister\` or \`${prefix}unregister\`\n` +
      `  Unregister your character from the system\n\n` +
      `**📝 Content Threads:**\n` +
      `• \`x [role]\` - Claim a role (e.g., \`x tank\`, \`x heal\`, \`x dps\`)\n` +
      `• \`x fill\` - Sign up to fill any available slot\n` +
      `• \`x cancel\` - Remove yourself from content\n`
    )
    .setFooter({ text: 'South PH - Albion Online Guild Bot' })
    .setTimestamp();
  pages.push(page1);

  // Page 2: Bank & Regear Commands
  let page2Desc = '';
  if (hasBankPerms || isAdmin) {
    page2Desc += `**💰 Bank Admin Commands** ${isAdmin ? '(Administrator)' : '(Authorized Role)'}:\n`;
    page2Desc += `• \`/bank deposit @user <amount>\` or \`${prefix}bank deposit @user <amount>\`\n`;
    page2Desc += `  Add money to a user's account\n`;
    page2Desc += `• \`/bank withdraw @user <amount>\` or \`${prefix}bank withdraw @user <amount>\`\n`;
    page2Desc += `  Remove money from a user's account\n`;
    page2Desc += `• \`/bank clear @user\` or \`${prefix}bank clear @user\`\n`;
    page2Desc += `  Clear a specific user's balance\n`;
    page2Desc += `• \`/bank clearall\` or \`${prefix}bank clearall\`\n`;
    page2Desc += `  Clear all balances (use with caution)\n\n`;
  }

  if (hasCtaPerms || isAdmin) {
    page2Desc += `**⚔️ Regear Commands** ${isAdmin ? '(Administrator)' : '(Authorized Role)'}:\n`;
    page2Desc += `• \`/regear create [cta|ff] [title] [time]\`\n`;
    page2Desc += `  Create a regear thread (CTA or FF)\n`;
    page2Desc += `• \`/regear close\`\n`;
    page2Desc += `  Close and lock the current regear thread\n`;
  }

  if (page2Desc) {
    const page2 = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📖 South PH Bot - Command Help (Page 2)')
      .setDescription(page2Desc)
      .setFooter({ text: 'South PH - Albion Online Guild Bot' })
      .setTimestamp();
    pages.push(page2);
  }

  // Page 3: Albion Admin Commands
  if (isAdmin) {
    const page3 = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📖 South PH Bot - Command Help (Page 3)')
      .setDescription(
        `**🎮 Albion Guild Verification (Admin)**:\n` +
        `• \`/set guild <region> <guild_name>\` or \`${prefix}set guild <region> <guild_name>\`\n` +
        `  Configure your guild and region (americas, europe, asia)\n` +
        `• \`/set register-role @role\` or \`${prefix}set register-role @role\`\n` +
        `  Set the role assigned to verified members\n` +
        `• \`/set guild-tag <tag>\` or \`${prefix}set guild-tag <tag>\`\n` +
        `  Set guild tag for nicknames (e.g., SOUTH)\n` +
        `• \`/set nickname-format <format>\` or \`${prefix}set nickname-format <format>\`\n` +
        `  Set nickname format ({ign}, {tag}, {guild}, {region})\n` +
        `• \`/config view\` or \`${prefix}config\`\n` +
        `  View current Albion configuration\n` +
        `• \`/forceunregister <ign>\` or \`${prefix}forceunregister <ign>\`\n` +
        `  Force unregister a player by in-game name\n` +
        `• \`/purge confirm\` or \`${prefix}purge confirm\`\n` +
        `  Remove users no longer in the guild (checks Albion API)\n`
      )
      .setFooter({ text: 'South PH - Albion Online Guild Bot' })
      .setTimestamp();
    pages.push(page3);

    // Page 4: Content Commands (Admin only)
    const page4 = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📖 South PH Bot - Command Help (Page 4)')
      .setDescription(
        `**🎮 Content Commands** (Administrator Only):\n` +
        `• \`/content create [type] [title] [zone] [tier] [time]\`\n` +
        `  Create content callout (ROA, CTA, GCAMPS, FF, Tracking, Avadungeon)\n` +
        `• \`/content reset\`\n` +
        `  Reset content callout (allows creating a new one)\n` +
        `• \`/content adduser @user [role]\`\n` +
        `  Add user to content role slot\n` +
        `• \`/content removeuser [role]\`\n` +
        `  Remove user from content role slot\n\n` +
        `**Content Types:**\n` +
        `• **ROA** - Roads of Avalon (7 fixed roles + fill)\n` +
        `• **CTA** - Crystal Territory Attack (categories: tank, heal, dps, support, dtank)\n` +
        `• **GCAMPS** - Group Camps (5 fixed roles + fill)\n` +
        `• **FF** - Faction Warfare (categories: tank, heal, dps)\n` +
        `• **Tracking** - Crystal League Tracking (5 fixed roles + fill)\n` +
        `• **Avadungeon** - Avalonian Dungeon (10 fixed roles + fill)\n`
      )
      .setFooter({ text: 'South PH - Albion Online Guild Bot' })
      .setTimestamp();
    pages.push(page4);

    // Page 5: Ticket & Permission Commands (Admin only)
    const page5 = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📖 South PH Bot - Command Help (Page 5)')
      .setDescription(
        `**🎫 Ticket Commands** (Administrator Only):\n` +
        `• \`/ticket setup\`\n` +
        `  Setup a ticket panel with full configuration\n` +
        `• \`/ticket list\` or \`${prefix}ticketpanels\`\n` +
        `  List all configured ticket panels\n` +
        `• \`/ticket panel [panel_id]\` or \`${prefix}applypanel\`\n` +
        `  Send apply button panel to current channel\n` +
        `• \`/ticket delete <panel_id>\` or \`${prefix}ticketdelete <panel_id>\`\n` +
        `  Delete a ticket panel configuration\n` +
        `• \`/ticket stats\` or \`${prefix}ticketstats\`\n` +
        `  View ticket statistics (total, open, closed, etc.)\n` +
        `• \`/ticket health\` or \`${prefix}tickethealth\`\n` +
        `  Run ticket system health check\n\n` +
        `**🛡️ Permission Commands** (Administrator Only):\n` +
        `• \`${prefix}prefix <new>\`\n` +
        `  Change bot prefix\n` +
        `• \`/perms list\` or \`${prefix}perms list\`\n` +
        `  View role permissions\n` +
        `• \`/perms add <bank|cta> @role\` or \`${prefix}perms add <bank|cta> @role\`\n` +
        `  Grant role special permissions\n` +
        `• \`/perms remove <bank|cta> @role\` or \`${prefix}perms remove <bank|cta> @role\`\n` +
        `  Revoke role permissions\n`
      )
      .setFooter({ text: 'South PH - Albion Online Guild Bot' })
      .setTimestamp();
    pages.push(page5);
  } else {
    // For non-admin, adjust page numbers
    pages.forEach((page, index) => {
      const totalPages = pages.length;
      page.setTitle(`📖 South PH Bot - Command Help (Page ${index + 1}/${totalPages})`);
    });
  }

  return pages;
}

/**
 * Build navigation buttons for paginated help
 */
export function buildHelpNavigationButtons(currentPage, totalPages) {
  const row = new ActionRowBuilder();

  // Previous button
  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`help_prev_${currentPage}`)
      .setLabel('◀️ Previous')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(currentPage === 0)
  );

  // Page indicator (disabled button showing page number)
  row.addComponents(
    new ButtonBuilder()
      .setCustomId('help_page_indicator')
      .setLabel(`Page ${currentPage + 1}/${totalPages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true)
  );

  // Next button
  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`help_next_${currentPage}`)
      .setLabel('Next ▶️')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(currentPage === totalPages - 1)
  );

  return row;
}

