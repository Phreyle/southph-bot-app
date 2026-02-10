import { EmbedBuilder } from 'discord.js';
import { CUSTOM_EMOJIS } from '../config/constants.js';
import { contentState } from '../config/contentState.js';

// Helper function to build the content embed
export const buildContentEmbed = () => {
  const contentType = contentState.contentType;
  const contentEmoji = {
    'roa': '🏰',
    'cta': '⚔️',
    'gcamps': '🏕️',
    'ff': '🛡️',
    'tracking': '🎯',
    'avadungeon': '⚔️'
  }[contentType] || '🎮';

  // ROA - Fixed 7 slots
  if (contentType === 'roa') {
    const roleLines = [
      `**1. ${CUSTOM_EMOJIS.OFFTANK} TANK (tank)**   ${contentState.roles.tank ? '➡️ <@' + contentState.roles.tank + '>' : ''}`,
      `**2. ${CUSTOM_EMOJIS.HEALER} HEALER (heal)**   ${contentState.roles.heal ? '➡️ <@' + contentState.roles.heal + '>' : ''}`,
      `**3. ${CUSTOM_EMOJIS.DPS} MIST PIERCER (mp)**   ${contentState.roles.mp ? '➡️ <@' + contentState.roles.mp + '>' : ''}`,
      `**4. ${CUSTOM_EMOJIS.DPS} MIST PIERCER (mp2)**   ${contentState.roles.mp2 ? '➡️ <@' + contentState.roles.mp2 + '>' : ''}`,
      `**5. ${CUSTOM_EMOJIS.DEBUFF} SHADOWCALLER (shadowcaller)**   ${contentState.roles.shadowcaller ? '➡️ <@' + contentState.roles.shadowcaller + '>' : ''}`,
      `**6. ${CUSTOM_EMOJIS.DPS} BLAZING (blazing)**   ${contentState.roles.blazing ? '➡️ <@' + contentState.roles.blazing + '>' : ''}`,
      `**7. ${CUSTOM_EMOJIS.DPS} FLEX (MP/LC/ARCTIC/PERMA) (flex)**   ${contentState.roles.flex ? '➡️ <@' + contentState.roles.flex + '>' : ''}`
    ];

    const roaRoles = ['tank', 'heal', 'mp', 'mp2', 'shadowcaller', 'blazing', 'flex'];
    const filledSlots = roaRoles.filter(key => contentState.roles[key] !== null).length;
    const fillCount = contentState.fill.length;
    const minSlotsBeforeFill = 6;
    const fillStatus = filledSlots >= minSlotsBeforeFill ? 'FILLING' : 'STANDBY';

    let fillSection = '';
    if (fillCount > 0) {
      const fillStatusEmoji = fillStatus === 'STANDBY' ? '⏸️' : '🔄';
      fillSection = `\n\n**${fillStatusEmoji} FILL - ${fillStatus} (${fillCount}):** ${contentState.fill.map(id => `<@${id}>`).join(', ')}`;
      if (fillStatus === 'STANDBY') {
        fillSection += `\n*Will auto-fill when ${minSlotsBeforeFill}+ slots are taken*`;
      }
    }

    let statusLine = `**Status:** ${filledSlots}/7`;
    if (fillCount > 0 && fillStatus === 'STANDBY') {
      statusLine += ` (${fillCount} in FILL standby)`;
    }

    return new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`${contentEmoji} ROA Role Call`)
      .setDescription(
        `**__X UP ROLE!__**\n` +
        `**Zone:** ${contentState.zone}\n**Gear:** T${contentState.tier} Sets\n**Time:** ${contentState.time}\n` +
        `${contentState.demassNotice ? `**Demass:** ${contentState.demassNotice}\n` : ''}` +
        `${statusLine}\n\n` +
        roleLines.join('\n') +
        fillSection
      );
  }

  // GCAMPS - Fixed 5 slots
  if (contentType === 'gcamps') {
    const roleLines = [
      `**1. ${CUSTOM_EMOJIS.OFFTANK} TANK (tank)**   ${contentState.roles.tank ? '➡️ <@' + contentState.roles.tank + '>' : ''}`,
      `**2. ${CUSTOM_EMOJIS.HEALER} HEALER (heal)**   ${contentState.roles.heal ? '➡️ <@' + contentState.roles.heal + '>' : ''}`,
      `**3. ${CUSTOM_EMOJIS.DEBUFF} SHADOWCALLER (shadowcaller)**   ${contentState.roles.shadowcaller ? '➡️ <@' + contentState.roles.shadowcaller + '>' : ''}`,
      `**4. ${CUSTOM_EMOJIS.DPS} BLAZING (blazing)**   ${contentState.roles.blazing ? '➡️ <@' + contentState.roles.blazing + '>' : ''}`,
      `**5. ${CUSTOM_EMOJIS.DPS} BADON (badon)**   ${contentState.roles.badon ? '➡️ <@' + contentState.roles.badon + '>' : ''}`
    ];

    const gcampsRoles = ['tank', 'heal', 'shadowcaller', 'blazing', 'badon'];
    const filledSlots = gcampsRoles.filter(key => contentState.roles[key] !== null).length;
    const fillCount = contentState.fill.length;
    const minSlotsBeforeFill = 4;
    const fillStatus = filledSlots >= minSlotsBeforeFill ? 'FILLING' : 'STANDBY';

    let fillSection = '';
    if (fillCount > 0) {
      const fillStatusEmoji = fillStatus === 'STANDBY' ? '⏸️' : '🔄';
      fillSection = `\n\n**${fillStatusEmoji} FILL - ${fillStatus} (${fillCount}):** ${contentState.fill.map(id => `<@${id}>`).join(', ')}`;
      if (fillStatus === 'STANDBY') {
        fillSection += `\n*Will auto-fill when ${minSlotsBeforeFill}+ slots are taken*`;
      }
    }

    let statusLine = `**Status:** ${filledSlots}/5`;
    if (fillCount > 0 && fillStatus === 'STANDBY') {
      statusLine += ` (${fillCount} in FILL standby)`;
    }

    return new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`${contentEmoji} GCAMPS Role Call`)
      .setDescription(
        `**__X UP ROLE!__**\n` +
        `**Zone:** ${contentState.zone}\n**Gear:** T${contentState.tier} Sets\n**Time:** ${contentState.time}\n` +
        `${contentState.demassNotice ? `**Demass:** ${contentState.demassNotice}\n` : ''}` +
        `${statusLine}\n\n` +
        roleLines.join('\n') +
        fillSection
      );
  }

  // Tracking - Fixed 5 slots (no fill mechanism)
  if (contentType === 'tracking') {
    const roleLines = [
      `**1. ${CUSTOM_EMOJIS.OFFTANK} TANK (tank)**   ${contentState.roles.tank ? '➡️ <@' + contentState.roles.tank + '>' : ''}`,
      `**2. ${CUSTOM_EMOJIS.HEALER} HEAL (heal)**   ${contentState.roles.heal ? '➡️ <@' + contentState.roles.heal + '>' : ''}`,
      `**3. ${CUSTOM_EMOJIS.DPS} DPAIR (dpair)**   ${contentState.roles.dpair ? '➡️ <@' + contentState.roles.dpair + '>' : ''}`,
      `**4. ${CUSTOM_EMOJIS.DPS} HP CUT(RB/FORCEPULSE) (hpcut)**   ${contentState.roles.hpcut ? '➡️ <@' + contentState.roles.hpcut + '>' : ''}`,
      `**5. ${CUSTOM_EMOJIS.DPS} FLEX DPS(DPAIR/WHISPERING/1H CURSE) (flexdps)**   ${contentState.roles.flexdps ? '➡️ <@' + contentState.roles.flexdps + '>' : ''}`
    ];

    const trackingRoles = ['tank', 'heal', 'dpair', 'hpcut', 'flexdps'];
    const filledSlots = trackingRoles.filter(key => contentState.roles[key] !== null).length;

    let statusLine = `**Status:** ${filledSlots}/5`;

    return new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`🎯 Tracking Role Call`)
      .setDescription(
        `**__X UP ROLE!__**\n` +
        `**Zone:** ${contentState.zone}\n**Gear:** T${contentState.tier} Sets\n**Time:** ${contentState.time}\n` +
        `${contentState.demassNotice ? `**Demass:** ${contentState.demassNotice}\n` : ''}` +
        `${statusLine}\n\n` +
        roleLines.join('\n')
      );
  }

  // AVADUNGEON - Fixed 10 slots
  if (contentType === 'avadungeon') {
    const roleLines = [
      `**1. ${CUSTOM_EMOJIS.OFFTANK} TANK (tank)**   ${contentState.roles.tank ? '➡️ <@' + contentState.roles.tank + '>' : ''}`,
      `**2. ${CUSTOM_EMOJIS.OFFTANK} OFF-TANK (offtank)**   ${contentState.roles.offtank ? '➡️ <@' + contentState.roles.offtank + '>' : ''}`,
      `**3. ${CUSTOM_EMOJIS.DPS} STUN (stun)**   ${contentState.roles.stun ? '➡️ <@' + contentState.roles.stun + '>' : ''}`,
      `**4. ${CUSTOM_EMOJIS.HEALER} MAIN HEALER (mainhealer)**   ${contentState.roles.mainhealer ? '➡️ <@' + contentState.roles.mainhealer + '>' : ''}`,
      `**5. ${CUSTOM_EMOJIS.HEALER} PARTY HEALER (partyhealer)**   ${contentState.roles.partyhealer ? '➡️ <@' + contentState.roles.partyhealer + '>' : ''}`,
      `**6. ${CUSTOM_EMOJIS.DEBUFF} SHADOWCALLER (shadowcaller)**   ${contentState.roles.shadowcaller ? '➡️ <@' + contentState.roles.shadowcaller + '>' : ''}`,
      `**7. ${CUSTOM_EMOJIS.DPS} DPS (dps1)**   ${contentState.roles.dps1 ? '➡️ <@' + contentState.roles.dps1 + '>' : ''}`,
      `**8. ${CUSTOM_EMOJIS.DPS} DPS (dps2)**   ${contentState.roles.dps2 ? '➡️ <@' + contentState.roles.dps2 + '>' : ''}`,
      `**9. ${CUSTOM_EMOJIS.DPS} DPS (dps3)**   ${contentState.roles.dps3 ? '➡️ <@' + contentState.roles.dps3 + '>' : ''}`,
      `**10. ${CUSTOM_EMOJIS.DPS} DPS (dps4)**   ${contentState.roles.dps4 ? '➡️ <@' + contentState.roles.dps4 + '>' : ''}`
    ];

    const avadungeonRoles = ['tank', 'offtank', 'stun', 'mainhealer', 'partyhealer', 'shadowcaller', 'dps1', 'dps2', 'dps3', 'dps4'];
    const filledSlots = avadungeonRoles.filter(key => contentState.roles[key] !== null).length;
    const fillCount = contentState.fill.length;
    const minSlotsBeforeFill = 8;
    const fillStatus = filledSlots >= minSlotsBeforeFill ? 'FILLING' : 'STANDBY';

    let fillSection = '';
    if (fillCount > 0) {
      const fillStatusEmoji = fillStatus === 'STANDBY' ? '⏸️' : '🔄';
      fillSection = `\n\n**${fillStatusEmoji} FILL - ${fillStatus} (${fillCount}):** ${contentState.fill.map(id => `<@${id}>`).join(', ')}`;
      if (fillStatus === 'STANDBY') {
        fillSection += `\n*Will auto-fill when ${minSlotsBeforeFill}+ slots are taken*`;
      }
    }

    let statusLine = `**Status:** ${filledSlots}/10`;
    if (fillCount > 0 && fillStatus === 'STANDBY') {
      statusLine += ` (${fillCount} in FILL standby)`;
    }

    return new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`${contentEmoji} Ava Dungeon Role Call`)
      .setDescription(
        `**__X UP ROLE!__**\n` +
        `**Zone:** ${contentState.zone}\n**Gear:** T${contentState.tier} Sets\n**Time:** ${contentState.time}\n` +
        `${contentState.demassNotice ? `**Demass:** ${contentState.demassNotice}\n` : ''}` +
        `${statusLine}\n\n` +
        roleLines.join('\n') +
        fillSection
      );
  }

  // CTA - Category-based with 5 categories
  if (contentType === 'cta') {
    const categories = contentState.categories;
    const totalPlayers = categories.tank.length + categories.heal.length + categories.dps.length + categories.support.length + categories.dtank.length;

    const categoryLines = [];

    // TANK
    categoryLines.push(`**${CUSTOM_EMOJIS.OFFTANK} TANK (${categories.tank.length})**`);
    if (categories.tank.length > 0) {
      categories.tank.forEach((uid, idx) => {
        categoryLines.push(`${idx + 1}. <@${uid}>`);
      });
    } else {
      categoryLines.push('*(empty)*');
    }
    categoryLines.push('');

    // HEAL
    categoryLines.push(`**${CUSTOM_EMOJIS.HEALER} HEAL (${categories.heal.length})**`);
    if (categories.heal.length > 0) {
      categories.heal.forEach((uid, idx) => {
        categoryLines.push(`${idx + 1}. <@${uid}>`);
      });
    } else {
      categoryLines.push('*(empty)*');
    }
    categoryLines.push('');

    // DPS
    categoryLines.push(`**${CUSTOM_EMOJIS.DPS} DPS (${categories.dps.length})**`);
    if (categories.dps.length > 0) {
      categories.dps.forEach((uid, idx) => {
        categoryLines.push(`${idx + 1}. <@${uid}>`);
      });
    } else {
      categoryLines.push('*(empty)*');
    }
    categoryLines.push('');

    // SUPPORT
    categoryLines.push(`**${CUSTOM_EMOJIS.DEBUFF} SUPPORT (${categories.support.length})**`);
    if (categories.support.length > 0) {
      categories.support.forEach((uid, idx) => {
        categoryLines.push(`${idx + 1}. <@${uid}>`);
      });
    } else {
      categoryLines.push('*(empty)*');
    }
    categoryLines.push('');

    // DTANK
    categoryLines.push(`**${CUSTOM_EMOJIS.OFFTANK} DTANK (${categories.dtank.length})**`);
    if (categories.dtank.length > 0) {
      categories.dtank.forEach((uid, idx) => {
        categoryLines.push(`${idx + 1}. <@${uid}>`);
      });
    } else {
      categoryLines.push('*(empty)*');
    }

    return new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle(`${contentEmoji} CTA Role Call`)
      .setDescription(
        `**__X UP ROLE!__**\n` +
        `**Zone:** ${contentState.zone}\n**Gear:** T${contentState.tier} Sets\n**Time:** ${contentState.time}\n` +
        `${contentState.demassNotice ? `**Demass:** ${contentState.demassNotice}\n` : ''}` +
        `**Status:** ${totalPlayers} players\n\n` +
        categoryLines.join('\n')
      );
  }

  // FF - Category-based with 3 categories and target count
  if (contentType === 'ff') {
    const categories = contentState.categories;
    const totalPlayers = categories.tank.length + categories.heal.length + categories.dps.length;
    const targetCount = contentState.targetCount || 10;

    const categoryLines = [];

    // TANK
    categoryLines.push(`**${CUSTOM_EMOJIS.OFFTANK} TANK (${categories.tank.length})**`);
    if (categories.tank.length > 0) {
      categories.tank.forEach((uid, idx) => {
        categoryLines.push(`${idx + 1}. <@${uid}>`);
      });
    } else {
      categoryLines.push('*(empty)*');
    }
    categoryLines.push('');

    // HEAL
    categoryLines.push(`**${CUSTOM_EMOJIS.HEALER} HEAL (${categories.heal.length})**`);
    if (categories.heal.length > 0) {
      categories.heal.forEach((uid, idx) => {
        categoryLines.push(`${idx + 1}. <@${uid}>`);
      });
    } else {
      categoryLines.push('*(empty)*');
    }
    categoryLines.push('');

    // DPS
    categoryLines.push(`**${CUSTOM_EMOJIS.DPS} DPS (${categories.dps.length})**`);
    if (categories.dps.length > 0) {
      categories.dps.forEach((uid, idx) => {
        categoryLines.push(`${idx + 1}. <@${uid}>`);
      });
    } else {
      categoryLines.push('*(empty)*');
    }

    return new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`${contentEmoji} FF Role Call`)
      .setDescription(
        `**__X UP ROLE!__**\n` +
        `**Zone:** ${contentState.zone}\n**Gear:** T${contentState.tier} Sets\n**Time:** ${contentState.time}\n` +
        `**Target:** ${targetCount} players | **Current:** ${totalPlayers}/${targetCount}\n` +
        `${contentState.demassNotice ? `**Demass:** ${contentState.demassNotice}\n` : ''}` +
        `\n` +
        categoryLines.join('\n')
      );
  }
};

// Auto-assign fill players to empty slots (ROA/GCAMPS only)
export async function autoAssignFillPlayers(client) {
  // Only for ROA/GCAMPS/AVADUNGEON (fixed slots)
  if (contentState.contentType !== 'roa' && contentState.contentType !== 'gcamps' && contentState.contentType !== 'avadungeon') {
    return;
  }

  let roleKeys, totalSlots, minSlotsBeforeFill;

  if (contentState.contentType === 'roa') {
    roleKeys = ['tank', 'heal', 'mp', 'mp2', 'shadowcaller', 'blazing', 'flex'];
    totalSlots = 7;
    minSlotsBeforeFill = 6;
  } else if (contentState.contentType === 'gcamps') {
    roleKeys = ['tank', 'heal', 'shadowcaller', 'blazing', 'badon'];
    totalSlots = 5;
    minSlotsBeforeFill = 4;
  } else { // avadungeon
    roleKeys = ['tank', 'offtank', 'stun', 'mainhealer', 'partyhealer', 'shadowcaller', 'dps1', 'dps2', 'dps3', 'dps4'];
    totalSlots = 10;
    minSlotsBeforeFill = 8;
  }

  // Count how many slots are currently filled (not null)
  const filledSlots = roleKeys.filter(key => contentState.roles[key] !== null).length;

  if (filledSlots < minSlotsBeforeFill) {
    // Not enough slots filled yet, keep fill players in standby
    console.log(`⏸️ Fill players on standby: ${filledSlots}/${totalSlots} slots filled (need ${minSlotsBeforeFill})`);
    return;
  }

  // Now we're at threshold or more slots, start assigning fill players
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
