import { Page, Browser, BrowserContext } from 'playwright';

export interface PlaywrightConfig {
  headless: boolean;
  browser: 'chromium' | 'firefox' | 'webkit';
  timeout: number;
  navigationTimeout: number;
  userAgent: string;
  viewport: {
    width: number;
    height: number;
  };
  maxConcurrentPages: number;
  proxy?: {
    server: string;
    username?: string;
    password?: string;
  };
  stealthMode: boolean;
}

export interface ScrapeOptions {
  waitForSelector?: string;
  waitForTimeout?: number;
  waitForLoadState?: 'load' | 'domcontentloaded' | 'networkidle';
  extractors?: Record<string, string | ExtractorConfig>;
  screenshots?: boolean;
  screenshotPath?: string;
  interceptRequests?: string[];
  blockResources?: string[];
  cookies?: Array<{
    name: string;
    value: string;
    domain?: string;
    path?: string;
  }>;
  headers?: Record<string, string>;
  viewport?: {
    width: number;
    height: number;
  };
  userAgent?: string;
  javascript?: boolean;
  retries?: number;
  timeout?: number;
  pagination?: PaginationOptions;
}

export interface ExtractorConfig {
  selector: string;
  type?: 'text' | 'html' | 'attribute' | 'multiple';
  attribute?: string;
  transform?: (value: string) => any;
}

export interface PaginationOptions {
  nextSelector: string;
  maxPages?: number;
  waitAfterClick?: number;
}

export interface ScrapedData {
  url: string;
  html?: string;
  extractedData?: Record<string, any>;
  metadata: {
    timestamp: Date;
    statusCode?: number;
    loadTime?: number;
    screenshot?: string;
  };
  jobId?: string;
  error?: string;
}

export interface ScrapingJob {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  urls: string[];
  options: ScrapeOptions;
  results: ScrapedData[];
  jobErrors: Array<{
    url: string;
    error: string;
    timestamp: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface PagePoolItem {
  page: Page;
  inUse: boolean;
  createdAt: Date;
  lastUsedAt: Date;
}

export interface BrowserManagerState {
  browser: Browser | null;
  context: BrowserContext | null;
  isInitialized: boolean;
  isShuttingDown: boolean;
}

export interface RequestInterceptorConfig {
  blockPatterns?: string[];
  capturePatterns?: string[];
  modifyHeaders?: Record<string, string>;
}

export interface ExtractedDataResult {
  success: boolean;
  data?: Record<string, any>;
  error?: string;
}

export interface NavigationOptions {
  url: string;
  waitForSelector?: string;
  timeout?: number;
  waitForLoadState?: 'load' | 'domcontentloaded' | 'networkidle';
}

export interface InteractionOptions {
  selector: string;
  action: 'click' | 'type' | 'hover' | 'scroll' | 'select';
  value?: string;
  delay?: number;
  waitAfter?: number;
}

export interface ScraperServiceResponse {
  success: boolean;
  data?: ScrapedData;
  error?: string;
}
