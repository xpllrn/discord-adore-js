# Cache System

## Write-Through Caching Strategy

### Write Flow
```javascript
async set(key, data) {
  // 1. Write to database FIRST
  await this.writeToDatabase(key, data);
  
  // 2. Update cache AFTER successful write
  this.cache.set(key, data);
}
```

### Read Flow
```javascript
async get(key) {
  // 1. Check cache first
  const cached = this.cache.get(key);
  if (cached !== null) return cached;
  
  // 2. Cache miss - fetch from database
  const data = await this.readFromDatabase(key);
  
  // 3. Cache the result
  if (data !== null) this.cache.set(key, data);
  
  return data;
}
```

## Configuration

**UserService**:
- TTL: 45 minutes
- Max Size: 10,000 users
- LRU eviction when full

**GuildService**:
- TTL: 60 minutes
- Max Size: 5,000 guilds

## Best Practices

✅ **DO**:
- Always use `this.set()` for writes
- Always use `this.get()` for reads
- Use `ensureUserData()` to guarantee user exists

❌ **DON'T**:
- Don't bypass cache with direct MongoDB operations
- Don't modify cached objects without calling `this.set()`
- If you must bypass, call `this.invalidateCache(key)`

## Performance

**Expected Hit Rates**:
- Active users: 95%+ hit rate
- Overall: 80-90% hit rate

**Memory Usage**:
- ~2-5 KB per user
- 10,000 users = ~20-50 MB
