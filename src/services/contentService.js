import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { contentState } from '../config/contentState.js';

// ─── Role definitions ──────────────────────────────────────────────────────────

export const MASTER_ROLES = [
  // Tank (4)
  { key: 'tank_ga',      label: 'Tank — Grovekeeper',        shortLabel: 'GA',       category: 'tank' },
  { key: 'tank_camlann', label: 'Tank — Camlann Mace',       shortLabel: 'Camlann',  category: 'tank' },
  { key: 'tank_hoj',     label: 'Tank — Hammer of Justice',  shortLabel: 'HoJ',      category: 'tank' },
  { key: 'tank_ic',      label: 'Tank — Ironclad Staff',     shortLabel: 'IC',       category: 'tank' },
  // Heal (5)
  { key: 'heal_hf',        label: 'Heal — Hallowfall',       shortLabel: 'HF',         category: 'heal' },
  { key: 'heal_fallen',    label: 'Heal — Fallen Staff',     shortLabel: 'Fallen',     category: 'heal' },
  { key: 'heal_lifetouch', label: 'Heal — Lifetouch Staff',  shortLabel: 'Lifetouch',  category: 'heal' },
  { key: 'heal_blight',    label: 'Heal — Blight Staff',     shortLabel: 'Blight',     category: 'heal' },
  { key: 'heal_rampant',   label: 'Heal — Rampant Staff',    shortLabel: 'Rampant',    category: 'heal' },
  // Support (3)
  { key: 'supp_locus',  label: 'Support — Locus Staff',     shortLabel: 'Locus',  category: 'support' },
  { key: 'supp_enig',   label: 'Support — Enigmatic Staff', shortLabel: 'Enig',   category: 'support' },
  { key: 'supp_occult', label: 'Support — Occult Staff',    shortLabel: 'Occult', category: 'support' },
  // DPS (14)
  { key: 'dps_sc',       label: 'DPS — Shadowcaller',       shortLabel: 'SC',       category: 'dps' },
  { key: 'dps_lc',       label: 'DPS — Lightcaller',        shortLabel: 'LC',       category: 'dps' },
  { key: 'dps_perma',    label: 'DPS — Permafrost Prism',   shortLabel: 'Perma',    category: 'dps' },
  { key: 'dps_brim',     label: 'DPS — Brimstone Staff',    shortLabel: 'Brim',     category: 'dps' },
  { key: 'dps_wildfire', label: 'DPS — Wildfire Staff',     shortLabel: 'Wildfire', category: 'dps' },
  { key: 'dps_carrion',  label: 'DPS — Carrioncaller',      shortLabel: 'Carrion',  category: 'dps' },
  { key: 'dps_spirith',  label: 'DPS — Spirithunter',       shortLabel: 'Spirith',  category: 'dps' },
  { key: 'dps_realm',    label: 'DPS — Realmbreaker',       shortLabel: 'Realm',    category: 'dps' },
  { key: 'dps_infernal', label: 'DPS — Infernal Scythe',    shortLabel: 'Infernal', category: 'dps' },
  { key: 'dps_galas',    label: 'DPS — Galatine Pair',      shortLabel: 'Galas',    category: 'dps' },
  { key: 'dps_bl',       label: 'DPS — Bloodletter',        shortLabel: 'BL',       category: 'dps' },
  { key: 'dps_siege',    label: 'DPS — Siegebow',           shortLabel: 'Siege',    category: 'dps' },
  { key: 'dps_we',       label: 'DPS — Weeping Repeater',   shortLabel: 'WE',       category: 'dps' },
  { key: 'dps_badon',    label: 'DPS — Bow of Badon',       shortLabel: 'Badon',    category: 'dps' },
];

// Lookup map: roleKey -> role info
export const ROLE_MAP = Object.fromEntries(MASTER_ROLES.map(r => [r.key, r]));

// Roles grouped by category (for the category-based selector)
export const ROLES_BY_CATEGORY = {
  tank:    MASTER_ROLES.filter(r => r.category === 'tank'),
  heal:    MASTER_ROLES.filter(r => r.category === 'heal'),
  support: MASTER_ROLES.filter(r => r.category === 'support'),
  dps:     MASTER_ROLES.filter(r => r.category === 'dps'),
};

// ─── Active-content embed & buttons ───────────────────────────────────────────

// Build the content embed dynamically from activeRoles
export const buildContentEmbed = () => {
  const { title, time, demassNotice, activeRoles, roles, fill, customRoleNames } = contentState;
  const total = activeRoles.length;
  const filled = activeRoles.filter(k => roles[k] != null).length;

  const roleLines = activeRoles.map((key, i) => {
    const displayName = customRoleNames?.[key] || ROLE_MAP[key]?.label || key.toUpperCase();
    const userId = roles[key];
    return `**${i + 1}. ${displayName}**   ${userId ? '➡️ <@' + userId + '>' : ''}`;
  });

  const fillSection = fill.length > 0
    ? `\n\n**🔄 FILL (${fill.length}):** ${fill.map(id => `<@${id}>`).join(', ')}`
    : '';

  return new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`📣 ${title || 'Role Call'}`)
    .setDescription(
      `**__X UP ROLE!__**\n` +
      `**Time:** ${time || 'TBD'}\n` +
      (demassNotice ? `**Demass:** ${demassNotice}\n` : '') +
      `**Status:** ${filled}/${total}\n\n` +
      roleLines.join('\n') +
      fillSection
    );
};

// Build Discord button rows dynamically from activeRoles (max 4 role rows + 1 utility row)
export const buildContentComponents = () => {
  const { activeRoles, customRoleNames } = contentState;

  const btn = (customId, label, style = ButtonStyle.Primary) =>
    new ButtonBuilder().setCustomId(customId).setLabel(label).setStyle(style);

  const row = (...btns) => new ActionRowBuilder().addComponents(...btns);

  const roleButtons = activeRoles.map(key => {
    const shortLabel = customRoleNames?.[key]
      ? customRoleNames[key].substring(0, 12)
      : (ROLE_MAP[key]?.shortLabel || key.toUpperCase().substring(0, 12));
    return btn(`content_role_${key}`, shortLabel);
  });

  const rows = [];
  for (let i = 0; i < roleButtons.length && rows.length < 4; i += 5) {
    rows.push(row(...roleButtons.slice(i, i + 5)));
  }

  // Utility row: Fill + Cancel
  rows.push(row(
    btn('content_fill', '🔄 Fill', ButtonStyle.Success),
    btn('content_cancel', '❌ Cancel', ButtonStyle.Danger)
  ));

  return rows;
};

// ─── Creation wizard builders ──────────────────────────────────────────────────

// Step 1: party size dropdown
export const buildSizeSelector = () => {
  const options = [];
  for (let i = 2; i <= 20; i++) {
    options.push({ label: `${i} players`, value: String(i) });
  }
  const select = new StringSelectMenuBuilder()
    .setCustomId('content_size_select')
    .setPlaceholder('How many party slots?')
    .addOptions(options);
  return [new ActionRowBuilder().addComponents(select)];
};

// Step 2: choose Custom vs Preset roles
export const buildMethodSelector = () => [
  new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('content_method_custom')
      .setLabel('🖊️ Custom Roles')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('content_method_dropdown')
      .setLabel('📋 Preset Roles')
      .setStyle(ButtonStyle.Secondary),
  ),
];

// Step 3 (Preset): category buttons — shown for each slot
export const buildSlotCategorySelector = (slotNum, partySize, assignedRoles) => {
  const progressLines = assignedRoles.map((key, i) => {
    const name = ROLE_MAP[key]?.label || key;
    return `✅ Slot ${i + 1}: **${name}**`;
  });

  const content = [
    `**Step 3 of 4** — Assign preset roles for your **${partySize}-slot** party`,
    progressLines.length > 0 ? progressLines.join('\n') : '',
    `\n**Slot ${slotNum} of ${partySize}** — Choose a category:`,
  ].filter(Boolean).join('\n');

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('content_cat_tank').setLabel('🛡️ Tank').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('content_cat_heal').setLabel('💚 Heal').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('content_cat_support').setLabel('🔷 Support').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('content_cat_dps').setLabel('⚔️ DPS').setStyle(ButtonStyle.Danger),
  );

  return { content, components: [row] };
};

// Step 3 (Preset): role dropdown for a specific category
export const buildCategoryRoleSelect = (category, slotNum, partySize) => {
  const roles = ROLES_BY_CATEGORY[category] || [];
  const options = roles.map(r => ({ label: r.label, value: r.key }));

  const selectRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`content_cat_select_${category}`)
      .setPlaceholder(`Slot ${slotNum}/${partySize} — pick a ${category.toUpperCase()} role`)
      .addOptions(options),
  );
  const backRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('content_cat_back')
      .setLabel('↩️ Back to Categories')
      .setStyle(ButtonStyle.Secondary),
  );

  return [selectRow, backRow];
};

// Step 3 (Custom): modal for naming a batch of slots
export const buildCustomBatchModal = (batchStart, partySize) => {
  const batchEnd = Math.min(batchStart + 5, partySize);
  const inputs = [];
  for (let i = batchStart; i < batchEnd; i++) {
    inputs.push(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(`slot_name_${i}`)
          .setLabel(`Slot ${i + 1} Role Name`)
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g. DPS, Tank, Bomb Squad, Scout...')
          .setRequired(true)
          .setMaxLength(50),
      ),
    );
  }
  return new ModalBuilder()
    .setCustomId('content_custom_modal')
    .setTitle(`Name Your Roles (Slots ${batchStart + 1}–${batchEnd})`)
    .addComponents(...inputs);
};

// "Continue naming slots" button (after a custom batch modal)
export const buildCustomContinueButton = (nextBatchStart, partySize) => {
  const batchEnd = Math.min(nextBatchStart + 5, partySize);
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('content_custom_continue')
        .setLabel(`📝 Name Slots ${nextBatchStart + 1}–${batchEnd}`)
        .setStyle(ButtonStyle.Primary),
    ),
  ];
};

// "Set content details" button — shown when all slots are assigned
export const buildContinueToDetailsButton = () => [
  new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('content_details_btn')
      .setLabel('✏️ Set Content Details')
      .setStyle(ButtonStyle.Success),
  ),
];

// Step 4: content details modal (title / time / demass)
export const buildContentDetailsModal = () =>
  new ModalBuilder()
    .setCustomId('content_create_modal')
    .setTitle('Content Details')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('modal_title')
          .setLabel('Content Title')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g. ROA Sunday Run')
          .setRequired(true)
          .setMaxLength(100),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('modal_time')
          .setLabel('Time (e.g. 20:00 UTC)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('20:00 UTC')
          .setRequired(true)
          .setMaxLength(50),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('modal_demass')
          .setLabel('Demass Notice (optional)')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Leave blank if no demass notice')
          .setRequired(false)
          .setMaxLength(500),
      ),
    );

// Step 5: preview embed (yellow, not yet published)
export const buildContentPreviewEmbed = (pending) => {
  const { assignedRoles = [], customRoleNames = {}, title, time, demassNotice } = pending;

  const roleLines = assignedRoles.map((key, i) => {
    const displayName = customRoleNames[key] || ROLE_MAP[key]?.label || key.toUpperCase();
    return `**${i + 1}. ${displayName}**`;
  });

  return new EmbedBuilder()
    .setColor(0xFEE75C)
    .setTitle(`📋 Preview: ${title || 'Role Call'}`)
    .setDescription(
      `**⚠️ PREVIEW — Not yet published**\n\n` +
      `**Time:** ${time || 'TBD'}\n` +
      (demassNotice ? `**Demass:** ${demassNotice}\n` : '') +
      `**Party size:** ${assignedRoles.length}\n\n` +
      roleLines.join('\n'),
    );
};

// Step 5: publish / edit-details buttons
export const buildPreviewComponents = () => [
  new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('content_preview_publish')
      .setLabel('✅ Publish')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('content_preview_edit')
      .setLabel('✏️ Edit Details')
      .setStyle(ButtonStyle.Secondary),
  ),
];

// ─── Auto-assign fill players ──────────────────────────────────────────────────

export async function autoAssignFillPlayers(client) {
  const { activeRoles } = contentState;
  if (!activeRoles || activeRoles.length === 0) return;

  // Shuffle fill array so assignment order is unpredictable
  for (let i = contentState.fill.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [contentState.fill[i], contentState.fill[j]] = [contentState.fill[j], contentState.fill[i]];
  }

  while (contentState.fill.length > 0) {
    const emptySlots = activeRoles.filter(key => contentState.roles[key] === null);
    if (emptySlots.length === 0) break;

    const emptySlot = emptySlots[Math.floor(Math.random() * emptySlots.length)];
    const fillPlayerId = contentState.fill.shift();
    contentState.roles[emptySlot] = fillPlayerId;
    console.log(`✅ Fill assigned: <@${fillPlayerId}> → ${emptySlot.toUpperCase()}`);

    try {
      const channel = await client.channels.fetch(contentState.threadId);
      if (channel) {
        const displayName =
          contentState.customRoleNames?.[emptySlot] ||
          ROLE_MAP[emptySlot]?.label ||
          emptySlot.toUpperCase();
        await channel.send(`✅ <@${fillPlayerId}> has been automatically assigned to **${displayName}** from FILL!`);
      }
    } catch (err) {
      console.error('Error notifying fill player:', err);
    }
  }
}