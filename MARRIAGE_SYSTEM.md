# Marriage System Implementation

## Overview
A complete marriage system has been added to the bot with rings, proposals, and tracking.

## Database Changes

### User Model (`database/models/user.js`)
Added two new fields:

1. **Marriage** - Stores marriage data
   - `partnerId`: ID of married partner
   - `marriedAt`: Date of marriage
   - `ringId`: ID of ring used for marriage

2. **Inventory** - Stores purchased items
   - `id`: Item ID
   - `name`: Item name
   - `quantity`: Item quantity
   - `category`: Item category
   - `addedAt`: Date added

## Store Items

### Rings Added (`database/services/features/StoreService.js`)
Five new rings available in the store:

| ID | Name | Price | Emoji |
|----|------|-------|-------|
| 8 | Copper Ring | 1,000 | 💍 |
| 9 | Silver Ring | 10,000 | 💍 |
| 10 | Gold Ring | 100,000 | 💍 |
| 11 | Platinum Ring | 1,000,000 | 💍 |
| 12 | Diamond Ring | 10,000,000 | 💎 |

## Commands

### 1. `marry <user> [ring]` (aliases: `propose`)
Propose marriage to another user with a ring from your inventory.

**Features:**
- Requires a ring in inventory
- Can specify which ring to use by ID or name
- If no ring specified, automatically uses the most expensive ring
- Target user must accept the proposal
- Prevents self-marriage and bot marriage
- Checks if either user is already married
- Removes ring from inventory on acceptance

**Examples:**
```
,marry @vwsn
,marry @vwsn 12
,marry @vwsn diamond ring
,marry @vwsn gold
```

### 2. `married [user]` (aliases: `marriage`)
Check marriage status and duration.

**Features:**
- Shows partner name
- Displays ring used
- Shows marriage date with timestamp
- Calculates duration in days and hours
- Can check own or other user's status

**Example:**
```
,married
,married @vwsn
```

### 3. `edaters` (aliases: `marriages`, `couples`)
List all married couples in the server.

**Features:**
- Shows all marriages where both partners are in the server
- Displays ring used for each marriage
- Shows when they got married (relative time)
- Sorted by marriage date (oldest first)
- Shows total couple count

**Example:**
```
,edaters
```

### 4. `divorce` (aliases: `unmarry`)
End your current marriage.

**Features:**
- Requires confirmation
- Removes marriage data from both users
- Cannot be undone
- Ring is not returned

**Example:**
```
,divorce
```

## Usage Flow

1. **Buy a ring:**
   ```
   ,store rings
   ,buy 8
   ```

2. **Propose to someone:**
   ```
   ,marry @partner
   ,marry @partner diamond ring
   ```

3. **Partner accepts the proposal** (clicks confirm button)

4. **Check marriage status:**
   ```
   ,married
   ```

5. **View all couples in server:**
   ```
   ,edaters
   ```

6. **Divorce (if needed):**
   ```
   ,divorce
   ```

## Technical Notes

- All commands are in the `commands/gamble/` folder
- Marriage data is stored in the User model (global database)
- Rings cannot be used with the `use` command - they're only for marriage
- The system prevents duplicate marriages and validates all states
- Marriage timestamps use Discord's timestamp formatting for proper timezone display
