# Command Structure Quick Reference

## 🎯 TL;DR

### Group Command Template
```javascript
module.exports = {
  name: "cmd",
  aliases: ['c'],
  description: 'Description',
  permission: 'Manage Guild', // optional
  isGroupCommand: true,
  run: async (client, message, args) => {
    if (!args[0]) return runHelpCommand(message, 'cmd');
    
    switch (args[0].toLowerCase()) {
      case 'sub': {
        const subcommandInfo = {
          description: 'What it does',
          usage: '{guildprefix}cmd sub [param]',
          aliases: [],
          example: '{guildprefix}cmd sub value'
        };
        return await handleSub(message, args);
      }
      default:
        return runHelpCommand(message, 'cmd');
    }
  }
};
```

### Single Command Template
```javascript
module.exports = {
  name: "cmd",
  aliases: ['c'],
  description: 'Description',
  syntax: 'cmd [param]',
  example: 'cmd value',
  run: async (client, message, args) => {
    // Logic
  }
};
```

## ✅ Checklist

### Group Commands
- [ ] `isGroupCommand: true`
- [ ] `subcommandInfo` in each case
- [ ] No `parameters` field
- [ ] `{guildprefix}` in usage/example
- [ ] Empty `aliases: []` if none

### Single Commands
- [ ] `syntax` field
- [ ] `example` field
- [ ] No `isGroupCommand` flag

## 🚫 Don't Include

- ❌ `parameters` field (not used)
- ❌ Hardcoded prefix in strings
- ❌ `isGroupCommand` for single commands

## ✨ Parameter Notation

- `[required]` - Must provide
- `(optional)` - Can omit
- `<a|b>` - Choose one

## 🔍 Validate

```bash
node scripts/standardize-commands.js
```

## 🔗 Alias System

### Placeholder Syntax
Use `{0}` in aliases to insert the first argument:
```
alias add pic role {0} @PicPerms
alias add shh timeout {0} 5m
```

Usage: `,pic @user` → `,role @user @PicPerms`

### Role Operations
Use `+` and `-` prefixes with role IDs:
```
alias add name role {0} +ROLEID, +ROLEID, -ROLEID
```

- `+ROLEID` - Add role (toggle if exists)
- `-ROLEID` - Force remove role

## 📖 Full Docs

See `docs/COMMAND_STANDARDS.md` for complete guide.
