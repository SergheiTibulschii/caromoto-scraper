#!/bin/bash

# Caromoto Scraper - Cloud Run Deployment Script
# This script helps deploy the application to Google Cloud Run

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
REGION="${REGION:-europe-west1}"
SERVICE_NAME="${SERVICE_NAME:-caromoto-scraper}"
MEMORY="${MEMORY:-2Gi}"
CPU="${CPU:-2}"
TIMEOUT="${TIMEOUT:-3600}"
MAX_INSTANCES="${MAX_INSTANCES:-1}"
MIN_INSTANCES="${MIN_INSTANCES:-1}"

echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Caromoto Scraper Cloud Run Deploy   ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}Error: gcloud CLI is not installed${NC}"
    echo "Please install it from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if user is logged in
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" &> /dev/null; then
    echo -e "${YELLOW}You are not logged in to gcloud${NC}"
    echo "Running: gcloud auth login"
    gcloud auth login
fi

# Get current project
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)

if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}Error: No GCP project is set${NC}"
    echo "Please run: gcloud config set project YOUR_PROJECT_ID"
    exit 1
fi

echo -e "${GREEN}✓ Using project: ${PROJECT_ID}${NC}"
echo -e "${GREEN}✓ Region: ${REGION}${NC}"
echo ""

# Ask deployment method
echo "Choose deployment method:"
echo "  1) Quick deploy (build and deploy from source)"
echo "  2) Using Cloud Build (recommended for CI/CD)"
echo "  3) Manual Docker build"
read -p "Enter choice [1-3]: " choice

case $choice in
    1)
        echo -e "${YELLOW}Deploying from source...${NC}"
        
        # Check if .env.production exists
        if [ ! -f .env.production ]; then
            echo -e "${YELLOW}Warning: .env.production not found${NC}"
            echo "Make sure to set environment variables and secrets after deployment"
        fi
        
        gcloud run deploy $SERVICE_NAME \
            --source . \
            --region=$REGION \
            --platform=managed \
            --allow-unauthenticated \
            --memory=$MEMORY \
            --cpu=$CPU \
            --timeout=$TIMEOUT \
            --max-instances=$MAX_INSTANCES \
            --min-instances=$MIN_INSTANCES \
            --set-env-vars="NODE_ENV=production,PLAYWRIGHT_HEADLESS=true"
        
        echo -e "${GREEN}✓ Deployment complete!${NC}"
        ;;
        
    2)
        echo -e "${YELLOW}Deploying using Cloud Build...${NC}"
        
        # Enable required APIs
        echo "Enabling required APIs..."
        gcloud services enable cloudbuild.googleapis.com
        gcloud services enable run.googleapis.com
        
        # Submit build
        gcloud builds submit \
            --config=cloudbuild.yaml
        
        echo -e "${GREEN}✓ Deployment complete!${NC}"
        ;;
        
    3)
        echo -e "${YELLOW}Building and pushing Docker image...${NC}"
        
        IMAGE_NAME="gcr.io/$PROJECT_ID/$SERVICE_NAME"
        TAG=$(date +%Y%m%d-%H%M%S)
        
        # Build image
        echo "Building Docker image..."
        docker build -t $IMAGE_NAME:$TAG -t $IMAGE_NAME:latest .
        
        # Configure Docker for GCR
        echo "Configuring Docker authentication..."
        gcloud auth configure-docker
        
        # Push image
        echo "Pushing image to GCR..."
        docker push $IMAGE_NAME:$TAG
        docker push $IMAGE_NAME:latest
        
        # Deploy
        echo "Deploying to Cloud Run..."
        gcloud run deploy $SERVICE_NAME \
            --image=$IMAGE_NAME:$TAG \
            --region=$REGION \
            --platform=managed \
            --allow-unauthenticated \
            --memory=$MEMORY \
            --cpu=$CPU \
            --timeout=$TIMEOUT \
            --max-instances=$MAX_INSTANCES \
            --min-instances=$MIN_INSTANCES
        
        echo -e "${GREEN}✓ Deployment complete!${NC}"
        ;;
        
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

# Get service URL
echo ""
echo -e "${GREEN}Getting service details...${NC}"
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
    --region=$REGION \
    --format="value(status.url)")

echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         Deployment Successful!         ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "Service URL: ${GREEN}$SERVICE_URL${NC}"
echo ""
echo "Next steps:"
echo "  1. Set up environment variables and secrets (see DEPLOYMENT.md)"
echo "  2. View logs: gcloud run services logs read $SERVICE_NAME --region=$REGION"
echo "  3. Monitor: https://console.cloud.google.com/run/detail/$REGION/$SERVICE_NAME"
echo ""
echo "Useful commands:"
echo "  - View logs: gcloud run services logs tail $SERVICE_NAME --region=$REGION"
echo "  - Update service: ./deploy.sh"
echo "  - Delete service: gcloud run services delete $SERVICE_NAME --region=$REGION"
echo ""
