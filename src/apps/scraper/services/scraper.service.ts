import { Page } from 'playwright';
import {
  ScrapeOptions,
  ScrapedData,
  ScraperServiceResponse,
  NavigationOptions,
  InteractionOptions,
  RequestInterceptorConfig,
} from '../types';
import BrowserManager from './browser-manager.service';
import PagePool from './page-pool.service';
import DataExtractorService from './data-extractor.service';
import LoggerService from '../../../common/shared/services/logger.service';
import { playwrightConfig } from '../../../core/config/playwright.config';

export class ScraperService {
  private browserManager: BrowserManager;
  private pagePool: PagePool;
  private dataExtractor: DataExtractorService;
  private logger: LoggerService;
  private isAuthenticated = false;

  constructor() {
    this.browserManager = BrowserManager.getInstance();
    this.pagePool = PagePool.getInstance();
    this.dataExtractor = new DataExtractorService();
    this.logger = LoggerService.getInstance();
  }

  public async initialize(): Promise<void> {
    try {
      await this.browserManager.initialize();
      this.logger.info('Scraper service initialized');
    } catch (error) {
      this.logger.error('Failed to initialize scraper service', error as Error);
      throw error;
    }
  }

  public async waitForAjaxRequest(
    page: Page,
    targetUrl: string,
    timeout = 30000,
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Timeout waiting for AJAX request to ${targetUrl}`));
      }, timeout);

      const responseHandler = async (response: any) => {
        const responseUrl = response.url();
        if (responseUrl.includes(targetUrl)) {
          clearTimeout(timeoutId);
          page.off('response', responseHandler);
          try {
            const data = await response.json();
            this.logger.info(`Captured AJAX response from: ${targetUrl}`, data);
            resolve(data);
          } catch (error) {
            reject(new Error(`Failed to parse response from ${targetUrl}`));
          }
        }
      };

      page.on('response', responseHandler);
    });
  }

  private async checkIfAuthenticated(page: Page): Promise<boolean> {
    try {
      await page.goto('https://caromoto.com/md', {
        waitUntil: 'load',
        timeout: 10000,
      });

      await page.waitForTimeout(1000);

      // Check if we're still on homepage or redirected to login
      const currentUrl = page.url();
      const isLoggedIn = !currentUrl.includes('/Login');

      // Additional check: look for user account elements
      if (isLoggedIn) {
        const userElement = await page.$(
          '.user-account, .user-menu, a[href*="Logout"]',
        );
        return !!userElement;
      }

      return false;
    } catch (error) {
      this.logger.warn('Failed to check authentication status', error as Error);
      return false;
    }
  }

  public async scrapeCaromotoAuthenticated(
    email: string,
    password: string,
    searchUrl: string,
    options: ScrapeOptions = {},
  ): Promise<ScraperServiceResponse> {
    const startTime = Date.now();
    let pageId: string | null = null;
    let page: Page | null = null;

    try {
      if (!this.browserManager.isInitialized()) {
        await this.initialize();
      }

      const { id, page: acquiredPage } = await this.pagePool.acquirePage();
      pageId = id;
      page = acquiredPage;

      // Check if already authenticated
      if (this.isAuthenticated) {
        this.logger.info('Already authenticated, checking session validity...');
        const stillAuthenticated = await this.checkIfAuthenticated(page);

        if (stillAuthenticated) {
          this.logger.info('✓ Session still valid, skipping login');
          return await this.extractAndReturnData(
            page,
            startTime,
            pageId,
            searchUrl,
            options,
          );
        } else {
          this.logger.info('Session expired, re-authenticating...');
          this.isAuthenticated = false;
        }
      }

      this.logger.info('Step 1: Navigating directly to login page...');
      await page.goto('https://caromoto.com/md/Login?tab=signin', {
        waitUntil: 'networkidle',
        timeout: options.timeout || 30000,
      });

      this.logger.info(
        'Step 2: Waiting for page to stabilize and resources to load...',
      );
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(3000);

      this.logger.info(
        'Step 3: Checking for and dismissing any modals or overlays...',
      );

      // Try to close any cookie consent or modal popups
      try {
        const closeButtons = await page.$$(
          'button[class*="close"], button[class*="dismiss"], .modal-close, [aria-label*="Close"]',
        );
        for (const button of closeButtons) {
          try {
            await button.click({ timeout: 1000 });
            await page.waitForTimeout(500);
          } catch {
            // Ignore if button not clickable
          }
        }
      } catch {
        this.logger.info('No modals to dismiss');
      }

      this.logger.info(
        'Step 4: Waiting for login form to be visible and interactable...',
      );

      // Take a screenshot for debugging if form is not visible
      try {
        // Wait for the form container first
        await page.waitForSelector('form, .login-form, #signinform', {
          timeout: 20000,
          state: 'attached',
        });

        // Wait for inputs to be both visible and enabled
        await page.waitForSelector('#Signin_Email', {
          timeout: 20000,
          state: 'visible',
        });

        await page.waitForSelector('#Signin_Password', {
          timeout: 20000,
          state: 'visible',
        });

        // Additional check: ensure inputs are not covered by overlays
        const emailVisible = await page.isVisible('#Signin_Email');
        const passwordVisible = await page.isVisible('#Signin_Password');

        if (!emailVisible || !passwordVisible) {
          throw new Error(
            `Form inputs not fully visible - Email: ${emailVisible}, Password: ${passwordVisible}`,
          );
        }

        this.logger.info('✓ Login form is visible and ready');
      } catch (error) {
        this.logger.error(
          'Login form not visible, taking screenshot for debugging...',
        );
        await page.screenshot({
          path: `debug-login-form-${Date.now()}.png`,
          fullPage: true,
        });

        // Comprehensive debugging
        const emailExists = await page.$('#Signin_Email');
        const passwordExists = await page.$('#Signin_Password');
        const emailVisible = await page
          .isVisible('#Signin_Email')
          .catch(() => false);
        const passwordVisible = await page
          .isVisible('#Signin_Password')
          .catch(() => false);

        this.logger.info(
          `Email - exists: ${!!emailExists}, visible: ${emailVisible}`,
        );
        this.logger.info(
          `Password - exists: ${!!passwordExists}, visible: ${passwordVisible}`,
        );

        // Check for overlays
        const overlays = await page.$$(
          'div.modal, div.overlay, div[style*="z-index"]',
        );
        this.logger.info(`Found ${overlays.length} potential overlays`);

        // Log page URL and title
        this.logger.info(`Current URL: ${page.url()}`);
        this.logger.info(`Page title: ${await page.title()}`);

        throw error;
      }

      this.logger.info('Step 5: Filling in login credentials...');

      // Ensure inputs are interactable by clicking on them first
      await page.click('#Signin_Email', { force: false });
      await page.waitForTimeout(300);
      await page.fill('#Signin_Email', email);
      await page.waitForTimeout(500);

      // Verify email was filled
      const emailValue = await page.inputValue('#Signin_Email');
      if (emailValue !== email) {
        this.logger.warn(
          `Email input value mismatch. Expected: ${email}, Got: ${emailValue}`,
        );
        // Try again with type instead of fill
        await page.type('#Signin_Email', email, { delay: 50 });
      }

      await page.click('#Signin_Password', { force: false });
      await page.waitForTimeout(300);
      await page.fill('#Signin_Password', password);
      await page.waitForTimeout(500);

      // Verify password was filled
      const passwordValue = await page.inputValue('#Signin_Password');
      if (passwordValue !== password) {
        this.logger.warn('Password input appears empty, retrying...');
        await page.type('#Signin_Password', password, { delay: 50 });
      }

      this.logger.info('✓ Credentials filled successfully');

      this.logger.info('Step 6: Submitting login form...');
      const signInButton = await page.waitForSelector('a.login__signin', {
        timeout: 5000,
        state: 'visible',
      });

      if (!signInButton) {
        throw new Error('Sign in button not found');
      }

      await signInButton.click();

      this.logger.info('Step 7: Waiting for redirect after login...');
      await page.waitForLoadState('networkidle', { timeout: 20000 });

      const currentUrl = page.url();
      if (currentUrl.includes('/Login/Index')) {
        const errorMsg = await page.textContent(
          '.validation_summary, .error-message',
        );
        throw new Error(
          `Login failed - still on login page. Error: ${errorMsg || 'Unknown error'}`,
        );
      }

      this.logger.info('Step 8: Login successful, navigating to search URL...');
      this.isAuthenticated = true;

      return await this.extractAndReturnData(
        page,
        startTime,
        pageId,
        searchUrl,
        options,
      );
    } catch (error) {
      this.logger.error(
        'Failed to scrape Caromoto with authentication',
        error as Error,
      );

      if (page) {
        try {
          await page.screenshot({
            path: `error-screenshot-${Date.now()}.png`,
            fullPage: true,
          });
        } catch (screenshotError) {
          this.logger.error(
            'Failed to take error screenshot',
            screenshotError as Error,
          );
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      if (pageId && page) {
        await this.pagePool.releasePage(pageId);
      }
    }
  }

  private async extractAndReturnData(
    page: Page,
    startTime: number,
    pageId: string | null,
    searchUrl?: string,
    options?: ScrapeOptions,
  ): Promise<ScraperServiceResponse> {
    try {
      if (searchUrl) {
        const ajaxPromise = this.waitForAjaxRequest(
          page,
          'FindVehicle/Search',
          options?.timeout || 60000,
        );

        await page.goto(searchUrl, {
          waitUntil: 'networkidle',
          timeout: options?.timeout || 60000,
        });

        this.logger.info('Waiting for AJAX request to FindVehicle/Search...');
        const ajaxData = await ajaxPromise;

        const loadTime = Date.now() - startTime;

        const scrapedData: ScrapedData = {
          url: searchUrl,
          html: '',
          extractedData: ajaxData,
          metadata: {
            timestamp: new Date(),
            loadTime,
          },
        };

        return {
          success: true,
          data: scrapedData,
        };
      }

      return {
        success: false,
        error: 'No search URL provided',
      };
    } catch (error) {
      this.logger.error(`Failed to scrape Caromoto with auth`, error as Error);
      return {
        success: false,
        error: (error as Error).message,
      };
    } finally {
      if (pageId && page) {
        await this.pagePool.releasePage(pageId);
      }
    }
  }

  public async scrapeCaromoto(
    url = 'https://caromoto.com',
    options: ScrapeOptions = {},
  ): Promise<ScraperServiceResponse> {
    const startTime = Date.now();
    let pageId: string | null = null;
    let page: Page | null = null;

    try {
      if (!this.browserManager.isInitialized()) {
        await this.initialize();
      }

      const { id, page: acquiredPage } = await this.pagePool.acquirePage();
      pageId = id;
      page = acquiredPage;

      this.logger.info('Navigating to Caromoto...');
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: options.timeout || 60000,
      });

      this.logger.info('Waiting for AJAX request to FindVehicle/Search...');
      const ajaxData = await this.waitForAjaxRequest(
        page,
        'FindVehicle/Search',
        options.timeout || 60000,
      );

      const loadTime = Date.now() - startTime;

      const scrapedData: ScrapedData = {
        url,
        html: '',
        extractedData: ajaxData,
        metadata: {
          timestamp: new Date(),
          loadTime,
        },
      };

      return {
        success: true,
        data: scrapedData,
      };
    } catch (error) {
      this.logger.error(`Failed to scrape Caromoto: ${url}`, error as Error);
      return {
        success: false,
        error: (error as Error).message,
      };
    } finally {
      if (pageId && page) {
        await this.pagePool.releasePage(pageId);
      }
    }
  }

  public async scrapeUrl(
    url: string,
    options: ScrapeOptions = {},
  ): Promise<ScraperServiceResponse> {
    const startTime = Date.now();
    let pageId: string | null = null;
    let page: Page | null = null;

    try {
      if (!this.browserManager.isInitialized()) {
        await this.initialize();
      }

      const { id, page: acquiredPage } = await this.pagePool.acquirePage();
      pageId = id;
      page = acquiredPage;

      if (options.userAgent) {
        await page.setExtraHTTPHeaders({
          'User-Agent': options.userAgent,
        });
      }

      if (options.headers) {
        await page.setExtraHTTPHeaders(options.headers);
      }

      if (options.viewport) {
        await page.setViewportSize(options.viewport);
      }

      if (options.cookies) {
        const context = page.context();
        await context.addCookies(
          options.cookies.map((cookie) => ({
            ...cookie,
            url: url,
          })),
        );
      }

      if (options.interceptRequests || options.blockResources) {
        await this.setupRequestInterception(page, {
          blockPatterns: options.blockResources,
          capturePatterns: options.interceptRequests,
        });
      }

      await this.navigateToUrl(page, {
        url,
        waitForSelector: options.waitForSelector,
        timeout: options.timeout || playwrightConfig.navigationTimeout,
        waitForLoadState: options.waitForLoadState || 'domcontentloaded',
      });

      if (options.waitForTimeout) {
        await page.waitForTimeout(options.waitForTimeout);
      }

      if (options.pagination) {
        await this.handlePagination(page, options.pagination);
      }

      const html = await page.content();
      let extractedData: Record<string, any> | undefined;

      if (options.extractors) {
        const extractionResult = await this.dataExtractor.extractData(
          page,
          options.extractors,
        );
        if (extractionResult.success) {
          extractedData = extractionResult.data;
        }
      }

      let screenshotPath: string | undefined;
      if (options.screenshots) {
        screenshotPath =
          options.screenshotPath || `screenshot-${Date.now()}.png`;
        await page.screenshot({
          path: screenshotPath,
          fullPage: true,
        });
      }

      const loadTime = Date.now() - startTime;

      const scrapedData: ScrapedData = {
        url,
        html,
        extractedData,
        metadata: {
          timestamp: new Date(),
          loadTime,
          screenshot: screenshotPath,
        },
      };

      return {
        success: true,
        data: scrapedData,
      };
    } catch (error) {
      this.logger.error(`Failed to scrape URL: ${url}`, error as Error);
      return {
        success: false,
        error: (error as Error).message,
      };
    } finally {
      if (pageId && page) {
        await this.pagePool.releasePage(pageId);
      }
    }
  }

  private async navigateToUrl(
    page: Page,
    options: NavigationOptions,
  ): Promise<void> {
    try {
      const { url, waitForSelector, timeout, waitForLoadState } = options;

      await page.goto(url, {
        timeout: timeout || playwrightConfig.navigationTimeout,
        waitUntil: waitForLoadState || 'domcontentloaded',
      });

      if (waitForSelector) {
        await page.waitForSelector(waitForSelector, {
          timeout: timeout || playwrightConfig.timeout,
        });
      }

      this.logger.info(`Successfully navigated to: ${url}`);
    } catch (error) {
      this.logger.error(`Navigation failed: ${options.url}`, error as Error);
      throw error;
    }
  }

  private async setupRequestInterception(
    page: Page,
    config: RequestInterceptorConfig,
  ): Promise<void> {
    await page.route('**/*', (route) => {
      const url = route.request().url();
      const resourceType = route.request().resourceType();

      if (config.blockPatterns) {
        for (const pattern of config.blockPatterns) {
          if (url.includes(pattern) || resourceType === pattern.toLowerCase()) {
            route.abort();
            return;
          }
        }
      }

      if (config.modifyHeaders) {
        route.continue({ headers: config.modifyHeaders });
      } else {
        route.continue();
      }
    });

    if (config.capturePatterns && config.capturePatterns.length > 0) {
      page.on('response', async (response) => {
        const url = response.url();
        const patterns = config.capturePatterns || [];
        for (const pattern of patterns) {
          if (url.includes(pattern)) {
            try {
              const data = await response.json();
              this.logger.info(`Captured API response: ${url}`, data);
            } catch (error) {
              this.logger.warn(`Failed to parse response from ${url}`);
            }
          }
        }
      });
    }

    this.logger.info('Request interception configured');
  }

  public async interact(
    page: Page,
    options: InteractionOptions,
  ): Promise<void> {
    const { selector, action, value, delay = 100, waitAfter = 500 } = options;

    try {
      await page.waitForSelector(selector, {
        timeout: playwrightConfig.timeout,
      });

      switch (action) {
        case 'click':
          await page.click(selector, { delay });
          break;

        case 'type':
          if (!value) {
            throw new Error('Value is required for type action');
          }
          await page.fill(selector, value);
          await page.type(selector, value, { delay });
          break;

        case 'hover':
          await page.hover(selector);
          break;

        case 'scroll':
          await page.evaluate((sel) => {
            const element = document.querySelector(sel);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth' });
            }
          }, selector);
          break;

        case 'select':
          if (!value) {
            throw new Error('Value is required for select action');
          }
          await page.selectOption(selector, value);
          break;

        default:
          throw new Error(`Unknown action: ${action}`);
      }

      if (waitAfter) {
        await page.waitForTimeout(waitAfter);
      }

      this.logger.info(`Interaction completed: ${action} on ${selector}`);
    } catch (error) {
      this.logger.error(
        `Interaction failed: ${action} on ${selector}`,
        error as Error,
      );
      throw error;
    }
  }

  private async handlePagination(
    page: Page,
    pagination: ScrapeOptions['pagination'],
  ): Promise<void> {
    if (!pagination) return;

    const { nextSelector, maxPages = 10, waitAfterClick = 1000 } = pagination;
    let currentPage = 1;

    while (currentPage < maxPages) {
      try {
        const nextButton = await page.$(nextSelector);
        if (!nextButton) {
          this.logger.info('No more pages to paginate');
          break;
        }

        const isDisabled = await nextButton.isDisabled();
        if (isDisabled) {
          this.logger.info('Next button is disabled');
          break;
        }

        await nextButton.click();
        await page.waitForTimeout(waitAfterClick);

        currentPage++;
        this.logger.info(`Navigated to page ${currentPage}`);
      } catch (error) {
        this.logger.warn(`Pagination stopped at page ${currentPage}`, {
          error: (error as Error).message,
        });
        break;
      }
    }
  }

  public async extractData(
    page: Page,
    extractors: ScrapeOptions['extractors'],
  ): Promise<Record<string, any> | null | undefined> {
    if (!extractors) return null;

    const result = await this.dataExtractor.extractData(page, extractors);
    return result.success ? result.data : null;
  }

  public async takeScreenshot(
    page: Page,
    path: string,
    fullPage = true,
  ): Promise<void> {
    try {
      await page.screenshot({ path, fullPage });
      this.logger.info(`Screenshot saved: ${path}`);
    } catch (error) {
      this.logger.error('Screenshot failed', error as Error);
      throw error;
    }
  }

  public async executeBatch(
    urls: string[],
    options: ScrapeOptions = {},
  ): Promise<ScraperServiceResponse[]> {
    const results: ScraperServiceResponse[] = [];

    for (const url of urls) {
      const result = await this.scrapeUrl(url, options);
      results.push(result);

      await this.randomDelay(1000, 3000);
    }

    return results;
  }

  public async executeParallel(
    urls: string[],
    options: ScrapeOptions = {},
    concurrency = 3,
  ): Promise<ScraperServiceResponse[]> {
    const results: ScraperServiceResponse[] = [];
    const chunks: string[][] = [];

    for (let i = 0; i < urls.length; i += concurrency) {
      chunks.push(urls.slice(i, i + concurrency));
    }

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map((url) => this.scrapeUrl(url, options)),
      );
      results.push(...chunkResults);
    }

    return results;
  }

  private async randomDelay(min: number, max: number): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  public async waitForElement(
    page: Page,
    selector: string,
    timeout?: number,
  ): Promise<void> {
    await page.waitForSelector(selector, {
      timeout: timeout || playwrightConfig.timeout,
    });
  }

  public async evaluateScript<T>(
    page: Page,
    script: string | ((arg?: any) => T),
    arg?: any,
  ): Promise<T> {
    return await page.evaluate(script, arg);
  }

  public getPoolStats() {
    return this.pagePool.getStats();
  }

  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down scraper service...');
    await this.pagePool.shutdown();
    await this.browserManager.shutdown();
    this.logger.info('Scraper service shut down');
  }
}

export default ScraperService;
