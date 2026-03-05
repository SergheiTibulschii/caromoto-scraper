# Multi-stage build for optimized production image
FROM node:18-slim AS builder

# Install dependencies needed for building
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Production stage
FROM node:18-slim

# Install Playwright dependencies and Chromium browser
RUN apt-get update && apt-get install -y \
    wget \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libwayland-client0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install production dependencies only
COPY package*.json ./
RUN npm ci --only=production

# Create output, logs, and data directories with proper permissions
RUN mkdir -p /app/output /app/logs /app/data /app/.cache && \
    chown -R node:node /app /app/output /app/logs /app/data /app/.cache

# Set environment variables
ENV NODE_ENV=production
ENV PLAYWRIGHT_HEADLESS=true
ENV PORT=8080
ENV PLAYWRIGHT_BROWSERS_PATH=/app/.cache/ms-playwright

# Copy built application from builder stage
COPY --from=builder /app/build ./build

# Switch to node user BEFORE installing browsers
USER node

# Install Playwright browsers as node user (chromium only for efficiency)
RUN npx playwright install chromium

# Expose port (Cloud Run uses PORT env variable)
EXPOSE 8080

# Start the application
CMD ["node", "build/main.js"]
