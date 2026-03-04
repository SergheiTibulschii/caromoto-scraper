# Cloud Run Setup - Summary of Changes

## ✅ Issues Fixed

### 1. Production Mode No Longer Uses Nodemon
**Problem**: The `start:prod` script was running docker-compose inside the container
**Solution**: Changed to run pure Node.js with compiled JavaScript

```json
// Before
"start:prod": "npm run build && docker-compose up -d && sleep 3 && node build/main.js"

// After
"start:prod": "node build/main.js"
"start:prod:local": "npm run build && docker-compose up -d && sleep 3 && node build/main.js"
```

### 2. Automatic Crash Recovery
**Already Implemented!** The app has built-in crash recovery:

- **In Production Mode**: Uncaught exceptions and unhandled rejections are logged but don't crash the app
- **Scheduler Keeps Running**: Even if a scraping job fails, the scheduler continues
- **Heartbeat Logging**: Every minute, the app logs a heartbeat to confirm it's alive

See `src/main.ts` lines 332-346 for the implementation.

## 📦 New Files Created

### 1. `Dockerfile` (Updated)
- Multi-stage build for smaller image size
- Playwright browsers pre-installed (Chromium only)
- Production-optimized with proper security (non-root user)
- Node 18 slim base image

### 2. `.dockerignore` (Updated)
- Excludes unnecessary files from Docker build
- Reduces build time and image size

### 3. `.gcloudignore`
- Similar to .dockerignore but for gcloud deployments
- Prevents uploading unnecessary files

### 4. `cloudbuild.yaml`
- Automated CI/CD configuration
- Builds, pushes to GCR, and deploys to Cloud Run
- Pre-configured with optimal settings

### 5. `deploy.sh`
- Interactive deployment script
- Three deployment methods: quick, Cloud Build, or manual
- Handles authentication and project setup

### 6. `DEPLOYMENT.md`
- Comprehensive deployment guide
- Redis setup options (Cloud Memorystore, Upstash, Redis Cloud)
- Environment variables configuration
- Security best practices
- Monitoring and troubleshooting

### 7. `CLOUD_RUN_QUICK_START.md`
- Quick reference for deployment
- 3-step deployment process
- Cost estimates
- Common troubleshooting

## 🚀 How to Deploy

### Option 1: Quick Deploy (Recommended for First Time)

```bash
# 1. Make script executable
chmod +x deploy.sh

# 2. Run deployment
./deploy.sh

# 3. Choose option 1
```

### Option 2: One-Line Deploy

```bash
gcloud run deploy caromoto-scraper \
  --source . \
  --region=europe-west1 \
  --memory=2Gi \
  --cpu=2 \
  --timeout=3600 \
  --max-instances=1 \
  --min-instances=1
```

### Option 3: Manual Docker Build

```bash
# Build locally
docker build -t caromoto-scraper .

# Test locally
docker run --rm --env-file .env caromoto-scraper

# Then deploy using deploy.sh (option 3)
```

## 🔧 Configuration

### Required Environment Variables

You need to set these as secrets in Google Cloud:

- `CAROMOTO_EMAIL`
- `CAROMOTO_PASSWORD`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `REDIS_HOST`
- `REDIS_PORT`
- `REDIS_PASSWORD`

**Quick setup script:**

```bash
# Create all secrets at once
echo -n "your-email@example.com" | gcloud secrets create caromoto-email --data-file=-
echo -n "your-password" | gcloud secrets create caromoto-password --data-file=-
echo -n "your-bot-token" | gcloud secrets create telegram-bot-token --data-file=-
echo -n "your-chat-id" | gcloud secrets create telegram-chat-id --data-file=-
echo -n "redis-host.upstash.io" | gcloud secrets create redis-host --data-file=-
echo -n "6379" | gcloud secrets create redis-port --data-file=-
echo -n "redis-password" | gcloud secrets create redis-password --data-file=-

# Attach to Cloud Run service
gcloud run services update caromoto-scraper \
  --region=europe-west1 \
  --update-secrets=CAROMOTO_EMAIL=caromoto-email:latest,CAROMOTO_PASSWORD=caromoto-password:latest,TELEGRAM_BOT_TOKEN=telegram-bot-token:latest,TELEGRAM_CHAT_ID=telegram-chat-id:latest,REDIS_HOST=redis-host:latest,REDIS_PORT=redis-port:latest,REDIS_PASSWORD=redis-password:latest
```

## 📊 Resource Configuration

The Dockerfile and deployment scripts are configured with:

- **Memory**: 2Gi (required for Playwright browser)
- **CPU**: 2 cores (handles browser operations efficiently)
- **Timeout**: 3600 seconds (1 hour - max allowed)
- **Min Instances**: 1 (keeps scheduler running)
- **Max Instances**: 1 (only need one for scheduled jobs)

## 🔍 Monitoring

### View Logs

```bash
# Stream logs in real-time
gcloud run services logs tail caromoto-scraper --region=europe-west1

# View last 50 logs
gcloud run services logs read caromoto-scraper --region=europe-west1 --limit=50

# Search for errors
gcloud run services logs read caromoto-scraper --region=europe-west1 | grep ERROR
```

### Check Service Status

```bash
# Get service details
gcloud run services describe caromoto-scraper --region=europe-west1

# Get service URL
gcloud run services describe caromoto-scraper \
  --region=europe-west1 \
  --format="value(status.url)"
```

## 💰 Cost Estimate

### With Always-On Configuration (min-instances=1)
- Cloud Run: ~$20-30/month
- Redis (Upstash Free): $0
- **Total**: ~$20-30/month

### With On-Demand (min-instances=0)
- Cloud Run: ~$5-10/month
- Redis (Upstash Free): $0
- **Total**: ~$5-10/month
- ⚠️ **Note**: Scheduler won't work reliably with min-instances=0

## 🛠️ Troubleshooting

### Build Fails
```bash
# Check Docker build locally
docker build -t test-build .
```

### Service Crashes
```bash
# Check logs for errors
gcloud run services logs read caromoto-scraper --region=europe-west1

# Increase memory if needed
gcloud run services update caromoto-scraper --memory=4Gi --region=europe-west1
```

### Redis Connection Issues
```bash
# Test Redis connection locally
REDIS_HOST=your-host REDIS_PORT=6379 REDIS_PASSWORD=your-password npm run start:once

# Check if Redis is accessible from Cloud Run
# If using Cloud Memorystore, you need VPC connector
```

### Browser/Playwright Issues
```bash
# Ensure headless mode is enabled
gcloud run services update caromoto-scraper \
  --update-env-vars=PLAYWRIGHT_HEADLESS=true \
  --region=europe-west1

# Reduce concurrent pages to save memory
gcloud run services update caromoto-scraper \
  --update-env-vars=PLAYWRIGHT_MAX_CONCURRENT_PAGES=2 \
  --region=europe-west1
```

## 📚 Additional Resources

- **Full Deployment Guide**: [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Quick Start**: [CLOUD_RUN_QUICK_START.md](./CLOUD_RUN_QUICK_START.md)
- **Cloud Run Documentation**: https://cloud.google.com/run/docs
- **Playwright in Docker**: https://playwright.dev/docs/docker

## ✨ Key Benefits

1. **No Nodemon in Production**: Pure Node.js for stability
2. **Automatic Recovery**: App stays alive even with errors
3. **Optimized Docker Image**: Multi-stage build, smaller size
4. **Production Ready**: Proper security, logging, monitoring
5. **Easy Deployment**: Single script or one command
6. **Cost Effective**: ~$20-30/month for always-on scraper

## 🎯 Next Steps

1. Set up Redis (recommend Upstash for simplicity)
2. Run `./deploy.sh` to deploy
3. Configure secrets using the commands above
4. Monitor logs to ensure everything works
5. Adjust scheduler cron expression if needed

Happy scraping! 🚗💨
