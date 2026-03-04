# Caromoto Scraper

Automated scraper for Caromoto website with intelligent car detail fetching, scheduled jobs, Redis persistence, and Telegram notifications.

## ✨ Features

### Core Features
- **Two Operating Modes**: Dev mode (no Redis) and Production mode (full features)
- **Intelligent Detail Fetching**: Automatically fetches details ONLY for new cars
- **Smart Comparison**: Compares scrapes to detect newly appeared cars
- **Scheduled Scraping**: Runs automatically based on configurable cron schedule
- **Persistent Storage**: Redis with RDB/AOF persistence for crash recovery
- **Telegram Notifications**: Get notified about scraping results
- **File Backups**: Saves JSON files in addition to Redis storage
- **Job Statistics**: Track scraping history and performance
- **Graceful Shutdown**: Handles SIGTERM/SIGINT properly

### Development Mode
- ✅ No Redis/Docker required
- ✅ Runs once immediately
- ✅ Fetches details for first car
- ✅ Perfect for testing

### Production Mode
- ✅ Redis persistence
- ✅ Scheduled execution
- ✅ Smart comparison logic
- ✅ Fetches details only for new cars
- ✅ Continuous monitoring

## Architecture

```
src/
├── main.ts                          # Main entry point (two-mode support)
├── services/
│   ├── redis-storage.service.ts     # Redis persistence layer
│   ├── scheduler.service.ts         # Job scheduler
│   ├── car-details.service.ts       # Car detail fetching (NEW!)
│   └── telegram.service.ts          # Telegram notifications
├── apps/scraper/
│   ├── caromoto-auth-mercedes-gle-scraper/
│   │   └── index.ts                 # Main scraper implementation
│   └── services/
│       ├── scraper.service.ts       # Core scraping logic
│       ├── browser-manager.service.ts
│       ├── page-pool.service.ts
│       └── data-extractor.service.ts
├── core/config/
│   ├── redis.config.ts
│   ├── scheduler.config.ts
│   └── playwright.config.ts
└── output/                          # Car details output directory (NEW!)
```

## Prerequisites

### For Development Mode
- Node.js 18+ and npm
- Valid Caromoto credentials

### For Production Mode
- Node.js 18+ and npm
- Docker and Docker Compose (for Redis)
- Valid Caromoto credentials

## Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

4. Edit `.env` with your settings:
   - Redis connection details
   - Caromoto credentials
   - Telegram bot token (optional)
   - Cron schedule

## Configuration

### Scheduler Configuration

Set your scraping schedule using cron expressions in `.env`:

```env
SCHEDULER_ENABLED=true
SCRAPER_CRON_SCHEDULE=0 */6 * * *    # Every 6 hours
SCHEDULER_TIMEZONE=Europe/Chisinau
SCRAPER_RUN_ON_START=true            # Run immediately on start
```

**Common Cron Expressions:**
- `0 */6 * * *` - Every 6 hours
- `0 */12 * * *` - Every 12 hours
- `0 0 * * *` - Daily at midnight
- `0 9,17 * * *` - Daily at 9 AM and 5 PM
- `*/30 * * * *` - Every 30 minutes

### Redis Persistence

Redis is configured for persistence with:
- **RDB snapshots**: Point-in-time backups
- **AOF logging**: Append-only file for durability

Make sure your Redis server has persistence enabled in `redis.conf`:

```conf
save 900 1
save 300 10
save 60 10000
appendonly yes
appendfilename "appendonly.aof"
```

## Quick Start

### Development Mode (Quick Test)

Run scraper once, fetch details for first car, no Redis needed:

```bash
npm run start:dev
```

**Output:** `output/first-car-details.json`

### Production Mode (Full Features)

Run with Redis, scheduling, and smart new car detection:

```bash
npm run start:prod
```

**Output:** `output/new-cars-<timestamp>.json` (when new cars found)

---

## Usage

### Development Mode Commands

```bash
# Run once with first car details (no Redis/Docker)
npm run start:dev

# Check output
cat output/first-car-details.json
```

### Production Mode Commands

```bash
# Start production mode (starts Redis automatically)
npm run start:prod

# Alternative: TypeScript mode
npm run start:prod:ts

# Stop production
npm run stop:prod

# Check statistics
npm run stats

# View new cars detected
ls -lth output/new-cars-*.json
```

### Docker Commands

```bash
# Start Redis only
npm run docker:up

# Stop Redis
npm run docker:down

# View Redis logs
npm run docker:logs

# Check Redis status
docker-compose ps
```

### Legacy Commands

```bash
# Run once in production mode (requires Redis)
npm run start:once

# Manual scrape

Run the scraper directly (legacy mode):

```bash
npm run scrape:manual
```

### View Statistics

Check scraping history and job stats:

```bash
npm run stats
```

### Development Mode

Run with auto-reload on file changes:

```bash
npm run start:dev
```

## Car Details Feature

### How It Works

The application intelligently fetches detailed car information:

#### Development Mode
- Fetches details for **first car only**
- Quick API test
- Output: `output/first-car-details.json`

#### Production Mode
- Fetches details **only for NEW cars**
- Compares current scrape with previous
- Avoids redundant API calls
- Output: `output/new-cars-<timestamp>.json`

### First Production Run

When Redis is empty, the application:
1. Performs initial scrape → Saves to Redis
2. Waits 5 seconds
3. Performs second scrape → Compares → Fetches details for new cars
4. Continues on schedule

### Subsequent Runs

On each scheduled run:
1. Loads previous scrape from Redis
2. Performs new scrape
3. Compares: current vs previous
4. Finds NEW cars (not seen before)
5. Fetches their details (2 second delay between requests)
6. Saves to `output/new-cars-<timestamp>.json`

### API Details

- **Endpoint:** `POST https://caromoto.com/FindVehicle/GetDetailInfo`
- **Body:** `auction=MAN&vehicleId=<id>`
- **Rate Limit:** 2 seconds between requests

### Output Example

```json
{
  "timestamp": "2026-03-04T14:30:00.000Z",
  "newCarsCount": 3,
  "cars": [
    {
      "basicInfo": {
        "detailsUrl": "/FindVehicle?auction=MAN&info_id=ABC123",
        "make": "Mercedes-Benz",
        "model": "GLE 350",
        "year": 2020
      },
      "detailedInfo": {
        "vin": "ABC123",
        "engine": "3.0L V6 Turbo",
        "transmission": "9-Speed Automatic",
        ...
      }
    }
  ]
}
```

---

## Redis Data Structure

### Keys

- `caromoto:scraping:history` - List of historical scraping results (max 100)
- `caromoto:scraping:latest` - Most recent scraping result
- `caromoto:scraping:stats` - Aggregated statistics

### Data Format

```typescript
interface ScrapedCarData {
  id: string;              // e.g., "scraping_1709567890123"
  timestamp: Date;
  data: any[];             // Array of car objects
  carsCount: number;
  loadTime: number;        // milliseconds
}

interface StorageStats {
  totalScrapings: number;
  lastScrapingTime: Date | null;
  averageCarsCount: number;
  storageSize: number;
}
```

## File Backups

In addition to Redis, scraping results are saved to:

```
src/apps/scraper/caromoto-auth-mercedes-gle-scraper/output/
└── GLE-350-2020-2021_DD_MM_YYYY_HH_MM_SS.json
```

## Telegram Notifications

Configure Telegram bot for notifications:

1. Create a bot with [@BotFather](https://t.me/botfather)
2. Get your chat ID:

```bash
npm run telegram:get-chat-id
```

3. Update `.env`:

```env
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_CHAT_ID=your-chat-id
```

## Monitoring

### Application Logs

Logs are written to:
- `logs/combined.log` - All logs
- `logs/error.log` - Error logs only
- `logs/exceptions.log` - Uncaught exceptions

### Process Management

For production, use PM2:

```bash
npm install -g pm2
pm2 start build/main.js --name caromoto-scraper
pm2 save
pm2 startup
```

## Graceful Shutdown

The application handles:
- `SIGTERM` - Kubernetes/Docker shutdown
- `SIGINT` - CTRL+C
- Uncaught exceptions
- Unhandled rejections

All handlers ensure:
1. Stop scheduler
2. Disconnect from Redis
3. Clean browser resources
4. Exit gracefully

## Development

### Build

```bash
npm run build
```

### Lint

```bash
npm run lint
npm run lint:fix
```

### Format

```bash
npm run format
```

## Troubleshooting

### Redis Connection Failed

```bash
# Check if Redis is running
redis-cli ping

# Start Redis
redis-server
```

### Scraper Login Issues

- Verify credentials in `.env`
- Check if Caromoto changed their login page structure
- Review debug screenshots in project root

### Scheduler Not Running

- Check `SCHEDULER_ENABLED=true` in `.env`
- Verify cron expression is valid
- Review logs for errors

## API Reference

### RedisStorageService

```typescript
// Get latest scraping
const latest = await storage.getLatestScraping();

// Get history
const history = await storage.getScrapingHistory(10);

// Get stats
const stats = await storage.getStats();

// Search scrapings
const results = await storage.searchScrapings({
  fromDate: new Date('2024-01-01'),
  minCars: 5,
});
```

### SchedulerService

```typescript
// Schedule a job
await scheduler.scheduleJob({
  name: 'my-job',
  cronExpression: '0 */6 * * *',
  handler: async () => { /* job logic */ },
  runOnStart: true,
});

// Get job stats
const stats = scheduler.getAllJobsStats();
```

### CarDetailsService

```typescript
// Extract vehicle ID from detailsUrl
const vehicleId = carDetails.extractVehicleId(car.detailsUrl);

// Fetch details for a single car
const result = await carDetails.fetchCarDetails('MAN', vehicleId);

// Fetch details for multiple cars
const detailsMap = await carDetails.fetchMultipleCarDetails(
  cars,
  'MAN',
  2000 // delay in ms
);

// Find new cars by comparison
const newCars = carDetails.findNewCars(currentCars, previousCars);
```

---

## 📚 Documentation

Comprehensive documentation is available:

- **[WORKFLOW.md](./WORKFLOW.md)** - Complete workflow guide with examples
- **[CAR_DETAILS_FEATURE.md](./CAR_DETAILS_FEATURE.md)** - Detailed feature documentation
- **[CHANGES_SUMMARY.md](./CHANGES_SUMMARY.md)** - Summary of all changes
- **[IMPLEMENTATION_COMPLETE.md](./IMPLEMENTATION_COMPLETE.md)** - Implementation details
- **[SETUP.md](./SETUP.md)** - Setup and installation guide
- **[TRANSFORMATION_SUMMARY.md](./TRANSFORMATION_SUMMARY.md)** - Architecture transformation

---

## License

ISC

## Author

Abdou-Raouf ATARMLA
