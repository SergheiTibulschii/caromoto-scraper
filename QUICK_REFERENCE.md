# Quick Reference Card

## 🚀 Commands

| Command | What It Does | Requires Docker? |
|---------|--------------|------------------|
| `npm run start:dev` | Run once, fetch first car details | ❌ No |
| `npm run start:prod` | Full production mode | ✅ Yes |
| `npm run docker:up` | Start Redis | ✅ Yes |
| `npm run docker:down` | Stop Redis | ✅ Yes |
| `npm run stats` | View statistics | ✅ Yes |
| `npm run build` | Compile TypeScript | ❌ No |

---

## 📁 Output Files

| File | Mode | Contains |
|------|------|----------|
| `output/first-car-details.json` | Dev | First car with full details |
| `output/new-cars-<timestamp>.json` | Prod | All new cars with details |
| `src/apps/scraper/.../output/GLE-350-*.json` | Both | Basic car list |

---

## 🔄 Workflows

### Dev Mode (Quick Test)
```bash
npm run start:dev
# → Scrapes
# → Fetches first car details
# → Saves to output/first-car-details.json
# → Exits
```

### Prod Mode (First Run)
```bash
npm run start:prod
# → Starts Redis
# → Scrape #1 → Save to Redis
# → Wait 5 sec
# → Scrape #2 → Compare → Fetch new car details
# → Runs on schedule (every 6 hours)
```

### Prod Mode (Subsequent Runs)
```bash
# (Already running)
# → Load previous from Redis
# → Scrape new data
# → Compare → Find NEW cars
# → Fetch details for new cars only
# → Save to output/new-cars-*.json
# → Wait for next schedule
```

---

## 🎯 Key Features

| Feature | Dev Mode | Prod Mode |
|---------|----------|-----------|
| Runs once | ✅ | ❌ (scheduled) |
| Requires Redis | ❌ | ✅ |
| Requires Docker | ❌ | ✅ |
| Fetches details for | First car only | New cars only |
| Comparison logic | ❌ | ✅ |
| Scheduling | ❌ | ✅ |
| Redis persistence | ❌ | ✅ |
| Telegram notifications | ✅ | ✅ |

---

## 🔧 Configuration

### .env Keys

**Required for Both Modes:**
```env
CAROMOTO_EMAIL=your-email
CAROMOTO_PASSWORD=your-password
```

**Required for Prod Mode:**
```env
REDIS_HOST=localhost
REDIS_PORT=6379
SCHEDULER_ENABLED=true
SCRAPER_CRON_SCHEDULE=0 */6 * * *
```

**Optional:**
```env
TELEGRAM_BOT_TOKEN=your-token
TELEGRAM_CHAT_ID=your-chat-id
PLAYWRIGHT_HEADLESS=true
```

---

## 📊 API Usage

### Detail Fetching Endpoint
```
POST https://caromoto.com/FindVehicle/GetDetailInfo
Content-Type: application/x-www-form-urlencoded

auction=MAN&vehicleId=4JGFB4KB5MA505280o
```

### Rate Limiting
- Dev mode: 1 request per run
- Prod mode: 2 second delay between requests

---

## 🐛 Troubleshooting

| Error | Solution |
|-------|----------|
| "Redis connection error" | Use dev mode OR start Docker: `npm run docker:up` |
| "Playwright browsers not installed" | Run: `npx playwright install chromium` |
| "MaxListenersExceededWarning" | Fixed! (singleton pattern) |
| "No new cars found" | Normal - means no new cars appeared |

---

## 📚 Documentation

| File | Purpose |
|------|---------|
| `WORKFLOW.md` | Complete guide with examples |
| `CAR_DETAILS_FEATURE.md` | Technical feature docs |
| `TASK_COMPLETE.md` | Implementation summary |
| `README.md` | Main documentation |

---

## ✅ Quick Start

```bash
# 1. Install dependencies (if not done)
npm install

# 2. Configure .env
cp .env.example .env
# Edit .env with your credentials

# 3. Test in dev mode
npm run start:dev

# 4. Check output
cat output/first-car-details.json

# 5. Run in production (if Docker available)
npm run start:prod
```

---

## 🎯 Examples

### Check for new cars in last 24h
```bash
find output -name "new-cars-*.json" -mtime -1
```

### View latest new cars
```bash
ls -t output/new-cars-*.json | head -1 | xargs cat | jq '.'
```

### Count total new cars found
```bash
cat output/new-cars-*.json | jq '.newCarsCount' | paste -sd+ | bc
```

### Monitor in real-time
```bash
watch -n 60 'ls -lth output/new-cars-*.json | head -5'
```

---

## 💡 Tips

1. **Dev Mode First:** Always test with `npm run start:dev` before production
2. **Check Logs:** Monitor `logs/combined.log` for issues
3. **Rate Limiting:** Don't reduce the 2-second delay (protects server)
4. **Archive Old Files:** Periodically move old `new-cars-*.json` files
5. **Redis Backups:** Docker volume persists data automatically

---

## 🎉 You're Ready!

```bash
npm run start:dev  # Quick test
npm run start:prod # Full production
```

Check `WORKFLOW.md` for detailed examples!
