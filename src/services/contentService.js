import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import { contentState } from '../config/contentState.js';

// Master list of all available roles (max 25 for Discord select menu)
export const MASTER_ROLES = [
  { key: 'tank',        label: '🛡️ Tank',           shortLabel: 'TANK' },
  { key: 'heal',        label: '💚 Healer',           shortLabel: 'HEAL' },
  { key: 'heal2',       label: '💚 Healer 2',         shortLabel: 'HEAL2' },
  { key: 'mp',          label: '⚔️ Arcane/MP',        shortLabel: 'MP' },
  { key: 'mp2',         label: '⚔️ Arcane/MP 2',      shortLabel: 'MP2' },
  { key: 'shadowcaller',label: '🔮 Shadowcaller',     shortLabel: 'SC' },
  { key: 'blazing',     label: '🔥 Blazing Staff',    shortLabel: 'BLAZING' },
  { key: 'flex',        label: '✨ Flex',              shortLabel: 'FLEX' },
  { key: 'badon',       label: '🗡️ Badon',            shortLabel: 'BADON' },
  { key: 'dpair',       label: '⚔️ DP Air',           shortLabel: 'DPAIR' },
  { key: 'hpcut',       label: '✂️ HP Cut',           shortLabel: 'HPCUT' },
  { key: 'flexdps',     label: '🗡️ Flex DPS',         shortLabel: 'FLEXDPS' },
  { key: 'offtank',     label: '🛡️ Off-Tank',         shortLabel: 'OFFTANK' },
  { key: 'stun',        label: '⚡ Stunner',           shortLabel: 'STUN' },
  { key: 'mainhealer',  label: '💚 Main Healer',      shortLabel: 'MAINHEAL' },
  { key: 'partyhealer', label: '💚 Party Healer',     shortLabel: 'PARTYHEAL' },
  { key: 'dps1',        label: '🗡️ DPS 1',            shortLabel: 'DPS1' },
  { key: 'dps2',        label: '🗡️ DPS 2',            shortLabel: 'DPS2' },
  { key: 'dps3',        label: '🗡️ DPS 3',            shortLabel: 'DPS3' },
  { key: 'dps4',        label: '🗡️ DPS 4',            shortLabel: 'DPS4' },
  { key: 'blaze',       label: '🔥 Blaze/Dawnsong',   shortLabel: 'BLAZE' },
  { key: 'perma',       label: '❄️ Perma Frost',      shortLabel: 'PERMA' },
  { key: 'lc',          label: '💡 Lightcaller',      shortLabel: 'LC' },
  { key: 'longbow',     label: '🏹 Longbow',           shortLabel: 'LONGBOW' },
  { key: 'support',     label: '🛡️ Support',           shortLabel: 'SUPPORT' },
];

// Lookup map: roleKey -> role info
export const ROLE_MAP = Object.fromEntries(MASTER_ROLES.map(r => [r.key, r]));

// Build the content embed dynamically from activeRoles
export const buildContentEmbed = () => {
  const { title, time, demassNotice, activeRoles, roles, fill } = contentState;
  const total = activeRoles.length;
  const filled = activeRoles.filter(k => roles[k] != null).length;

  const roleLines = activeRoles.map((key, i) => {
    const info = ROLE_MAP[key] || { label: key.toUpperCase() };
    const userId = roles[key];
    return `**${i + 1}. ${info.label} (${key})**   ${userId ? '➡️ <@' + userId + '>' : ''}`;
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
  const { activeRoles } = contentState;

  const btn = (customId, label, style = ButtonStyle.Primary) =>
    new ButtonBuilder().setCustomId(customId).setLabel(label).setStyle(style);

  const row = (...btns) => new ActionRowBuilder().addComponents(...btns);

  const roleButtons = activeRoles.map(key => {
    const info = ROLE_MAP[key] || { shortLabel: key.toUpperCase() };
    return btn(`content_role_${key}`, info.shortLabel);
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

// Returns the ephemeral message components for step 1: pick party size
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

// Returns the ephemeral message components for step 2: pick roles
export const buildRoleSelector = (partySize) => {
  const options = MASTER_ROLES.map(r => ({
    label: r.label,
    value: r.key,
    description: `Key: ${r.key}`
  }));
  const select = new StringSelectMenuBuilder()
    .setCustomId('content_role_select')
    .setPlaceholder(`Pick exactly ${partySize} roles`)
    .setMinValues(partySize)
    .setMaxValues(partySize)
    .addOptions(options);
  return [new ActionRowBuilder().addComponents(select)];
};

// Auto-assign fill players to empty slots — random order and random slot
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
        const info = ROLE_MAP[emptySlot] || { label: emptySlot.toUpperCase() };
        await channel.send(`✅ <@${fillPlayerId}> has been automatically assigned to **${info.label}** from FILL!`);
      }
    } catch (err) {
      console.error('Error notifying fill player:', err);
    }
  }
}