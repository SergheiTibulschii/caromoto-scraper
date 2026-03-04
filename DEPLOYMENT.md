# Google Cloud Run Deployment Guide

## Prerequisites

1. **Google Cloud Project**: Create a project in Google Cloud Console
2. **gcloud CLI**: Install and configure the gcloud CLI
3. **Redis Instance**: Set up a managed Redis instance (Cloud Memorystore) or use a third-party service like Upstash or Redis Cloud

## Setup

### 1. Install and Configure gcloud CLI

```bash
# Install gcloud CLI (if not already installed)
# Visit: https://cloud.google.com/sdk/docs/install

# Login to Google Cloud
gcloud auth login

# Set your project ID
gcloud config set project YOUR_PROJECT_ID

# Enable required APIs
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable redis.googleapis.com
```

### 2. Set Up Redis Instance

#### Option A: Cloud Memorystore (Recommended for Production)

```bash
# Create a Redis instance
gcloud redis instances create caromoto-redis \
    --size=1 \
    --region=europe-west1 \
    --redis-version=redis_7_0 \
    --tier=basic

# Get the Redis host and port
gcloud redis instances describe caromoto-redis \
    --region=europe-west1 \
    --format="get(host,port)"
```

#### Option B: Third-Party Redis (Easier & Free Tier Available)

- **Upstash**: https://upstash.com/ (Serverless Redis with free tier)
- **Redis Cloud**: https://redis.com/try-free/ (Free 30MB plan)
- **Railway**: https://railway.app/ (Simple deployment with Redis addon)

### 3. Configure Environment Variables

Create a `.env.production` file with your production values:

```env
NODE_ENV=production

# Redis Configuration (update with your Redis instance details)
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
REDIS_DB=0
REDIS_KEY_PREFIX=caromoto:
REDIS_ENABLE_PERSISTENCE=true
REDIS_MAX_RETRIES=5
REDIS_RETRY_DELAY=2000

# Scheduler Configuration
SCHEDULER_ENABLED=true
SCRAPER_CRON_SCHEDULE=*/5 * * * *
SCHEDULER_TIMEZONE=Europe/Chisinau
SCRAPER_RUN_ON_START=true

# Caromoto Credentials
CAROMOTO_EMAIL=your-email@example.com
CAROMOTO_PASSWORD=your-password

# Playwright Browser Configuration
PLAYWRIGHT_HEADLESS=true
PLAYWRIGHT_BROWSER=chromium
PLAYWRIGHT_TIMEOUT=30000
PLAYWRIGHT_NAVIGATION_TIMEOUT=60000
PLAYWRIGHT_USER_AGENT=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36
PLAYWRIGHT_VIEWPORT_WIDTH=1920
PLAYWRIGHT_VIEWPORT_HEIGHT=1080
PLAYWRIGHT_MAX_CONCURRENT_PAGES=3

# Telegram Configuration
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_CHAT_ID=your-chat-id
```

## Deployment Methods

### Method 1: Manual Deployment (Quick Start)

```bash
# Build and deploy in one command
gcloud run deploy caromoto-scraper \
  --source . \
  --region=europe-west1 \
  --platform=managed \
  --allow-unauthenticated \
  --memory=2Gi \
  --cpu=2 \
  --timeout=3600 \
  --max-instances=1 \
  --min-instances=1 \
  --set-env-vars="NODE_ENV=production,PLAYWRIGHT_HEADLESS=true" \
  --set-secrets="CAROMOTO_EMAIL=caromoto-email:latest,CAROMOTO_PASSWORD=caromoto-password:latest,TELEGRAM_BOT_TOKEN=telegram-bot-token:latest,TELEGRAM_CHAT_ID=telegram-chat-id:latest,REDIS_HOST=redis-host:latest,REDIS_PORT=redis-port:latest,REDIS_PASSWORD=redis-password:latest"
```

### Method 2: Using Cloud Build (Automated CI/CD)

This method uses the `cloudbuild.yaml` file for automated deployments.

```bash
# Submit build to Cloud Build
gcloud builds submit \
  --config=cloudbuild.yaml \
  --substitutions=_REGION=europe-west1
```

### Method 3: Two-Step Deployment (Build then Deploy)

```bash
# Step 1: Build the Docker image
docker build -t gcr.io/YOUR_PROJECT_ID/caromoto-scraper:latest .

# Step 2: Push to Google Container Registry
docker push gcr.io/YOUR_PROJECT_ID/caromoto-scraper:latest

# Step 3: Deploy to Cloud Run
gcloud run deploy caromoto-scraper \
  --image=gcr.io/YOUR_PROJECT_ID/caromoto-scraper:latest \
  --region=europe-west1 \
  --platform=managed \
  --allow-unauthenticated \
  --memory=2Gi \
  --cpu=2 \
  --timeout=3600 \
  --max-instances=1 \
  --min-instances=1
```

## Managing Secrets

It's recommended to use Google Cloud Secret Manager for sensitive data:

```bash
# Create secrets
echo -n "your-email@example.com" | gcloud secrets create caromoto-email --data-file=-
echo -n "your-password" | gcloud secrets create caromoto-password --data-file=-
echo -n "your-bot-token" | gcloud secrets create telegram-bot-token --data-file=-
echo -n "your-chat-id" | gcloud secrets create telegram-chat-id --data-file=-
echo -n "your-redis-host" | gcloud secrets create redis-host --data-file=-
echo -n "6379" | gcloud secrets create redis-port --data-file=-
echo -n "your-redis-password" | gcloud secrets create redis-password --data-file=-

# Deploy with secrets
gcloud run deploy caromoto-scraper \
  --image=gcr.io/YOUR_PROJECT_ID/caromoto-scraper:latest \
  --region=europe-west1 \
  --set-secrets="CAROMOTO_EMAIL=caromoto-email:latest,CAROMOTO_PASSWORD=caromoto-password:latest,TELEGRAM_BOT_TOKEN=telegram-bot-token:latest,TELEGRAM_CHAT_ID=telegram-chat-id:latest,REDIS_HOST=redis-host:latest,REDIS_PORT=redis-port:latest,REDIS_PASSWORD=redis-password:latest"
```

## Configuration Details

### Memory and CPU

- **Memory**: 2Gi (recommended for Playwright)
- **CPU**: 2 (to handle browser operations efficiently)
- Adjust based on your needs and budget

### Timeout

- Set to 3600 seconds (1 hour) to allow long-running scraping jobs
- Cloud Run max timeout is 3600 seconds

### Instances

- **Min instances**: 1 (keeps the service warm and scheduler running)
- **Max instances**: 1 (only need one instance for scheduled jobs)

### Networking

If using Cloud Memorystore Redis, you'll need to:

1. Create a Serverless VPC Access connector:

```bash
gcloud compute networks vpc-access connectors create caromoto-connector \
  --region=europe-west1 \
  --range=10.8.0.0/28
```

2. Deploy with VPC connector:

```bash
gcloud run deploy caromoto-scraper \
  --vpc-connector=caromoto-connector \
  --vpc-egress=private-ranges-only \
  # ... other flags
```

## Testing the Deployment

```bash
# Get the service URL
gcloud run services describe caromoto-scraper \
  --region=europe-west1 \
  --format="value(status.url)"

# View logs
gcloud run services logs read caromoto-scraper \
  --region=europe-west1 \
  --limit=50

# Stream logs
gcloud run services logs tail caromoto-scraper \
  --region=europe-west1
```

## Local Testing with Docker

Before deploying, test locally:

```bash
# Build the image
docker build -t caromoto-scraper:local .

# Run with environment variables
docker run --rm \
  --env-file .env \
  -p 8080:8080 \
  caromoto-scraper:local
```

## Monitoring

1. **Cloud Console**: View logs, metrics, and traces in Google Cloud Console
2. **Logs Explorer**: Search and filter logs
3. **Cloud Monitoring**: Set up alerts for errors or performance issues

```bash
# Create an alert policy for errors
gcloud alpha monitoring policies create \
  --notification-channels=YOUR_CHANNEL_ID \
  --display-name="Caromoto Scraper Errors" \
  --condition-display-name="Error rate" \
  --condition-threshold-value=1 \
  --condition-threshold-duration=60s
```

## Troubleshooting

### Service won't start

- Check logs: `gcloud run services logs read caromoto-scraper --region=europe-west1`
- Verify environment variables are set correctly
- Ensure Redis connection details are correct

### Out of memory

- Increase memory allocation to 4Gi or 8Gi
- Reduce `PLAYWRIGHT_MAX_CONCURRENT_PAGES`

### Timeout errors

- Increase timeout value (max 3600s)
- Optimize scraping logic to run faster

### Browser errors

- Ensure Playwright dependencies are installed (Dockerfile handles this)
- Verify `PLAYWRIGHT_HEADLESS=true` is set
- Check if memory is sufficient

## Cost Optimization

- Use **min-instances=0** if you don't need the scheduler running constantly (but note: cold starts will occur)
- Use **smaller memory/CPU** if performance allows
- Consider **scheduled Cloud Run Jobs** instead of always-on service
- Use **Upstash Redis** (serverless) instead of Cloud Memorystore for lower costs

## Maintenance

### Update the deployed service

```bash
# After making code changes
gcloud run deploy caromoto-scraper \
  --source . \
  --region=europe-west1
```

### Rollback to previous revision

```bash
# List revisions
gcloud run revisions list \
  --service=caromoto-scraper \
  --region=europe-west1

# Route traffic to previous revision
gcloud run services update-traffic caromoto-scraper \
  --to-revisions=REVISION_NAME=100 \
  --region=europe-west1
```

## Security Best Practices

1. ✅ Use Secret Manager for sensitive data
2. ✅ Run as non-root user (Dockerfile already configured)
3. ✅ Use `--no-allow-unauthenticated` if you don't need public access
4. ✅ Enable VPC for Cloud Memorystore connection
5. ✅ Regularly update dependencies
6. ✅ Monitor logs for security issues

## Support

For issues or questions:
- Check Cloud Run documentation: https://cloud.google.com/run/docs
- View service logs for error details
- Test locally with Docker first
