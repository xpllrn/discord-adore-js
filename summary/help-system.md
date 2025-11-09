# Help System

## Consistent Help Display

All commands use `runHelpCommand()` for error handling instead of inline usage strings.

### Pattern

```javascript
const { runHelpCommand } = require('../../utils/embeds/helpEmbedBuilder');

// When user makes a mistake
if (!validInput) {
  return runHelpCommand(client, message, commandName);
}
```

### What Users See
- Full paginated help embeds
- All subcommands listed
- Proper syntax and examples
- Navigation buttons
- Consistent experience

### Status
✅ 14 command files updated
✅ 34 inline usage strings replaced
✅ Validation error messages preserved (good UX)
✅ Dev folder excluded (as requested)
