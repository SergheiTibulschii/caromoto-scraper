import { chromium, firefox, webkit, Browser, BrowserContext } from 'playwright';
import {
  playwrightConfig,
  getLaunchOptions,
} from '../../../core/config/playwright.config';
import { BrowserManagerState } from '../types';
import LoggerService from '../../../common/shared/services/logger.service';

export class BrowserManager {
  private static instance: BrowserManager;
  private state: BrowserManagerState = {
    browser: null,
    context: null,
    isInitialized: false,
    isShuttingDown: false,
  };
  private logger: LoggerService;
  private restartAttempts = 0;
  private maxRestartAttempts = 3;

  private constructor() {
    this.logger = LoggerService.getInstance();
    this.setupProcessHandlers();
  }

  public static getInstance(): BrowserManager {
    if (!BrowserManager.instance) {
      BrowserManager.instance = new BrowserManager();
    }
    return BrowserManager.instance;
  }

  private setupProcessHandlers(): void {
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
    process.on('uncaughtException', (error) => {
      this.logger.error(
        'Uncaught exception in browser manager',
        error as Error,
      );
      this.shutdown();
    });
  }

  public async initialize(): Promise<void> {
    if (this.state.isInitialized) {
      this.logger.info('Browser already initialized');
      return;
    }

    try {
      this.logger.info('Initializing browser...');
      const launchOptions = getLaunchOptions();

      switch (playwrightConfig.browser) {
        case 'firefox':
          this.state.browser = await firefox.launch(launchOptions);
          break;
        case 'webkit':
          this.state.browser = await webkit.launch(launchOptions);
          break;
        case 'chromium':
        default:
          this.state.browser = await chromium.launch(launchOptions);
          break;
      }

      this.state.context = await this.createContext();
      this.state.isInitialized = true;
      this.restartAttempts = 0;

      this.logger.info(
        `Browser initialized successfully: ${playwrightConfig.browser}`,
      );

      this.state.browser.on('disconnected', () => {
        this.logger.warn('Browser disconnected unexpectedly');
        this.handleBrowserDisconnect();
      });
    } catch (error) {
      this.logger.error('Failed to initialize browser', error as Error);
      throw error;
    }
  }

  private async createContext(): Promise<BrowserContext> {
    if (!this.state.browser) {
      throw new Error('Browser not initialized');
    }

    const contextOptions = {
      viewport: playwrightConfig.viewport,
      userAgent: playwrightConfig.userAgent,
      ignoreHTTPSErrors: true,
      bypassCSP: true,
      // Additional options for better headless compatibility
      hasTouch: false,
      isMobile: false,
      locale: 'en-US',
      timezoneId: 'America/New_York',
      permissions: ['geolocation'],
      geolocation: { longitude: -73.935242, latitude: 40.73061 },
      colorScheme: 'light',
      deviceScaleFactor: 1,
      // Set extra HTTP headers to appear more like a real browser
      extraHTTPHeaders: {
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'sec-ch-ua':
          '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
      },
    };

    const context = await this.state.browser.newContext(contextOptions);

    if (playwrightConfig.stealthMode) {
      await this.applyStealthMode(context);
    }

    return context;
  }

  private async applyStealthMode(context: BrowserContext): Promise<void> {
    await context.addInitScript(() => {
      // Remove webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });

      // Add realistic plugin array
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });

      // Set languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });

      // Add chrome object
      (window as any).chrome = {
        runtime: {},
      };

      // Mock permissions
      Object.defineProperty(navigator, 'permissions', {
        get: () => ({
          query: () => Promise.resolve({ state: 'granted' }),
        }),
      });

      // Mock hardware concurrency
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        get: () => 8,
      });

      // Mock connection
      Object.defineProperty(navigator, 'connection', {
        get: () => ({
          effectiveType: '4g',
          rtt: 100,
          downlink: 10,
          saveData: false,
        }),
      });

      // Override the Notification permission
      const originalQuery = window.navigator.permissions.query;
      (window.navigator.permissions as any).query = (parameters: any) =>
        parameters.name === 'notifications'
          ? Promise.resolve({ state: Notification.permission })
          : originalQuery(parameters);

      // Remove automation indicators
      delete (window.document as any).__playwright;
      delete (window.document as any).__puppeteer;

      // Mock battery
      (navigator as any).getBattery = () =>
        Promise.resolve({
          charging: true,
          chargingTime: 0,
          dischargingTime: Infinity,
          level: 1,
        });
    });

    this.logger.info('Stealth mode applied to browser context');
  }

  private async handleBrowserDisconnect(): Promise<void> {
    if (this.state.isShuttingDown) {
      return;
    }

    this.state.isInitialized = false;
    this.state.browser = null;
    this.state.context = null;

    if (this.restartAttempts < this.maxRestartAttempts) {
      this.restartAttempts++;
      this.logger.info(
        `Attempting to restart browser (attempt ${this.restartAttempts}/${this.maxRestartAttempts})`,
      );

      try {
        await this.initialize();
      } catch (error) {
        this.logger.error('Failed to restart browser', error as Error);
      }
    } else {
      this.logger.error(
        'Max restart attempts reached. Manual intervention required.',
      );
    }
  }

  public async getContext(): Promise<BrowserContext> {
    if (!this.state.isInitialized || !this.state.context) {
      await this.initialize();
    }

    if (!this.state.context) {
      throw new Error('Failed to get browser context');
    }

    return this.state.context;
  }

  public async getBrowser(): Promise<Browser> {
    if (!this.state.isInitialized || !this.state.browser) {
      await this.initialize();
    }

    if (!this.state.browser) {
      throw new Error('Failed to get browser');
    }

    return this.state.browser;
  }

  public isInitialized(): boolean {
    return this.state.isInitialized;
  }

  public async restart(): Promise<void> {
    this.logger.info('Restarting browser...');
    await this.shutdown();
    await this.initialize();
  }

  public async shutdown(): Promise<void> {
    if (this.state.isShuttingDown) {
      return;
    }

    this.state.isShuttingDown = true;
    this.logger.info('Shutting down browser...');

    try {
      if (this.state.context) {
        await this.state.context.close();
        this.state.context = null;
      }

      if (this.state.browser) {
        await this.state.browser.close();
        this.state.browser = null;
      }

      this.state.isInitialized = false;
      this.logger.info('Browser shut down successfully');
    } catch (error) {
      this.logger.error('Error during browser shutdown', error as Error);
    } finally {
      this.state.isShuttingDown = false;
    }
  }

  public async createNewContext(): Promise<BrowserContext> {
    await this.getBrowser();
    return this.createContext();
  }
}

export default BrowserManager;
