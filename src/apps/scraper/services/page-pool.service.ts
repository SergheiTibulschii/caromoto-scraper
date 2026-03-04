import { Page, BrowserContext } from 'playwright';
import { PagePoolItem } from '../types';
import { playwrightConfig } from '../../../core/config/playwright.config';
import LoggerService from '../../../common/shared/services/logger.service';
import BrowserManager from './browser-manager.service';

export class PagePool {
  private static instance: PagePool;
  private pool: Map<string, PagePoolItem> = new Map();
  private queue: Array<{
    resolve: (page: Page) => void;
    reject: (error: Error) => void;
  }> = [];
  private logger: LoggerService;
  private maxPages: number;
  private pageIdCounter = 0;
  private cleanupInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.logger = LoggerService.getInstance();
    this.maxPages = playwrightConfig.maxConcurrentPages;
    this.startCleanupTask();
  }

  public static getInstance(): PagePool {
    if (!PagePool.instance) {
      PagePool.instance = new PagePool();
    }
    return PagePool.instance;
  }

  private startCleanupTask(): void {
    this.cleanupInterval = setInterval(
      () => {
        this.cleanupIdlePages();
      },
      5 * 60 * 1000,
    );
  }

  private async cleanupIdlePages(): Promise<void> {
    const now = Date.now();
    const maxIdleTime = 10 * 60 * 1000;

    for (const [id, item] of this.pool.entries()) {
      if (!item.inUse && now - item.lastUsedAt.getTime() > maxIdleTime) {
        this.logger.info(`Cleaning up idle page: ${id}`);
        try {
          await item.page.close();
          this.pool.delete(id);
        } catch (error) {
          this.logger.error(`Error cleaning up page ${id}`, error as Error);
        }
      }
    }
  }

  private generatePageId(): string {
    return `page-${++this.pageIdCounter}-${Date.now()}`;
  }

  private async createPage(
    context: BrowserContext,
  ): Promise<{ id: string; page: Page }> {
    const page = await context.newPage();
    const id = this.generatePageId();

    page.setDefaultTimeout(playwrightConfig.timeout);
    page.setDefaultNavigationTimeout(playwrightConfig.navigationTimeout);

    page.on('crash', () => {
      this.logger.error(`Page ${id} crashed`);
      this.handlePageCrash(id);
    });

    page.on('close', () => {
      this.pool.delete(id);
      this.logger.info(`Page ${id} closed`);
    });

    return { id, page };
  }

  private handlePageCrash(id: string): void {
    const item = this.pool.get(id);
    if (item) {
      item.inUse = false;
      this.pool.delete(id);
      this.logger.info(`Removed crashed page ${id} from pool`);
    }
  }

  private getAvailablePage(): PagePoolItem | null {
    for (const item of this.pool.values()) {
      if (!item.inUse) {
        return item;
      }
    }
    return null;
  }

  private getPoolSize(): number {
    return this.pool.size;
  }

  private getActivePages(): number {
    let count = 0;
    for (const item of this.pool.values()) {
      if (item.inUse) {
        count++;
      }
    }
    return count;
  }

  public async acquirePage(): Promise<{ id: string; page: Page }> {
    const availablePage = this.getAvailablePage();
    if (availablePage) {
      availablePage.inUse = true;
      availablePage.lastUsedAt = new Date();

      const id =
        Array.from(this.pool.entries()).find(
          ([, item]) => item === availablePage,
        )?.[0] || '';

      this.logger.info(`Reusing existing page: ${id}`);
      return { id, page: availablePage.page };
    }

    if (this.getPoolSize() < this.maxPages) {
      try {
        const browserManager = BrowserManager.getInstance();
        const context = await browserManager.getContext();
        const { id, page } = await this.createPage(context);

        const poolItem: PagePoolItem = {
          page,
          inUse: true,
          createdAt: new Date(),
          lastUsedAt: new Date(),
        };

        this.pool.set(id, poolItem);
        this.logger.info(
          `Created new page: ${id} (${this.getPoolSize()}/${this.maxPages})`,
        );

        return { id, page };
      } catch (error) {
        this.logger.error('Failed to create new page', error as Error);
        throw error;
      }
    }

    this.logger.info(
      `Pool full (${this.getPoolSize()}/${this.maxPages}), waiting for available page...`,
    );
    return new Promise<{ id: string; page: Page }>((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.queue.findIndex(
          (item) => item.resolve === waiter.resolve,
        );
        if (index !== -1) {
          this.queue.splice(index, 1);
        }
        reject(new Error('Timeout waiting for available page'));
      }, 60000);

      const waiter = {
        resolve: (page: Page) => {
          clearTimeout(timeout);
          const id =
            Array.from(this.pool.entries()).find(
              ([, item]) => item.page === page,
            )?.[0] || '';
          resolve({ id, page });
        },
        reject: (error: Error) => {
          clearTimeout(timeout);
          reject(error);
        },
      };

      this.queue.push(waiter);
    });
  }

  public async releasePage(id: string): Promise<void> {
    const item = this.pool.get(id);
    if (!item) {
      this.logger.warn(`Attempted to release non-existent page: ${id}`);
      return;
    }

    item.inUse = false;
    item.lastUsedAt = new Date();

    try {
      await item.page.goto('about:blank');
      await item.page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
    } catch (error) {
      this.logger.error(`Error resetting page ${id}`, error as Error);
    }

    this.logger.info(`Released page: ${id}`);

    if (this.queue.length > 0) {
      const waiter = this.queue.shift();
      if (waiter) {
        item.inUse = true;
        item.lastUsedAt = new Date();
        waiter.resolve(item.page);
        this.logger.info(`Assigned page ${id} to queued request`);
      }
    }
  }

  public async destroyPage(id: string): Promise<void> {
    const item = this.pool.get(id);
    if (!item) {
      this.logger.warn(`Attempted to destroy non-existent page: ${id}`);
      return;
    }

    try {
      await item.page.close();
      this.pool.delete(id);
      this.logger.info(`Destroyed page: ${id}`);
    } catch (error) {
      this.logger.error(`Error destroying page ${id}`, error as Error);
    }
  }

  public async clear(): Promise<void> {
    this.logger.info('Clearing page pool...');

    const closePromises: Promise<void>[] = [];
    for (const [id, item] of this.pool.entries()) {
      closePromises.push(
        item.page.close().catch((error) => {
          this.logger.error(`Error closing page ${id}`, error as Error);
        }),
      );
    }

    await Promise.allSettled(closePromises);
    this.pool.clear();
    this.queue = [];

    this.logger.info('Page pool cleared');
  }

  public getStats() {
    return {
      totalPages: this.getPoolSize(),
      activePages: this.getActivePages(),
      availablePages: this.getPoolSize() - this.getActivePages(),
      queueLength: this.queue.length,
      maxPages: this.maxPages,
    };
  }

  public async shutdown(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    await this.clear();
    this.logger.info('Page pool shut down');
  }
}

export default PagePool;
