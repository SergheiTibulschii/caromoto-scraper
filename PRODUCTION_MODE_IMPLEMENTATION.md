# Production Mode Implementation Summary

## Overview
Implemented a production-ready periodic job system with retry logic, cleaner logging, and proper Redis storage management.

---

## 1. Dev vs Prod Modes

### Dev Mode (`npm run dev`)
- Runs **once** and shuts down
- No Redis required
- Scrapes first car
- Sends Telegram notification
- Verbose logging

### Prod Mode (default)
- Runs **continuously** with scheduled jobs
- Requires Redis connection
- Scrapes all cars periodically
- Compares with previous data
- Sends Telegram notifications for **new cars only**
- Minimal logging

---

## 2. Redis Storage Strategy

### Key Changes
- **Single key storing exactly 25 cars**:
  - `scraping:cars` - Always contains 25 cars
  - `scraping:stats` - Statistics

### Flow
1. **First run**: 
   - Redis empty
   - Scrape 25 cars
   - No comparison (nothing to compare with)
   - Save 25 cars to Redis

2. **Second run**:
   - Get 25 cars from Redis
   - Scrape 25 new cars
   - Compare: scraped vs stored (by vehicleId)
   - Identify new cars
   - **Replace** Redis with newly scraped 25 cars

3. **Subsequent runs**: Repeat step 2

### Benefits
- Fixed storage size (always exactly 25 cars)
- Simple comparison: stored vs scraped
- Automatic replacement with fresh data
- No manual cleanup needed

---

## 3. Job Scheduling

### Configuration
```typescript
cronExpression: '*/5 * * * *'  // Every 5 minutes (for testing)
```

To change frequency, update `.env`:
```bash
SCRAPER_CRON_SCHEDULE="*/5 * * * *"  # Every 5 minutes
# SCRAPER_CRON_SCHEDULE="0 */1 * * *"  # Every hour
# SCRAPER_CRON_SCHEDULE="0 */6 * * *"  # Every 6 hours
```

---

## 4. Retry Logic

### Implementation
- **Max retries**: 3 attempts
- **Retry delay**: 2 seconds between attempts
- **Failure handling**: 
  - Logs failure after all retries exhausted
  - Job completes (doesn't crash the scheduler)
  - Next scheduled job runs normally

### Error Scenarios Handled
1. Scraping timeout
2. Network failures
3. Invalid response data
4. Redis connection issues

---

## 5. Production Logging

### Minimal Logs
Only essential information:

```
=== Caromoto Scraper - PRODUCTION MODE ===
Scheduler: */5 * * * * (Europe/Chisinau)
Scheduler active. Press CTRL+C to stop.

[10:00:00] Job started
Found 2 new car(s)
[10:00:45] Job succeeded

[10:05:00] Job started
Attempt 1 failed, retrying...
Attempt 2 failed, retrying...
Job failed after 3 attempts: Network timeout

[10:10:00] Job started
[10:10:32] Job succeeded
```

### What's Removed in Prod
- ❌ Detailed scraping steps
- ❌ Redis storage stats after each run
- ❌ Car comparison details
- ❌ File save confirmations

---

## 6. Telegram Notifications

### Dev Mode
- Sends notification for **first car** always

### Prod Mode
- Sends notifications **only for NEW cars**
- Each new car gets individual message with:
  - Grade & evaluation
  - Pricing (estimated, min offer, buy now)
  - Mileage, paint, history
  - Red flags (if any)
  - Link to Caromoto
  - Car image

---

## 7. Running the Application

### Development (One-time run)
```bash
npm run dev
```

### Production (Continuous)
```bash
npm start
```

### Check Stats
```bash
npm run stats
```

### Clear Redis (if needed)
```bash
redis-cli
> FLUSHDB
```

---

## 8. Architecture Changes

### File Changes

#### `src/main.ts`
- ✅ Added `MAX_RETRIES` constant (3)
- ✅ Implemented retry loop in `runScrapingJob()`
- ✅ Simplified logging for prod mode
- ✅ Updated `performScrapeWithComparison()`:
  - Get stored cars from Redis (25 cars)
  - Scrape new 25 cars
  - Compare by vehicleId to find new cars
  - **Replace** Redis with newly scraped cars
- ✅ Added `processAndNotifyNewCars()` for Telegram notifications
- ✅ Extracted `sendCarNotification()` for reuse

#### `src/services/redis-storage.service.ts`
- ✅ Replaced list-based history with single-key system
- ✅ Removed `SCRAPING_HISTORY_KEY` (was: list of 100 items)
- ✅ Added `CARS_KEY` (stores exactly 25 cars)
- ✅ Updated `saveScrapingResult()` to replace all stored cars
- ✅ Added `getStoredCars()` to fetch current 25 cars
- ✅ Added `getStoredCarsData()` to get car data for comparison
- ✅ Simplified `isEmpty()` check
- ✅ Removed unused methods: `getScrapingHistory()`, `getScrapingById()`, `searchScrapings()`
- ✅ Added `clearAll()` method

#### `src/core/config/scheduler.config.ts`
- ✅ Changed default cron from `0 */6 * * *` to `*/5 * * * *`

---

## 9. Testing Checklist

### Before Testing
1. ✅ Redis is running: `redis-cli ping` → `PONG`
2. ✅ `.env` configured with Telegram bot token and chat ID
3. ✅ Project built: `npm run build`

### Test Flow
1. **First run** (initial scrape):
   ```bash
   npm start
   ```
   - Should see: "Job started" → "Job succeeded"
   - No new cars notification (nothing to compare)

2. **Wait 5 minutes** (second run):
   - Should see: "Job started" → "Found X new car(s)" → Telegram notifications → "Job succeeded"

3. **Wait 5 minutes** (third run):
   - If no new cars: "Job started" → "Job succeeded"
   - If new cars: "Job started" → "Found X new car(s)" → Telegram notifications → "Job succeeded"

### Test Retry Logic
Temporarily break Redis connection:
```bash
redis-cli shutdown
npm start
```
- Should see 3 retry attempts
- Should fail gracefully

Start Redis again:
```bash
redis-server
```
- Next scheduled job should work normally

---

## 10. Production Recommendations

### After Testing
Once you've verified the 5-minute interval works:

1. **Change to production frequency**:
   ```bash
   # In .env
   SCRAPER_CRON_SCHEDULE="0 */1 * * *"  # Every hour
   # or
   SCRAPER_CRON_SCHEDULE="0 */6 * * *"  # Every 6 hours
   ```

2. **Set up process manager** (PM2):
   ```bash
   npm install -g pm2
   pm2 start npm --name "caromoto-scraper" -- start
   pm2 save
   pm2 startup
   ```

3. **Monitor logs**:
   ```bash
   pm2 logs caromoto-scraper
   ```

4. **Set up alerts** (optional):
   - Use PM2 Plus for monitoring
   - Set up health checks
   - Configure restart policies

---

## Summary

✅ **Dev mode**: Quick test runs with Telegram notification
✅ **Prod mode**: Continuous operation with scheduled jobs
✅ **Redis storage**: Stores exactly 25 cars, completely replaced each run
✅ **Comparison logic**: Compare scraped 25 vs stored 25 by vehicleId
✅ **Retry logic**: 3 attempts with 2-second delay
✅ **Clean logs**: Minimal noise, essential info only
✅ **Telegram notifications**: Only for new cars in prod
✅ **Job frequency**: 5 minutes (configurable via .env)
