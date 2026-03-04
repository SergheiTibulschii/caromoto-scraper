# Redis Troubleshooting Guide

## Problem Solved: Redis Connection Error

### What Was Wrong?
The Redis container was stuck in a **restart loop** due to a configuration file syntax error.

**Error in logs:**
```
FATAL CONFIG FILE ERROR (Redis 7.4.8)
Reading the configuration file, at line 5
>>> 'save 900 1        # Save after 900 seconds (15 min) if at least 1 key changed'
Invalid save parameters
```

### Root Cause
Redis 7.4.8 does **not allow inline comments** on the same line as configuration directives.

**Wrong (❌):**
```conf
save 900 1        # Save after 900 seconds
```

**Correct (✅):**
```conf
# Save after 900 seconds
save 900 1
```

### The Fix
Moved all inline comments to separate lines above the configuration directives in `redis.conf`.

---

## How to Check Redis Status

### 1. Check if Docker Container is Running
```bash
docker ps | grep redis
```

**Healthy output:**
```
50d1b7416e8d   redis:7-alpine   ...   Up 2 minutes (healthy)   0.0.0.0:6379->6379/tcp   caromoto-redis
```

**Problem indicators:**
- "Restarting" status = container restart loop
- Container not listed = not running at all

### 2. Check Redis Logs
```bash
docker logs caromoto-redis --tail 50
```

**Success output (last line):**
```
* Ready to accept connections tcp
```

**Problem indicators:**
- "FATAL CONFIG FILE ERROR" = configuration syntax error
- "Permission denied" = file permission issues
- Nothing = container not running

### 3. Test Redis Connection
```bash
docker exec caromoto-redis redis-cli ping
```

**Expected output:**
```
PONG
```

---

## Common Redis Issues & Solutions

### Issue 1: Container Keeps Restarting
**Symptoms:**
- Status shows "Restarting (1) X seconds ago"
- Application can't connect

**Solution:**
```bash
# Check logs for errors
docker logs caromoto-redis --tail 50

# If config error, fix redis.conf and restart
docker restart caromoto-redis
```

### Issue 2: Connection Refused
**Symptoms:**
```
Error: Connection is closed
ECONNREFUSED 127.0.0.1:6379
```

**Solution:**
```bash
# Check if container is running
docker ps | grep redis

# If not running, start it
docker-compose up -d redis

# Or use npm script
npm run docker:up
```

### Issue 3: Port Already in Use
**Symptoms:**
```
Error: bind: address already in use
```

**Solution:**
```bash
# Find what's using port 6379
lsof -i :6379

# Option 1: Stop other Redis instance
redis-cli shutdown

# Option 2: Change port in docker-compose.yml
# Change "6379:6379" to "6380:6379"
# And update REDIS_PORT in .env to 6380
```

### Issue 4: Data Persistence Issues
**Symptoms:**
- Data lost after restart
- "Permission denied" in logs

**Solution:**
```bash
# Check volume exists
docker volume ls | grep redis

# Check volume permissions
docker exec caromoto-redis ls -la /data

# If permission issues, recreate volume
docker-compose down
docker volume rm caromoto-crawler_redis-data
docker-compose up -d
```

---

## Quick Diagnostic Commands

### Check Everything at Once
```bash
echo "=== Docker Container Status ==="
docker ps -a | grep redis

echo "\n=== Recent Logs ==="
docker logs caromoto-redis --tail 20

echo "\n=== Connection Test ==="
docker exec caromoto-redis redis-cli ping
```

### Reset Redis Completely
```bash
# Stop and remove container
docker-compose down

# Remove volume (deletes all data!)
docker volume rm caromoto-crawler_redis-data

# Start fresh
docker-compose up -d

# Wait for it to be healthy
sleep 5
docker ps | grep redis
```

---

## Configuration File Best Practices

### ✅ Good redis.conf Format
```conf
# RDB Snapshots
# Save after 900 seconds if at least 1 key changed
save 900 1

# Save after 300 seconds if at least 10 keys changed
save 300 10

# Working directory
dir /data

# AOF persistence
appendonly yes
```

### ❌ Bad redis.conf Format
```conf
save 900 1    # inline comment - will fail!
dir /data     # another inline comment - will fail!
```

---

## Startup Sequence

### Recommended Order
```bash
# 1. Start Redis
npm run docker:up

# 2. Wait for Redis to be healthy (3-5 seconds)
sleep 5

# 3. Verify Redis is ready
docker logs caromoto-redis --tail 5

# 4. Start your application
npm start
```

### Or Use Combined Script
```bash
npm run start:prod
# This does: docker-compose up -d && sleep 3 && node build/main.js
```

---

## Health Check

The `docker-compose.yml` includes a health check:

```yaml
healthcheck:
  test: ["CMD", "redis-cli", "ping"]
  interval: 5s
  timeout: 3s
  retries: 5
```

This means:
- Docker checks Redis every 5 seconds
- If "ping" fails 5 times, container is marked unhealthy
- Your app should wait for "(healthy)" status before connecting

---

## Monitoring Redis in Production

### View Real-time Logs
```bash
npm run docker:logs
# Or:
docker logs -f caromoto-redis
```

### Check Memory Usage
```bash
docker exec caromoto-redis redis-cli INFO memory
```

### Check Connected Clients
```bash
docker exec caromoto-redis redis-cli CLIENT LIST
```

### Check Keys Count
```bash
docker exec caromoto-redis redis-cli DBSIZE
```

---

## Emergency Commands

### Force Stop Redis
```bash
docker stop caromoto-redis
```

### Force Remove Container
```bash
docker rm -f caromoto-redis
```

### Start Redis Without docker-compose
```bash
docker run -d \
  --name caromoto-redis \
  -p 6379:6379 \
  -v redis-data:/data \
  redis:7-alpine
```

---

## Prevention Tips

1. **Always test config changes:**
   ```bash
   docker exec caromoto-redis redis-cli CONFIG SET save "900 1"
   # If successful, add to redis.conf
   ```

2. **Keep backups of working config:**
   ```bash
   cp redis.conf redis.conf.backup
   ```

3. **Monitor container health:**
   ```bash
   watch -n 5 'docker ps | grep redis'
   ```

4. **Use logging:**
   - Redis logs help diagnose issues quickly
   - Check logs before and after config changes

---

## Summary

✅ **Fixed:** Removed inline comments from `redis.conf`
✅ **Working:** Redis now starts successfully
✅ **Verified:** Container shows "healthy" status
✅ **Ready:** Application can now connect to Redis

**Key Takeaway:** Redis configuration files don't support inline comments. Always put comments on separate lines!
