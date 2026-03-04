#!/bin/bash

# Production startup script for Caromoto Scraper
# This script starts Redis and the application in production mode

echo "=== Starting Caromoto Scraper in Production Mode ==="

# Start Redis with Docker Compose
echo "→ Starting Redis container..."
docker-compose up -d

# Wait for Redis to be ready
echo "→ Waiting for Redis to be ready..."
sleep 3

# Check if Redis is running
if docker-compose ps | grep -q "caromoto-redis.*Up"; then
    echo "✓ Redis is running"
else
    echo "✗ Failed to start Redis"
    exit 1
fi

# Build the application if needed
if [ ! -d "build" ]; then
    echo "→ Building application..."
    npm run build
fi

# Start the application
echo "→ Starting application in production mode..."
node build/main.js
