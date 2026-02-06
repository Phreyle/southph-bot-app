import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { loadPrefix, savePrefix, loadPermissions, savePermissions } from '../database/guildData.js';
import { deposit, withdraw, getBalance, getActiveUsers, clearUser, clearAll, CURRENCY } from '../systems/bank/bank.js';
import { hasPermission } from '../utils/permissions.js';
import { buildHelpEmbed } from '../utils/embedBuilder.js';
import { 
  setupTicketPanel, 
  listTicketPanels, 
  deleteTicketPanel,
  getTicketStatsCommand,
  ticketHealthCommand 
} from '../systems/ticket/ticket-commands.js';
import { createApplyPanelMessage } from '../systems/ticket/ticket-system.js';

export async function handlePrefixCommands(message, command, args, prefix) {
  // !utc command
  if (command === 'utc' || command === 'time') {
    const now = new Date();
    const hours = String(now.getUTCHours()).padStart(2, '0');
    const minutes = String(now.getUTCMinutes()).padStart(2, '0');
    const seconds = String(now.getUTCSeconds()).padStart(2, '0');
    const utcTime = `${hours}:${minutes}:${seconds}`;

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setDescription(`⏰ UTC Time Now: **${utcTime}**`);

    await message.reply({ embeds: [embed] });
    return;
  }

  // !bank or !bal command
  if (command === 'bank' || command === 'bal' || command === 'balance') {
    const subcommand = args[0]?.toLowerCase();
    
    if (!subcommand || subcommand === 'balance' || subcommand === 'bal') {
      // Show own balance or mentioned user's balance
      const mentionedUser = message.mentions.users.first();
      const targetUserId = mentionedUser?.id || message.author.id;
      const balance = getBalance(message.guild.id, targetUserId);

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('💰 Bank Balance')
        .setDescription(
          `**User:** <@${targetUserId}>\n` +
          `**Balance:** ${CURRENCY}${balance.toLocaleString()}`
        )
        .setTimestamp();

      await message.reply({ embeds: [embed] });
      return;
    }

    // Check admin permission for admin commands
    if (!hasPermission(message.member, 'bankAdminRoles')) {
      await message.reply('❌ You need Administrator permission or an authorized role to use this command.');
      return;
    }

    if (subcommand === 'deposit' || subcommand === 'dep') {

      const mentionedUser = message.mentions.users.first();
      const amount = parseInt(args[1]);

      if (!mentionedUser || isNaN(amount) || amount <= 0) {
        await message.reply(`❌ Usage: \`${prefix}bank deposit @user <amount>\``);
        return;
      }

      const result = deposit(message.guild.id, mentionedUser.id, amount);

      const embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('💰 Deposit Successful')
        .setDescription(
          `**User:** <@${mentionedUser.id}>\n` +
          `**Deposited:** ${CURRENCY}${amount.toLocaleString()}\n` +
          `**New Balance:** ${CURRENCY}${result.newBalance.toLocaleString()}`
        )
        .setTimestamp();

      await message.reply({ embeds: [embed] });
      return;
    }

    if (subcommand === 'withdraw' || subcommand === 'with') {

      const mentionedUser = message.mentions.users.first();
      const amount = parseInt(args[1]);

      if (!mentionedUser || !amount || amount <= 0) {
        await message.reply(`❌ Usage: \`${prefix}bank withdraw @user <amount>\``);
        return;
      }

      const result = withdraw(message.guild.id, mentionedUser.id, amount);

      if (!result.success) {
        await message.reply(`❌ ${result.error}`);
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle('💸 Withdrawal Successful')
        .setDescription(
          `**User:** <@${mentionedUser.id}>\n` +
          `**Withdrawn:** ${CURRENCY}${amount.toLocaleString()}\n` +
          `**New Balance:** ${CURRENCY}${result.newBalance.toLocaleString()}`
        )
        .setTimestamp();

      await message.reply({ embeds: [embed] });
      return;
    }

    if (subcommand === 'active' || subcommand === 'list') {
      const activeUsers = getActiveUsers(message.guild.id);

      if (activeUsers.length === 0) {
        await message.reply('📊 No users currently have money in the bank.');
        return;
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

      await message.reply({ embeds: [embed] });
      return;
    }

    if (subcommand === 'clear') {

      const mentionedUser = message.mentions.users.first();

      if (!mentionedUser) {
        await message.reply(`❌ Usage: \`${prefix}bank clear @user\``);
        return;
      }

      const result = clearUser(message.guild.id, mentionedUser.id);

      if (!result.success) {
        await message.reply(`❌ ${result.error}`);
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0xe67e22)
        .setTitle('🗑️ Balance Cleared')
        .setDescription(
          `**User:** <@${mentionedUser.id}>\n` +
          `**Cleared Amount:** ${CURRENCY}${result.clearedAmount.toLocaleString()}\n` +
          `**New Balance:** ${CURRENCY}0`
        )
        .setTimestamp();

      await message.reply({ embeds: [embed] });
      return;
    }

    if (subcommand === 'clearall') {

      const result = clearAll(message.guild.id);

      if (!result.success) {
        await message.reply(`❌ ${result.error}`);
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0xc0392b)
        .setTitle('🗑️ All Balances Cleared')
        .setDescription(
          `**Cleared Users:** ${result.clearedUsers}\n` +
          `**All balances have been reset to ${CURRENCY}0**`
        )
        .setTimestamp();

      await message.reply({ embeds: [embed] });
      return;
    }

    // Invalid subcommand
    await message.reply(
      `❌ Invalid subcommand. Available: \`balance\`, \`deposit\`, \`withdraw\`, \`active\`, \`clear\`, \`clearall\``
    );
    return;
  }

  // !prefix command - Change bot prefix (Admin only)
  if (command === 'prefix') {
    const isAdmin = message.member.permissions.has(PermissionFlagsBits.Administrator);
    
    if (!isAdmin) {
      await message.reply('❌ You need Administrator permission to change the prefix.');
      return;
    }

    const newPrefix = args[0];

    if (!newPrefix) {
      await message.reply(`📝 Current prefix: \`${prefix}\`\nUsage: \`${prefix}prefix <new_prefix>\``);
      return;
    }

    if (newPrefix.length > 3) {
      await message.reply('❌ Prefix must be 3 characters or less.');
      return;
    }

    if (savePrefix(message.guild.id, newPrefix)) {
      await message.reply(`✅ Prefix changed from \`${prefix}\` to \`${newPrefix}\``);
    } else {
      await message.reply('❌ Failed to change prefix.');
    }
    return;
  }

  // !permissions command - Manage role permissions (Admin only)
  if (command === 'permissions' || command === 'perms') {
    const isAdmin = message.member.permissions.has(PermissionFlagsBits.Administrator);
    
    if (!isAdmin) {
      await message.reply('❌ You need Administrator permission to manage permissions.');
      return;
    }

    const subcommand = args[0]?.toLowerCase();
    const permType = args[1]?.toLowerCase();
    
    if (!subcommand || (subcommand !== 'list' && !permType)) {
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🔐 Permission Management')
        .setDescription(
          `**Usage:**\n` +
          `\`${prefix}perms list\` - List all role permissions\n` +
          `\`${prefix}perms add <bank|cta> @role\` - Add role to permission group\n` +
          `\`${prefix}perms remove <bank|cta> @role\` - Remove role from permission group\n\n` +
          `**Permission Types:**\n` +
          `• \`bank\` - Can use bank deposit/withdraw/clear commands\n` +
          `• \`cta\` - Can use /ctaregear command`
        );
      await message.reply({ embeds: [embed] });
      return;
    }

    if (subcommand === 'list') {
      const permissions = loadPermissions(message.guild.id);
      const bankRoles = permissions.bankAdminRoles.map(id => `<@&${id}>`).join('\n') || '*None*';
      const ctaRoles = permissions.ctaRegearRoles.map(id => `<@&${id}>`).join('\n') || '*None*';
      
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🔐 Current Role Permissions')
        .addFields(
          { name: '💰 Bank Admin Roles', value: bankRoles, inline: false },
          { name: '⚔️ CTA Regear Roles', value: ctaRoles, inline: false }
        )
        .setFooter({ text: 'Administrators always have access to all commands' });
      
      await message.reply({ embeds: [embed] });
      return;
    }

    const role = message.mentions.roles.first();
    if (!role) {
      await message.reply(`❌ Please mention a role. Usage: \`${prefix}perms ${subcommand} <bank|cta> @role\``);
      return;
    }

    let configKey;
    let displayName;
    if (permType === 'bank') {
      configKey = 'bankAdminRoles';
      displayName = 'Bank Admin';
    } else if (permType === 'cta') {
      configKey = 'ctaRegearRoles';
      displayName = 'CTA Regear';
    } else {
      await message.reply(`❌ Invalid permission type. Use \`bank\` or \`cta\`.`);
      return;
    }

    const permissions = loadPermissions(message.guild.id);

    if (subcommand === 'add') {
      if (permissions[configKey].includes(role.id)) {
        await message.reply(`❌ Role ${role} already has ${displayName} permission.`);
        return;
      }
      
      permissions[configKey].push(role.id);
      savePermissions(message.guild.id, permissions);
      await message.reply(`✅ Added ${role} to ${displayName} permissions.`);
      return;
    }

    if (subcommand === 'remove') {
      const index = permissions[configKey].indexOf(role.id);
      if (index === -1) {
        await message.reply(`❌ Role ${role} doesn't have ${displayName} permission.`);
        return;
      }
      
      permissions[configKey].splice(index, 1);
      savePermissions(message.guild.id, permissions);
      await message.reply(`✅ Removed ${role} from ${displayName} permissions.`);
      return;
    }

    await message.reply(`❌ Invalid subcommand. Use \`add\`, \`remove\`, or \`list\`.`);
    return;
  }

  // !help command
  if (command === 'help' || command === 'commands') {
    const embed = buildHelpEmbed(message.member, message.guild.id, false);
    await message.reply({ embeds: [embed] });
    return;
  }

  // ==================== TICKET COMMANDS ====================
  
  // !ticketsetup command
  if (command === 'ticketsetup') {
    await setupTicketPanel(message, args);
    return;
  }

  // !ticketpanels command
  if (command === 'ticketpanels') {
    await listTicketPanels(message);
    return;
  }

  // !ticketdelete command
  if (command === 'ticketdelete') {
    await deleteTicketPanel(message, args);
    return;
  }

  // !ticketstats command
  if (command === 'ticketstats') {
    await getTicketStatsCommand(message);
    return;
  }

  // !tickethealth command
  if (command === 'tickethealth') {
    await ticketHealthCommand(message);
    return;
  }

  // !applypanel command - sends the apply button in the current channel
  if (command === 'applypanel') {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      await message.reply('❌ You need Administrator permission to use this command.');
      return;
    }
    
    const panelMessage = createApplyPanelMessage();
    await message.channel.send(panelMessage);
    await message.reply('✅ Apply panel created!');
    return;
  }
}
