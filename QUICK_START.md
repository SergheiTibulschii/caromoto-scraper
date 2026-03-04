# Quick Start Guide

## Prerequisites

- Node.js 18+ installed
- Redis running (see options below)

## 1. Install Dependencies

```bash
npm install
```

## 2. Start Redis

### Option A: Docker (Easiest)

```bash
# Make sure Docker Desktop is running, then:
docker-compose up -d

# Verify Redis is running:
docker ps
```

### Option B: Local Redis (macOS)

```bash
brew install redis
brew services start redis

# Verify:
redis-cli ping
# Should return: PONG
```

### Option C: Local Redis (Ubuntu/Debian)

```bash
sudo apt-get install redis-server
sudo systemctl start redis
sudo systemctl enable redis

# Verify:
redis-cli ping
```

## 3. Configure

Edit `.env` file (already configured with your credentials):

```env
# Already set:
CAROMOTO_EMAIL=moldex.dan@gmail.com
CAROMOTO_PASSWORD=446236

# Redis (localhost defaults):
REDIS_HOST=localhost
REDIS_PORT=6379

# Schedule: Every 6 hours
SCRAPER_CRON_SCHEDULE=0 */6 * * *

# Telegram (optional):
TELEGRAM_BOT_TOKEN=8734928706:AAE6WO38LhcOXL8UDT34RjCTTGCEDbl4Maw
TELEGRAM_CHAT_ID=-1003799800194
```

## 4. Build

```bash
npm run build
```

## 5. Run

### Start with Scheduler (Recommended)

```bash
npm start
```

This will:
- Run immediately (if `SCRAPER_RUN_ON_START=true`)
- Then run every 6 hours based on your cron schedule
- Keep running until you stop it (Ctrl+C)

### Run Once and Exit

```bash
npm run start:once
```

### View Statistics

```bash
npm run stats
```

## Common Commands

```bash
# Development mode (auto-reload)
npm run start:dev

# Manual scrape (legacy)
npm run scrape:manual

# Build TypeScript
npm run build

# Check Redis data
redis-cli
> KEYS caromoto:*
> GET caromoto:scraping:latest
> LRANGE caromoto:scraping:history 0 9
```

## Production Deployment

### Using PM2

```bash
npm install -g pm2
pm2 start build/main.js --name caromoto-scraper
pm2 save
pm2 startup
```

### View Logs

```bash
# With PM2:
pm2 logs caromoto-scraper

# Without PM2:
tail -f logs/combined.log
tail -f logs/error.log
```

## Cron Schedule Examples

Edit `SCRAPER_CRON_SCHEDULE` in `.env`:

```env
# Every 6 hours (current)
SCRAPER_CRON_SCHEDULE=0 */6 * * *

# Every 12 hours
SCRAPER_CRON_SCHEDULE=0 */12 * * *

# Daily at 9 AM
SCRAPER_CRON_SCHEDULE=0 9 * * *

# Twice daily (9 AM and 9 PM)
SCRAPER_CRON_SCHEDULE=0 9,21 * * *

# Every 30 minutes
SCRAPER_CRON_SCHEDULE=*/30 * * * *
```

## Troubleshooting

### Redis Connection Failed

```bash
# Check if Redis is running
redis-cli ping

# If using Docker:
docker ps | grep redis
docker-compose up -d

# If local Redis:
brew services list  # macOS
sudo systemctl status redis  # Linux
```

### Scraper Fails

1. Check credentials in `.env`
2. Check browser logs in `logs/error.log`
3. Try non-headless mode: `PLAYWRIGHT_HEADLESS=false`
4. Check debug screenshots (created on error)

### Port Already in Use

Redis port 6379 might be in use:

```bash
# Check what's using the port
lsof -i :6379

# Change port in .env:
REDIS_PORT=6380
```

## What Happens When You Run

1. **Application starts** → Connects to Redis
2. **Scheduler initializes** → Sets up cron job
3. **First run** (if `SCRAPER_RUN_ON_START=true`):
   - Opens browser
   - Logs into Caromoto
   - Scrapes Mercedes GLE data
   - Saves to Redis
   - Saves JSON file to `output/`
   - Sends Telegram notification
4. **Waits for next scheduled time**
5. **Repeats** at scheduled intervals

## Output Locations

- **Redis**: `caromoto:scraping:*` keys
- **JSON Files**: `src/apps/scraper/caromoto-auth-mercedes-gle-scraper/output/`
- **Logs**: `logs/combined.log`, `logs/error.log`

## Stop the Application

```bash
# If running in terminal:
Ctrl+C

# If using PM2:
pm2 stop caromoto-scraper
pm2 delete caromoto-scraper
```

## Need Help?

See detailed documentation:
- `README.md` - Full documentation
- `SETUP.md` - Detailed setup guide
- `TRANSFORMATION_SUMMARY.md` - What changed
