# South PH Discord Bot - Architecture Documentation

## 📁 Project Structure

```
southph-bot-app/
├── app.js                      # Main entry point - minimal, clean
├── utils.js                    # Discord API utilities (unchanged)
├── commands.js                 # Slash command definitions (unchanged)
│
├── src/
│   ├── config/
│   │   ├── constants.js        # Bot configuration constants
│   │   └── contentState.js     # Content callout state management
│   │
│   ├── database/
│   │   └── guildData.js        # Per-guild prefix/permissions I/O
│   │
│   ├── utils/
│   │   ├── permissions.js      # Permission checking utilities
│   │   └── embedBuilder.js     # Help embed builder
│   │
│   ├── services/
│   │   └── contentService.js   # Content callout business logic
│   │
│   ├── events/
│   │   ├── messageCreate.js    # Message event handler
│   │   └── interactionCreate.js # Button interaction handler
│   │
│   ├── commands/
│   │   ├── prefixCommands.js   # Text command handlers (!help, !bank, etc.)
│   │   └── slashCommands.js    # Slash command handlers (/utc, /content, etc.)
│   │
│   └── systems/
│       ├── bank/
│       │   └── bank.js         # Bank economy system
│       └── ticket/
│           ├── ticket-db.js    # Ticket database operations
│           ├── ticket-system.js # Ticket system logic
│           ├── ticket-commands.js # Ticket admin commands
│           └── ticket-utils.js # Ticket utility functions
│
├── docs/                       # Documentation files
│   ├── TICKET-README.md
│   ├── TICKET-FLOW.md
│   ├── QUICK-REFERENCE.md
│   ├── IMPLEMENTATION-SUMMARY.md
│   ├── FILE-MANIFEST.md
│   └── DEPLOYMENT-CHECKLIST.md
│
├── archive/                    # Archived features
├── examples/                   # Code examples
└── app-old.js                  # Original monolithic file (backup)
```

## 🎯 Design Principles

### 1. **Minimal Entry Point**
- `app.js` is now only ~100 lines
- Handles Discord client initialization
- Loads event handlers
- Starts Express server
- No business logic

### 2. **Clear Separation of Concerns**
- **Config**: Constants and state
- **Database**: File I/O operations
- **Utils**: Helper functions
- **Services**: Business logic
- **Events**: Discord event handlers
- **Commands**: Command implementations

### 3. **No Circular Dependencies**
- Utils don't import from services
- Events import from commands/services
- Commands import from services/utils
- Linear dependency graph

### 4. **System Isolation**
- Bank and ticket systems are in `src/systems/`
- Each system has its own folder
- Self-contained modules with clear boundaries
- Easy to add new systems in the future

## 📦 Module Dependencies

```
app.js
  ├─> src/config/* (constants, state)
  ├─> src/events/messageCreate.js
  │     ├─> src/database/guildData.js
  │     ├─> src/config/contentState.js
  │     ├─> src/services/contentService.js
  │     ├─> src/commands/prefixCommands.js
  │     │     ├─> src/systems/bank/bank.js
  │     │     └─> src/systems/ticket/* (commands, system)
  │     └─> src/systems/ticket/ticket-system.js
  ├─> src/events/interactionCreate.js
  │     └─> src/systems/ticket/ticket-system.js
  └─> src/commands/slashCommands.js
        ├─> src/database/guildData.js
        ├─> src/utils/permissions.js
        ├─> src/utils/embedBuilder.js
        ├─> src/services/contentService.js
        └─> src/systems/bank/bank.js
```

## 🚀 What Was Changed

### ✅ Extracted
- Configuration constants → `src/config/constants.js`
- Content state → `src/config/contentState.js`
- Guild data I/O → `src/database/guildData.js`
- Permission checks → `src/utils/permissions.js`
- Embed builders → `src/utils/embedBuilder.js`
- Content logic → `src/services/contentService.js`
- Message handler → `src/events/messageCreate.js`
- Interaction handler → `src/events/interactionCreate.js`
- Prefix commands → `src/commands/prefixCommands.js`
- Slash commands → `src/commands/slashCommands.js`

### ❌ Not Changed
- `bank.js` - Working bank system
- `ticket-db.js` - Working ticket database
- `ticket-system.js` - Working ticket logic
- `ticket-commands.js` - Working ticket commands
- `ticket-utils.js` - Working ticket utilities
- `utils.js` - Working Discord API wrapper
- `commands.js` - Working slash command registry

### 📝 Documentation
- Moved 6 markdown files → `docs/`
- Kept `README.md` in root
- Created `app-old.js` as backup

## 🔄 Runtime Behavior

### 100% Identical
- All commands work exactly the same
- All features preserved
- No logic changes
- Same API endpoints
- Same database structure
- Same permissions system

### Benefits
- ✅ Easier to find code
- ✅ Faster to debug
- ✅ Simpler to extend
- ✅ Better code reuse
- ✅ Cleaner imports
- ✅ Reduced file size (app.js: 2659 → ~100 lines)

## 🛠️ Development Guidelines

### Adding New Commands
1. **Prefix Command**: Add to `src/commands/prefixCommands.js`
2. **Slash Command**: Add to `src/commands/slashCommands.js`
3. **Command Registry**: Add to `commands.js` (if slash command)

### Adding New Features
1. **Business Logic**: Add to `src/services/`
2. **Utilities**: Add to `src/utils/`
3. **Database**: Add to `src/database/`
4. **Events**: Extend `src/events/`

### Import Guidelines
```javascript
// ✅ Good - Linear dependencies
import { CONSTANT } from './src/config/constants.js';
import { loadData } from './src/database/guildData.js';
import { checkPerm } from './src/utils/permissions.js';
import { doLogic } from './src/services/contentService.js';

// ❌ Bad - Circular dependencies
import { serviceFunc } from './services/service.js';
// in service.js: import { utilFunc } from './utils/util.js';
// in util.js: import { serviceFunc } from './services/service.js'; // CIRCULAR!
```

## 🔍 Finding Code

### "Where is the code for...?"

| Feature | File Location |
|---------|--------------|
| Bot constants | `src/config/constants.js` |
| Content state | `src/config/contentState.js` |
| Prefix/permissions I/O | `src/database/guildData.js` |
| Permission checks | `src/utils/permissions.js` |
| Help embed | `src/utils/embedBuilder.js` |
| Content embeds | `src/services/contentService.js` |
| Text commands | `src/commands/prefixCommands.js` |
| Slash commands | `src/commands/slashCommands.js` |
| Message events | `src/events/messageCreate.js` |
| Button clicks | `src/events/interactionCreate.js` |
| Bank system | `bank.js` (unchanged) |
| Ticket system | `ticket-*.js` (unchanged) |

## 🧪 Testing

### Before Deployment
1. ✅ Check all imports are correct
2. ✅ Test prefix commands (!help, !bank, etc.)
3. ✅ Test slash commands (/utc, /content, etc.)
4. ✅ Test content threads (ROA, CTA, FF, etc.)
5. ✅ Test ticket system (apply, claim, approve, close)
6. ✅ Test permissions system
7. ✅ Test bank system

### Rollback Plan
If issues occur:
```bash
# Restore original file
mv app-old.js app.js
# Restart bot
npm start
```

## 📚 Additional Resources

- Original implementation: `app-old.js` (backup)
- Ticket documentation: `docs/TICKET-*.md`
- Deployment guide: `docs/DEPLOYMENT-CHECKLIST.md`
- Quick reference: `docs/QUICK-REFERENCE.md`
