// Storage for content state (in production, use a database)
export const contentState = {
  active: false,
  messageId: null,
  channelId: null,
  threadId: null,
  contentType: 'ff', // roa, cta, gcamps, ff, tracking, avadungeon
  title: '',
  zone: 'Brecilien',
  tier: 7,
  time: '',
  demassNotice: '',
  targetCount: 10, // for FF only

  // For ROA/GCAMPS/AVADUNGEON (fixed slots)
  // ROA uses: tank, heal, mp, mp2, shadowcaller, blazing, flex (7 slots)
  // GCAMPS uses: tank, heal, shadowcaller, blazing, badon (5 slots)
  // AVADUNGEON uses: tank, offtank, stun, mainhealer, partyhealer, shadowcaller, dps1, dps2, dps3, dps4 (10 slots)
  roles: {
    tank: null,
    offtank: null,
    stun: null,
    heal: null,
    mainhealer: null,
    partyhealer: null,
    mp: null,
    mp2: null,
    shadowcaller: null,
    blazing: null,
    flex: null,
    badon: null,
    dps1: null,
    dps2: null,
    dps3: null,
    dps4: null
  },

  // For CTA/FF (category lists)
  categories: {
    tank: [],
    heal: [],
    dps: [],
    support: [], // CTA only
    dtank: []    // CTA only
  },

  fill: [] // Array of user IDs who want to fill any remaining slots (ROA/GCAMPS only)
};
