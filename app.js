import 'dotenv/config';
import { Client, GatewayIntentBits, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  InteractionType,
  InteractionResponseType,
  verifyKeyMiddleware,
} from 'discord-interactions';
import { DiscordRequest } from './utils.js';
import { 
  deposit, 
  withdraw, 
  getBalance, 
  getActiveUsers, 
  clearUser,
  clearAll,
  CURRENCY 
} from './bank.js';
import { createWorker } from 'tesseract.js';
import axios from 'axios';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Interaction received at', Date.now());

// Prefix configuration
const PREFIX_FILE = path.join(__dirname, 'prefix-config.json');
// Use /tmp for permissions in read-only container environments
const PERMISSIONS_FILE = process.env.PERMISSIONS_FILE || '/tmp/permissions-config.json';

function getPrefix() {
  try {
    const data = fs.readFileSync(PREFIX_FILE, 'utf8');
    const config = JSON.parse(data);
    return config.prefix || '!';
  } catch (error) {
    return '!';
  }
}

function setPrefix(newPrefix) {
  try {
    fs.writeFileSync(PREFIX_FILE, JSON.stringify({ prefix: newPrefix }, null, 2), 'utf8');
    console.log(`✅ Prefix changed to: ${newPrefix}`);
    return true;
  } catch (error) {
    console.error('❌ Error saving prefix:', error);
    return false;
  }
}

// Permission configuration
function getPermissions() {
  try {
    const data = fs.readFileSync(PERMISSIONS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading permissions config:', error);
    return { bankAdminRoles: [], ctaRegearRoles: [] };
  }
}

function savePermissions(config) {
  try {
    // Ensure the directory exists
    const dir = path.dirname(PERMISSIONS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(PERMISSIONS_FILE, JSON.stringify(config, null, 2), 'utf8');
    console.log('✅ Permissions saved successfully to:', PERMISSIONS_FILE);
    return true;
  } catch (error) {
    console.error('❌ Error saving permissions config:', error);
    console.error('   Attempted path:', PERMISSIONS_FILE);
    return false;
  }
}

// Check if user has required permission (Admin OR specified role)
function hasPermission(member, permissionType) {
  // Always allow Discord Administrators
  if (member.permissions.has(PermissionFlagsBits.Administrator)) {
    return true;
  }

  // Check if user has any of the specified roles
  const permissions = getPermissions();
  const allowedRoles = permissions[permissionType] || [];
  
  if (!member.roles || !member.roles.cache) {
    return false;
  }

  return member.roles.cache.some(role => allowedRoles.includes(role.id));
}

// For slash commands (permissions are strings, not objects)
function hasPermissionSlash(member, permissionType) {
  // Always allow Discord Administrators
  if (member && member.permissions && 
    (BigInt(member.permissions) & BigInt(PermissionFlagsBits.Administrator)) === BigInt(PermissionFlagsBits.Administrator)) {
    return true;
  }

  // Check if user has any of the specified roles
  const permissions = getPermissions();
  const allowedRoles = permissions[permissionType] || [];
  
  if (!member.roles || allowedRoles.length === 0) {
    return false;
  }

  return allowedRoles.some(roleId => member.roles.includes(roleId));
}

// Build help embed based on user permissions
function buildHelpEmbed(member, isSlashCommand = false) {
  const prefix = getPrefix();
  
  // Check permissions
  const isAdmin = isSlashCommand 
    ? (member && member.permissions && (BigInt(member.permissions) & BigInt(PermissionFlagsBits.Administrator)) === BigInt(PermissionFlagsBits.Administrator))
    : (member && member.permissions && member.permissions.has(PermissionFlagsBits.Administrator));
  
  const hasBankPerms = isSlashCommand 
    ? hasPermissionSlash(member, 'bankAdminRoles')
    : hasPermission(member, 'bankAdminRoles');
  
  const hasCtaPerms = isSlashCommand 
    ? hasPermissionSlash(member, 'ctaRegearRoles')
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
    description += `• \`/regear [cta|ff] [title] [time]\` - Create a regear thread\n\n`;
  }

  // Full Admin Commands (Only for Discord Administrators)
  if (isAdmin) {
    description += `**🛡️ Administrator Commands** (Discord Admin Only):\n`;
    description += `• \`${prefix}prefix <new>\` - Change bot prefix\n`;
    description += `• \`/perms list\` or \`${prefix}perms list\` - View role permissions\n`;
    description += `• \`/perms add <bank|cta> @role\` or \`${prefix}perms add <bank|cta> @role\` - Grant role permission\n`;
    description += `• \`/perms remove <bank|cta> @role\` or \`${prefix}perms remove <bank|cta> @role\` - Revoke role permission\n`;
    description += `• \`/content create [content_type] [role] [title] [zone] [tier] [time]\` - Create content callout\n`;
    description += `• \`/content reset\` - Reset content callout\n`;
    description += `• \`/content adduser\` - Add user to content role\n`;
    description += `• \`/content removeuser\` - Remove user from content role\n\n`;
  }

  // Show permission status if user has special permissions
  if (!isAdmin && (hasBankPerms || hasCtaPerms)) {
    description += `*You have special permissions granted via role assignment.*\n`;
  }

  embed.setDescription(description);
  return embed;
}
// Create an express app
const app = express();
// Get port, or default to 3000
const PORT = process.env.PORT || 3000;

// Custom emoji configuration - Replace with your server's emoji IDs
// To get emoji ID: Type \:emoji_name: in Discord and copy the numbers
const CUSTOM_EMOJIS = {
  OFFTANK: '<:OFFTANK:1388541334637379695>',  // Replace YOUR_EMOJI_ID_HERE with actual ID
  HEALER: '<:HEALER:1388541939317473350>',
  DEBUFF: '<:DEBUFF:1388542342788677834>',
  DPS: '<:DPS:1388541739815669792>',
};

// Storage for content state (in production, use a database)
const contentState = {
  active: false,
  messageId: null,
  channelId: null,
  threadId: null,
  contentType: 'ff', // roa, cta, gcamps, ff
  zone: 'Brecilien',
  tier: 7,
  time: '',
  roles: {
    tank: null,
    heal: null,
    shadowcaller: null,
    blazing: null,
    mp: null,
    mp2: null,
    flex: null
  },
  fill: [] // Array of user IDs who want to fill any remaining slots
};

// Storage for regear threads (for OCR tracking)
const regearThreads = new Set(); // Set of thread IDs for ctaregear and ffregear threads

// Create a Discord client
const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ] 
});

client.once('clientReady', () => {
  console.log(`Gateway connected as ${client.user.tag}`);
});

// Helper function to build the content embed
const buildContentEmbed = () => {
  const roleLines = [
    `**1. ${CUSTOM_EMOJIS.OFFTANK} TANK**   ${contentState.roles.tank ? '➡️ <@' + contentState.roles.tank + '>' : ''}`,
    `**2. ${CUSTOM_EMOJIS.HEALER} HEALER**   ${contentState.roles.heal ? '➡️ <@' + contentState.roles.heal + '>' : ''}`,
    `**3. ${CUSTOM_EMOJIS.DEBUFF} SHADOWCALLER**   ${contentState.roles.shadowcaller ? '➡️ <@' + contentState.roles.shadowcaller + '>' : ''}`,
    `**4. ${CUSTOM_EMOJIS.DPS} BLAZING**   ${contentState.roles.blazing ? '➡️ <@' + contentState.roles.blazing + '>' : ''}`,
    `**5. ${CUSTOM_EMOJIS.DPS} MIST PIERCER**   ${contentState.roles.mp ? '➡️ <@' + contentState.roles.mp + '>' : ''}`,
    `**6. ${CUSTOM_EMOJIS.DPS} MIST PIERCER**   ${contentState.roles.mp2 ? '➡️ <@' + contentState.roles.mp2 + '>' : ''}`,
    `**7. ${CUSTOM_EMOJIS.DPS} MP / LC / ARCTIC / PERMA**   ${contentState.roles.flex ? '➡️ <@' + contentState.roles.flex + '>' : ''}`
  ];

  // Count filled slots
  const filledSlots = Object.values(contentState.roles).filter(v => v !== null).length;
  const totalSlots = 7;
  const fillCount = contentState.fill.length;

  // Determine if fill players are in standby or being auto-assigned
  const minSlotsBeforeFill = 6;
  const fillStatus = filledSlots >= minSlotsBeforeFill ? 'FILLING' : 'STANDBY';

  // Build fill section
  let fillSection = '';
  if (fillCount > 0) {
    const fillStatusEmoji = fillStatus === 'STANDBY' ? '⏸️' : '🔄';
    fillSection = `\n\n**${fillStatusEmoji} FILL - ${fillStatus} (${fillCount}):** ${contentState.fill.map(id => `<@${id}>`).join(', ')}`;
    if (fillStatus === 'STANDBY') {
      fillSection += `\n*Will auto-fill when ${minSlotsBeforeFill}+ slots are taken*`;
    }
  }

  // Build status line
  let statusLine = `**Status:** ${filledSlots}/${totalSlots}`;
  if (fillCount > 0 && fillStatus === 'STANDBY') {
    statusLine += ` (${fillCount} in FILL standby)`;
  }

  // Content type title
  const contentTypeTitle = contentState.contentType.toUpperCase();
  const contentEmoji = {
    'roa': '🏰',
    'cta': '⚔️',
    'gcamps': '🏕️',
    'ff': '🛡️'
  }[contentState.contentType] || '🎮';

  return new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`${contentEmoji} ${contentTypeTitle} Role Call`)
    .setDescription(
      `**__X UP ROLE!__**\n` +
      `**Zone:** ${contentState.zone}\n**Gear:** T${contentState.tier} Sets\n**Time:** ${contentState.time}\n` +
      `${statusLine}\n\n` +
      roleLines.join('\n') +
      fillSection +
      `\n\n**Builds Thread:** <#1422948227405316208>`
    );
};

// Auto-assign fill players to empty slots
async function autoAssignFillPlayers() {
  const roleKeys = ['tank', 'heal', 'shadowcaller', 'blazing', 'mp', 'mp2', 'flex'];
  const totalSlots = 7;

  // Count how many slots are currently filled (not null)
  const filledSlots = Object.values(contentState.roles).filter(v => v !== null).length;

  // Only auto-assign fill players when 6 or more slots are taken
  // This means: wait until almost full, then fill remaining slots
  const minSlotsBeforeFill = 6;

  if (filledSlots < minSlotsBeforeFill) {
    // Not enough slots filled yet, keep fill players in standby
    console.log(`⏸️ Fill players on standby: ${filledSlots}/${totalSlots} slots filled (need ${minSlotsBeforeFill})`);
    return;
  }

  // Now we're at 6 or more slots, start assigning fill players
  console.log(`✅ Auto-assigning fill players: ${filledSlots}/${totalSlots} slots filled`);

  while (contentState.fill.length > 0) {
    // Find first empty slot
    const emptySlot = roleKeys.find(key => contentState.roles[key] === null);

    if (!emptySlot) {
      // No empty slots, break
      break;
    }

    // Assign first fill player to empty slot
    const fillPlayerId = contentState.fill.shift();
    contentState.roles[emptySlot] = fillPlayerId;

    // Try to notify the player
    try {
      const channel = await client.channels.fetch(contentState.threadId);
      if (channel) {
        await channel.send(`✅ <@${fillPlayerId}> has been automatically assigned to **${emptySlot.toUpperCase()}** from FILL standby!`);
      }
    } catch (err) {
      console.error('Error notifying fill player:', err);
    }
  }
}

// OCR function to extract Est. Market Value from images
async function extractMarketValueFromImage(imageUrl) {
  try {
    console.log('🔍 Starting OCR for image:', imageUrl);
    
    // Download the image
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const originalBuffer = Buffer.from(response.data, 'binary');
    
    // Try multiple preprocessing techniques
    const preprocessingTechniques = [
      {
        name: 'High Contrast B&W',
        process: async (buf) => sharp(buf)
          .greyscale()
          .normalize()
          .threshold(128) // Binary threshold for stark contrast
          .resize({ width: 3000, fit: 'inside', withoutEnlargement: false })
          .toBuffer()
      },
      {
        name: 'Enhanced Sharpening',
        process: async (buf) => sharp(buf)
          .greyscale()
          .normalize()
          .sharpen({ sigma: 2 })
          .modulate({ brightness: 1.2, contrast: 1.5 })
          .resize({ width: 3000, fit: 'inside', withoutEnlargement: false })
          .toBuffer()
      },
      {
        name: 'Inverted Colors',
        process: async (buf) => sharp(buf)
          .greyscale()
          .normalize()
          .negate()
          .sharpen()
          .resize({ width: 2500, fit: 'inside', withoutEnlargement: false })
          .toBuffer()
      }
    ];
    
    let allExtractedText = [];
    
    // Try each preprocessing technique
    for (const technique of preprocessingTechniques) {
      console.log(`🖼️ Trying preprocessing: ${technique.name}...`);
      const processedBuffer = await technique.process(originalBuffer);
      
      // Try multiple OCR configurations
      const ocrConfigs = [
        { name: 'Numbers Only', params: { tessedit_char_whitelist: '0123456789,.', tessedit_pageseg_mode: '6' } },
        { name: 'With Text', params: { tessedit_char_whitelist: '0123456789,.EestMarkvlueVOo ', tessedit_pageseg_mode: '6' } },
        { name: 'Default', params: { tessedit_pageseg_mode: '11' } }
      ];
      
      for (const config of ocrConfigs) {
        try {
          const worker = await createWorker('eng');
          await worker.setParameters(config.params);
          const { data: { text } } = await worker.recognize(processedBuffer);
          await worker.terminate();
          
          if (text && text.trim().length > 0) {
            console.log(`   📝 ${technique.name} + ${config.name}: "${text.substring(0, 100).replace(/\n/g, ' ')}..."`);
            allExtractedText.push(text);
          }
        } catch (err) {
          console.log(`   ⚠️ ${technique.name} + ${config.name} failed:`, err.message);
        }
      }
    }
    
    console.log(`\n📊 Total OCR attempts: ${allExtractedText.length}`);
    console.log('🔎 Analyzing all extracted text for market value...\n');
    
    // Now analyze all extracted text
    for (let i = 0; i < allExtractedText.length; i++) {
      const text = allExtractedText[i];
      
      // Strategy 1: Look for comma-separated numbers (most reliable for market values)
      const commaNumbers = text.match(/\b[0-9]{1,3}(?:,[0-9]{3})+\b/g);
      if (commaNumbers && commaNumbers.length > 0) {
        // Sort by value and return largest
        const largest = commaNumbers.sort((a, b) => {
          const aVal = parseInt(a.replace(/,/g, ''));
          const bVal = parseInt(b.replace(/,/g, ''));
          return bVal - aVal;
        })[0];
        
        const numericValue = parseInt(largest.replace(/,/g, ''));
        // Market values are typically > 1000
        if (numericValue >= 1000) {
          console.log(`✅ Found comma-separated number (Pass ${i + 1}):`, largest);
          return largest;
        }
      }
      
      // Strategy 2: Look for any 6-7 digit numbers (without commas)
      const largeNumbers = text.match(/\b[0-9]{6,7}\b/g);
      if (largeNumbers && largeNumbers.length > 0) {
        const largest = largeNumbers.sort((a, b) => parseInt(b) - parseInt(a))[0];
        // Add commas for readability
        const formatted = parseInt(largest).toLocaleString('en-US');
        console.log(`✅ Found large number (Pass ${i + 1}):`, formatted);
        return formatted;
      }
    }
    
    // Strategy 3: Look for ANY numbers and return the largest
    console.log('🔎 Fallback: Looking for any numbers...');
    let allNumbers = [];
    for (const text of allExtractedText) {
      const numbers = text.match(/\b[0-9,]+\b/g);
      if (numbers) {
        allNumbers = allNumbers.concat(numbers);
      }
    }
    
    if (allNumbers.length > 0) {
      const sorted = allNumbers
        .map(n => n.replace(/,/g, ''))
        .filter(n => parseInt(n) >= 100) // At least 100
        .sort((a, b) => parseInt(b) - parseInt(a));
      
      if (sorted.length > 0) {
        const largest = parseInt(sorted[0]).toLocaleString('en-US');
        console.log(`⚠️ Fallback found:`, largest);
        return largest;
      }
    }
    
    console.log('❌ No market value found in image');
    console.log('💡 All extracted text:');
    allExtractedText.forEach((text, i) => {
      console.log(`   Pass ${i + 1}: ${text.substring(0, 100).replace(/\n/g, ' ')}`);
    });
    return null;
  } catch (error) {
    console.error('❌ Error during OCR:', error);
    return null;
  }
}

// Listen for messages in the FFROA thread
client.on('messageCreate', async (message) => {
  // Ignore bot messages
  if (message.author.bot) return;

  const prefix = getPrefix();

  // Handle images in regear threads (CTA and FF regear)
  if (regearThreads.has(message.channelId)) {
    // Check if message has attachments (images)
    if (message.attachments.size > 0) {
      for (const attachment of message.attachments.values()) {
        // Check if it's an image
        if (attachment.contentType && attachment.contentType.startsWith('image/')) {
          console.log('📸 Image detected in regear thread:', attachment.url);
          
          // Extract market value from image
          const marketValue = await extractMarketValueFromImage(attachment.url);
          
          if (marketValue) {
            // Post the extracted value in the thread
            await message.reply({
              content: `💰 **Est. Market Value:** ${marketValue}`,
              allowedMentions: { repliedUser: false }
            });
          }
        }
      }
    }
  }

  // Handle content thread messages
  if (contentState.active && message.channelId === contentState.threadId) {
    const content = message.content.toLowerCase().trim();

    // Pattern matching for "x [role]" format
    const rolePatterns = {
      tank: /^x\s+(tank|t)$/i,
      heal: /^x\s+(heal|healer|h)$/i,
      shadowcaller: /^x\s+(shadowcaller|sc|shadow)$/i,
      blazing: /^x\s+(blazing|blaze|b)$/i,
      mp: /^x\s+(mp|mist\s*piercer)$/i,
      mp2: /^x\s+(mp2|mist\s*piercer\s*2)$/i,
      flex: /^x\s+(flex|f|perma|arctic|LC)$/i
    };

    // Check for "x fill" command
    if (/^x\s+fill$/i.test(content)) {
      // Check if user is already in fill
      if (contentState.fill.includes(message.author.id)) {
        await message.react('ℹ️');
        return;
      }

      // Check if user already has a role - remove them from it
      for (const [roleKey, userId] of Object.entries(contentState.roles)) {
        if (userId === message.author.id) {
          contentState.roles[roleKey] = null;
          break;
        }
      }

      // Add to fill list
      contentState.fill.push(message.author.id);

      // Check if we can auto-assign fill players
      await autoAssignFillPlayers();

      try {
        const embed = buildContentEmbed();
        await DiscordRequest(`channels/${contentState.channelId}/messages/${contentState.messageId}`, {
          method: 'PATCH',
          body: {
            embeds: [embed.toJSON()]
          },
        });
        await message.react('🔄');
      } catch (err) {
        console.error('Error updating content message:', err);
        await message.reply('❌ Failed to update the content board.');
      }
      return;
    }

    let assignedRole = null;

    // Check which role the user is claiming
    for (const [roleKey, pattern] of Object.entries(rolePatterns)) {
      if (pattern.test(content)) {
        // Count filled slots
        const filledSlots = Object.values(contentState.roles).filter(v => v !== null).length;
        const fillCount = contentState.fill.length;
        const totalSlots = 7;

        // Check if all slots are taken (not including fill players on standby)
        if (filledSlots >= totalSlots && !contentState.roles[roleKey]) {
          await message.reply(`❌ All slots are full! (${filledSlots}/${totalSlots}) ${fillCount > 0 ? `There are ${fillCount} player(s) in FILL standby.` : ''}`);
          return;
        }

        // Check if role is already taken by someone else
        if (contentState.roles[roleKey] && contentState.roles[roleKey] !== message.author.id) {
          await message.reply(`❌ ${roleKey.toUpperCase()} slot is already taken by <@${contentState.roles[roleKey]}>!`);
          return;
        }

        // If user already has this role, ignore (no change needed)
        if (contentState.roles[roleKey] === message.author.id) {
          await message.react('ℹ️');
          return;
        }

        // Remove user from any other role they currently have
        for (const [existingRoleKey, existingUserId] of Object.entries(contentState.roles)) {
          if (existingUserId === message.author.id) {
            contentState.roles[existingRoleKey] = null;
          }
        }

        // Remove user from fill list if they were in it
        const fillIndex = contentState.fill.indexOf(message.author.id);
        if (fillIndex > -1) {
          contentState.fill.splice(fillIndex, 1);
        }

        // Assign the new role
        contentState.roles[roleKey] = message.author.id;
        assignedRole = roleKey;
        break;
      }
    }

    // If a role was assigned, update the content message and check for auto-assignment
    if (assignedRole) {
      // Check if we need to auto-assign fill players
      await autoAssignFillPlayers();

      try {
        const embed = buildContentEmbed();
        await DiscordRequest(`channels/${contentState.channelId}/messages/${contentState.messageId}`, {
          method: 'PATCH',
          body: {
            embeds: [embed.toJSON()]
          },
        });

        await message.react('✅');
      } catch (err) {
        console.error('Error updating content message:', err);
        await message.reply('❌ Failed to update the content board.');
      }
    }
    return;
  }


  // Handle text commands with prefix
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/\s+/);
  const command = args.shift().toLowerCase();

  console.log(`📝 Text command received: ${prefix}${command}`);

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
      const balance = getBalance(targetUserId);

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

      if (!mentionedUser || !amount || amount <= 0) {
        await message.reply(`❌ Usage: \`${prefix}bank deposit @user <amount>\``);
        return;
      }

      const result = deposit(mentionedUser.id, amount);

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

      const result = withdraw(mentionedUser.id, amount);

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
      const activeUsers = getActiveUsers();

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

      const result = clearUser(mentionedUser.id);

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

      const result = clearAll();

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

    if (setPrefix(newPrefix)) {
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
      const permissions = getPermissions();
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

    const permissions = getPermissions();

    if (subcommand === 'add') {
      if (permissions[configKey].includes(role.id)) {
        await message.reply(`❌ Role ${role} already has ${displayName} permission.`);
        return;
      }
      
      permissions[configKey].push(role.id);
      if (savePermissions(permissions)) {
        await message.reply(`✅ Added ${role} to ${displayName} permissions.`);
      } else {
        await message.reply('❌ Failed to save permissions.');
      }
      return;
    }

    if (subcommand === 'remove') {
      const index = permissions[configKey].indexOf(role.id);
      if (index === -1) {
        await message.reply(`❌ Role ${role} doesn't have ${displayName} permission.`);
        return;
      }
      
      permissions[configKey].splice(index, 1);
      if (savePermissions(permissions)) {
        await message.reply(`✅ Removed ${role} from ${displayName} permissions.`);
      } else {
        await message.reply('❌ Failed to save permissions.');
      }
      return;
    }

    await message.reply(`❌ Invalid subcommand. Use \`add\`, \`remove\`, or \`list\`.`);
    return;
  }

  // !help command
  if (command === 'help' || command === 'commands') {
    const embed = buildHelpEmbed(message.member, false);
    await message.reply({ embeds: [embed] });
    return;
  }
});

// Login to Discord
client.login(process.env.DISCORD_TOKEN);

/**
 * Interactions endpoint URL where Discord will send HTTP requests
 * Parse request body and verifies incoming requests using discord-interactions package
 */
app.post('/interactions', verifyKeyMiddleware(process.env.PUBLIC_KEY), async function (req, res) {
  // Interaction type and data
  const { type, id, data } = req.body;

  // DEBUG: Log all incoming interactions
  console.log('========================================');
  console.log('📥 INTERACTION RECEIVED');
  console.log('Time:', new Date().toISOString());
  console.log('Type:', type);
  console.log('ID:', id);
  console.log('Data:', JSON.stringify(data, null, 2));
  console.log('========================================');

  /**
   * Handle verification requests
   */
  if (type === InteractionType.PING) {
    console.log('✅ PING received, responding with PONG');
    return res.send({ type: InteractionResponseType.PONG });
  }

  /**
   * Handle slash command requests
   * See https://discord.com/developers/docs/interactions/application-commands#slash-commands
   */
  if (type === InteractionType.APPLICATION_COMMAND) {
    const { name } = data;
    console.log(`🔧 Processing slash command: /${name}`);

    // "/utc" command - Display current UTC time (Albion Online in-game time)
    if (name === 'utc') {
      console.log('⏰ Executing /utc command');
      const now = new Date();
      const hours = String(now.getUTCHours()).padStart(2, '0');
      const minutes = String(now.getUTCMinutes()).padStart(2, '0');
      const seconds = String(now.getUTCSeconds()).padStart(2, '0');
      const utcTime = `${hours}:${minutes}:${seconds}`;

      const embed = new EmbedBuilder()
        .setColor(0x5865F2) // Discord blurple color
        .setDescription(`⏰ UTC Time Now: **${utcTime}**`); // inline code block for background effect

      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          embeds: [embed.toJSON()]
        },
      });
    }

    // "/content" command - Manage content callouts
    if (name === 'content') {
      console.log('🎮 Executing /content command');
      const subcommand = data.options[0].name;
      console.log(`   Subcommand: ${subcommand}`);
      const context = req.body.context;
      const userId = context === 0 ? req.body.member.user.id : req.body.user.id;

      // Subcommand: create
      if (subcommand === 'create') {
        console.log('   Creating content thread...');
        if (contentState.active) {
          console.log('   ❌ Content already active');
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: '❌ A content callout is already active! Use `/content reset` to clear it first.',
              flags: 64 // EPHEMERAL
            },
          });
        }

        const contentType = data.options[0].options[0].value;
        const roleOption = data.options[0].options[1].value;
        const threadTitle = data.options[0].options[2].value;
        const zone = data.options[0].options[3].value;
        const tier = data.options[0].options[4].value;
        const time = data.options[0].options[5].value;
        const channelId = req.body.channel_id;

        contentState.active = true;
        contentState.contentType = contentType;
        contentState.zone = zone;
        contentState.tier = tier;
        contentState.time = time;
        contentState.roles[roleOption] = userId;

        const embed = buildContentEmbed();

        // Defer the response to give us time to create the thread
        console.log('   ⏳ Deferring response...');
        res.send({
          type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            flags: 64 // EPHEMERAL
          }
        });

        try {
          // Create a thread in the channel
          console.log('   📝 Creating thread...');
          const threadResponse = await DiscordRequest(`channels/${channelId}/threads`, {
            method: 'POST',
            body: {
              name: threadTitle,
              type: 11, // PUBLIC_THREAD
              auto_archive_duration: 1440 // 24 hours
            },
          });
          const threadData = await threadResponse.json();
          const threadId = threadData.id;
          console.log(`   ✅ Thread created: ${threadId}`);

          // Post the content message in the thread
          console.log('   📤 Posting message in thread...');
          const messageResponse = await DiscordRequest(`channels/${threadId}/messages`, {
            method: 'POST',
            body: {
            content:"<@&1344897722196430879>",
            embeds: [embed.toJSON()]
            },
          });
          const messageData = await messageResponse.json();

          // Store the message and channel info
          contentState.messageId = messageData.id;
          contentState.channelId = threadId;
          contentState.threadId = threadId;
          console.log('   ✅ Content state saved');

          // Follow up with success message
          console.log('   📨 Sending follow-up message...');
          await DiscordRequest(`webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
            method: 'PATCH',
            body: {
              content: `✅ ${contentType.toUpperCase()} content thread created: **${threadTitle}**`,
              flags: 64
            },
          });
          console.log('   ✅ /content create completed successfully');

        } catch (err) {
          console.error('   ❌ Error creating thread:', err);
          contentState.active = false;
          contentState.roles[roleOption] = null;

          // Follow up with error message
          await DiscordRequest(`webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
            method: 'PATCH',
            body: {
              content: '❌ Failed to create content thread.',
              flags: 64
            },
          });
        }
        return;
      }

      // Subcommand: adduser
      if (subcommand === 'adduser') {
        if (!contentState.active) {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: '❌ No active content callout! Use `/content create` first.',
              flags: 64 // EPHEMERAL
            },
          });
        }

        const targetUserId = data.options[0].options[0].value;
        const roleOption = data.options[0].options[1].value;

        if (contentState.roles[roleOption]) {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: `❌ The ${roleOption.toUpperCase()} slot is already filled!`,
              flags: 64 // EPHEMERAL
            },
          });
        }

        contentState.roles[roleOption] = targetUserId;

        // Check if we need to auto-assign fill players after adding user
        await autoAssignFillPlayers();

        const embed = buildContentEmbed();

        // Update the original message
        try {
          await DiscordRequest(`channels/${contentState.channelId}/messages/${contentState.messageId}`, {
            method: 'PATCH',
            body: {
              embeds: [embed.toJSON()]
            },
          });

          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: `✅ <@${targetUserId}> added to **${roleOption.toUpperCase()}**`,
              flags: 64 // EPHEMERAL
            },
          });
        } catch (err) {
          console.error('Error updating message:', err);
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: '❌ Failed to update the content message.',
              flags: 64 // EPHEMERAL
            },
          });
        }
      }

      // Subcommand: removeuser
      if (subcommand === 'removeuser') {
        if (!contentState.active) {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: '❌ No active content callout! Use `/content create` first.',
              flags: 64 // EPHEMERAL
            },
          });
        }

        const roleOption = data.options[0].options[0].value;

        if (!contentState.roles[roleOption]) {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: `❌ The ${roleOption.toUpperCase()} slot is already empty!`,
              flags: 64 // EPHEMERAL
            },
          });
        }

        contentState.roles[roleOption] = null;

        // Check if we need to auto-assign fill players after removing user
        await autoAssignFillPlayers();

        const embed = buildContentEmbed();

        // Update the original message
        try {
          await DiscordRequest(`channels/${contentState.channelId}/messages/${contentState.messageId}`, {
            method: 'PATCH',
            body: {
              embeds: [embed.toJSON()]
            },
          });

          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: `✅ Removed user from **${roleOption.toUpperCase()}**`,
              flags: 64 // EPHEMERAL
            },
          });
        } catch (err) {
          console.error('Error updating message:', err);
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: '❌ Failed to update the content message.',
              flags: 64 // EPHEMERAL
            },
          });
        }
      }

      // Subcommand: reset
      if (subcommand === 'reset') {
        contentState.active = false;
        contentState.messageId = null;
        contentState.channelId = null;
        contentState.threadId = null;
        contentState.contentType = 'ff';
        contentState.zone = 'Brecilien';
        contentState.tier = 7;
        contentState.time = '';
        contentState.roles = {
          tank: null,
          heal: null,
          shadowcaller: null,
          blazing: null,
          mp: null,
          mp2: null,
          flex: null
        };
        contentState.fill = [];

        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: '✅ Content callout has been reset! You can now create a new one with `/content create`.',
            flags: 64 // EPHEMERAL
          },
        });
      }
    }

    // "/regear" command - Create regear thread (unified CTA/FF)
    if (name === 'regear') {
      console.log('⚔️ Executing /regear command');

      // Check permission for CTA regear
      const contentType = data.options[0].value;
      const member = req.body.member;
      if (contentType === 'cta' && !hasPermissionSlash(member, 'ctaRegearRoles')) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: '❌ You need Administrator permission or an authorized role to use this command for CTA regear.',
            flags: 64 // EPHEMERAL
          },
        });
      }

      const threadTitle = data.options[1].value;
      const time = data.options[2].value;
      const channelId = req.body.channel_id;

      // Defer the response
      console.log('   ⏳ Deferring response...');
      res.send({
        type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          flags: 64 // EPHEMERAL
        }
      });

      try {
        // Create a thread in the channel
        console.log(`   📝 Creating ${contentType.toUpperCase()} regear thread...`);
        const threadResponse = await DiscordRequest(`channels/${channelId}/threads`, {
          method: 'POST',
          body: {
            name: threadTitle,
            type: 11, // PUBLIC_THREAD
            auto_archive_duration: 1440 // 24 hours
          },
        });
        const threadData = await threadResponse.json();
        const threadId = threadData.id;
        console.log(`   ✅ Thread created: ${threadId}`);

        // Add thread to regear threads tracking (for OCR)
        regearThreads.add(threadId);
        console.log(`   📋 Added thread ${threadId} to regear tracking`);

        // Create embed based on content type
        const embedColor = contentType === 'cta' ? 0xe74c3c : 0x5865F2;
        const embedTitle = contentType === 'cta' ? '⚔️ CTA REGEAR' : '🛡️ FF REGEAR';
        const embedDescription = contentType === 'cta'
          ? `**SEND REGEAR HERE**\n**INCLUDE OC BREAK**\n**Time:** ${time}`
          : `**SEND FF REGEAR HERE**\n**Time:** ${time}`;

        const embed = new EmbedBuilder()
          .setColor(embedColor)
          .setTitle(embedTitle)
          .setDescription(embedDescription);

        // Post the message in the thread
        await DiscordRequest(`channels/${threadId}/messages`, {
          method: 'POST',
          body: {
            content:"<@&1344897722196430879>",
            embeds: [embed.toJSON()]
          },
        });

        // Follow up with success message
        await DiscordRequest(`webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
          method: 'PATCH',
          body: {
            content: `✅ ${contentType.toUpperCase()} regear thread created: **${threadTitle}**`,
            flags: 64
          },
        });
        console.log(`   ✅ /regear ${contentType} completed successfully`);

      } catch (err) {
        console.error(`   ❌ Error creating ${contentType} regear thread:`, err);

        // Follow up with error message
        await DiscordRequest(`webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
          method: 'PATCH',
          body: {
            content: `❌ Failed to create ${contentType.toUpperCase()} regear thread.`,
            flags: 64
          },
        });
      }
      return;
    }

    // "/bank" command - Bank economy system
    if (name === 'bank') {
      console.log('💰 Executing /bank command');
      const subcommand = data.options[0].name;
      console.log(`   Subcommand: ${subcommand}`);
      const context = req.body.context;
      const userId = context === 0 ? req.body.member.user.id : req.body.user.id;
      const member = req.body.member;

      // Check admin permission for deposit/withdraw
      const hasAdminPermission = hasPermissionSlash(member, 'bankAdminRoles');

      // Subcommand: deposit
      if (subcommand === 'deposit') {
        if (!hasAdminPermission) {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: '❌ You need Administrator permission or an authorized role to use this command.',
              flags: 64 // EPHEMERAL
            },
          });
        }

        const targetUserId = data.options[0].options[0].value;
        const amount = data.options[0].options[1].value;

        const result = deposit(targetUserId, amount);

        if (!result.success) {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: `❌ ${result.error}`,
              flags: 64 // EPHEMERAL
            },
          });
        }

        const embed = new EmbedBuilder()
          .setColor(0x2ecc71) // Green
          .setTitle('💰 Deposit Successful')
          .setDescription(
            `**User:** <@${targetUserId}>\n` +
            `**Deposited:** ${CURRENCY}${amount.toLocaleString()}\n` +
            `**New Balance:** ${CURRENCY}${result.newBalance.toLocaleString()}`
          )
          .setTimestamp();

        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            embeds: [embed.toJSON()]
          },
        });
      }

      // Subcommand: withdraw
      if (subcommand === 'withdraw') {
        if (!hasAdminPermission) {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: '❌ You need Administrator permission or an authorized role to use this command.',
              flags: 64 // EPHEMERAL
            },
          });
        }

        const targetUserId = data.options[0].options[0].value;
        const amount = data.options[0].options[1].value;

        const result = withdraw(targetUserId, amount);

        if (!result.success) {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: `❌ ${result.error}`,
              flags: 64 // EPHEMERAL
            },
          });
        }

        const embed = new EmbedBuilder()
          .setColor(0xe74c3c) // Red
          .setTitle('💸 Withdrawal Successful')
          .setDescription(
            `**User:** <@${targetUserId}>\n` +
            `**Withdrawn:** ${CURRENCY}${amount.toLocaleString()}\n` +
            `**New Balance:** ${CURRENCY}${result.newBalance.toLocaleString()}`
          )
          .setTimestamp();

        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            embeds: [embed.toJSON()]
          },
        });
      }

      // Subcommand: balance
      if (subcommand === 'balance') {
        const targetUserId = data.options[0].options?.[0]?.value || userId;
        const balance = getBalance(targetUserId);

        const embed = new EmbedBuilder()
          .setColor(0x5865F2) // Discord blurple
          .setTitle('💰 Bank Balance')
          .setDescription(
            `**User:** <@${targetUserId}>\n` +
            `**Balance:** ${CURRENCY}${balance.toLocaleString()}`
          )
          .setTimestamp();

        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            embeds: [embed.toJSON()]
          },
        });
      }

      // Subcommand: active
      if (subcommand === 'active') {
        const activeUsers = getActiveUsers();

        if (activeUsers.length === 0) {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: '📊 No users currently have money in the bank.',
            },
          });
        }

        const userList = activeUsers
          .map(([uid, bal]) => `<@${uid}> — ${CURRENCY}${bal.toLocaleString()}`)
          .join('\n');

        const embed = new EmbedBuilder()
          .setColor(0xf39c12) // Orange
          .setTitle('📊 Active Bank Users')
          .setDescription(userList)
          .setFooter({ text: `Total users: ${activeUsers.length}` })
          .setTimestamp();

        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            embeds: [embed.toJSON()]
          },
        });
      }

      // Subcommand: clear
      if (subcommand === 'clear') {
        if (!hasAdminPermission) {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: '❌ You need Administrator permission or an authorized role to use this command.',
              flags: 64 // EPHEMERAL
            },
          });
        }

        const targetUserId = data.options[0].options[0].value;
        const result = clearUser(targetUserId);

        if (!result.success) {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: `❌ ${result.error}`,
              flags: 64 // EPHEMERAL
            },
          });
        }

        const embed = new EmbedBuilder()
          .setColor(0xe67e22) // Orange
          .setTitle('🗑️ Balance Cleared')
          .setDescription(
            `**User:** <@${targetUserId}>\n` +
            `**Cleared Amount:** ${CURRENCY}${result.clearedAmount.toLocaleString()}\n` +
            `**New Balance:** ${CURRENCY}0`
          )
          .setTimestamp();

        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            embeds: [embed.toJSON()]
          },
        });
      }

      // Subcommand: clearall
      if (subcommand === 'clearall') {
        if (!hasAdminPermission) {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: '❌ You need Administrator permission or an authorized role to use this command.',
              flags: 64 // EPHEMERAL
            },
          });
        }

        const result = clearAll();

        if (!result.success) {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: `❌ ${result.error}`,
              flags: 64 // EPHEMERAL
            },
          });
        }

        const embed = new EmbedBuilder()
          .setColor(0xc0392b) // Dark Red
          .setTitle('🗑️ All Balances Cleared')
          .setDescription(
            `**Cleared Users:** ${result.clearedUsers}\n` +
            `**All balances have been reset to ${CURRENCY}0**`
          )
          .setTimestamp();

        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            embeds: [embed.toJSON()]
          },
        });
      }
    }

    // "/help" command - Show available commands
    if (name === 'help') {
      console.log('❓ Executing /help command');
      const member = req.body.member;
      const embed = buildHelpEmbed(member, true);

      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          embeds: [embed.toJSON()],
          flags: 64 // EPHEMERAL
        },
      });
    }

    // "/perms" command - Manage role permissions (Admin only)
    if (name === 'perms') {
      console.log('🔐 Executing /perms command');
      const member = req.body.member;
      const subcommand = data.options[0].name;
      
      // Check if user is Discord Administrator
      const isAdmin = member && member.permissions && 
        (BigInt(member.permissions) & BigInt(PermissionFlagsBits.Administrator)) === BigInt(PermissionFlagsBits.Administrator);
      
      if (!isAdmin) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: '❌ You need Administrator permission to manage permissions.',
            flags: 64 // EPHEMERAL
          },
        });
      }

      // Subcommand: list
      if (subcommand === 'list') {
        const permissions = getPermissions();
        const bankRoles = permissions.bankAdminRoles.map(id => `<@&${id}>`).join('\n') || '*None*';
        const ctaRoles = permissions.ctaRegearRoles.map(id => `<@&${id}>`).join('\n') || '*None*';
        
        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle('🔐 Current Role Permissions')
          .addFields(
            { name: '💰 Bank Admin Roles', value: bankRoles, inline: false },
            { name: '⚔️ CTA Regear Roles', value: ctaRoles, inline: false }
          )
          .setFooter({ text: 'Administrators always have access to all commands' })
          .setTimestamp();
        
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            embeds: [embed.toJSON()],
            flags: 64 // EPHEMERAL
          },
        });
      }

      // Subcommand: add
      if (subcommand === 'add') {
        const permType = data.options[0].options[0].value; // 'bank' or 'cta'
        const roleId = data.options[0].options[1].value;
        
        let configKey;
        let displayName;
        if (permType === 'bank') {
          configKey = 'bankAdminRoles';
          displayName = 'Bank Admin';
        } else if (permType === 'cta') {
          configKey = 'ctaRegearRoles';
          displayName = 'CTA Regear';
        } else {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: '❌ Invalid permission type.',
              flags: 64
            },
          });
        }

        const permissions = getPermissions();

        if (permissions[configKey].includes(roleId)) {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: `❌ Role <@&${roleId}> already has ${displayName} permission.`,
              flags: 64
            },
          });
        }
        
        permissions[configKey].push(roleId);
        if (savePermissions(permissions)) {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: `✅ Added <@&${roleId}> to ${displayName} permissions.\n\n**Storage location:** \`${PERMISSIONS_FILE}\``,
              flags: 64
            },
          });
        } else {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: `❌ Failed to save permissions. Check console for errors.\n**Attempted path:** \`${PERMISSIONS_FILE}\``,
              flags: 64
            },
          });
        }
      }

      // Subcommand: remove
      if (subcommand === 'remove') {
        const permType = data.options[0].options[0].value; // 'bank' or 'cta'
        const roleId = data.options[0].options[1].value;
        
        let configKey;
        let displayName;
        if (permType === 'bank') {
          configKey = 'bankAdminRoles';
          displayName = 'Bank Admin';
        } else if (permType === 'cta') {
          configKey = 'ctaRegearRoles';
          displayName = 'CTA Regear';
        } else {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: '❌ Invalid permission type.',
              flags: 64
            },
          });
        }

        const permissions = getPermissions();
        const index = permissions[configKey].indexOf(roleId);
        
        if (index === -1) {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: `❌ Role <@&${roleId}> doesn't have ${displayName} permission.`,
              flags: 64
            },
          });
        }
        
        permissions[configKey].splice(index, 1);
        if (savePermissions(permissions)) {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: `✅ Removed <@&${roleId}> from ${displayName} permissions.\n\n**Storage location:** \`${PERMISSIONS_FILE}\``,
              flags: 64
            },
          });
        } else {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: `❌ Failed to save permissions. Check console for errors.\n**Attempted path:** \`${PERMISSIONS_FILE}\``,
              flags: 64
            },
          });
        }
      }
    }

    console.error(`❌ Unknown command: ${name}`);
    return res.status(400).json({ error: 'unknown command' });
  }

  /**
   * Handle button and component interactions
   */
  if (type === InteractionType.MESSAGE_COMPONENT) {
    const componentId = data.custom_id;
    console.log(`🔘 Processing button interaction: ${componentId}`);

    // Handle FFROA button clicks (if you have any other button interactions)
    // Add other button handlers here if needed

    console.error(`❌ Unknown component ID: ${componentId}`);
    return res.status(400).json({ error: 'unknown component' });
  }

  console.error('❌ Unknown interaction type:', type);
  return res.status(400).json({ error: 'unknown interaction type' });
});

app.listen(PORT, () => {
  console.log('Listening on port ', PORT, ' ✅');
});
