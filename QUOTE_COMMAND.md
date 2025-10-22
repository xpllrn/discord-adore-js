# Quote Command Documentation

## Overview
The quote command generates aesthetic quote images with a user's Discord profile picture and their message text.

## Usage

### Method 1: Reply to a message
```
User: "I love coding!"
You: ,quote (reply to their message)
```

### Method 2: Use message ID
```
,quote 1234567890123456789
```

### Method 3: Mention user with custom text
```
,quote @username This is a custom quote text
```

## Features

- **1200x630px canvas** - Perfect for sharing
- **Dark gradient background** - Black to dark gray
- **Circular profile picture** - 350px diameter, centered on left side
- **Curved divider** - Smooth S-shaped transition between image and text
- **Text wrapping** - Automatically wraps long text (max 4 lines)
- **Typography**:
  - Quote text: 70px bold white font
  - Username: 30px italic gray font with "— username" format
- **Shadows and effects** - Subtle shadows for depth
- **Error handling** - Graceful fallbacks for missing avatars

## Technical Details

- Uses `node-canvas` for image generation
- Supports PNG output as Discord attachment
- Text limit: 500 characters (truncated with "..." if longer)
- Automatic font fallbacks: Arial, sans-serif
- Profile picture fallback: Gray circle with user's first initial

## Command Structure

- **Name**: `quote`
- **Aliases**: `q`
- **Permission**: Send Messages
- **Category**: Miscellaneous

## Error Handling

- Invalid message ID: "Could not find a message with that ID"
- Empty message content: "The message has no text content to quote"
- Missing parameters: Helpful usage instructions
- Avatar loading failure: Fallback to initial circle
- Canvas errors: Generic error message with console logging