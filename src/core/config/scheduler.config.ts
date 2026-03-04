import dotenv from 'dotenv';
import { getEnvBoolean, getEnvString } from '../utils/env.utils';

dotenv.config();

export interface SchedulerConfig {
  enabled: boolean;
  cronExpression: string;
  timezone: string;
  runOnStart: boolean;
  maxConcurrentJobs: number;
}

export const schedulerConfig: SchedulerConfig = {
  enabled: getEnvBoolean('SCHEDULER_ENABLED', true),
  cronExpression: getEnvString('SCRAPER_CRON_SCHEDULE', '*/5 * * * *'),
  timezone: getEnvString('SCHEDULER_TIMEZONE', 'Europe/Chisinau'),
  runOnStart: getEnvBoolean('SCRAPER_RUN_ON_START', true),
  maxConcurrentJobs: 1,
};
