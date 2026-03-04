import dotenv from 'dotenv';
import { getEnvBoolean, getEnvNumber, getEnvString } from '../utils/env.utils';

dotenv.config();

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  keyPrefix: string;
  enablePersistence: boolean;
  maxRetries: number;
  retryDelay: number;
}

export const redisConfig: RedisConfig = {
  host: getEnvString('REDIS_HOST', 'localhost'),
  port: getEnvNumber('REDIS_PORT', 6379),
  password: getEnvString('REDIS_PASSWORD', ''),
  db: getEnvNumber('REDIS_DB', 0),
  keyPrefix: getEnvString('REDIS_KEY_PREFIX', 'caromoto:'),
  enablePersistence: getEnvBoolean('REDIS_ENABLE_PERSISTENCE', true),
  maxRetries: getEnvNumber('REDIS_MAX_RETRIES', 3),
  retryDelay: getEnvNumber('REDIS_RETRY_DELAY', 1000),
};
