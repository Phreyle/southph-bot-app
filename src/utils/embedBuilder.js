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
    description += `• \`/perms add <bank|cta> @role\` or \`${prefix}perms add <bank|cta> @role\` - Grant role permission\n`;
    description += `• \`/perms remove <bank|cta> @role\` or \`${prefix}perms remove <bank|cta> @role\` - Revoke role permission\n`;
    description += `• \`/content create [type] [title] [zone] [tier] [time]\` - Create content callout\n`;
    description += `• \`/content reset\` - Reset content callout\n`;
    description += `• \`/content adduser @user [role]\` - Add user to content role\n`;
    description += `• \`/content removeuser [role]\` - Remove user from content role\n`;
    description += `• \`/ticket setup\` - Setup a ticket panel (with region options)\n`;
    description += `• \`/ticket list\` - List all ticket panels\n`;
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
    .setTitle('📖 South PH Bot - Command Help (Page 1/4)')
    .setDescription(
      `**Current Prefix:** \`${prefix}\`\n\n` +
      `**👤 User Commands** (Available to All Members):\n` +
      `• \`/help\` or \`${prefix}help\` - Show this help menu\n` +
      `• \`/utc\` or \`${prefix}utc\` - Display current UTC time\n` +
      `• \`/info <playername>\` - Search for an Albion player\n` +
      `• \`/bank balance [@user]\` or \`${prefix}bal [@user]\` - Check balance\n` +
      `• \`/bank active\` or \`${prefix}bank active\` - List all bank users\n` +
      `• In content threads: \`x [role]\` - Claim a role (tank, heal, etc.)\n` +
      `• In content threads: \`x fill\` - Sign up to fill any slot\n`
    )
    .setFooter({ text: 'South PH - Albion Online Guild Bot' })
    .setTimestamp();
  pages.push(page1);

  // Page 2: Bank & Regear Commands
  let page2Desc = '';
  if (hasBankPerms || isAdmin) {
    page2Desc += `**💰 Bank Admin Commands** ${isAdmin ? '(Administrator)' : '(Authorized Role)'}:\n`;
    page2Desc += `• \`/bank deposit @user <amount>\` - Deposit money to a user\n`;
    page2Desc += `• \`/bank withdraw @user <amount>\` - Withdraw money from a user\n`;
    page2Desc += `• \`/bank clear @user\` - Clear a user's balance\n`;
    page2Desc += `• \`/bank clearall\` - Clear all balances\n\n`;
  }

  if (hasCtaPerms || isAdmin) {
    page2Desc += `**⚔️ Regear Commands** ${isAdmin ? '(Administrator)' : '(Authorized Role)'}:\n`;
    page2Desc += `• \`/regear create [cta|ff] [title] [time]\` - Create a regear thread\n`;
    page2Desc += `• \`/regear close\` - Close and lock the current regear thread\n`;
  }

  if (page2Desc) {
    const page2 = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📖 South PH Bot - Command Help (Page 2/4)')
      .setDescription(page2Desc)
      .setFooter({ text: 'South PH - Albion Online Guild Bot' })
      .setTimestamp();
    pages.push(page2);
  }

  // Page 3: Content Commands (Admin only)
  if (isAdmin) {
    const page3 = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📖 South PH Bot - Command Help (Page 3/4)')
      .setDescription(
        `**🎮 Content Commands** (Administrator Only):\n` +
        `• \`/content create [type] [title] [zone] [tier] [time]\` - Create content callout\n` +
        `  Types: ROA, CTA, GCAMPS, FF, Tracking\n` +
        `• \`/content reset\` - Reset content callout\n` +
        `• \`/content adduser @user [role]\` - Add user to content role\n` +
        `• \`/content removeuser [role]\` - Remove user from content role\n\n` +
        `**🎫 Ticket Commands** (Administrator Only):\n` +
        `• \`/ticket setup\` - Setup a ticket panel with region options\n` +
        `• \`/ticket list\` - List all ticket panels\n` +
        `• \`/ticket delete <panel_id>\` - Delete a ticket panel\n` +
        `• \`/ticket stats\` - View ticket statistics\n` +
        `• \`/ticket health\` - Run ticket system health check\n`
      )
      .setFooter({ text: 'South PH - Albion Online Guild Bot' })
      .setTimestamp();
    pages.push(page3);

    // Page 4: Permission & Config Commands (Admin only)
    const page4 = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📖 South PH Bot - Command Help (Page 4/4)')
      .setDescription(
        `**🛡️ Permission & Config Commands** (Administrator Only):\n` +
        `• \`${prefix}prefix <new>\` - Change bot prefix\n` +
        `• \`/perms list\` or \`${prefix}perms list\` - View role permissions\n` +
        `• \`/perms add <bank|cta> @role\` - Grant role permission\n` +
        `• \`/perms remove <bank|cta> @role\` - Revoke role permission\n\n` +
        `**ℹ️ About Regions:**\n` +
        `The ticket system supports Albion Online regions:\n` +
        `• 🌏 Asia\n` +
        `• 🌍 Europe\n` +
        `• 🌎 Americas\n\n` +
        `Use dropdown menus in \`/ticket setup\` for easy region selection.`
      )
      .setFooter({ text: 'South PH - Albion Online Guild Bot' })
      .setTimestamp();
    pages.push(page4);
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

