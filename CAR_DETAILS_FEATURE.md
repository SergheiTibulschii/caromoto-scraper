# Car Details Fetching Feature

## 📋 Overview

The application now intelligently fetches detailed car information with different strategies for development and production modes.

---

## 🎯 Feature Summary

### Development Mode
- **Strategy:** Fetch details for the **first car only**
- **Purpose:** Quick testing without overwhelming the API
- **Output:** `output/first-car-details.json`

### Production Mode
- **Strategy:** Smart comparison - fetch details **only for new cars**
- **Purpose:** Efficient monitoring, avoid redundant API calls
- **Output:** `output/new-cars-<timestamp>.json`

---

## 🔄 How It Works

### Development Mode Flow

```
1. Scrape car list
2. Extract first car from results
3. Parse vehicle ID from detailsUrl
4. Fetch detailed info via POST request
5. Save combined data (basic + detailed) to file
```

**Example:**
```bash
npm run start:dev
```

**Output File:** `output/first-car-details.json`
```json
{
  "basicInfo": {
    "detailsUrl": "/FindVehicle?auction=MAN&info_id=4JGFB4KB5MA505280o",
    "make": "Mercedes-Benz",
    "model": "GLE 350",
    "year": 2020,
    "price": "$45,000"
  },
  "detailedInfo": {
    "vin": "4JGFB4KB5MA505280",
    "engine": "3.0L V6 Turbo",
    "transmission": "9-Speed Automatic",
    "mileage": "45,000 km",
    "condition": "Excellent",
    "features": [...],
    "images": [...]
  },
  "timestamp": "2026-03-04T14:30:00.000Z"
}
```

---

### Production Mode Flow

#### First Run (Redis Empty)

```
1. Phase 1: Initial Scrape
   ├─ Scrape car list
   ├─ Save to Redis
   └─ Log: "Initial scrape saved"

2. Wait 5 seconds

3. Phase 2: Comparison Scrape
   ├─ Scrape car list again
   ├─ Compare with Phase 1 results
   ├─ Identify new cars
   ├─ Fetch details for new cars
   ├─ Save to output/new-cars-<timestamp>.json
   └─ Update Redis with latest data

4. Continue on schedule (e.g., every 6 hours)
```

#### Subsequent Runs (Redis Has Data)

```
1. Load previous scrape from Redis
2. Perform new scrape
3. Compare: current vs previous
4. Identify new cars (not in previous scrape)
5. Fetch details ONLY for new cars
6. Save to output/new-cars-<timestamp>.json
7. Update Redis with latest data
8. Wait for next scheduled run
```

**Example:**
```bash
npm run start:prod
```

**Console Output:**
```
=== Starting Scraping Job (Prod Mode) ===
→ Redis is empty - performing initial scrape...

--- Phase 1: Initial Scrape ---
✓ Initial scrape saved to Redis with ID: scraping_1709563200000
→ Found 15 cars in initial scrape

→ Waiting 5 seconds before second scrape...

--- Phase 2: Comparison Scrape ---
✓ Scraping result saved to Redis with ID: scraping_1709563205000
→ Found 16 cars in current scrape
🆕 Found 1 new cars!
→ Fetching details for new cars...
✓ Successfully fetched details for 4JGFB4KB5MA505280o
✓ Saved 1 detailed car info to output/

📊 Storage stats: {
  "totalScrapings": 2,
  "lastScrapingTime": "2026-03-04T14:30:05.000Z",
  "averageCarsCount": 15,
  "storageSize": 2
}
```

**Output File:** `output/new-cars-1709563205000.json`
```json
{
  "timestamp": "2026-03-04T14:30:05.000Z",
  "newCarsCount": 1,
  "cars": [
    {
      "basicInfo": {
        "detailsUrl": "/FindVehicle?auction=MAN&info_id=4JGFB4KB5MA505280o",
        "make": "Mercedes-Benz",
        "model": "GLE 350",
        "year": 2020
      },
      "detailedInfo": {
        "vin": "4JGFB4KB5MA505280",
        "specifications": {...},
        "condition": {...}
      }
    }
  ]
}
```

---

## 🔌 API Details

### Endpoint Information

**URL:** `https://caromoto.com/FindVehicle/GetDetailInfo`

**Method:** `POST`

**Headers:**
```http
Content-Type: application/x-www-form-urlencoded
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36
```

**Request Body:**
```
auction=MAN&vehicleId=4JGFB4KB5MA505280o
```

**Example with curl:**
```bash
curl -X POST 'https://caromoto.com/FindVehicle/GetDetailInfo' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -H 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' \
  -d 'auction=MAN&vehicleId=4JGFB4KB5MA505280o'
```

---

## 🛠️ Implementation Details

### New Service: `CarDetailsService`

**Location:** `src/services/car-details.service.ts`

**Key Methods:**

1. **`extractVehicleId(detailsUrl: string): string | null`**
   - Extracts vehicle ID from detailsUrl
   - Example: `"/FindVehicle?auction=MAN&info_id=ABC123"` → `"ABC123"`

2. **`fetchCarDetails(auction: string, vehicleId: string): Promise<CarDetailsResponse>`**
   - Fetches details for a single car
   - Returns success/error response

3. **`fetchMultipleCarDetails(cars: any[], auction: string, delayMs: number): Promise<Map<string, any>>`**
   - Fetches details for multiple cars
   - Includes configurable delay between requests (default: 2000ms)
   - Returns Map of vehicleId → detailed data

4. **`findNewCars(currentCars: any[], previousCars: any[]): any[]`**
   - Compares two car lists
   - Returns cars that are in current but not in previous
   - Uses vehicle ID for comparison

### Updated `RedisStorageService`

**New Methods:**

1. **`isEmpty(): Promise<boolean>`**
   - Checks if Redis has any scraping history
   - Used to determine if this is the first run

2. **`getPreviousCarsData(): Promise<any[] | null>`**
   - Retrieves the latest scraping result
   - Used for comparison in subsequent runs

### Updated `main.ts`

**New Flow Methods:**

1. **`runScrapingJobSimple()`** - Dev mode
   - Scrapes once
   - Fetches details for first car
   - Saves to file

2. **`performInitialScrape()`** - First prod run
   - Scrapes twice with 5-second delay
   - Establishes baseline for comparison

3. **`performComparisonScrape()`** - Subsequent prod runs
   - Compares current vs previous
   - Fetches details only for new cars

---

## 📁 Output Files

### Development Mode
```
output/
└── first-car-details.json        # First car with detailed info
```

### Production Mode
```
output/
├── new-cars-1709563200000.json   # New cars from first comparison
├── new-cars-1709584800000.json   # New cars from second run
└── new-cars-1709606400000.json   # New cars from third run
```

---

## ⚙️ Configuration

### Rate Limiting

**Development Mode:**
- No delay (only 1 car)

**Production Mode:**
- 2 second delay between detail requests
- Configurable in `fetchMultipleCarDetails()` call

### Comparison Logic

**How cars are identified as "new":**
1. Extract vehicle ID from `detailsUrl` field
2. Compare vehicle IDs: current scrape vs previous scrape
3. Cars with IDs not in previous scrape = NEW

**Vehicle ID extraction:**
- Pattern: `/info_id=([^&]+)/`
- Example: `info_id=4JGFB4KB5MA505280o` → `4JGFB4KB5MA505280o`

---

## 🎛️ Usage Examples

### Quick Dev Test
```bash
# Test scraper + details fetching for first car
npm run start:dev

# Check the result
cat output/first-car-details.json | jq '.'
```

### Production Initial Setup
```bash
# Start Redis
docker-compose up -d

# First production run (Redis is empty)
npm run start:prod

# What happens:
# 1. Scrape #1 -> Save to Redis
# 2. Wait 5 sec
# 3. Scrape #2 -> Compare -> Fetch new car details
# 4. Continue on schedule

# Check new cars
ls -la output/new-cars-*.json
```

### Production Monitoring
```bash
# Already running with data in Redis
npm run start:prod

# On each scheduled run:
# 1. Load previous scrape
# 2. Perform new scrape  
# 3. Find new cars
# 4. Fetch their details
# 5. Save to timestamped file

# Monitor for new cars
watch -n 60 'ls -lth output/new-cars-*.json | head -3'
```

---

## 🔍 Debugging

### Check Vehicle ID Extraction
```bash
# In Node REPL
node
> const { CarDetailsService } = require('./build/services/car-details.service');
> const service = CarDetailsService.getInstance();
> service.extractVehicleId('/FindVehicle?auction=MAN&info_id=ABC123xyz')
'ABC123xyz'
```

### Manual Detail Fetch
```bash
curl -X POST 'https://caromoto.com/FindVehicle/GetDetailInfo' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'auction=MAN&vehicleId=4JGFB4KB5MA505280o' | jq '.'
```

### Check Redis Data
```bash
# Connect to Redis
docker exec -it caromoto-redis redis-cli

# Check latest scraping
GET caromoto:scraping:latest

# Check history
LRANGE caromoto:scraping:history 0 -1

# Check stats
HGETALL caromoto:scraping:stats
```

---

## 🚨 Error Handling

### Failed Detail Fetch
- Logs warning but continues processing other cars
- Does not crash the application
- Failed cars are skipped in the output

### Network Issues
- Retries are handled by the fetch implementation
- Timeout protection via Playwright configuration
- Graceful degradation: saves what was successfully fetched

### Invalid Vehicle IDs
- Logged as warning
- Skipped in processing
- Application continues with valid cars

---

## 📊 Performance Considerations

### API Load
- **Dev mode:** 1 request per run (minimal)
- **Prod mode:** Only new cars (efficient)
- **Rate limiting:** 2 second delay prevents overwhelming server

### Memory Usage
- Detail data is saved to files immediately
- Not held in memory for extended periods
- Redis stores only basic car info for comparison

### Storage
- JSON files compressed naturally by filesystem
- Old files can be archived/deleted manually
- Consider log rotation for long-running deployments

---

## 🔮 Future Enhancements

1. **Configurable detail fetching**
   - Option to fetch all cars in prod mode
   - Toggle details fetching on/off

2. **Batch optimization**
   - Parallel detail requests with concurrency limit
   - Reduce total time for many new cars

3. **Data persistence**
   - Store detailed info in Redis
   - Query interface for historical details

4. **Notifications**
   - Telegram alert when new cars are found
   - Include basic info in notification

---

## ✅ Testing Checklist

- [ ] Dev mode fetches first car details
- [ ] Prod mode performs initial double-scrape
- [ ] Prod mode compares and finds new cars
- [ ] Vehicle ID extraction works correctly
- [ ] API requests succeed
- [ ] Output files are created
- [ ] Rate limiting works (2 sec delay)
- [ ] Error handling doesn't crash app
- [ ] Redis comparison logic works
- [ ] Telegram notifications still work

---

## 📝 Summary

This feature adds intelligent car detail fetching with:
- ✅ Minimal API calls (dev: 1, prod: only new)
- ✅ Smart comparison logic
- ✅ Graceful error handling
- ✅ Rate limiting protection
- ✅ Easy debugging and monitoring
- ✅ Production-ready implementation
