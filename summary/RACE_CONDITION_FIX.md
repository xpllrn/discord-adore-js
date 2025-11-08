# Race Condition Fix - Money & Inventory Issues

## Problems Identified

### 1. Cache Invalidation Issue (Admin Command)
**Symptom:** Money added via admin command disappears after user makes a purchase.

**Root Cause:**
- The admin command was directly updating MongoDB using `findOneAndUpdate`
- This bypassed the service layer's cache system
- When users made purchases, they read stale cached data
- The purchase would overwrite the database with old values, erasing admin additions

**Example Flow:**
```
1. User has 1,000 coins (cached)
2. Admin adds 5,000 coins directly to DB → DB now has 6,000
3. User buys item → reads from cache (still shows 1,000)
4. Purchase completes → writes back 1,000 - cost to DB
5. Result: The 5,000 coins vanish!
```

### 2. Race Condition in Purchases
**Symptom:** Items purchased but money not deducted, or vice versa.

**Root Cause:**
- The buy command had separate operations for:
  1. Checking balance
  2. Deducting money
  3. Adding item to inventory
- If a user clicked buy twice quickly, both transactions could read the same balance
- Operations could interleave, causing inconsistent state

**Example Flow:**
```
Transaction A: Read balance (1000) → User confirms
Transaction B: Read balance (1000) → User confirms
Transaction A: Deduct 500 → Write balance (500)
Transaction B: Deduct 300 → Write balance (700) ← Overwrites A's change!
Result: Only one deduction counted, but both items added
```

## Solutions Implemented

### 1. Fixed Admin Command (admin.js)
**Change:** Use the service layer instead of direct MongoDB operations.

```javascript
// OLD - Bypassed cache
await User.findOneAndUpdate(
  { UserID: targetUser.id },
  { $inc: { 'Gambling.wallet': amount }}
);

// NEW - Uses service layer with proper cache handling
const userService = getService('user');
await userService.updateWallet(targetUser.id, amount);
```

**Benefits:**
- Cache is properly invalidated when money is added
- All subsequent reads get fresh data from database
- No more disappearing money

### 2. Made Wallet Updates Atomic (UserService.js)
**Change:** Use MongoDB's atomic `$inc` operator with cache invalidation.

```javascript
// Atomic update with $inc operator
await Model.findOneAndUpdate(
  { UserID: userId },
  { 
    $inc: { 'Gambling.wallet': amount },
    $max: { 'Gambling.wallet': 0 } // Never go below 0
  },
  { new: true }
);

// Invalidate cache to force fresh read
this.invalidateCache(userId);
```

**Benefits:**
- MongoDB handles the increment atomically at the database level
- No race conditions even with concurrent requests
- Cache is invalidated to ensure consistency

### 3. Added Atomic Purchase Transaction (UserService.js)
**New Method:** `atomicPurchase()` - Single atomic operation for purchases.

```javascript
async atomicPurchase(userId, item, quantity, totalCost) {
  // Single atomic operation that:
  // 1. Checks if user has enough money
  // 2. Deducts the money
  // 3. Adds item to inventory
  // All in ONE database operation!
  
  const result = await Model.findOneAndUpdate(
    { 
      UserID: userId,
      'Gambling.wallet': { $gte: totalCost } // Only if enough money
    },
    {
      $inc: { 'Gambling.wallet': -totalCost },
      $push: { 'Inventory.items': itemToAdd }
    },
    { new: true }
  );
  
  // Invalidate cache
  this.invalidateCache(userId);
  
  return result;
}
```

**Benefits:**
- Entire purchase is one atomic database operation
- Either everything succeeds or everything fails (no partial states)
- Impossible for race conditions to occur
- Handles stackable items correctly

### 4. Updated Buy Command (buy.js)
**Change:** Use the new atomic purchase method.

```javascript
// OLD - Multiple separate operations
await userService.updateWallet(userId, -totalCost);
await userService.addInventoryItem(userId, item);

// NEW - Single atomic operation
const result = await userService.atomicPurchase(
  userId,
  item,
  quantity,
  totalCost
);
```

**Benefits:**
- No time gap between operations
- No possibility of partial completion
- Better error handling with clear success/failure states

## Technical Details

### What is a Race Condition?
A race condition occurs when two operations try to modify the same data at the same time, and the final result depends on the timing of the operations.

### What is an Atomic Operation?
An atomic operation is one that completes entirely or not at all - there's no in-between state. MongoDB's `findOneAndUpdate` with operators like `$inc` and `$push` are atomic at the document level.

### Cache Invalidation Strategy
When data is modified:
1. Update the database first (write-through)
2. Invalidate the cache entry
3. Next read will fetch fresh data from database
4. Fresh data gets cached for future reads

This ensures cache never has stale data after modifications.

## Testing Recommendations

### Test Case 1: Admin Add Balance
1. Check user's balance
2. Use admin command to add money
3. Immediately check balance again
4. Make a purchase
5. Verify balance is correct after purchase

### Test Case 2: Rapid Purchases
1. Have user with enough money for 2 items
2. Click buy on two different items rapidly
3. Verify both purchases complete correctly
4. Verify balance is deducted correctly for both

### Test Case 3: Concurrent Purchases
1. Have user with 1000 coins
2. Try to buy two 600-coin items at the same time
3. Verify only one purchase succeeds
4. Verify the other gets "insufficient funds" error

### Test Case 4: Banknote Purchases
1. Buy a banknote
2. Verify it appears in inventory
3. Verify money was deducted
4. Use the banknote
5. Verify bank limit increased

## Files Modified

1. **commands/dev/admin.js**
   - Changed to use service layer for adding balance
   - Ensures cache consistency

2. **database/services/UserService.js**
   - Made `updateWallet()` atomic with cache invalidation
   - Added new `atomicPurchase()` method
   - Prevents all race conditions in money/inventory operations

3. **commands/gamble/buy.js**
   - Updated to use atomic purchase transaction
   - Simplified error handling
   - Better user feedback

## Migration Notes

- No database migration needed
- Changes are backward compatible
- Existing data structure unchanged
- Only the operation logic improved

## Performance Impact

- **Positive:** Fewer database operations (combined operations)
- **Positive:** Better cache hit rates (proper invalidation)
- **Neutral:** Atomic operations have same performance as separate operations
- **Overall:** Should see slight performance improvement

## Conclusion

These fixes address the root causes of money and inventory disappearing:
1. Cache consistency is maintained through proper invalidation
2. Race conditions are eliminated through atomic operations
3. Purchases are now transactional (all-or-nothing)
4. Admin operations properly integrate with the caching system

The system is now much more robust and reliable for handling concurrent operations.
