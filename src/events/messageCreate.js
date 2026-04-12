import { loadPrefix } from '../database/guildData.js';
import { contentState } from '../config/contentState.js';
import { buildContentEmbed, autoAssignFillPlayers } from '../services/contentService.js';
import { DiscordRequest } from '../../utils.js';
import { handleTicketMessage } from '../systems/ticket/ticket-system.js';
import { handlePrefixCommands } from '../commands/prefixCommands.js';

export async function handleMessageCreate(message, client) {
  // Ignore bot messages
  if (message.author.bot) return;

  const prefix = loadPrefix(message.guild.id).prefix;

  // Handle content thread messages
  if (contentState.active && message.channelId === contentState.threadId) {
    const content = message.content.toLowerCase().trim();
    const contentType = contentState.contentType;

    // Check for "x cancel" command
    if (/^x\s+cancel$/i.test(content)) {
      let foundRole = false;

      // For ROA/GCAMPS/ROAPVP/RCK/RCB/Tracking/Avadungeon (fixed slots)
      if (contentType === 'roa' || contentType === 'roapvp' || contentType === 'gcamps' || contentType === 'tracking' || contentType === 'avadungeon' || contentType === 'rck' || contentType === 'rcb') {
        for (const [roleKey, userId] of Object.entries(contentState.roles)) {
          if (userId === message.author.id) {
            contentState.roles[roleKey] = null;
            foundRole = true;
            break;
          }
        }

        // Also check if user is in fill list (not applicable to tracking, but won't hurt)
        const fillIndex = contentState.fill.indexOf(message.author.id);
        if (fillIndex > -1) {
          contentState.fill.splice(fillIndex, 1);
          foundRole = true;
        }
      }

      // For CTA/FF (categories)
      if (contentType === 'cta' || contentType === 'ff') {
        for (const [categoryKey, userList] of Object.entries(contentState.categories)) {
          const userIndex = userList.indexOf(message.author.id);
          if (userIndex > -1) {
            userList.splice(userIndex, 1);
            foundRole = true;
            break;
          }
        }
      }

      if (!foundRole) {
        await message.react('ℹ️');
        return;
      }

      // Update the content message
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
      return;
    }
    
    // Check for "x fill" command (ROA/GCAMPS/AVADUNGEON only)
    if (/^x\s+fill$/i.test(content)) {
      // Only for fixed-slot types with fill
      if (contentType !== 'roa' && contentType !== 'roapvp' && contentType !== 'gcamps' && contentType !== 'avadungeon' && contentType !== 'rck' && contentType !== 'rcb') {
        await message.reply('❌ Fill is only available for ROA PVE, ROA PVE/P, Group Camps, Ava Dungeon, RCK, and RCB.');
        return;
      }

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
      await autoAssignFillPlayers(client);

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

    // === ROA/GCAMPS - Fixed slot assignment ===
    if (contentType === 'roa' || contentType === 'gcamps') {
      const rolePatterns = {
        tank: /^x\s+(tank|t)$/i,
        heal: /^x\s+(heal|healer|h)$/i,
        mp: /^x\s+(mp|mist|piercer)$/i,
        mp2: /^x\s+(mp2|mist2|piercer2)$/i,
        shadowcaller: /^x\s+(shadowcaller|sc|shadow)$/i,
        blazing: /^x\s+(blazing|blaze|b)$/i,
        flex: /^x\s+(flex|perma|lc|arctic)$/i,
        badon: /^x\s+(badon)$/i
      };

      let assignedRole = null;

      for (const [roleKey, pattern] of Object.entries(rolePatterns)) {
        if (pattern.test(content)) {
          // Check if role is already taken by someone else
          if (contentState.roles[roleKey] && contentState.roles[roleKey] !== message.author.id) {
            await message.reply(`❌ ${roleKey.toUpperCase()} slot is already taken by <@${contentState.roles[roleKey]}>!`);
            return;
          }

          // If user already has this role, ignore
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

      if (assignedRole) {
        await autoAssignFillPlayers(client);

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

    // === ROA PVE/P - Fixed slot assignment ===
    if (contentType === 'roapvp') {
      const rolePatterns = {
        tank: /^x\s+(tank|t)$/i,
        heal: /^x\s+(heal|healer|h)$/i,
        blaze: /^x\s+(blaze|blazing|dawnsong|b)$/i,
        sc: /^x\s+(sc|dtank|shadowcaller|shadow)$/i,
        perma: /^x\s+(perma|p)$/i,
        lc: /^x\s+(lc|lightcaller|light)$/i,
        mp: /^x\s+(mp|mist|piercer)$/i
      };

      let assignedRole = null;

      for (const [roleKey, pattern] of Object.entries(rolePatterns)) {
        if (pattern.test(content)) {
          if (contentState.roles[roleKey] && contentState.roles[roleKey] !== message.author.id) {
            await message.reply(`❌ ${roleKey.toUpperCase()} slot is already taken by <@${contentState.roles[roleKey]}>!`);
            return;
          }
          if (contentState.roles[roleKey] === message.author.id) {
            await message.react('ℹ️');
            return;
          }
          for (const [existingRoleKey, existingUserId] of Object.entries(contentState.roles)) {
            if (existingUserId === message.author.id) contentState.roles[existingRoleKey] = null;
          }
          const fillIndex = contentState.fill.indexOf(message.author.id);
          if (fillIndex > -1) contentState.fill.splice(fillIndex, 1);
          contentState.roles[roleKey] = message.author.id;
          assignedRole = roleKey;
          break;
        }
      }

      if (assignedRole) {
        await autoAssignFillPlayers(client);
        try {
          const embed = buildContentEmbed();
          await DiscordRequest(`channels/${contentState.channelId}/messages/${contentState.messageId}`, {
            method: 'PATCH',
            body: { embeds: [embed.toJSON()] },
          });
          await message.react('✅');
        } catch (err) {
          console.error('Error updating content message:', err);
          await message.reply('❌ Failed to update the content board.');
        }
      }
      return;
    }

    // === RCK - AVA ROAM CLAP KITE - Fixed slot assignment ===
    if (contentType === 'rck') {
      const rolePatterns = {
        tank: /^x\s+(tank|t)$/i,
        heal: /^x\s+(heal|healer|h)$/i,
        longbow: /^x\s+(longbow|lb)$/i,
        realmbreaker: /^x\s+(realmbreaker|rb|realm)$/i,
        kingmaker: /^x\s+(kingmaker|km|king)$/i,
        heron: /^x\s+(heron|hr)$/i,
        bloodletter: /^x\s+(bloodletter|bl|blood)$/i
      };

      let assignedRole = null;

      for (const [roleKey, pattern] of Object.entries(rolePatterns)) {
        if (pattern.test(content)) {
          if (contentState.roles[roleKey] && contentState.roles[roleKey] !== message.author.id) {
            await message.reply(`❌ ${roleKey.toUpperCase()} slot is already taken by <@${contentState.roles[roleKey]}>!`);
            return;
          }
          if (contentState.roles[roleKey] === message.author.id) {
            await message.react('ℹ️');
            return;
          }
          for (const [existingRoleKey, existingUserId] of Object.entries(contentState.roles)) {
            if (existingUserId === message.author.id) contentState.roles[existingRoleKey] = null;
          }
          const fillIndex = contentState.fill.indexOf(message.author.id);
          if (fillIndex > -1) contentState.fill.splice(fillIndex, 1);
          contentState.roles[roleKey] = message.author.id;
          assignedRole = roleKey;
          break;
        }
      }

      if (assignedRole) {
        await autoAssignFillPlayers(client);
        try {
          const embed = buildContentEmbed();
          await DiscordRequest(`channels/${contentState.channelId}/messages/${contentState.messageId}`, {
            method: 'PATCH',
            body: { embeds: [embed.toJSON()] },
          });
          await message.react('✅');
        } catch (err) {
          console.error('Error updating content message:', err);
          await message.reply('❌ Failed to update the content board.');
        }
      }
      return;
    }

    // === RCB - AVA ROAM CLAP BRAWL - Fixed slot assignment ===
    if (contentType === 'rcb') {
      const rolePatterns = {
        tank: /^x\s+(tank|t)$/i,
        heal: /^x\s+(heal|healer|h)$/i,
        realmcarving: /^x\s+(realmcarving|realmbreaker|carving|rc|rb)$/i,
        longbow: /^x\s+(longbow|lb)$/i,
        brawl1: /^x\s+(brawl1|brawl|bw1|bw)$/i,
        brawl2: /^x\s+(brawl2|bw2)$/i,
        brawl3: /^x\s+(brawl3|bw3)$/i
      };

      let assignedRole = null;

      for (const [roleKey, pattern] of Object.entries(rolePatterns)) {
        if (pattern.test(content)) {
          if (contentState.roles[roleKey] && contentState.roles[roleKey] !== message.author.id) {
            await message.reply(`❌ ${roleKey.toUpperCase()} slot is already taken by <@${contentState.roles[roleKey]}>!`);
            return;
          }
          if (contentState.roles[roleKey] === message.author.id) {
            await message.react('ℹ️');
            return;
          }
          for (const [existingRoleKey, existingUserId] of Object.entries(contentState.roles)) {
            if (existingUserId === message.author.id) contentState.roles[existingRoleKey] = null;
          }
          const fillIndex = contentState.fill.indexOf(message.author.id);
          if (fillIndex > -1) contentState.fill.splice(fillIndex, 1);
          contentState.roles[roleKey] = message.author.id;
          assignedRole = roleKey;
          break;
        }
      }

      if (assignedRole) {
        await autoAssignFillPlayers(client);
        try {
          const embed = buildContentEmbed();
          await DiscordRequest(`channels/${contentState.channelId}/messages/${contentState.messageId}`, {
            method: 'PATCH',
            body: { embeds: [embed.toJSON()] },
          });
          await message.react('✅');
        } catch (err) {
          console.error('Error updating content message:', err);
          await message.reply('❌ Failed to update the content board.');
        }
      }
      return;
    }

    // === Tracking - Fixed slot assignment (similar to ROA but no fill) ===
    if (contentType === 'tracking') {
      const rolePatterns = {
        tank: /^x\s+(tank|t)$/i,
        heal: /^x\s+(heal|healer|h)$/i,
        dpair: /^x\s+(dpair|dp)$/i,
        hpcut: /^x\s+(hpcut|hp|rb|force|forcepulse)$/i,
        flexdps: /^x\s+(flexdps|flex|fd|whispering|curse)$/i
      };

      let assignedRole = null;

      for (const [roleKey, pattern] of Object.entries(rolePatterns)) {
        if (pattern.test(content)) {
          // Check if role is already taken by someone else
          if (contentState.roles[roleKey] && contentState.roles[roleKey] !== message.author.id) {
            await message.reply(`❌ ${roleKey.toUpperCase()} slot is already taken by <@${contentState.roles[roleKey]}>!`);
            return;
          }

          // If user already has this role, ignore
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

          // Assign the new role
          contentState.roles[roleKey] = message.author.id;
          assignedRole = roleKey;
          break;
        }
      }

      if (assignedRole) {
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

    // === AVADUNGEON - Fixed slot assignment ===
    if (contentType === 'avadungeon') {
      const rolePatterns = {
        tank: /^x\s+(tank|t)$/i,
        offtank: /^x\s+(offtank|ot|off-tank)$/i,
        stun: /^x\s+(stun|s)$/i,
        mainhealer: /^x\s+(mainhealer|mh|main|mainheal)$/i,
        partyhealer: /^x\s+(partyhealer|ph|party|partyheal)$/i,
        shadowcaller: /^x\s+(shadowcaller|sc|shadow)$/i,
        dps1: /^x\s+(dps1|dps)$/i,
        dps2: /^x\s+(dps2)$/i,
        dps3: /^x\s+(dps3)$/i,
        dps4: /^x\s+(dps4)$/i
      };

      let assignedRole = null;

      for (const [roleKey, pattern] of Object.entries(rolePatterns)) {
        if (pattern.test(content)) {
          // Check if role is already taken by someone else
          if (contentState.roles[roleKey] && contentState.roles[roleKey] !== message.author.id) {
            await message.reply(`❌ ${roleKey.toUpperCase()} slot is already taken by <@${contentState.roles[roleKey]}>!`);
            return;
          }

          // If user already has this role, ignore
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

      if (assignedRole) {
        await autoAssignFillPlayers(client);

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

    // === CTA - Category-based assignment ===
    if (contentType === 'cta') {
      const categoryPatterns = {
        tank: /^x\s+(tank|t)$/i,
        heal: /^x\s+(heal|healer|h)$/i,
        dps: /^x\s+(dps|d)$/i,
        support: /^x\s+(support|sup|s)$/i,
        dtank: /^x\s+(dtank|dt|dive)$/i
      };

      let assignedCategory = null;

      for (const [categoryKey, pattern] of Object.entries(categoryPatterns)) {
        if (pattern.test(content)) {
          // Check if user is already in this category
          if (contentState.categories[categoryKey].includes(message.author.id)) {
            await message.react('ℹ️');
            return;
          }

          // Remove user from any other category
          for (const [existingCategoryKey, userList] of Object.entries(contentState.categories)) {
            const userIndex = userList.indexOf(message.author.id);
            if (userIndex > -1) {
              userList.splice(userIndex, 1);
            }
          }

          // Add user to new category
          contentState.categories[categoryKey].push(message.author.id);
          assignedCategory = categoryKey;
          break;
        }
      }

      if (assignedCategory) {
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

    // === FF - Category-based assignment (3 categories) ===
    if (contentType === 'ff') {
      const categoryPatterns = {
        tank: /^x\s+(tank|t)$/i,
        heal: /^x\s+(heal|healer|h)$/i,
        dps: /^x\s+(dps|d)$/i
      };

      let assignedCategory = null;

      for (const [categoryKey, pattern] of Object.entries(categoryPatterns)) {
        if (pattern.test(content)) {
          // Check if user is already in this category
          if (contentState.categories[categoryKey].includes(message.author.id)) {
            await message.react('ℹ️');
            return;
          }

          // Remove user from any other category
          for (const [existingCategoryKey, userList] of Object.entries(contentState.categories)) {
            const userIndex = userList.indexOf(message.author.id);
            if (userIndex > -1) {
              userList.splice(userIndex, 1);
            }
          }

          // Add user to new category
          contentState.categories[categoryKey].push(message.author.id);
          assignedCategory = categoryKey;
          break;
        }
      }

      if (assignedCategory) {
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

    return;
  }


  // Handle text commands with prefix
  if (!message.content.startsWith(prefix)) {
    // Log ticket messages even if not a command
    await handleTicketMessage(message);
    return;
  }

  const args = message.content.slice(prefix.length).trim().split(/\s+/);
  const command = args.shift().toLowerCase();

  console.log(`📝 Text command received: ${prefix}${command}`);

  // Handle prefix commands
  await handlePrefixCommands(message, command, args, prefix);
}
