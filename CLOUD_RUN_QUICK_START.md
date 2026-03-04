# Cloud Run Quick Start

## TL;DR - Deploy in 3 Steps

### 1. Prerequisites

```bash
# Install gcloud CLI: https://cloud.google.com/sdk/docs/install
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

### 2. Set Up Redis

**Easiest option - Upstash (Free tier, no VPC needed):**

1. Go to https://upstash.com/
2. Create a free account
3. Create a Redis database
4. Copy the connection details (host, port, password)

### 3. Deploy

```bash
# Make deploy script executable
chmod +x deploy.sh

# Run deployment
./deploy.sh
```

Choose option 1 (Quick deploy), then set your environment variables:

```bash
# Set secrets
echo -n "your-email@example.com" | gcloud secrets create caromoto-email --data-file=-
echo -n "your-password" | gcloud secrets create caromoto-password --data-file=-
echo -n "your-bot-token" | gcloud secrets create telegram-bot-token --data-file=-
echo -n "your-chat-id" | gcloud secrets create telegram-chat-id --data-file=-
echo -n "your-redis-host.upstash.io" | gcloud secrets create redis-host --data-file=-
echo -n "6379" | gcloud secrets create redis-port --data-file=-
echo -n "your-redis-password" | gcloud secrets create redis-password --data-file=-

# Update service with secrets
gcloud run services update caromoto-scraper \
  --region=europe-west1 \
  --update-secrets=CAROMOTO_EMAIL=caromoto-email:latest,CAROMOTO_PASSWORD=caromoto-password:latest,TELEGRAM_BOT_TOKEN=telegram-bot-token:latest,TELEGRAM_CHAT_ID=telegram-chat-id:latest,REDIS_HOST=redis-host:latest,REDIS_PORT=redis-port:latest,REDIS_PASSWORD=redis-password:latest
```

## Production Features

✅ **Crash Recovery**: App automatically recovers from errors without restarting
✅ **No Nodemon**: Uses pure Node.js in production
✅ **Optimized Docker**: Multi-stage build with Playwright pre-installed
✅ **Persistent Scheduler**: Keeps running with heartbeat logs every minute
✅ **Resource Efficient**: 2Gi memory, 2 CPU cores

## View Logs

```bash
# Stream logs
gcloud run services logs tail caromoto-scraper --region=europe-west1

# View last 100 logs
gcloud run services logs read caromoto-scraper --region=europe-west1 --limit=100
```

## Local Docker Testing

```bash
# Build
docker build -t caromoto-scraper:test .

# Run with your .env file
docker run --rm --env-file .env caromoto-scraper:test
```

## Cost Estimate

With min-instances=1 (always running):
- **Cloud Run**: ~$20-30/month (2Gi RAM, always on)
- **Redis (Upstash)**: Free tier (10k commands/day)
- **Total**: ~$20-30/month

With min-instances=0 (on-demand):
- **Cloud Run**: ~$5-10/month (only when running)
- **Redis (Upstash)**: Free tier
- **Total**: ~$5-10/month
- **Note**: Scheduler won't work with min-instances=0

## Troubleshooting

**Service won't start?**
```bash
gcloud run services logs read caromoto-scraper --region=europe-west1
```

**Out of memory?**
```bash
gcloud run services update caromoto-scraper --memory=4Gi --region=europe-west1
```

**Need more details?**
See [DEPLOYMENT.md](./DEPLOYMENT.md) for comprehensive guide.
