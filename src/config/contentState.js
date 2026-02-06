// Storage for content state (in production, use a database)
export const contentState = {
  active: false,
  messageId: null,
  channelId: null,
  threadId: null,
  contentType: 'ff', // roa, cta, gcamps, ff
  title: '',
  zone: 'Brecilien',
  tier: 7,
  time: '',
  demassNotice: '',
  targetCount: 10, // for FF only

  // For ROA/GCAMPS (fixed slots)
  // ROA uses: tank, heal, mp, mp2, shadowcaller, blazing, flex (7 slots)
  // GCAMPS uses: tank, heal, shadowcaller, blazing, badon (5 slots)
  roles: {
    tank: null,
    heal: null,
    mp: null,
    mp2: null,
    shadowcaller: null,
    blazing: null,
    flex: null,
    badon: null
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
