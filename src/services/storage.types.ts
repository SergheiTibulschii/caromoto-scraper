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
