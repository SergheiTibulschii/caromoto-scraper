import { createLogger, format, transports, Logger } from 'winston';
import { Format } from 'logform';

class LoggerService {
  private static instance: LoggerService;
  private logger: Logger;

  private constructor() {
    const logFormat: Format = format.combine(
      format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      format.printf(
        (info) => `[${info.timestamp}] (${info.level}): ${info.message}`,
      ),
    );

    const logTransports: any[] = [
      new transports.Console({
        format: format.combine(format.colorize(), logFormat),
      }),
    ];

    // Only use file logging in development (not in production/Cloud Run)
    if (process.env.NODE_ENV !== 'production') {
      logTransports.push(
        new transports.File({ filename: 'logs/error.log', level: 'error' }),
        new transports.File({ filename: 'logs/combined.log' }),
      );
    }

    this.logger = createLogger({
      level: 'info',
      format: logFormat,
      transports: logTransports,
    });

    // Set max listeners to avoid warnings
    process.setMaxListeners(20);
  }

  public static getInstance(): LoggerService {
    if (!LoggerService.instance) {
      LoggerService.instance = new LoggerService();
    }
    return LoggerService.instance;
  }

  log(level: string, message: string, metadata?: Record<string, any>): void {
    this.logger.log({ level, message, ...metadata });
  }

  info(message: string, metadata?: Record<string, any>): void {
    this.logger.info(message, metadata);
  }

  warn(message: string, metadata?: Record<string, any>): void {
    this.logger.warn(message, metadata);
  }

  error(message: string, error?: Error): void {
    this.logger.error(message, { error: error?.stack || error });
  }
}

export const logger = LoggerService.getInstance();
export default LoggerService;
