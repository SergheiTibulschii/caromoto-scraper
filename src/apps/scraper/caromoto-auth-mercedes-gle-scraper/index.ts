import { ScraperService } from '../services';
import { TelegramService } from '../../../services/telegram.service';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Production Script: Mercedes GLE 350 2020-2021 Scraper
 *
 * Scrapes Caromoto for Mercedes GLE vehicles from 2020-2021
 * and saves the results to a timestamped JSON file
 */

interface CaromotoCredentials {
  email: string;
  password: string;
}

class MercedesGLEScraper {
  private scraperService: ScraperService;
  private telegram: TelegramService;
  private outputDir: string;
  private isInitialized = false;

  constructor() {
    this.scraperService = new ScraperService();
    this.telegram = TelegramService.getInstance();
    this.outputDir = path.join(__dirname, 'output');
  }

  /**
   * Generates a filename with timestamp
   * Format: GLE-350-2020-2021_DD_MM_YYYY_HH_MM_SS.json
   */
  private generateFilename(): string {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `GLE-350-2020-2021_${day}_${month}_${year}_${hours}_${minutes}_${seconds}.json`;
  }

  /**
   * Gets credentials from environment variables or uses defaults
   */
  private getCredentials(): CaromotoCredentials {
    return {
      email: process.env.CAROMOTO_EMAIL || 'moldex.dan@gmail.com',
      password: process.env.CAROMOTO_PASSWORD || '446236',
    };
  }

  /**
   * Initialize scraper service (only once)
   */
  async initialize(): Promise<void> {
    if (!this.isInitialized) {
      await this.scraperService.initialize();
      console.log('✓ Scraper service initialized (browser will stay alive)');
      this.isInitialized = true;
    }
  }

  /**
   * Shutdown scraper service (call when app terminates)
   */
  async shutdown(): Promise<void> {
    if (this.isInitialized) {
      await this.scraperService.shutdown();
      console.log('✓ Scraper service shut down');
      this.isInitialized = false;
    }
  }

  /**
   * Main scraping function
   */
  async scrape(): Promise<any> {
    try {
      await this.initialize();

      const credentials = this.getCredentials();

      // Search URL with filters for Mercedes-Benz GLE 2020-2021
      const searchUrl =
        'https://caromoto.com/md/FindVehicle/Index?page_size=25&sort=years&order=asc&auction=MAN' +
        '&filter_type=MAKE&filter_val=00000000-0000-3044-0000-000000010000---Mercedes-Benz' +
        '&filter_type=YEAR_FROM&filter_val=2020--TO--2021---2020%20-%202021' +
        '&filter_type=ODOMETER_FROM&filter_val=--TO--150000---%3C%20150000' +
        '&filter_type=MODEL&filter_val=a91b845e-c513-47b6-a5a1-e603c7929cfc---GLE' +
        '&filter_type=ENGINE&filter_val=00000000-0000-2000-0000-000000008490---%204-%D1%86%D0%B8%D0%BB%D0%B8%D0%BD%D0%B4%D1%80%D0%BE%D0%B2%D1%8B%D0%B9%20%D1%82%D1%83%D1%80%D0%B1%D0%BE' +
        '&filter_type=DRIVE_TRAIN&filter_val=740a9317-9362-4747-9d5c-98cc0fa11c97---4%D0%A54';

      console.log('→ Starting authenticated scraping...');
      console.log(`→ Search URL: ${searchUrl.substring(0, 50)}...`);

      const result = await this.scraperService.scrapeCaromotoAuthenticated(
        credentials.email,
        credentials.password,
        searchUrl,
        {
          timeout: 60000,
        },
      );

      if (result.success && result.data) {
        console.log('✓ Scraping successful!');
        console.log(`→ Load time: ${result.data.metadata.loadTime} ms`);
        console.log(`→ Timestamp: ${result.data.metadata.timestamp}`);

        // Extract only the cars data from result.searchModel.cars
        const extractedData = result.data.extractedData as any;

        if (extractedData?.result?.searchModel?.cars) {
          const carsData = extractedData.result.searchModel.cars;
          console.log(`✓ Found ${carsData.length} cars`);

          // Generate filename and save
          console.log('\n=== Scraping Complete ===');
          console.log(`Total cars: ${carsData.length}`);

          return result;
        } else {
          console.error('✗ No cars data found in result.searchModel.cars');
          console.log(
            'Extracted data structure:',
            JSON.stringify(extractedData, null, 2),
          );

          return {
            success: false,
            error: 'No cars data found',
          };
        }
      } else {
        console.error('✗ Scraping failed:', result.error);

        await this.telegram.sendErrorNotification(
          result.error || 'Unknown scraping error',
        );

        return result;
      }
    } catch (error) {
      console.error('✗ Error during scraping:', error);

      await this.telegram.sendErrorNotification(
        error instanceof Error ? error.message : String(error),
      );

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

/**
 * Main execution
 */
async function main() {
  const scraper = new MercedesGLEScraper();

  try {
    await scraper.scrape();
    await scraper.shutdown();
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Script failed:', error);
    await scraper.shutdown();
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

export { MercedesGLEScraper };
