# Cache and Database System Documentation

## Overview

The bot uses a **write-through caching strategy** with intelligent cache management to optimize database operations while maintaining data consistency.

## Architecture

```
┌─────────────────┐
│  Command Layer  │  (work.js, buy.js, etc.)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Service Layer   │  (UserService, GuildService, etc.)
│  - Business     │
│    Logic        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  BaseService    │  (Cache + DB coordination)
│  - set()        │
│  - get()        │
│  - delete()     │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌──────────┐
│ Cache  │ │ MongoDB  │
│(Memory)│ │ (Disk)   │
└────────┘ └──────────┘
```

## Core Components

### 1. SmartCache (database/services/core/SmartCache.js)

**Purpose**: In-memory LRU cache with TTL management

**Features**:
- **LRU Eviction**: Automatically removes least recently used items when cache is full
- **TTL Management**: Items expire after configured time (default: 45 minutes for users)
- **Statistics Tracking**: Monitors hits, misses, evictions
- **Memory Management**: Configurable max size (10,000 users by default)

**Key Methods**:
```javascript
cache.set(key, value, customTTL)  // Store value with optional TTL
cache.get(key)                     // Retrieve value (null if not found)
cache.invalidate(key)              // Remove specific entry
cache.clear()                      // Remove all entries
cache.getStats()                   // Get performance metrics
```

**How it Works**:
- Each entry stores: `{ value, timestamp, accessed, accessCount }`
- Access order tracked for LRU eviction
- Automatic cleanup via setTimeout for TTL
- Updates access metadata on every `get()`

### 2. BaseService (database/services/core/BaseService.js)

**Purpose**: Abstract base class providing cache + database coordination

**Strategy**: Write-Through Caching
- Writes go to database FIRST, then cache
- Reads check cache FIRST, then database
- Ensures cache never has data that's not in database

**Key Methods**:

#### `set(key, data, customTTL)`
**Write-Through Strategy**:
```javascript
async set(key, data, customTTL) {
  // Step 1: Write to database FIRST
  await this.writeToDatabase(key, data);
  
  // Step 2: Update cache ONLY after successful DB write
  this.cache.set(key, data, customTTL);
  
  return true;
}
```

**Error Handling**:
- If DB write fails → cache is invalidated
- Transient errors (network issues) → retry up to 2 times
- Permanent errors (validation) → throw immediately

#### `get(key)`
**Cache-First Strategy**:
```javascript
async get(key) {
  // Step 1: Try cache first
  const cached = this.cache.get(key);
  if (cached !== null) {
    return cached;  // Cache hit!
  }

  // Step 2: Cache miss - fetch from database
  const data = await this.readFromDatabase(key);
  
  // Step 3: Cache the result if found
  if (data !== null) {
    this.cache.set(key, data);
  }
  
  return data;
}
```

#### `delete(key)`
```javascript
async delete(key) {
  // Remove from cache immediately
  this.cache.invalidate(key);
  
  // Remove from database
  await this.deleteFromDatabase(key);
  
  return true;
}
```

#### `batchGet(keys[])`
**Optimized Batch Operations**:
```javascript
async batchGet(keys) {
  // 1. Check cache for all keys
  // 2. Batch fetch cache misses from DB
  // 3. Cache all DB results
  // 4. Return combined results
}
```

### 3. UserService (database/services/UserService.js)

**Purpose**: User-specific business logic extending BaseService

**Configuration**:
```javascript
constructor() {
  super({
    modelName: 'User',
    keyField: 'UserID',
    database: 'global',
    ttl: 45 * 60 * 1000,  // 45 minutes
    maxSize: 10000         // 10,000 users
  });
}
```

**Database Operations** (implements BaseService abstract methods):

```javascript
// Write to MongoDB
async writeToDatabase(key, data) {
  await Model.updateOne(
    { UserID: key },
    { $set: data },
    { upsert: true }
  );
}

// Read from MongoDB
async readFromDatabase(key) {
  return await Model.findOne({ UserID: key }).lean();
}

// Delete from MongoDB
async deleteFromDatabase(key) {
  await Model.deleteOne({ UserID: key });
}
```

## How to Use the System Correctly

### ✅ CORRECT Pattern (Used by all methods)

```javascript
async updateWallet(userId, amount) {
  // 1. Get data (cache-first)
  const userData = await this.ensureUserData(userId);
  const gambling = userData.Gambling || this.getDefaultGamblingData();
  
  // 2. Modify in memory
  gambling.wallet = Math.max(0, (gambling.wallet || 0) + amount);
  userData.Gambling = gambling;
  
  // 3. Save (write-through: DB first, then cache)
  await this.set(userId, userData);
  
  return true;
}
```

**Why this works**:
- ✅ Uses cache system properly
- ✅ Write-through ensures consistency
- ✅ Cache automatically updated
- ✅ Follows established pattern

### ❌ INCORRECT Pattern (Don't do this!)

```javascript
// BAD: Bypasses cache system
async updateWallet(userId, amount) {
  await Model.findOneAndUpdate(
    { UserID: userId },
    { $inc: { 'Gambling.wallet': amount }}
  );
  
  this.invalidateCache(userId);  // Cache now stale until next read!
}
```

**Why this is wrong**:
- ❌ Bypasses write-through cache
- ❌ Cache invalidated but not updated
- ❌ Next read will be cache miss (slower)
- ❌ Breaks consistency guarantees
- ❌ Doesn't follow established pattern

## Data Flow Examples

### Example 1: User Uses Work Command

```
1. User types: ,work

2. work.js calls:
   gambling = await userService.getGamblingData(userId)
   
3. UserService.getGamblingData():
   userData = await this.get(userId)  // Cache-first read
   
4. BaseService.get():
   - Check cache → MISS (first time)
   - Read from MongoDB
   - Cache the result
   - Return data
   
5. work.js calculates earnings:
   earnings = 2500 coins
   
6. work.js calls:
   await userService.updateWallet(userId, 2500)
   
7. UserService.updateWallet():
   - Get userData (cache HIT this time!)
   - Modify: wallet += 2500
   - Call this.set(userId, userData)
   
8. BaseService.set():
   - Write to MongoDB FIRST
   - Update cache AFTER successful write
   - Return success
   
9. User sees success message
```

### Example 2: Admin Adds Balance

```
1. Admin types: ,eco addbal @user 10000

2. eco.js calls:
   await userService.updateWallet(userId, 10000)
   
3. UserService.updateWallet():
   - Get userData from cache/DB
   - Modify: wallet += 10000
   - Call this.set(userId, userData)
   
4. BaseService.set():
   - Write to MongoDB (wallet now 11000)
   - Update cache (wallet now 11000)
   
5. User immediately uses ,work:
   - Reads from cache (wallet: 11000) ✅ Correct!
   - Adds earnings: wallet = 13500
   - Writes back to DB and cache
   
Result: No data loss! Cache stays consistent.
```

### Example 3: Purchase Transaction

```
1. User types: ,buy 1 2 (buy 2 banknotes)

2. buy.js:
   - Check balance: 50000 coins
   - Show confirmation button
   
3. User clicks confirm

4. buy.js (in confirmation handler):
   a) Re-check balance (in case it changed)
   b) Deduct money:
      await userService.updateWallet(userId, -40000)
      → Reads userData from cache
      → Modifies wallet: 50000 - 40000 = 10000
      → Writes to DB and cache
      
   c) Add items:
      await userService.addInventoryItem(userId, item)
      → Reads userData from cache (wallet: 10000)
      → Adds items to inventory
      → Writes to DB and cache
      
5. If step (c) fails:
   - Refund: await userService.updateWallet(userId, 40000)
   - User gets money back
   
Result: Transaction completes successfully or fully rolls back.
```

## Cache Performance

### Cache Hit Rates

**Expected Performance**:
- First access: Cache MISS (must read from DB)
- Subsequent accesses: Cache HIT (instant, no DB query)
- After 45 minutes: Cache expires, next access is MISS

**Typical Hit Rates**:
- Active users: 95%+ hit rate
- Inactive users: Lower hit rate (TTL expiration)
- Overall: 80-90% hit rate

### Memory Usage

**Per User Entry** (approximate):
- User ID: ~20 bytes
- User data: ~2-5 KB (varies by data)
- Cache metadata: ~100 bytes
- **Total**: ~2-5 KB per user

**With 10,000 users cached**:
- Memory usage: ~20-50 MB
- Very reasonable for modern servers

### When Cache is Cleared

1. **TTL Expiration**: After 45 minutes of no access
2. **LRU Eviction**: When cache is full (10,000 users)
3. **Manual Invalidation**: When `invalidateCache()` is called
4. **Service Restart**: All cache cleared on bot restart

## Race Conditions

### Are They a Problem?

**Short Answer**: Not really, for Discord bots.

**Why**:
1. Most operations are user-initiated and sequential
2. Users can't click buttons simultaneously
3. Discord has rate limits preventing spam
4. Cache system handles consistency

### When They Could Occur

**Scenario**: User clicks buy button twice very quickly

**What Happens**:
```
Request A: Read balance (1000) → Deduct 500 → Write (500)
Request B: Read balance (1000) → Deduct 300 → Write (700)
```

**Result**: Request B overwrites Request A's change.

**Mitigation**:
1. **Button Disabling**: Buttons are disabled after first click
2. **Cooldowns**: Commands have cooldowns
3. **Re-checking**: Buy command re-checks balance before deducting
4. **User Behavior**: Users don't typically spam commands

### If You Need True Atomicity

For critical operations requiring true atomicity, use MongoDB's atomic operators directly, but you must handle cache properly:

```javascript
// Option 1: Use atomic operation + invalidate cache
async atomicIncrement(userId, field, amount) {
  await Model.findOneAndUpdate(
    { UserID: userId },
    { $inc: { [field]: amount }}
  );
  
  // Invalidate cache - next read will fetch fresh data
  this.invalidateCache(userId);
}

// Option 2: Use transactions (MongoDB 4.0+)
async transactionExample(userId) {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    // Do multiple operations
    await Model.updateOne({...}, {...}, { session });
    await OtherModel.updateOne({...}, {...}, { session });
    
    await session.commitTransaction();
    
    // Invalidate all affected caches
    this.invalidateCache(userId);
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}
```

**Important**: If you bypass `this.set()`, you MUST invalidate cache!

## Best Practices

### ✅ DO

1. **Always use `this.set()` for writes**
   ```javascript
   await this.set(userId, userData);
   ```

2. **Always use `this.get()` for reads**
   ```javascript
   const userData = await this.get(userId);
   ```

3. **Use `ensureUserData()` to guarantee user exists**
   ```javascript
   const userData = await this.ensureUserData(userId);
   ```

4. **Follow the established pattern**
   - Get data
   - Modify in memory
   - Save with `this.set()`

5. **Use batch operations for multiple users**
   ```javascript
   const usersMap = await this.batchGet(userIds);
   ```

### ❌ DON'T

1. **Don't bypass the cache system**
   ```javascript
   // BAD
   await Model.findOneAndUpdate(...);
   ```

2. **Don't forget to invalidate if you must bypass**
   ```javascript
   // If you MUST use direct MongoDB operations
   await Model.updateOne(...);
   this.invalidateCache(userId);  // Required!
   ```

3. **Don't modify cached objects directly**
   ```javascript
   // BAD
   const userData = await this.get(userId);
   userData.wallet += 100;  // Modifies cache!
   // No this.set() call = cache and DB out of sync
   ```

4. **Don't assume cache is always fresh**
   - Cache can expire (TTL)
   - Cache can be evicted (LRU)
   - Always use `this.get()` which handles cache misses

## Debugging Cache Issues

### Check Cache Stats

```javascript
const userService = getService('user');
const stats = userService.getCacheStats();
console.log(stats);
```

**Output**:
```javascript
{
  hits: 15234,
  misses: 892,
  sets: 1045,
  evictions: 12,
  expirations: 234,
  size: 8456,
  hitRate: '94.48%',
  name: 'User'
}
```

### Common Issues

**Issue**: "Money disappeared after admin added it"
- **Cause**: Admin command bypassed cache system
- **Solution**: Use `userService.updateWallet()` instead of direct MongoDB

**Issue**: "Changes not showing up"
- **Cause**: Forgot to call `this.set()` after modifying data
- **Solution**: Always call `this.set()` after modifications

**Issue**: "Old data showing up"
- **Cause**: Cache not invalidated after direct DB operation
- **Solution**: Call `this.invalidateCache(key)` after direct operations

**Issue**: "High memory usage"
- **Cause**: Too many users cached
- **Solution**: Reduce `maxSize` in service constructor

## Performance Tips

1. **Use batch operations** when working with multiple users
2. **Don't clear cache unnecessarily** - let TTL handle it
3. **Monitor cache hit rates** - should be 80%+
4. **Adjust TTL** based on your needs (longer = better hit rate, more memory)
5. **Use `ensureUserData()`** instead of checking if user exists

## Summary

The cache and database system is designed to:
- ✅ Optimize performance (reduce DB queries)
- ✅ Maintain consistency (write-through strategy)
- ✅ Handle failures gracefully (automatic retry, invalidation)
- ✅ Scale efficiently (LRU eviction, TTL management)
- ✅ Be easy to use (simple get/set interface)

**Golden Rule**: Always use `this.get()` and `this.set()` - they handle everything for you!
