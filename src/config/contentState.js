// Storage for content state (in production, use a database)
export const contentState = {
  active: false,
  messageId: null,
  channelId: null,
  threadId: null,
  title: '',
  time: '',
  demassNotice: '',
  activeRoles: [],      // Ordered array of role keys chosen during /content create
  roles: {},            // roleKey -> userId | null — populated dynamically from activeRoles
  fill: [],             // User IDs in fill queue
  customRoleNames: {}   // roleKey -> display label (for custom-named roles)
};

// Temporary in-progress creation state, keyed by userId.
// Cleared after successful publish.
// Shape: {
//   partySize: Number,
//   method: 'custom' | 'dropdown' | null,
//   assignedRoles: string[],   // role keys in slot order
//   customRoleNames: {},       // 'custom_0' -> 'Bomb Squad' etc.
//   currentSlot: Number,       // next slot index to fill (0-based)
//   customBatchStart: Number,  // first slot index of the next custom modal batch
//   title: string,             // set after content_create_modal submit
//   time: string,
//   demassNotice: string,
// }
export const pendingCreations = new Map();
