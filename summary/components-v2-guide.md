# Discord Components V2 - Complete Guide

## What is Components V2?

Components V2 is Discord's modern message format that replaces traditional embeds. It provides better layouts, integrated buttons, and a cleaner mobile experience.

## Quick Start

**Old way (embeds):**
```
{embed}$v{title: Hello}$v{description: World}
```

**New way (Components V2):**
```
{v2}$v{text: # Hello}$v{text: World}
```

Or use `{container}` instead of `{v2}`:
```
{container}$v{text: # Hello}$v{text: World}
```

## Basic Syntax

```
{v2}$v{parameter: content}$v{parameter: content}
```

- Start with `{v2}` or `{container}`
- Separate each parameter with `$v`
- Format: `{parameter: content}`
- All embed variables work (`{user}`, `{guild.name}`, etc.)

---

## Available Parameters

### `{text: content}`
Displays text content. Supports full markdown formatting.

**Examples:**
```
{v2}$v{text: # This is a heading}
{v2}$v{text: **Bold text** and *italic text*}
{v2}$v{text: Regular paragraph}
{v2}$v{text: `code` and [links](https://discord.com)}
```

**Markdown support:**
- `# Heading` - Large heading
- `## Heading` - Medium heading  
- `### Heading` - Small heading
- `**bold**` - Bold text
- `*italic*` - Italic text
- `` `code` `` - Inline code
- `[text](url)` - Links
- `<@userid>` - User mentions
- `<#channelid>` - Channel mentions
- `<t:timestamp:R>` - Timestamps

**Multiple text blocks:**
```
{v2}$v{text: First paragraph}$v{text: Second paragraph}$v{text: Third paragraph}
```


---

### `{color: hex}`
Sets the accent color (left border) of the container.

**Format:** `{color: #0099ff}` or `{color: 0099ff}`

**Examples:**
```
{v2}$v{color: #ff0000}$v{text: # Error Message}
{v2}$v{color: #00ff00}$v{text: # Success!}
{v2}$v{color: #ffaa00}$v{text: # Warning}
```

**Common colors:**
- `#0099ff` - Blue
- `#ff0000` - Red (errors)
- `#00ff00` - Green (success)
- `#ffaa00` - Orange (warnings)
- `#9b59b6` - Purple
- `#e91e63` - Pink

---

### `{section: text1&&text2&&text3&&image_url}`
Creates a section with up to 3 text displays and an optional thumbnail image.

**Format:** `{section: text1&&text2&&text3&&https://image.url}`

**Examples:**

**Section with thumbnail:**
```
{v2}$v{section: **User Profile**&&Level 42&&Joined 2 days ago&&{user.avatar}}
```

**Section without thumbnail:**
```
{v2}$v{section: **Important**&&Please read carefully&&Thank you}
```

**With only 1 text:**
```
{v2}$v{section: **Server Info**&&https://example.com/icon.png}
```

**Tips:**
- Separate parts with `&&`
- Last part is thumbnail if it's a URL (starts with http:// or https://)
- Up to 3 text displays
- Thumbnail appears on the right side
- Great for profile cards

---

### `{author: name&&icon_url}`
Displays author information at the top.

**Format:** `{author: Author Name&&https://icon.url}`

**Examples:**

**With icon:**
```
{v2}$v{author: {user}&&{user.avatar}}$v{text: Welcome message here}
```

**Without icon:**
```
{v2}$v{author: Admin Team}$v{text: Important announcement}
```

**Tips:**
- Icon URL is optional
- Shows as bold text with optional thumbnail
- Good for attribution

---


### `{thumbnail: url}`
Displays a small thumbnail image.

**Format:** `{thumbnail: https://image.url}`

**Examples:**
```
{v2}$v{text: # User Profile}$v{thumbnail: {user.avatar}}
{v2}$v{text: Server icon}$v{thumbnail: {guild.icon}}
```

**Tips:**
- Must be valid image URL
- Works with variables
- Appears as small image in a section

---

### `{image: url}`
Displays a large image.

**Format:** `{image: https://image.url}`

**Examples:**
```
{v2}$v{text: # Check this out!}$v{image: https://i.imgur.com/example.png}
{v2}$v{image: {user.display_avatar}}
```

**Tips:**
- Must be valid image URL
- Displays as full-width image
- Works with variables

---

### `{gallery: url1&&url2&&url3}`
Displays multiple images in a grid layout.

**Format:** `{gallery: url1&&url2&&url3&&...}`

**Examples:**
```
{v2}$v{text: # Photo Gallery}$v{gallery: https://i.imgur.com/1.png&&https://i.imgur.com/2.png&&https://i.imgur.com/3.png}
```

**Tips:**
- Separate URLs with `&&`
- Supports up to 10 images
- All URLs must be valid image URLs
- Images display in grid
- Perfect for showcasing multiple images

---

### `{footer: text}`
Displays small footer text at the bottom.

**Format:** `{footer: Footer text here}`

**Examples:**
```
{v2}$v{text: # Announcement}$v{text: Important update}$v{footer: Posted by Admin Team}
{v2}$v{text: Message}$v{footer: Server ID: {guild.id}}
```

**Tips:**
- Automatically formatted as small text
- Appears at bottom of container
- Good for timestamps, credits, notes

---


### `{separator}`
Adds vertical spacing between components.

**Format:** `{separator}`

**Examples:**
```
{v2}$v{text: First section}$v{separator}$v{text: Second section}
```

**Tips:**
- No parameters needed
- Creates visual separation
- Makes messages easier to read

---

### `{separator.line}`
Adds spacing with a visible horizontal line.

**Format:** `{separator.line}`

**Examples:**
```
{v2}$v{text: # Section 1}$v{separator.line}$v{text: # Section 2}
{v2}$v{text: Above}$v{separator.line}$v{text: Below}
```

**Tips:**
- Shows horizontal divider line
- More prominent than regular separator
- Use for major section breaks

---

### `{timestamp}`
Adds current timestamp at the bottom.

**Format:** `{timestamp}`

**Examples:**
```
{v2}$v{text: # Announcement}$v{text: Important update}$v{timestamp}
```

**Result:** Shows relative time like "2 minutes ago"

**Tips:**
- No parameters needed
- Automatically uses current time
- Formatted as small footer text
- Shows as relative timestamp

---


### `{button: style&&label&&emoji&&disabled}`
Adds an interactive button.

**Format:** `{button: style&&label&&emoji&&disabled}`

**Parameters:**
- `style` - Button color or URL
- `label` - Button text (required)
- `emoji` - Optional emoji
- `disabled` - Optional: use `disabled` to make unclickable

**Button styles:**
- `primary` or `blurple` - Blue button
- `secondary`, `grey`, or `gray` - Gray button (default)
- `success` or `green` - Green button
- `danger` or `red` - Red button
- `https://...` - Link button (opens URL)

**Examples:**

**Basic buttons:**
```
{v2}$v{text: Click a button}$v{button: primary&&Click Me}
{v2}$v{button: success&&Accept}$v{button: danger&&Decline}
```

**Buttons with emojis:**
```
{v2}$v{button: primary&&Like&&👍}
{v2}$v{button: success&&Accept&&✅}
{v2}$v{button: danger&&Delete&&🗑️}
```

**Disabled button:**
```
{v2}$v{button: secondary&&Locked&&🔒&&disabled}
```

**Link button:**
```
{v2}$v{button: https://discord.com&&Visit Discord&&🌐}
```

**Multiple buttons:**
```
{v2}$v{text: # Choose an option}$v{button: primary&&Option 1&&1️⃣}$v{button: success&&Option 2&&2️⃣}$v{button: danger&&Cancel&&❌}
```

**Tips:**
- Up to 25 buttons per container
- Buttons appear in rows of 5
- Emojis can be Unicode (👍) or custom (`<:name:id>`)
- Link buttons don't trigger bot interactions
- Regular buttons generate unique IDs automatically

---

### `{message: text}` or `{content: text}`
Adds regular message text outside the container.

**Format:** `{message: text}` or `{content: text}`

**Examples:**
```
{v2}$v{message: Hey {user}!}$v{text: # Welcome}
{v2}$v{content: @everyone New announcement}$v{text: Read below}
```

**Result:**
```
Hey @User!
[Container appears here]
```

**Tips:**
- Appears above the container
- Use for mentions or quick messages
- Supports all variables
- `{message}` and `{content}` are the same

---


## Complete Examples

### Example 1: Simple Welcome Message

**Embed version:**
```
{embed}$v{title: Welcome!}$v{description: Thanks for joining {guild.name}}$v{color: #0099ff}
```

**Components V2 version:**
```
{v2}$v{text: # Welcome!}$v{text: Thanks for joining {guild.name}}$v{color: #0099ff}
```

---

### Example 2: User Profile

**Components V2:**
```
{v2}$v{color: #9b59b6}$v{section: **{user}**&&Level 42 • 1337 XP&&Joined <t:{user.joined_timestamp}:R>&&{user.avatar}}$v{separator}$v{text: **Stats**}$v{text: Messages: 5,234 • Voice Time: 48h}
```

---

### Example 3: Server Info with Thumbnail

**Components V2:**
```
{v2}$v{color: #0099ff}$v{author: {guild.name}&&{guild.icon}}$v{separator}$v{text: **Members:** {guild.count}}$v{text: **Channels:** 50}$v{text: **Roles:** 25}$v{footer: Server ID: {guild.id}}
```

---

### Example 4: Announcement with Buttons

**Components V2:**
```
{v2}$v{color: #ff0000}$v{text: # 🎉 Giveaway Time!}$v{text: React to enter the giveaway}$v{text: Prize: Discord Nitro}$v{separator.line}$v{text: Ends <t:1234567890:R>}$v{button: primary&&Enter Giveaway&&🎁}$v{button: secondary&&Rules&&📜}
```

---

### Example 5: Image Gallery

**Components V2:**
```
{v2}$v{text: # Photo Gallery}$v{text: Check out these amazing screenshots!}$v{gallery: https://i.imgur.com/1.png&&https://i.imgur.com/2.png&&https://i.imgur.com/3.png}$v{footer: Uploaded by {user}}
```

---

### Example 6: Moderation Log

**Components V2:**
```
{v2}$v{color: #ff0000}$v{text: # Member Banned}$v{separator}$v{text: **User:** {user} ({user.id})}$v{text: **Reason:** Spamming}$v{text: **Moderator:** {user}}$v{timestamp}
```

---

### Example 7: Multiple Sections

**Components V2:**
```
{v2}$v{color: #0099ff}$v{text: # Server Statistics}$v{separator.line}$v{section: **Members**&&Total: {guild.count}&&Online: 234}$v{separator}$v{section: **Activity**&&Messages Today: 1,234&&Voice Active: 45}$v{separator}$v{section: **Growth**&&New Members: 12&&Boost Level: {guild.boost_tier}}
```

---


## Migration from Embeds

### Embed → Components V2 Conversion

| Embed Parameter | Components V2 Equivalent |
|----------------|-------------------------|
| `{title: text}` | `{text: # text}` (use markdown heading) |
| `{description: text}` | `{text: text}` |
| `{color: #hex}` | `{color: #hex}` |
| `{thumbnail: url}` | `{thumbnail: url}` |
| `{image: url}` | `{image: url}` |
| `{author: name&&icon}` | `{author: name&&icon}` |
| `{footer: text}` | `{footer: text}` |
| `{field: name&&value&&false}` | `{text: **name**\nvalue}` |
| `{field: name&&value&&true}` | `{text: **name:** value}` |
| `{timestamp}` | `{timestamp}` |

**Note:** Components V2 doesn't have separate `title` or `description` parameters. Use `{text}` with markdown formatting instead.

### Converting Fields

Embeds have fields, Components V2 uses text with markdown:

**Embed fields:**
```
{embed}$v{field: Username&&JohnDoe&&false}$v{field: Level&&42&&true}$v{field: XP&&1337&&true}
```

**Components V2 equivalent:**
```
{v2}$v{text: **Username**\nJohnDoe}$v{text: **Level:** 42 • **XP:** 1337}
```

**Tips:**
- Use `\n` for line breaks
- Use `**bold:**` for field names
- Use `•` or `|` to separate inline values
- Use `{separator}` between sections

---

## Common Patterns

### Pattern 1: Title + Description + Color

```
{v2}$v{color: #0099ff}$v{text: # Main Title}$v{text: Description text here}
```

---

### Pattern 2: Profile Card

```
{v2}$v{color: #9b59b6}$v{section: **{user}**&&Level {level.rank}&&{user.avatar}}$v{separator}$v{text: **Stats:** Messages: 1,234 • Voice: 48h}
```

---

### Pattern 3: Info List

```
{v2}$v{text: # Server Info}$v{separator.line}$v{text: **Name:** {guild.name}}$v{text: **Members:** {guild.count}}$v{text: **Created:** <t:{guild.created_at_timestamp}:R>}
```

---

### Pattern 4: Announcement with Image

```
{v2}$v{color: #ff0000}$v{text: # 🎉 Announcement}$v{text: Important update for everyone}$v{image: https://example.com/banner.png}$v{footer: Posted by Admin}
```

---

### Pattern 5: Multiple Buttons

```
{v2}$v{text: # Choose your role}$v{separator}$v{button: primary&&Gaming&&🎮}$v{button: success&&Art&&🎨}$v{button: danger&&Music&&🎵}$v{button: secondary&&Other&&📌}
```

---


## All Variables (Work in Both Embeds and V2)

### User Variables
- `{user}` - User display name
- `{user.mention}` - @mention
- `{user.name}` - Username
- `{user.id}` - User ID
- `{user.display_name}` - Display name
- `{user.tag}` - User tag
- `{user.avatar}` - Avatar URL
- `{user.display_avatar}` - Display avatar URL
- `{user.joined}` - Join date
- `{user.joined_timestamp}` - Join timestamp
- `{user.created}` - Account creation date
- `{user.created_timestamp}` - Account creation timestamp
- `{user.boost}` - Boost status (Yes/No)
- `{user.color}` - Role color

### Guild/Server Variables
- `{guild.name}` - Server name
- `{guild.id}` - Server ID
- `{guild.count}` - Member count
- `{member.count}` - Member count (alias)
- `{guild.icon}` - Server icon URL
- `{guild.banner}` - Server banner URL
- `{guild.owner_id}` - Owner ID
- `{guild.created_at}` - Creation date
- `{guild.created_at_timestamp}` - Creation timestamp
- `{guild.boost_count}` - Boost count
- `{guild.boost_tier}` - Boost tier
- `{guild.role_count}` - Number of roles
- `{guild.emoji_count}` - Number of emojis
- `{guild.vanity}` - Vanity URL code

### Channel Variables
- `{channel.name}` - Channel name
- `{channel.id}` - Channel ID
- `{channel.mention}` - #mention
- `{channel.topic}` - Channel topic
- `{channel.type}` - Channel type

### Time Variables
- `{time.now}` - Current time (12h)
- `{time.now_millitary}` - Current time (24h)
- `{time.now_timestamp}` - Current timestamp

### Level Variables (if applicable)
- `{level.new_rank}` - New level/rank
- `{level.rank}` - Current rank

---

## Troubleshooting

### "Invalid container code"
- Check that you start with `{v2}` or `{container}`
- Make sure all `{` have matching `}`
- Separate parameters with `$v`
- Use format `{parameter: content}`

### Buttons not showing
- Check button format: `{button: style&&label}`
- Make sure style is valid: `primary`, `secondary`, `success`, `danger`, or URL
- Label is required
- Emoji and disabled are optional

### Images not displaying
- URL must start with `http://` or `https://`
- Check that URL is a direct image link
- Variables like `{user.avatar}` must resolve to valid URLs

### Text not formatting
- Use `#` for headings: `{text: # Heading}`
- Use `**bold**` for bold text
- Use `*italic*` for italic
- Use `\n` for line breaks

### Colors not working
- Use hex format: `{color: #0099ff}` or `{color: 0099ff}`
- Don't use color names, use hex codes

---

## Quick Reference

**Minimal container:**
```
{v2}$v{text: Hello World}
```

**With color:**
```
{v2}$v{color: #0099ff}$v{text: # Title}$v{text: Description}
```

**With button:**
```
{v2}$v{text: Click below}$v{button: primary&&Click Me}
```

**With image:**
```
{v2}$v{text: # Check this out}$v{image: https://example.com/image.png}
```

**With variables:**
```
{v2}$v{text: # Welcome {user}!}$v{text: You joined {guild.name}}
```

**Full example:**
```
{v2}$v{color: #0099ff}$v{author: {guild.name}&&{guild.icon}}$v{separator}$v{text: # Welcome {user}!}$v{text: Thanks for joining our community}$v{separator}$v{text: **Members:** {guild.count}}$v{button: primary&&Get Started&&🚀}$v{footer: Joined <t:{time.now_timestamp}:R>}
```

---

**Remember:** Components V2 is the future! Start using `{v2}` instead of `{embed}` for modern, flexible messages.
