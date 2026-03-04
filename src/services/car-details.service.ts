import LoggerService from '../common/shared/services/logger.service';

export interface CarDetailsRequest {
  auction: string;
  vehicleId: string;
}

export interface CarDetailsResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export class CarDetailsService {
  private static instance: CarDetailsService;
  private logger: LoggerService;
  private readonly DETAILS_URL =
    'https://caromoto.com/FindVehicle/GetDetailInfo';

  private constructor() {
    this.logger = LoggerService.getInstance();
  }

  public static getInstance(): CarDetailsService {
    if (!CarDetailsService.instance) {
      CarDetailsService.instance = new CarDetailsService();
    }
    return CarDetailsService.instance;
  }

  /**
   * Fetches detailed information for a single car
   */
  public async fetchCarDetails(
    auction: string,
    vehicleId: string,
  ): Promise<CarDetailsResponse> {
    try {
      this.logger.info(`Fetching details for vehicle: ${vehicleId}`);

      const body = `auction=${auction}&vehicleId=${vehicleId}`;

      const response = await fetch(this.DETAILS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        body,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      this.logger.info(`✓ Successfully fetched details for ${vehicleId}`);

      return {
        success: true,
        data,
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch details for ${vehicleId}`,
        error as Error,
      );
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Fetches details for multiple cars with delay between requests
   */
  public async fetchMultipleCarDetails(
    cars: any[],
    delayMs = 1000,
  ): Promise<Map<string, any>> {
    const results = new Map<string, any>();

    this.logger.info(`Fetching details for ${cars.length} cars...`);

    for (const car of cars) {
      const result = await this.fetchCarDetails(car.auctionCode, car.vehicleId);

      if (result.success && result.data) {
        results.set(car.vehicleId, {
          basicInfo: car,
          detailedInfo: result.data,
        });
      }

      // Delay between requests to avoid rate limiting
      if (delayMs > 0) {
        await this.delay(delayMs);
      }
    }

    this.logger.info(
      `✓ Successfully fetched ${results.size}/${cars.length} car details`,
    );

    return results;
  }

  /**
   * Compares two car lists and returns new cars
   */
  public findNewCars(currentCars: any[], previousCars: any[]): any[] {
    const previousIds = new Set(previousCars.map((car) => car.vehicleId));

    const newCars = currentCars.filter((car) => {
      const vehicleId = car.vehicleId;
      return vehicleId && !previousIds.has(vehicleId);
    });

    this.logger.info(
      `Found ${newCars.length} new cars out of ${currentCars.length} total`,
    );

    return newCars;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default CarDetailsService;
