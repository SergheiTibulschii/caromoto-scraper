# Quick Reference - Production Mode

## 🚀 Quick Start

### Run Once (Dev Mode)
```bash
npm run dev
```
- Scrapes once
- Sends 1 Telegram message
- Shuts down

### Run Continuously (Prod Mode)
```bash
npm start
```
- Runs every 5 minutes
- Compares with previous data
- Sends Telegram for NEW cars only
- Press CTRL+C to stop

---

## ⚙️ Configuration

### Change Job Frequency
Edit `.env`:
```bash
# Every 5 minutes (testing)
SCRAPER_CRON_SCHEDULE="*/5 * * * *"

# Every hour (production)
SCRAPER_CRON_SCHEDULE="0 */1 * * *"

# Every 6 hours
SCRAPER_CRON_SCHEDULE="0 */6 * * *"
```

---

## 📊 Redis Storage

### Current Storage
- **Maximum**: Exactly 25 cars at any time
- **Keys**: `scraping:cars`, `scraping:stats`

### Clear Redis
```bash
redis-cli
> FLUSHDB
> exit
```

### Check Redis Content
```bash
redis-cli
> KEYS *
> GET caromoto:scraping:cars
> exit
```

---

## 🔄 Retry Logic

- **Max attempts**: 3
- **Delay**: 2 seconds between retries
- **Behavior**: Fails gracefully, next job runs normally

---

## 📝 Logging

### Production Logs (Minimal)
```
[10:00:00] Job started
Found 2 new car(s)
[10:00:45] Job succeeded
```

### On Failure
```
[10:05:00] Job started
Attempt 1 failed, retrying...
Attempt 2 failed, retrying...
Job failed after 3 attempts: Network timeout
```

---

## 📱 Telegram Notifications

### Dev Mode
- Always sends for first car

### Prod Mode
- Only sends for NEW cars
- Each car = 1 message with photo

---

## 🛠️ Troubleshooting

### Redis Connection Error
```bash
# Check if Redis is running
redis-cli ping
# Should return: PONG

# Start Redis
redis-server

# Or with config
redis-server /path/to/redis.conf
```

### No New Cars Detected
- Wait for next scheduled run (5 min)
- Cars are compared by `vehicleId`
- Check Redis has data: `redis-cli KEYS *`

### Job Not Running
```bash
# Check scheduler config
cat .env | grep SCHEDULER

# Should be:
SCHEDULER_ENABLED=true
```

---

## 📦 Production Deployment (PM2)

### Install PM2
```bash
npm install -g pm2
```

### Start Application
```bash
pm2 start npm --name "caromoto-scraper" -- start
```

### Manage Application
```bash
pm2 status                    # Check status
pm2 logs caromoto-scraper     # View logs
pm2 restart caromoto-scraper  # Restart
pm2 stop caromoto-scraper     # Stop
pm2 delete caromoto-scraper   # Remove
```

### Auto-restart on Reboot
```bash
pm2 save
pm2 startup
```

---

## 🎯 What Changed?

### ✅ Implemented
1. **5-minute job frequency** (configurable)
2. **Redis stores exactly 25 cars** - completely replaced each run
3. **Comparison logic** - scraped vs stored by vehicleId
4. **Retry logic** (3 attempts)
5. **Minimal prod logging**
6. **Telegram notifications** for new cars in prod
7. **Continuous operation** in prod mode

### 🔧 Files Modified
- `src/main.ts` - Main application logic with comparison flow
- `src/services/redis-storage.service.ts` - Single-key storage strategy
- `src/core/config/scheduler.config.ts` - Job frequency

---

## 📋 Typical Production Flow

```
[Time 00:00] First Run
  ├─ Redis empty
  ├─ Scrape 25 cars
  ├─ No comparison (nothing stored yet)
  └─ Save 25 cars to Redis

[Time 00:05] Second Run
  ├─ Get 25 cars from Redis
  ├─ Scrape 25 new cars
  ├─ Compare: scraped vs stored (by vehicleId)
  ├─ Find 3 NEW cars
  ├─ Send 3 Telegram notifications
  └─ Replace Redis with newly scraped 25 cars

[Time 00:10] Third Run
  ├─ Get 25 cars from Redis
  ├─ Scrape 25 new cars
  ├─ Compare: scraped vs stored (by vehicleId)
  ├─ No new cars found
  └─ Replace Redis with newly scraped 25 cars
```

---

## 🔍 Debug Commands

### Check Job Stats
```bash
npm run stats
```

### View Redis Data
```bash
redis-cli
> KEYS caromoto:*
> HGETALL caromoto:scraping:stats
> exit
```

### Test Single Run Without Scheduler
```bash
# In .env, set:
SCHEDULER_ENABLED=false

# Then run:
npm start
```

---

## ⚡ Performance

- **Scraping time**: ~30-45 seconds
- **Job interval**: 5 minutes (configurable)
- **Retry delay**: 2 seconds
- **Max job time**: ~90 seconds (3 retries × 30s)

---

## 🎉 Ready to Go!

```bash
# 1. Make sure Redis is running
redis-cli ping

# 2. Start production mode
npm start

# 3. Check logs
# Logs will show job status every 5 minutes

# 4. Stop when needed
# Press CTRL+C
```
