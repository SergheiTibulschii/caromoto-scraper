import { LaunchOptions } from 'playwright';
import { PlaywrightConfig } from '../../apps/scraper/types';
import { getEnvBoolean, getEnvNumber, getEnvString } from '../utils/env.utils';

export const playwrightConfig: PlaywrightConfig = {
  headless: getEnvBoolean('PLAYWRIGHT_HEADLESS', true),
  browser:
    (getEnvString('PLAYWRIGHT_BROWSER', 'chromium') as
      | 'chromium'
      | 'firefox'
      | 'webkit') || 'chromium',
  timeout: getEnvNumber('PLAYWRIGHT_TIMEOUT', 30000),
  navigationTimeout: getEnvNumber('PLAYWRIGHT_NAVIGATION_TIMEOUT', 60000),
  userAgent: getEnvString(
    'PLAYWRIGHT_USER_AGENT',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  ),
  viewport: {
    width: getEnvNumber('PLAYWRIGHT_VIEWPORT_WIDTH', 1920),
    height: getEnvNumber('PLAYWRIGHT_VIEWPORT_HEIGHT', 1080),
  },
  maxConcurrentPages: getEnvNumber('PLAYWRIGHT_MAX_CONCURRENT_PAGES', 5),
  stealthMode: getEnvBoolean('PLAYWRIGHT_STEALTH_MODE', true),
};

if (process.env.PLAYWRIGHT_PROXY_SERVER) {
  playwrightConfig.proxy = {
    server: process.env.PLAYWRIGHT_PROXY_SERVER,
    username: process.env.PLAYWRIGHT_PROXY_USERNAME,
    password: process.env.PLAYWRIGHT_PROXY_PASSWORD,
  };
}

export const getLaunchOptions = (): LaunchOptions => {
  const options: LaunchOptions = {
    headless: playwrightConfig.headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1920,1080',
    ],
  };

  if (playwrightConfig.proxy) {
    options.proxy = playwrightConfig.proxy;
  }

  if (playwrightConfig.stealthMode) {
    options.args = [
      ...(options.args || []),
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
    ];
  }

  return options;
};

export const getUserAgents = (): string[] => {
  return [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
  ];
};

export const getRandomUserAgent = (): string => {
  const userAgents = getUserAgents();
  return userAgents[Math.floor(Math.random() * userAgents.length)];
};

export const getRandomViewport = (): { width: number; height: number } => {
  const viewports = [
    { width: 1920, height: 1080 },
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
    { width: 1536, height: 864 },
    { width: 1280, height: 720 },
  ];
  return viewports[Math.floor(Math.random() * viewports.length)];
};

export const getStealthScripts = (): string[] => {
  return [
    `
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
    `,
    `
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });
    `,
    `
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });
    `,
    `
    window.chrome = {
      runtime: {},
    };
    `,
    `
    Object.defineProperty(navigator, 'permissions', {
      get: () => ({
        query: () => Promise.resolve({ state: 'granted' }),
      }),
    });
    `,
  ];
};
