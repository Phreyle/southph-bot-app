import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { CUSTOM_EMOJIS } from '../config/constants.js';
import { contentState } from '../config/contentState.js';

// Helper function to build the content embed
export const buildContentEmbed = () => {
  const contentType = contentState.contentType;
  const contentEmoji = {
    'roa': '🏰',
    'roapvp': '⚔️',
    'cta': '⚔️',
    'gcamps': '🏕️',
    'ff': '🛡️',
    'tracking': '🎯',
    'avadungeon': '⚔️',
    'rck': '🏹',
    'rcb': '🥊'
  }[contentType] || '🎮';

  // ROA PVE - Fixed 7 slots
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

    const fillSection = fillCount > 0
      ? `\n\n**🔄 FILL (${fillCount}):** ${contentState.fill.map(id => `<@${id}>`).join(', ')}`
      : '';

    return new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`${contentEmoji} ROA PVE Role Call`)
      .setDescription(
        `**__X UP ROLE!__**\n` +
        `**Zone:** ${contentState.zone}\n**Gear:** T${contentState.tier} Sets\n**Time:** ${contentState.time}\n` +
        `${contentState.demassNotice ? `**Demass:** ${contentState.demassNotice}\n` : ''}` +
        `**Status:** ${filledSlots}/7\n\n` +
        roleLines.join('\n') +
        fillSection
      );
  }

  // ROA PVE/P - Fixed 7 slots (PVE + PVP Hybrid)
  if (contentType === 'roapvp') {
    const roleLines = [
      `**1. ${CUSTOM_EMOJIS.OFFTANK} TANK (tank)**   ${contentState.roles.tank ? '➡️ <@' + contentState.roles.tank + '>' : ''}`,
      `**2. ${CUSTOM_EMOJIS.HEALER} HEAL (heal)**   ${contentState.roles.heal ? '➡️ <@' + contentState.roles.heal + '>' : ''}`,
      `**3. ${CUSTOM_EMOJIS.DPS} BLAZE/DAWNSONG (blaze)**   ${contentState.roles.blaze ? '➡️ <@' + contentState.roles.blaze + '>' : ''}`,
      `**4. ${CUSTOM_EMOJIS.DEBUFF} SC/DTANK (sc)**   ${contentState.roles.sc ? '➡️ <@' + contentState.roles.sc + '>' : ''}`,
      `**5. ${CUSTOM_EMOJIS.DPS} PERMA (perma)**   ${contentState.roles.perma ? '➡️ <@' + contentState.roles.perma + '>' : ''}`,
      `**6. ${CUSTOM_EMOJIS.DPS} LIGHTCALLER (lc)**   ${contentState.roles.lc ? '➡️ <@' + contentState.roles.lc + '>' : ''}`,
      `**7. ${CUSTOM_EMOJIS.DPS} MP (mp)**   ${contentState.roles.mp ? '➡️ <@' + contentState.roles.mp + '>' : ''}`
    ];

    const roapvpRoles = ['tank', 'heal', 'blaze', 'sc', 'perma', 'lc', 'mp'];
    const filledSlots = roapvpRoles.filter(key => contentState.roles[key] !== null).length;
    const fillCount = contentState.fill.length;

    const fillSection = fillCount > 0
      ? `\n\n**🔄 FILL (${fillCount}):** ${contentState.fill.map(id => `<@${id}>`).join(', ')}`
      : '';

    return new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`${contentEmoji} ROA PVE/P Role Call`)
      .setDescription(
        `**__X UP ROLE!__**\n` +
        `**Zone:** ${contentState.zone}\n**Gear:** T${contentState.tier} Sets\n**Time:** ${contentState.time}\n` +
        `${contentState.demassNotice ? `**Demass:** ${contentState.demassNotice}\n` : ''}` +
        `**Status:** ${filledSlots}/7\n\n` +
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

    const fillSection = fillCount > 0
      ? `\n\n**🔄 FILL (${fillCount}):** ${contentState.fill.map(id => `<@${id}>`).join(', ')}`
      : '';

    const statusLine = `**Status:** ${filledSlots}/5`;

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

    const fillSection = fillCount > 0
      ? `\n\n**🔄 FILL (${fillCount}):** ${contentState.fill.map(id => `<@${id}>`).join(', ')}`
      : '';

    const statusLine = `**Status:** ${filledSlots}/10`;

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
  // RCK - AVA ROAM CLAP KITE - Fixed 7 slots
  if (contentType === 'rck') {
    const roleLines = [
      `**1. ${CUSTOM_EMOJIS.OFFTANK} TANK (tank)**   ${contentState.roles.tank ? '➡️ <@' + contentState.roles.tank + '>' : ''}`,
      `**2. ${CUSTOM_EMOJIS.HEALER} HEAL (heal)**   ${contentState.roles.heal ? '➡️ <@' + contentState.roles.heal + '>' : ''}`,
      `**3. ${CUSTOM_EMOJIS.DPS} LONGBOW (longbow)**   ${contentState.roles.longbow ? '➡️ <@' + contentState.roles.longbow + '>' : ''}`,
      `**4. ${CUSTOM_EMOJIS.DPS} REALMBREAKER (realmbreaker)**   ${contentState.roles.realmbreaker ? '➡️ <@' + contentState.roles.realmbreaker + '>' : ''}`,
      `**5. ${CUSTOM_EMOJIS.DPS} KINGMAKER (kingmaker)**   ${contentState.roles.kingmaker ? '➡️ <@' + contentState.roles.kingmaker + '>' : ''}`,
      `**6. ${CUSTOM_EMOJIS.DPS} HERON (heron)**   ${contentState.roles.heron ? '➡️ <@' + contentState.roles.heron + '>' : ''}`,
      `**7. ${CUSTOM_EMOJIS.DPS} BLOODLETTER (bloodletter)**   ${contentState.roles.bloodletter ? '➡️ <@' + contentState.roles.bloodletter + '>' : ''}`
    ];

    const rckRoles = ['tank', 'heal', 'longbow', 'realmbreaker', 'kingmaker', 'heron', 'bloodletter'];
    const filledSlots = rckRoles.filter(key => contentState.roles[key] !== null).length;
    const fillCount = contentState.fill.length;

    const fillSection = fillCount > 0
      ? `\n\n**🔄 FILL (${fillCount}):** ${contentState.fill.map(id => `<@${id}>`).join(', ')}`
      : '';

    return new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`${contentEmoji} AVA ROAM CLAP KITE (RCK) Role Call`)
      .setDescription(
        `**__X UP ROLE!__**\n` +
        `**Zone:** ${contentState.zone}\n**Gear:** T${contentState.tier} Sets\n**Time:** ${contentState.time}\n` +
        `${contentState.demassNotice ? `**Demass:** ${contentState.demassNotice}\n` : ''}` +
        `**Status:** ${filledSlots}/7\n\n` +
        roleLines.join('\n') +
        fillSection
      );
  }

  // RCB - AVA ROAM CLAP BRAWL - Fixed 7 slots
  if (contentType === 'rcb') {
    const roleLines = [
      `**1. ${CUSTOM_EMOJIS.OFFTANK} TANK (tank)**   ${contentState.roles.tank ? '➡️ <@' + contentState.roles.tank + '>' : ''}`,
      `**2. ${CUSTOM_EMOJIS.HEALER} HEAL (heal)**   ${contentState.roles.heal ? '➡️ <@' + contentState.roles.heal + '>' : ''}`,
      `**3. ${CUSTOM_EMOJIS.DPS} REALMBREAKER/CARVING (realmcarving)**   ${contentState.roles.realmcarving ? '➡️ <@' + contentState.roles.realmcarving + '>' : ''}`,
      `**4. ${CUSTOM_EMOJIS.DPS} LONGBOW (longbow)**   ${contentState.roles.longbow ? '➡️ <@' + contentState.roles.longbow + '>' : ''}`,
      `**5. ${CUSTOM_EMOJIS.DPS} BRAWL DPS (brawl1)**   ${contentState.roles.brawl1 ? '➡️ <@' + contentState.roles.brawl1 + '>' : ''}`,
      `**6. ${CUSTOM_EMOJIS.DPS} BRAWL DPS (brawl2)**   ${contentState.roles.brawl2 ? '➡️ <@' + contentState.roles.brawl2 + '>' : ''}`,
      `**7. ${CUSTOM_EMOJIS.DPS} BRAWL DPS (brawl3)**   ${contentState.roles.brawl3 ? '➡️ <@' + contentState.roles.brawl3 + '>' : ''}`
    ];

    const rcbRoles = ['tank', 'heal', 'realmcarving', 'longbow', 'brawl1', 'brawl2', 'brawl3'];
    const filledSlots = rcbRoles.filter(key => contentState.roles[key] !== null).length;
    const fillCount = contentState.fill.length;

    const fillSection = fillCount > 0
      ? `\n\n**🔄 FILL (${fillCount}):** ${contentState.fill.map(id => `<@${id}>`).join(', ')}`
      : '';

    return new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`${contentEmoji} AVA ROAM CLAP BRAWL (RCB) Role Call`)
      .setDescription(
        `**__X UP ROLE!__**\n` +
        `**Zone:** ${contentState.zone}\n**Gear:** T${contentState.tier} Sets\n**Time:** ${contentState.time}\n` +
        `${contentState.demassNotice ? `**Demass:** ${contentState.demassNotice}\n` : ''}` +
        `**Status:** ${filledSlots}/7\n\n` +
        roleLines.join('\n') +
        fillSection
      );
  }
};

// Build Discord button components for the active content type
export const buildContentComponents = () => {
  const contentType = contentState.contentType;

  const btn = (customId, label, style = ButtonStyle.Primary) =>
    new ButtonBuilder().setCustomId(customId).setLabel(label).setStyle(style);

  const cancelBtn = btn('content_cancel', '❌ Cancel Role', ButtonStyle.Danger);
  const fillBtn   = btn('content_fill',   '🔄 Fill',        ButtonStyle.Secondary);

  const row = (...btns) => new ActionRowBuilder().addComponents(...btns);

  if (contentType === 'roa') {
    return [
      row(btn('content_role_tank', 'TANK'), btn('content_role_heal', 'HEAL'), btn('content_role_mp', 'MP'), btn('content_role_mp2', 'MP2'), btn('content_role_shadowcaller', 'SC')),
      row(btn('content_role_blazing', 'BLAZING'), btn('content_role_flex', 'FLEX'), fillBtn, cancelBtn)
    ];
  }
  if (contentType === 'roapvp') {
    return [
      row(btn('content_role_tank', 'TANK'), btn('content_role_heal', 'HEAL'), btn('content_role_blaze', 'BLAZE'), btn('content_role_sc', 'SC'), btn('content_role_perma', 'PERMA')),
      row(btn('content_role_lc', 'LC'), btn('content_role_mp', 'MP'), fillBtn, cancelBtn)
    ];
  }
  if (contentType === 'gcamps') {
    return [
      row(btn('content_role_tank', 'TANK'), btn('content_role_heal', 'HEAL'), btn('content_role_shadowcaller', 'SC'), btn('content_role_blazing', 'BLAZING'), btn('content_role_badon', 'BADON')),
      row(fillBtn, cancelBtn)
    ];
  }
  if (contentType === 'tracking') {
    return [
      row(btn('content_role_tank', 'TANK'), btn('content_role_heal', 'HEAL'), btn('content_role_dpair', 'DPAIR'), btn('content_role_hpcut', 'HP CUT'), btn('content_role_flexdps', 'FLEX DPS')),
      row(cancelBtn)
    ];
  }
  if (contentType === 'avadungeon') {
    return [
      row(btn('content_role_tank', 'TANK'), btn('content_role_offtank', 'OFF-TANK'), btn('content_role_stun', 'STUN'), btn('content_role_mainhealer', 'MAIN HEAL'), btn('content_role_partyhealer', 'PARTY HEAL')),
      row(btn('content_role_shadowcaller', 'SC'), btn('content_role_dps1', 'DPS1'), btn('content_role_dps2', 'DPS2'), btn('content_role_dps3', 'DPS3'), btn('content_role_dps4', 'DPS4')),
      row(fillBtn, cancelBtn)
    ];
  }
  if (contentType === 'rck') {
    return [
      row(btn('content_role_tank', 'TANK'), btn('content_role_heal', 'HEAL'), btn('content_role_longbow', 'LONGBOW'), btn('content_role_realmbreaker', 'REALMBREAKER'), btn('content_role_kingmaker', 'KINGMAKER')),
      row(btn('content_role_heron', 'HERON'), btn('content_role_bloodletter', 'BLOODLETTER'), fillBtn, cancelBtn)
    ];
  }
  if (contentType === 'rcb') {
    return [
      row(btn('content_role_tank', 'TANK'), btn('content_role_heal', 'HEAL'), btn('content_role_realmcarving', 'REALMCARVING'), btn('content_role_longbow', 'LONGBOW'), btn('content_role_brawl1', 'BRAWL1')),
      row(btn('content_role_brawl2', 'BRAWL2'), btn('content_role_brawl3', 'BRAWL3'), fillBtn, cancelBtn)
    ];
  }
  if (contentType === 'cta') {
    return [
      row(btn('content_role_tank', 'TANK'), btn('content_role_heal', 'HEAL'), btn('content_role_dps', 'DPS'), btn('content_role_support', 'SUPPORT'), btn('content_role_dtank', 'DTANK')),
      row(cancelBtn)
    ];
  }
  if (contentType === 'ff') {
    return [
      row(btn('content_role_tank', 'TANK'), btn('content_role_heal', 'HEAL'), btn('content_role_dps', 'DPS'), cancelBtn)
    ];
  }
  return [];
};

// Auto-assign fill players to empty slots immediately (no threshold)
export async function autoAssignFillPlayers(client) {
  const fixedSlotTypes = ['roa', 'roapvp', 'gcamps', 'avadungeon', 'rck', 'rcb'];
  if (!fixedSlotTypes.includes(contentState.contentType)) return;

  let roleKeys;
  if (contentState.contentType === 'roa') {
    roleKeys = ['tank', 'heal', 'mp', 'mp2', 'shadowcaller', 'blazing', 'flex'];
  } else if (contentState.contentType === 'roapvp') {
    roleKeys = ['tank', 'heal', 'blaze', 'sc', 'perma', 'lc', 'mp'];
  } else if (contentState.contentType === 'gcamps') {
    roleKeys = ['tank', 'heal', 'shadowcaller', 'blazing', 'badon'];
  } else if (contentState.contentType === 'avadungeon') {
    roleKeys = ['tank', 'offtank', 'stun', 'mainhealer', 'partyhealer', 'shadowcaller', 'dps1', 'dps2', 'dps3', 'dps4'];
  } else if (contentState.contentType === 'rck') {
    roleKeys = ['tank', 'heal', 'longbow', 'realmbreaker', 'kingmaker', 'heron', 'bloodletter'];
  } else { // rcb
    roleKeys = ['tank', 'heal', 'realmcarving', 'longbow', 'brawl1', 'brawl2', 'brawl3'];
  }

  // Assign ALL fill players to available empty slots immediately
  while (contentState.fill.length > 0) {
    const emptySlot = roleKeys.find(key => contentState.roles[key] === null);
    if (!emptySlot) break; // All slots full, remaining fill players wait

    const fillPlayerId = contentState.fill.shift();
    contentState.roles[emptySlot] = fillPlayerId;
    console.log(`✅ Fill assigned: <@${fillPlayerId}> → ${emptySlot.toUpperCase()}`);

    try {
      const channel = await client.channels.fetch(contentState.threadId);
      if (channel) {
        await channel.send(`✅ <@${fillPlayerId}> has been automatically assigned to **${emptySlot.toUpperCase()}** from FILL!`);
      }
    } catch (err) {
      console.error('Error notifying fill player:', err);
    }
  }
}
