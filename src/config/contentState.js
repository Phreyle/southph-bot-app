// Storage for content state (in production, use a database)
export const contentState = {
  active: false,
  messageId: null,
  channelId: null,
  threadId: null,
  title: '',
  time: '',
  demassNotice: '',
  activeRoles: [], // Ordered array of role keys chosen during /content create
  roles: {},       // roleKey -> userId | null — populated dynamically from activeRoles
  fill: []         // User IDs in fill queue
};

// Temporary in-progress creation state, keyed by userId
// Cleared after successful modal submit
export const pendingCreations = new Map(); // userId -> { partySize: Number, roles?: string[] }
