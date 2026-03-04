# Setup Guide

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and configure your settings:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:
- Caromoto email/password
- Telegram bot token (optional)
- Redis connection details

### 3. Start Redis

**Option A: Using Docker (Recommended)**

```bash
# Start Docker Desktop first, then:
docker-compose up -d
```

**Option B: Using Local Redis**

```bash
# macOS with Homebrew
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt-get install redis-server
sudo systemctl start redis

# Verify Redis is running
redis-cli ping
# Should return: PONG
```

### 4. Build the Project

```bash
npm run build
```

### 5. Run the Scraper

**Scheduled Mode (Default)**
```bash
npm start
# Runs with automatic scheduling based on SCRAPER_CRON_SCHEDULE
```

**One-time Scrape**
```bash
npm run start:once
# Runs once and exits
```

**Development Mode**
```bash
npm run start:dev
# Auto-reloads on file changes
```

### 6. Check Statistics

```bash
npm run stats
```

## Redis Persistence Setup

If using local Redis, configure persistence in `/usr/local/etc/redis.conf` (macOS) or `/etc/redis/redis.conf` (Linux):

```conf
# RDB snapshots
save 900 1
save 300 10
save 60 10000

# AOF
appendonly yes
appendfilename "appendonly.aof"
appendfsync everysec

# Hybrid persistence
aof-use-rdb-preamble yes
```

Restart Redis after configuration changes:
```bash
# macOS
brew services restart redis

# Linux
sudo systemctl restart redis
```

## Troubleshooting

### Redis Connection Error

1. Check if Redis is running:
   ```bash
   redis-cli ping
   ```

2. Check Redis logs:
   ```bash
   # macOS
   tail -f /usr/local/var/log/redis.log
   
   # Linux
   sudo journalctl -u redis -f
   ```

3. Verify `.env` settings:
   ```env
   REDIS_HOST=localhost
   REDIS_PORT=6379
   ```

### Playwright Browser Issues

If browser automation fails:

1. Install Playwright browsers:
   ```bash
   npx playwright install chromium
   ```

2. Try running in non-headless mode:
   ```env
   PLAYWRIGHT_HEADLESS=false
   ```

### Telegram Notifications Not Working

1. Get your chat ID:
   ```bash
   npm run telegram:get-chat-id
   ```

2. Test the bot:
   ```bash
   npm run telegram:test-bot
   ```

## Production Deployment

### Using PM2

```bash
# Install PM2
npm install -g pm2

# Start the application
pm2 start build/main.js --name caromoto-scraper

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

### Using systemd

Create `/etc/systemd/system/caromoto-scraper.service`:

```ini
[Unit]
Description=Caromoto Scraper
After=network.target redis.service

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/caromoto-crawler
ExecStart=/usr/bin/node /path/to/caromoto-crawler/build/main.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable caromoto-scraper
sudo systemctl start caromoto-scraper
sudo systemctl status caromoto-scraper
```

## Monitoring

### View Logs

```bash
# Application logs
tail -f logs/combined.log
tail -f logs/error.log

# With PM2
pm2 logs caromoto-scraper

# With systemd
sudo journalctl -u caromoto-scraper -f
```

### Check Redis Data

```bash
redis-cli

# Check keys
KEYS caromoto:*

# Get latest scraping
GET caromoto:scraping:latest

# Get stats
HGETALL caromoto:scraping:stats

# List history
LRANGE caromoto:scraping:history 0 9
```

## Scheduler Configuration

Modify `SCRAPER_CRON_SCHEDULE` in `.env`:

```env
# Every 6 hours
SCRAPER_CRON_SCHEDULE=0 */6 * * *

# Every day at 9 AM
SCRAPER_CRON_SCHEDULE=0 9 * * *

# Every 30 minutes
SCRAPER_CRON_SCHEDULE=*/30 * * * *
```

Cron expression format: `minute hour day month weekday`

## Data Backup

### Export Scraping History

```bash
redis-cli --eval export-history.lua
```

### Redis Backup

```bash
# Create RDB backup
redis-cli SAVE

# Copy backup file
cp /var/lib/redis/dump.rdb ~/backups/dump-$(date +%Y%m%d).rdb
```

## Development

### Run Type Checking

```bash
npx tsc --noEmit
```

### Run Linter

```bash
npm run lint
npm run lint:fix
```

### Format Code

```bash
npm run format
```
