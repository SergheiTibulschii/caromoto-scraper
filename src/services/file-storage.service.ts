import * as fs from 'fs';
import * as path from 'path';
import LoggerService from '../common/shared/services/logger.service';
import { ScrapedCarData, StorageStats } from './storage.types';

interface StorageData {
  cars: any[] | null;
  lastScraping: ScrapedCarData | null;
  stats: {
    totalScrapings: number;
    totalCarsCount: number;
  };
}

export class FileStorageService {
  private static instance: FileStorageService;
  private logger: LoggerService;
  private readonly storageDir: string;
  private readonly storageFile: string;
  private data: StorageData;

  private constructor() {
    this.logger = LoggerService.getInstance();

    this.storageDir = path.join(process.cwd(), 'data');
    this.storageFile = path.join(this.storageDir, 'storage.json');

    this.logger.info('=== File Storage Configuration ===');
    this.logger.info(`Storage Directory: ${this.storageDir}`);
    this.logger.info(`Storage File: ${this.storageFile}`);

    if (process.env.NODE_ENV === 'production') {
      this.logger.warn('⚠️  Using ephemeral file storage in production');
      this.logger.warn('⚠️  Data will be lost on container restart');
      this.logger.warn('⚠️  Consider using Cloud Storage for persistence');
    }

    this.logger.info('==================================');

    this.data = {
      cars: null,
      lastScraping: null,
      stats: {
        totalScrapings: 0,
        totalCarsCount: 0,
      },
    };
  }

  public static getInstance(): FileStorageService {
    if (!FileStorageService.instance) {
      FileStorageService.instance = new FileStorageService();
    }
    return FileStorageService.instance;
  }

  public async connect(): Promise<void> {
    try {
      this.logger.info('Initializing file storage...');

      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true });
        this.logger.info(`Created storage directory: ${this.storageDir}`);
      }

      if (fs.existsSync(this.storageFile)) {
        const fileContent = fs.readFileSync(this.storageFile, 'utf-8');
        const parsed = JSON.parse(fileContent);

        // Convert timestamp back to Date if it exists
        if (parsed.lastScraping?.timestamp) {
          parsed.lastScraping.timestamp = new Date(
            parsed.lastScraping.timestamp,
          );
        }

        this.data = parsed;
        this.logger.info('✓ Loaded existing storage data');
        this.logger.info(
          `  Last scraping: ${this.data.lastScraping?.timestamp || 'Never'}`,
        );
        this.logger.info(`  Stored cars: ${this.data.cars?.length || 0}`);
      } else {
        await this.saveToFile();
        this.logger.info('✓ Created new storage file');
      }

      this.logger.info('✓ File storage service initialized successfully');
    } catch (error) {
      this.logger.error('✗ Failed to initialize file storage', error as Error);
      throw error;
    }
  }

  private async saveToFile(): Promise<void> {
    try {
      fs.writeFileSync(
        this.storageFile,
        JSON.stringify(this.data, null, 2),
        'utf-8',
      );
    } catch (error) {
      this.logger.error('Failed to save to file', error as Error);
      throw error;
    }
  }

  public async saveScrapingResult(
    cars: any[],
    metadata: { carsCount: number; loadTime: number },
  ): Promise<void> {
    try {
      const scrapingData: ScrapedCarData = {
        id: `scraping:${Date.now()}`,
        timestamp: new Date(),
        data: cars,
        carsCount: metadata.carsCount,
        loadTime: metadata.loadTime,
      };

      // Replace the current data with new data
      this.data.lastScraping = scrapingData;
      this.data.cars = cars;

      this.data.stats.totalScrapings++;
      this.data.stats.totalCarsCount = metadata.carsCount;

      await this.saveToFile();

      this.logger.info(
        `Saved scraping result: ${metadata.carsCount} cars, ${metadata.loadTime}ms load time`,
      );
    } catch (error) {
      this.logger.error('Failed to save scraping result', error as Error);
      throw error;
    }
  }

  public async getStoredCars(): Promise<ScrapedCarData | null> {
    return this.data.lastScraping;
  }

  public async getStats(): Promise<StorageStats> {
    const totalScrapings = this.data.stats.totalScrapings;
    const lastScrapingTime = this.data.lastScraping?.timestamp || null;
    const averageCarsCount = this.data.stats.totalCarsCount;

    return {
      totalScrapings,
      lastScrapingTime,
      averageCarsCount,
      storageSize: this.data.cars?.length || 0,
    };
  }

  public async clearAll(): Promise<void> {
    this.data = {
      cars: null,
      lastScraping: null,
      stats: {
        totalScrapings: 0,
        totalCarsCount: 0,
      },
    };
    await this.saveToFile();
    this.logger.info('Cleared all storage data');
  }

  public async isConnected(): Promise<boolean> {
    return fs.existsSync(this.storageFile);
  }

  public async isEmpty(): Promise<boolean> {
    return this.data.lastScraping === null;
  }

  public async getStoredCarsData(): Promise<any[] | null> {
    return this.data.cars;
  }

  public async disconnect(): Promise<void> {
    try {
      await this.saveToFile();
      this.logger.info('File storage disconnected (data saved)');
    } catch (error) {
      this.logger.error('Error during disconnect', error as Error);
    }
  }
}
