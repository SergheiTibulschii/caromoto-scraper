# Web Scraper Module

A powerful web scraping module built with Playwright for handling complex web scraping tasks with support for dynamic content, pagination, request interception, and more.

## Features

- 🚀 **High Performance**: Built on Playwright for fast and reliable scraping
- 🔄 **Page Pooling**: Efficient page reuse with connection pooling
- 🎭 **Stealth Mode**: Anti-detection features to avoid bot detection
- 🌐 **Request Interception**: Block unnecessary resources and capture API calls
- 📄 **Pagination Support**: Automatic handling of paginated content
- 📊 **Data Extraction**: Flexible data extraction with CSS selectors and XPath
- 🔧 **Configurable**: Environment-based configuration
- 💾 **Data Persistence**: MongoDB integration for storing scraped data
- 📈 **Job Management**: Track scraping jobs with status monitoring

## Installation

The module is already installed as part of the project. Make sure Playwright is installed:

```bash
npm install
npx playwright install
```

## Configuration

Configure Playwright settings in your `.env` file:

```env
# Playwright Browser Configuration
PLAYWRIGHT_HEADLESS=true
PLAYWRIGHT_BROWSER=chromium
PLAYWRIGHT_TIMEOUT=30000
PLAYWRIGHT_NAVIGATION_TIMEOUT=60000
PLAYWRIGHT_USER_AGENT=Mozilla/5.0...
PLAYWRIGHT_VIEWPORT_WIDTH=1920
PLAYWRIGHT_VIEWPORT_HEIGHT=1080
PLAYWRIGHT_MAX_CONCURRENT_PAGES=5

# Anti-detection
PLAYWRIGHT_STEALTH_MODE=true
```

## API Endpoints

### 1. Scrape Single URL

**POST** `/scraper/scrape`

Scrape a single URL with custom options.

```json
{
  "url": "https://example.com",
  "options": {
    "waitForSelector": ".content",
    "extractors": {
      "title": "h1",
      "description": "p.description"
    },
    "screenshots": true
  }
}
```

### 2. Batch Scraping

**POST** `/scraper/scrape-batch`

Scrape multiple URLs in batch mode.

```json
{
  "urls": ["https://example.com/page1", "https://example.com/page2"],
  "options": {
    "waitForSelector": "main",
    "extractors": {
      "title": "h1"
    }
  }
}
```

### 3. Get Job Status

**GET** `/scraper/jobs/:id`

Get the status of a scraping job.

### 4. List All Jobs

**GET** `/scraper/jobs?page=1&limit=10&status=completed`

List all scraping jobs with pagination.

### 5. Cancel Job

**DELETE** `/scraper/jobs/:id`

Cancel a running scraping job.

### 6. Get Scraped Data

**GET** `/scraper/data?page=1&limit=10&url=https://example.com`

Get scraped data with filtering options.

### 7. Get Scraped Data by ID

**GET** `/scraper/data/:id`

Get specific scraped data by ID.

### 8. Get Pool Statistics

**GET** `/scraper/stats`

Get current page pool statistics.

## Usage Examples

### Simple Scraping

```typescript
import { ScraperService } from './apps/scraper';

const scraperService = new ScraperService();
await scraperService.initialize();

const result = await scraperService.scrapeUrl('https://example.com', {
  waitForSelector: 'h1',
  extractors: {
    title: 'h1',
    content: 'article',
  },
});

console.log(result.data);
```

### With Request Interception

```typescript
const result = await scraperService.scrapeUrl('https://example.com', {
  blockResources: ['image', 'stylesheet', 'font'],
  interceptRequests: ['*/api/*'],
  extractors: {
    data: '.content',
  },
});
```

### Pagination Handling

```typescript
const result = await scraperService.scrapeUrl('https://example.com/products', {
  pagination: {
    nextSelector: 'button.next',
    maxPages: 10,
    waitAfterClick: 2000,
  },
  extractors: {
    products: {
      selector: '.product',
      type: 'multiple',
    },
  },
});
```

### Batch Scraping

```typescript
const urls = [
  'https://example.com/1',
  'https://example.com/2',
  'https://example.com/3',
];

const results = await scraperService.executeParallel(
  urls,
  {
    extractors: { title: 'h1' },
  },
  3,
); // 3 concurrent requests
```

## Extractor Types

### Text Extraction

```typescript
extractors: {
  title: 'h1', // Simple selector
  // or
  title: {
    selector: 'h1',
    type: 'text',
  },
}
```

### HTML Extraction

```typescript
extractors: {
  content: {
    selector: 'article',
    type: 'html',
  },
}
```

### Attribute Extraction

```typescript
extractors: {
  imageUrl: {
    selector: 'img.main',
    type: 'attribute',
    attribute: 'src',
  },
}
```

### Multiple Elements

```typescript
extractors: {
  links: {
    selector: 'a',
    type: 'multiple',
    attribute: 'href',
  },
}
```

### With Transform

```typescript
extractors: {
  price: {
    selector: '.price',
    type: 'text',
    transform: (value: string) => parseFloat(value.replace('$', '')),
  },
}
```

## Advanced Features

### Stealth Mode

Automatically enabled when `PLAYWRIGHT_STEALTH_MODE=true`. Features include:

- Removing webdriver flags
- Randomizing browser fingerprints
- Using real user agents
- Simulating human-like behavior

### Page Pool Management

The page pool automatically manages browser pages for optimal performance:

- Reuses pages when possible
- Queues requests when pool is full
- Cleans up idle pages automatically
- Monitors page health

### Error Handling

The service includes comprehensive error handling:

- Automatic retries for failed requests
- Graceful degradation
- Detailed error logging
- Screenshot on error

## Models

### ScrapedData

Stores the results of scraping operations:

- `url`: The scraped URL
- `html`: The HTML content
- `extractedData`: Structured extracted data
- `metadata`: Scraping metadata (timestamp, load time, etc.)
- `jobId`: Associated job ID (if part of a batch)

### ScrapingJob

Tracks batch scraping jobs:

- `status`: Job status (pending, running, completed, failed, cancelled)
- `urls`: List of URLs to scrape
- `options`: Scraping options
- `results`: Results for each URL
- `errors`: Any errors encountered

## Examples

See the `examples/` directory for complete working examples:

1. `simple-scrape.example.ts` - Basic scraping
2. `request-interception.example.ts` - Request filtering
3. `pagination.example.ts` - Handling pagination
4. `batch-scraping.example.ts` - Multiple URLs
5. `dynamic-content.example.ts` - JavaScript-heavy SPAs

## Best Practices

1. **Use Request Interception**: Block unnecessary resources to improve performance
2. **Set Appropriate Timeouts**: Adjust timeouts based on your target sites
3. **Implement Rate Limiting**: Add delays between requests to avoid being blocked
4. **Use Stealth Mode**: Enable stealth features for better bot detection avoidance
5. **Monitor Pool Stats**: Check pool statistics to optimize concurrency settings
6. **Handle Errors Gracefully**: Always implement proper error handling
7. **Clean Up Resources**: Always call `shutdown()` when done

## Troubleshooting

### Browser fails to launch

Make sure Playwright browsers are installed:

```bash
npx playwright install
```

### Timeouts

Increase timeout values in `.env`:

```env
PLAYWRIGHT_TIMEOUT=60000
PLAYWRIGHT_NAVIGATION_TIMEOUT=120000
```

### Memory issues

Reduce concurrent pages:

```env
PLAYWRIGHT_MAX_CONCURRENT_PAGES=3
```

### Bot detection

Enable stealth mode and use rotating user agents:

```env
PLAYWRIGHT_STEALTH_MODE=true
```

## Performance Tips

1. **Parallel Processing**: Use `executeParallel()` for multiple URLs
2. **Resource Blocking**: Block images, CSS, fonts when not needed
3. **Page Reuse**: The page pool automatically reuses pages
4. **Early Exit**: Use `waitForLoadState: 'domcontentloaded'` instead of `'load'`
5. **Selective Content**: Only extract data you need

## License

This module is part of the caromoto-crawler project.
