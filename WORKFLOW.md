# Caromoto Scraper - Workflow Guide

This document explains the two operating modes and how to use them.

## 🚀 Quick Start

### Development Mode (No Redis Required)
```bash
npm run start:dev
```
- Runs scraper **once** immediately
- Saves results to timestamped JSON file
- **No Docker or Redis required**
- Perfect for testing and development

### Production Mode (With Redis & Scheduler)
```bash
npm run start:prod
```
- Starts Redis via Docker Compose
- Runs scraper on schedule (cron job)
- Stores results in Redis
- Sends Telegram notifications
- **Requires Docker**

---

## 📋 Operating Modes

### 1. Development Mode (`start:dev`)

**Purpose:** Quick testing without infrastructure dependencies

**What it does:**
- ✓ Runs scraper once
- ✓ Saves to JSON file in `output/` folder
- ✓ **Fetches detailed info for FIRST car only**
- ✓ No Redis needed
- ✓ No Docker needed
- ✓ Fast startup
- ✗ No scheduling
- ✗ No Redis storage

**When to use:**
- Testing scraper logic
- Debugging
- Quick data extraction
- Development without Docker

**Command:**
```bash
npm run start:dev
```

**Output:**
- Car list: `src/apps/scraper/caromoto-auth-mercedes-gle-scraper/output/GLE-350-2020-2021_DD_MM_YYYY_HH_MM_SS.json`
- First car details: `output/first-car-details.json`
- Console logs

---

### 2. Production Mode (`start:prod`)

**Purpose:** Long-running scraper with persistence and scheduling

**What it does:**
- ✓ Starts Redis container
- ✓ Runs on schedule (every 6 hours by default)
- ✓ Stores results in Redis
- ✓ Maintains scraping history
- ✓ **Intelligent new car detection**
- ✓ **Fetches details ONLY for new cars**
- ✓ Sends Telegram notifications
- ✓ Automatic recovery
- ✓ Statistics tracking

**Smart Detection Logic:**
1. **First Run (Redis Empty):**
   - Scrapes and saves to Redis
   - Waits 5 seconds
   - Scrapes again immediately
   - Compares results and fetches details for any new cars

2. **Subsequent Runs:**
   - Scrapes current data
   - Compares with previous scrape
   - Fetches details ONLY for newly appeared cars
   - Saves detailed info to `output/new-cars-<timestamp>.json`

**When to use:**
- Production deployment
- Scheduled scraping
- Data persistence needed
- Historical tracking
- Automatic new car monitoring

**Prerequisites:**
- Docker installed and running
- Docker Compose available

**Commands:**
```bash
# Start production mode
npm run start:prod

# Stop production mode
npm run stop:prod

# View Redis logs
npm run docker:logs

# Check statistics
npm run stats
```

**Alternative (using TypeScript):**
```bash
npm run start:prod:ts
```

---

## 🛠️ Available Scripts

| Script | Description | Redis Required |
|--------|-------------|----------------|
| `npm run start:dev` | Run once in dev mode | ❌ No |
| `npm run start:prod` | Production mode with Redis | ✅ Yes |
| `npm run start:prod:ts` | Production mode (TypeScript) | ✅ Yes |
| `npm run start:once` | Run once in prod mode | ✅ Yes |
| `npm run stats` | View statistics | ✅ Yes |
| `npm run docker:up` | Start Redis only | N/A |
| `npm run docker:down` | Stop Redis | N/A |
| `npm run docker:logs` | View Redis logs | N/A |
| `npm run stop:prod` | Stop production mode | N/A |

---

## 🚗 Car Details Fetching

### How It Works

The application now intelligently fetches detailed car information:

#### Development Mode
- **Fetches details for:** First car only
- **Purpose:** Quick testing of details API
- **Output:** `output/first-car-details.json`

#### Production Mode
- **Fetches details for:** Only NEW cars (not seen before)
- **Purpose:** Avoid redundant API calls
- **Output:** `output/new-cars-<timestamp>.json`

### Details API

The application fetches details from Caromoto's detail endpoint:
- **URL:** `https://caromoto.com/FindVehicle/GetDetailInfo`
- **Method:** POST
- **Body:** `auction=MAN&vehicleId=<vehicleId>`
- **Rate Limiting:** 2 second delay between requests (production)

### Example Output Structure

```json
{
  "timestamp": "2026-03-04T14:30:00.000Z",
  "newCarsCount": 3,
  "cars": [
    {
      "basicInfo": {
        "detailsUrl": "/FindVehicle?auction=MAN&info_id=4JGFB4KB5MA505280o",
        "make": "Mercedes-Benz",
        "model": "GLE 350",
        ...
      },
      "detailedInfo": {
        "vin": "4JGFB4KB5MA505280",
        "specifications": {...},
        "condition": {...},
        ...
      }
    }
  ]
}
```

---

## 📦 Docker Commands

### Start Redis
```bash
docker-compose up -d
# or
npm run docker:up
```

### Stop Redis
```bash
docker-compose down
# or
npm run docker:down
```

### View Redis logs
```bash
docker-compose logs -f redis
# or
npm run docker:logs
```

### Check Redis status
```bash
docker-compose ps
```

---

## 🔧 Configuration

### Development Mode
Edit `.env`:
```env
# Only these are required for dev mode
CAROMOTO_EMAIL=your-email@example.com
CAROMOTO_PASSWORD=your-password

# Optional
PLAYWRIGHT_HEADLESS=false  # Set to false to see browser
```

### Production Mode
Edit `.env`:
```env
# Required for production
REDIS_HOST=localhost
REDIS_PORT=6379
SCHEDULER_ENABLED=true
SCRAPER_CRON_SCHEDULE=0 */6 * * *  # Every 6 hours
SCRAPER_RUN_ON_START=true

# Caromoto credentials
CAROMOTO_EMAIL=your-email@example.com
CAROMOTO_PASSWORD=your-password

# Telegram notifications
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_CHAT_ID=your-chat-id
```

---

## 📊 Workflow Examples

### Example 1: Quick Test Run (Dev Mode)
```bash
# Just want to see if scraper works
npm run start:dev

# Check output files
ls -la src/apps/scraper/caromoto-auth-mercedes-gle-scraper/output/
ls -la output/

# View first car details
cat output/first-car-details.json | jq '.'
```

### Example 2: Production Deployment (First Time)
```bash
# Build the application
npm run build

# Start in production mode (first run with empty Redis)
npm run start:prod

# What happens:
# 1. Redis starts
# 2. First scrape -> saves to Redis
# 3. Wait 5 seconds
# 4. Second scrape -> compares and fetches details for new cars
# 5. Continues on schedule...

# Application runs indefinitely with scheduled jobs
# Press Ctrl+C to stop

# Or run in background
./start-prod.sh &

# Check stats later
npm run stats

# View new cars detected
ls -la output/new-cars-*.json
```

### Example 3: Production with Existing Data
```bash
# Start production (Redis already has data)
npm run start:prod

# What happens:
# 1. Redis starts
# 2. Loads previous scrape from Redis
# 3. Performs new scrape
# 4. Compares: current vs previous
# 5. Fetches details ONLY for new cars
# 6. Saves to output/new-cars-<timestamp>.json
# 7. Waits for next scheduled run (6 hours)

# Monitor new cars
watch -n 60 'ls -lth output/new-cars-*.json | head -5'
```

### Example 4: Development with Docker
```bash
# Start Redis manually
npm run docker:up

# Run application without scheduler (once)
npm run start:once

# Check what was stored
npm run stats

# View new cars detected
cat output/new-cars-*.json | jq '.newCarsCount'

# Stop Redis
npm run docker:down
```

---

## 🐛 Troubleshooting

### Issue: "Redis connection error"
**Solution:**
```bash
# Check if Docker is running
docker ps

# Start Redis
npm run docker:up

# Verify Redis is healthy
docker-compose ps
```

### Issue: "MaxListenersExceededWarning"
**Solution:** Fixed! LoggerService is now a singleton.

### Issue: Docker not found
**Solution:**
```bash
# Use dev mode instead (no Docker needed)
npm run start:dev
```

### Issue: Permission denied on Docker
**Solution:**
```bash
# On Linux/Mac, you may need to add your user to docker group
sudo usermod -aG docker $USER
# Then log out and back in
```

---

## 📁 Output Files

### Development Mode Output
```
src/apps/scraper/caromoto-auth-mercedes-gle-scraper/output/
└── GLE-350-2020-2021_04_03_2026_13_45_30.json
```

### Production Mode Output
- **Redis Storage:** Keys prefixed with `caromoto:`
  - `caromoto:scraping:latest` - Latest scraping result
  - `caromoto:scraping:history` - List of historical results
  - `caromoto:scraping:stats` - Statistics
- **Log Files:** 
  - `logs/combined.log` - All logs
  - `logs/error.log` - Error logs only

---

## 🔄 Migration Path

### From Dev to Prod
1. Test in dev mode: `npm run start:dev`
2. Verify output file is correct
3. Start Docker: `npm run docker:up`
4. Test once in prod: `npm run start:once`
5. Check stats: `npm run stats`
6. Start full prod: `npm run start:prod`

---

## ⚙️ Advanced Usage

### Custom Cron Schedule
Edit `.env`:
```env
# Run every hour
SCRAPER_CRON_SCHEDULE=0 * * * *

# Run every day at midnight
SCRAPER_CRON_SCHEDULE=0 0 * * *

# Run every 30 minutes
SCRAPER_CRON_SCHEDULE=*/30 * * * *
```

### Disable Telegram Notifications
Edit `.env`:
```env
# Leave empty to disable
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

### Headless vs Headful Mode
Edit `.env`:
```env
# Show browser (good for debugging)
PLAYWRIGHT_HEADLESS=false

# Hide browser (production)
PLAYWRIGHT_HEADLESS=true
```

---

## 📈 Monitoring

### View Statistics
```bash
npm run stats
```

Output:
```json
{
  "totalScrapings": 42,
  "lastScrapingTime": "2026-03-04T14:30:00.000Z",
  "averageCarsCount": 15,
  "storageSize": 42
}
```

### View Logs
```bash
# All logs
tail -f logs/combined.log

# Error logs only
tail -f logs/error.log

# Redis logs
npm run docker:logs
```

---

## 🎯 Summary

- **Development:** `npm run start:dev` - No Redis, runs once, saves to file
- **Production:** `npm run start:prod` - With Redis, scheduled, persistent storage

Choose the mode that fits your needs! 🚀
