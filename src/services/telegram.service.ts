import TelegramBot from 'node-telegram-bot-api';
import { telegramConfig } from '../core/config/telegram.config';
import LoggerService from '../common/shared/services/logger.service';

export class TelegramService {
  private static instance: TelegramService;
  private bot: TelegramBot | null;
  private chatId: string | null;
  private logger: LoggerService;
  private enabled: boolean;

  private constructor() {
    this.logger = LoggerService.getInstance();
    this.enabled = telegramConfig.enabled;

    if (this.enabled && telegramConfig.botToken && telegramConfig.chatId) {
      this.bot = new TelegramBot(telegramConfig.botToken, { polling: false });
      this.chatId = telegramConfig.chatId;
      this.logger.info('✓ Telegram notifications enabled');
      this.logger.info(`  → Chat ID: ${this.chatId}`);
    } else {
      this.bot = null;
      this.chatId = null;
      this.logger.info(
        '⚠ Telegram notifications disabled (missing credentials)',
      );
      this.logger.info(`  → Bot Token present: ${!!telegramConfig.botToken}`);
      this.logger.info(`  → Chat ID present: ${!!telegramConfig.chatId}`);
    }
  }

  public static getInstance(): TelegramService {
    if (!TelegramService.instance) {
      TelegramService.instance = new TelegramService();
    }
    return TelegramService.instance;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public async sendMessage(message: string): Promise<void> {
    if (!this.bot || !this.chatId) {
      this.logger.warn('⚠ Telegram notification skipped (not configured)');
      return;
    }

    try {
      await this.bot.sendMessage(this.chatId, message, {
        parse_mode: 'Markdown',
      });
      this.logger.info('✓ Telegram notification sent');
    } catch (error) {
      this.logger.error(
        '✗ Failed to send Telegram notification',
        error as Error,
      );
    }
  }

  public async sendPhoto(photoUrl: string, caption: string): Promise<void> {
    if (!this.bot || !this.chatId) {
      this.logger.warn('⚠ Telegram notification skipped (not configured)');
      return;
    }

    try {
      await this.bot.sendPhoto(this.chatId, photoUrl, {
        caption,
        parse_mode: 'Markdown',
      });
      this.logger.info('✓ Telegram photo notification sent');
    } catch (error) {
      this.logger.error(
        '✗ Failed to send Telegram photo notification',
        error as Error,
      );
      this.logger.info('→ Falling back to text-only message');
      await this.sendMessage(caption);
    }
  }

  public async sendErrorNotification(error: string): Promise<void> {
    const message = `❌ *Mercedes GLE Scraping Failed*\n\n` + `Error: ${error}`;
    await this.sendMessage(message);
  }

  public async sendCustomNotification(
    title: string,
    details: Record<string, any>,
  ): Promise<void> {
    let message = `📢 *${title}*\n\n`;

    for (const [key, value] of Object.entries(details)) {
      message += `${key}: ${value}\n`;
    }

    await this.sendMessage(message);
  }
}

export default TelegramService;
