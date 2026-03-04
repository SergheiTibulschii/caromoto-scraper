import dotenv from 'dotenv';
import { MercedesGLEScraper } from './apps/scraper/caromoto-auth-mercedes-gle-scraper';
import { RedisStorageService } from './services/redis-storage.service';
import { SchedulerService } from './services/scheduler.service';
import { CarDetailsService } from './services/car-details.service';
import { schedulerConfig } from './core/config/scheduler.config';
import LoggerService from './common/shared/services/logger.service';
import * as fs from 'fs';
import * as path from 'path';
import { TelegramService } from './services';
import { extractVitalDetails } from './common/utils/format-car-details';

dotenv.config();

type AppMode = 'dev' | 'prod';

class CaromotoScraperApp {
  private scraper: MercedesGLEScraper;
  private storage?: RedisStorageService;
  private scheduler?: SchedulerService;
  private carDetailsService: CarDetailsService;
  private telegram: TelegramService;
  private logger: LoggerService;
  private isShuttingDown = false;
  private mode: AppMode;
  private outputDir: string;
  private readonly MAX_RETRIES = 3;

  constructor(mode: AppMode = 'prod') {
    this.mode = mode;
    this.scraper = new MercedesGLEScraper();
    this.carDetailsService = CarDetailsService.getInstance();
    this.telegram = TelegramService.getInstance();
    this.logger = LoggerService.getInstance();
    this.outputDir = path.join(__dirname, '../output');

    if (this.mode === 'prod') {
      this.storage = RedisStorageService.getInstance();
      this.scheduler = SchedulerService.getInstance();
    }
  }

  async initialize(): Promise<void> {
    try {
      if (this.mode === 'dev') {
        this.logger.info('=== Caromoto Scraper - DEV MODE ===');
        this.setupProcessHandlers();
        await this.runScrapingJobSimple();
        await this.shutdown();
      } else {
        this.logger.info('=== Caromoto Scraper - PRODUCTION MODE ===');

        if (!this.storage) {
          throw new Error('Redis storage not initialized');
        }

        await this.storage.connect();

        const isConnected = await this.storage.isConnected();
        if (!isConnected) {
          throw new Error('Redis connection failed');
        }

        this.setupProcessHandlers();

        if (schedulerConfig.enabled) {
          await this.setupScheduler();
        } else {
          await this.runScrapingJob();
          await this.shutdown();
        }
      }
    } catch (error) {
      this.logger.error('Initialization failed', error as Error);
      throw error;
    }
  }

  private async setupScheduler(): Promise<void> {
    if (!this.scheduler) {
      throw new Error('Scheduler not initialized');
    }

    this.logger.info(
      `Scheduler: ${schedulerConfig.cronExpression} (${schedulerConfig.timezone})`,
    );

    await this.scheduler.scheduleJob({
      name: 'mercedes-gle-scraper',
      cronExpression: schedulerConfig.cronExpression,
      handler: async () => {
        await this.runScrapingJob();
      },
      runOnStart: schedulerConfig.runOnStart,
      enabled: true,
    });

    this.logNextJobTime();
    this.logger.info('Scheduler active. Press CTRL+C to stop.');

    // Keep the process alive explicitly
    this.keepAlive();
  }

  private keepAlive(): void {
    // Log every minute to confirm process is alive
    setInterval(() => {
      this.logger.info('[HEARTBEAT] Process alive, scheduler running');
      this.logNextJobTime();
    }, 60000); // Every 1 minute
  }

  private logNextJobTime(): void {
    const now = new Date();
    const nextRun = new Date(now);
    nextRun.setMinutes(Math.ceil(now.getMinutes() / 5) * 5, 0, 0);

    if (nextRun <= now) {
      nextRun.setMinutes(nextRun.getMinutes() + 5);
    }

    const minutesUntil = Math.round(
      (nextRun.getTime() - now.getTime()) / 60000,
    );
    this.logger.info(
      `Next scheduled run: ${nextRun.toLocaleTimeString()} (in ${minutesUntil} minutes)`,
    );
  }

  private async runScrapingJobSimple(): Promise<void> {
    this.logger.info('Starting scrape...');

    try {
      const result = await this.scraper.scrape();

      if (result && result.success && result.data) {
        const extractedData = result.data.extractedData as any;

        if (extractedData?.result?.searchModel?.cars) {
          const carsData = extractedData.result.searchModel.cars;
          this.logger.info(`✓ Found ${carsData.length} cars`);

          if (carsData.length > 0) {
            this.logger.info('→ Fetching details for first car...');

            const firstCar = carsData[0];

            if (firstCar) {
              const detailsResult =
                await this.carDetailsService.fetchCarDetails(
                  firstCar.auctionCode,
                  firstCar.vehicleId,
                );

              if (detailsResult.success) {
                this.saveToFile(detailsResult.data, 'first-car-details.json');

                const carDetailsCondensed = extractVitalDetails(
                  detailsResult.data.result,
                );

                await this.sendCarNotification(carDetailsCondensed);

                this.logger.info('✓ Sent notification to Telegram');
              } else {
                this.logger.error(
                  `✗ Failed to fetch car details: ${detailsResult.error || 'Unknown error'}`,
                );
              }
            }
          }

          this.logger.info('✓ Scraping completed');
        } else {
          this.logger.warn('No cars data found');
        }
      } else {
        this.logger.error('✗ Scraping failed:', result.error);
      }
    } catch (error) {
      this.logger.error('Error in scraping job', error as Error);
      throw error;
    }
  }

  private async runScrapingJob(): Promise<void> {
    if (!this.storage) {
      throw new Error('Storage not initialized');
    }

    const jobStartTime = new Date();
    this.logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    this.logger.info(`[JOB START] ${jobStartTime.toLocaleString()}`);
    this.logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    let attempt = 0;
    let success = false;
    let lastError: Error | null = null;

    while (attempt < this.MAX_RETRIES && !success) {
      attempt++;

      try {
        await this.performScrapeWithComparison();
        success = true;
        const jobEndTime = new Date();
        const duration = (
          (jobEndTime.getTime() - jobStartTime.getTime()) /
          1000
        ).toFixed(2);
        this.logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        this.logger.info(`[JOB SUCCESS] Completed in ${duration}s`);
        this.logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      } catch (error) {
        lastError = error as Error;

        if (attempt < this.MAX_RETRIES) {
          this.logger.warn(
            `[RETRY] Attempt ${attempt}/${this.MAX_RETRIES} failed, retrying...`,
          );
          await this.delay(2000);
        }
      }
    }

    if (!success) {
      this.logger.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      this.logger.error(
        `[JOB FAILED] After ${this.MAX_RETRIES} attempts: ${lastError?.message || 'Unknown error'}`,
      );
      this.logger.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    }
  }

  private async performScrapeWithComparison(): Promise<void> {
    if (!this.storage) return;

    const storedCars = await this.storage.getStoredCarsData();

    const result = await this.scraper.scrape();

    if (!result || !result.success || !result.data) {
      throw new Error(result?.error || 'Scraping failed');
    }

    const extractedData = result.data.extractedData as any;
    const scrapedCars = extractedData?.result?.searchModel?.cars;

    if (!scrapedCars || scrapedCars.length === 0) {
      throw new Error('No cars found in scraping result');
    }

    if (storedCars && storedCars.length > 0) {
      const newCars = this.carDetailsService.findNewCars(
        scrapedCars,
        storedCars,
      );

      if (newCars.length > 0) {
        this.logger.info(`Found ${newCars.length} new car(s)`);
        await this.processAndNotifyNewCars(newCars);
      }
    }

    await this.storage.saveScrapingResult(scrapedCars, {
      carsCount: scrapedCars.length,
      loadTime: result.data.metadata.loadTime,
    });
  }

  private async processAndNotifyNewCars(newCars: any[]): Promise<void> {
    try {
      const detailsMap = await this.carDetailsService.fetchMultipleCarDetails(
        newCars,
        2000,
      );
      const detailedCars = Array.from(detailsMap.values());

      for (const carDetails of detailedCars) {
        if (carDetails.detailedInfo?.result) {
          const carDetailsCondensed = extractVitalDetails(
            carDetails.detailedInfo.result,
          );
          await this.sendCarNotification(carDetailsCondensed);
        }
      }
    } catch (error) {
      this.logger.error('Failed to process new cars', error as Error);
    }
  }

  private async sendCarNotification(car: any): Promise<void> {
    try {
      const message = `
*Grade:* ${car.conditionGrade} (${car.evaluations.grade})
━━━━━━━━━━━━━━━━━━━━

🚗 *${car.vehicle}*

💰 *PRICING* (${car.evaluations.priceDiff})
━━━━━━━━━━━━━━━━━━━━
*Estimated Price:* ${car.estimatedPrice}
*Min. Offer:* ${car.minimumOffer}
*Buy Now:* ${car.buyNowPrice}

📊 *DETAILS*
━━━━━━━━━━━━━━━━━━━━
*Mileage:* ${car.odometer} — ${car.evaluations.mileage}
*Paint:* ${car.evaluations.paint}
*History:* ${car.evaluations.damageHistory}

🚨 *STATUS* (${car.evaluations.redFlags})
━━━━━━━━━━━━━━━━━━━━
${car.redFlagsList.length > 0 ? '\n⚠️ *Red Flags:*\n' + car.redFlagsList.map((flag: string) => `  • ${flag}`).join('\n') : ''}

🔗 [View on Caromoto](${car.carLink})
`.trim();

      if (car.imageUrl) {
        await this.telegram.sendPhoto(car.imageUrl, message);
      } else {
        await this.telegram.sendMessage(message);
      }
    } catch (error) {
      this.logger.error('Failed to send notification', error as Error);
    }
  }

  private saveToFile(data: any, filename: string): void {
    try {
      if (!fs.existsSync(this.outputDir)) {
        fs.mkdirSync(this.outputDir, { recursive: true });
      }

      const filePath = path.join(this.outputDir, filename);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      this.logger.info(`→ Saved to: ${filePath}`);
    } catch (error) {
      this.logger.error('Failed to save file', error as Error);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private setupProcessHandlers(): void {
    process.on('SIGTERM', () => {
      this.logger.info('Received SIGTERM signal');
      this.shutdown();
    });

    process.on('SIGINT', () => {
      this.logger.info('Received SIGINT signal');
      this.shutdown();
    });

    process.on('uncaughtException', (error) => {
      this.logger.error(
        '⚠️  UNCAUGHT EXCEPTION - This should not shutdown in production',
        error,
      );
      // Don't shutdown in production mode with scheduler
      if (this.mode === 'dev' || !schedulerConfig.enabled) {
        this.shutdown();
      }
    });

    process.on('unhandledRejection', (reason) => {
      this.logger.error(
        '⚠️  UNHANDLED REJECTION - This should not shutdown in production',
        new Error(String(reason)),
      );
      // Don't shutdown in production mode with scheduler
      if (this.mode === 'dev' || !schedulerConfig.enabled) {
        this.shutdown();
      }
    });
  }

  private async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    this.logger.info('Shutting down...');

    try {
      if (this.scheduler) {
        this.scheduler.stopAll();
      }
      await this.scraper.shutdown();
      if (this.storage) {
        await this.storage.disconnect();
      }
      this.logger.info('Shutdown complete');
      process.exit(0);
    } catch (error) {
      this.logger.error('Shutdown error', error as Error);
      process.exit(1);
    }
  }

  public async getStats(): Promise<void> {
    if (!this.storage || !this.scheduler) {
      this.logger.error('Stats only available in production mode');
      return;
    }

    try {
      const storageStats = await this.storage.getStats();
      const jobStats = this.scheduler.getAllJobsStats();

      console.log('\n=== Application Statistics ===');
      console.log('\n📊 Storage Stats:');
      console.log(`  Total Scrapings: ${storageStats.totalScrapings}`);
      console.log(`  Stored Cars: ${storageStats.storageSize}`);
      console.log(
        `  Last Scrape: ${storageStats.lastScrapingTime?.toLocaleString() || 'Never'}`,
      );
      console.log(`  Avg Cars/Scrape: ${storageStats.averageCarsCount}`);

      console.log('\n🔄 Job Stats:');
      Object.entries(jobStats).forEach(([name, stats]: [string, any]) => {
        console.log(`\n  Job: ${name}`);
        console.log(
          `  Status: ${stats.isRunning ? '🟢 Running' : stats.isScheduled ? '🟡 Scheduled' : '🔴 Stopped'}`,
        );
        console.log(`  Total Runs: ${stats.totalRuns}`);
        console.log(
          `  Successful: ${stats.successfulRuns} | Failed: ${stats.failedRuns}`,
        );
        console.log(
          `  Last Run: ${stats.lastRun ? new Date(stats.lastRun).toLocaleString() : 'Never'}`,
        );
        console.log(
          `  Last Duration: ${stats.lastDuration ? `${(stats.lastDuration / 1000).toFixed(2)}s` : 'N/A'}`,
        );
      });
      console.log('\n');
    } catch (error) {
      this.logger.error('Failed to get stats', error as Error);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  // Determine mode: 'dev' runs once without Redis, 'prod' uses Redis
  const mode: AppMode = command === 'dev' ? 'dev' : 'prod';
  const app = new CaromotoScraperApp(mode);

  try {
    if (command === 'stats') {
      // Stats command requires production mode
      const statsApp = new CaromotoScraperApp('prod');
      await statsApp.initialize();
      await statsApp.getStats();
      process.exit(0);
    } else if (command === 'dev') {
      // Dev mode: run once without Redis
      await app.initialize();
    } else if (command === 'once') {
      // Once mode: production but without scheduler
      process.env.SCHEDULER_ENABLED = 'false';
      await app.initialize();
    } else {
      // Default: production mode with scheduler
      await app.initialize();
    }
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { CaromotoScraperApp };
