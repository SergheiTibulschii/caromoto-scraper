import Redis from 'ioredis';
import { redisConfig } from '../core/config/redis.config';
import LoggerService from '../common/shared/services/logger.service';

export interface ScrapedCarData {
  id: string;
  timestamp: Date;
  data: any;
  carsCount: number;
  loadTime: number;
}

export interface StorageStats {
  totalScrapings: number;
  lastScrapingTime: Date | null;
  averageCarsCount: number;
  storageSize: number;
}

export class RedisStorageService {
  private static instance: RedisStorageService;
  private client: Redis;
  private logger: LoggerService;
  private readonly CARS_KEY = 'scraping:cars';
  private readonly SCRAPING_STATS_KEY = 'scraping:stats';
  private readonly MAX_CARS_STORED = 25;

  private constructor() {
    this.logger = LoggerService.getInstance();

    const redisOptions: any = {
      host: redisConfig.host,
      port: redisConfig.port,
      db: redisConfig.db,
      keyPrefix: redisConfig.keyPrefix,
      maxRetriesPerRequest: redisConfig.maxRetries,
      retryStrategy: (times: number) => {
        if (times > redisConfig.maxRetries) {
          this.logger.error('Redis max retries exceeded');
          return null;
        }
        return Math.min(times * redisConfig.retryDelay, 3000);
      },
      lazyConnect: true,
    };

    if (redisConfig.password) {
      redisOptions.password = redisConfig.password;
    }

    this.client = new Redis(redisOptions);

    this.client.on('connect', () => {
      this.logger.info('Redis connected successfully');
    });

    this.client.on('error', (error) => {
      this.logger.error('Redis connection error', error);
    });

    this.client.on('ready', async () => {
      this.logger.info('Redis is ready');

      if (redisConfig.enablePersistence) {
        try {
          await this.configurePersistence();
        } catch (error) {
          this.logger.warn(
            'Could not configure Redis persistence (may not have permissions)',
            error as Error,
          );
        }
      }
    });
  }

  public static getInstance(): RedisStorageService {
    if (!RedisStorageService.instance) {
      RedisStorageService.instance = new RedisStorageService();
    }
    return RedisStorageService.instance;
  }

  public async connect(): Promise<void> {
    try {
      await this.client.connect();
      this.logger.info('Redis storage service initialized');
    } catch (error) {
      this.logger.error('Failed to connect to Redis', error as Error);
      throw error;
    }
  }

  private async configurePersistence(): Promise<void> {
    try {
      const currentConfig = await this.client.config('GET', 'save');
      this.logger.info(
        'Current Redis save configuration:',
        currentConfig as Record<string, any>,
      );

      // Configure Redis persistence:
      // - Save after 300 seconds (5 min) if at least 1 key changed
      // - Save after 60 seconds (1 min) if at least 10 keys changed
      await this.client.config('SET', 'save', '300 1 60 10');

      // Enable AOF (Append Only File) for better durability
      await this.client.config('SET', 'appendonly', 'yes');
      await this.client.config('SET', 'appendfsync', 'everysec');

      this.logger.info('Redis persistence configured successfully');
    } catch (error) {
      this.logger.warn(
        'Could not configure Redis persistence (may not have permissions)',
        error as Error,
      );
    }
  }

  public async saveScrapingResult(
    data: any,
    metadata: { carsCount: number; loadTime: number },
  ): Promise<string> {
    try {
      const id = `scraping_${Date.now()}`;
      const scrapedData: ScrapedCarData = {
        id,
        timestamp: new Date(),
        data,
        carsCount: metadata.carsCount,
        loadTime: metadata.loadTime,
      };

      await this.client.set(this.CARS_KEY, JSON.stringify(scrapedData));

      await this.updateStats(metadata.carsCount);

      return id;
    } catch (error) {
      this.logger.error('Failed to save scraping result', error as Error);
      throw error;
    }
  }

  private async updateStats(carsCount: number): Promise<void> {
    try {
      const pipeline = this.client.pipeline();

      pipeline.hincrby(this.SCRAPING_STATS_KEY, 'totalScrapings', 1);
      pipeline.hset(
        this.SCRAPING_STATS_KEY,
        'lastScrapingTime',
        new Date().toISOString(),
      );
      pipeline.hincrby(this.SCRAPING_STATS_KEY, 'totalCars', carsCount);

      await pipeline.exec();
    } catch (error) {
      this.logger.error('Failed to update stats', error as Error);
    }
  }

  public async getStoredCars(): Promise<ScrapedCarData | null> {
    try {
      const data = await this.client.get(this.CARS_KEY);
      if (!data) return null;

      return JSON.parse(data);
    } catch (error) {
      this.logger.error('Failed to get stored cars', error as Error);
      return null;
    }
  }

  public async getStats(): Promise<StorageStats> {
    try {
      const stats = await this.client.hgetall(this.SCRAPING_STATS_KEY);

      const totalScrapings = parseInt(stats.totalScrapings || '0', 10);
      const totalCars = parseInt(stats.totalCars || '0', 10);
      const lastScrapingTime = stats.lastScrapingTime
        ? new Date(stats.lastScrapingTime)
        : null;

      const storedCars = await this.getStoredCars();

      return {
        totalScrapings,
        lastScrapingTime,
        averageCarsCount:
          totalScrapings > 0 ? Math.round(totalCars / totalScrapings) : 0,
        storageSize: storedCars?.carsCount || 0,
      };
    } catch (error) {
      this.logger.error('Failed to get stats', error as Error);
      return {
        totalScrapings: 0,
        lastScrapingTime: null,
        averageCarsCount: 0,
        storageSize: 0,
      };
    }
  }

  public async clearAll(): Promise<void> {
    try {
      const pipeline = this.client.pipeline();
      pipeline.del(this.CARS_KEY);
      pipeline.del(this.SCRAPING_STATS_KEY);
      await pipeline.exec();
      this.logger.info('All scraping data cleared');
    } catch (error) {
      this.logger.error('Failed to clear data', error as Error);
      throw error;
    }
  }

  public async isConnected(): Promise<boolean> {
    try {
      await this.client.ping();
      return true;
    } catch (error) {
      return false;
    }
  }

  public async isEmpty(): Promise<boolean> {
    try {
      const exists = await this.client.exists(this.CARS_KEY);
      return exists === 0;
    } catch (error) {
      this.logger.error('Failed to check if storage is empty', error as Error);
      return true;
    }
  }

  public async getStoredCarsData(): Promise<any[] | null> {
    try {
      const stored = await this.getStoredCars();
      return stored?.data || null;
    } catch (error) {
      this.logger.error('Failed to get stored cars data', error as Error);
      return null;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      await this.client.quit();
      this.logger.info('Redis storage service disconnected');
    } catch (error) {
      this.logger.error('Failed to disconnect Redis', error as Error);
    }
  }
}

export default RedisStorageService;
