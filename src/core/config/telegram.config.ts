import dotenv from 'dotenv';
import { getEnvString } from '../utils/env.utils';

dotenv.config();

export interface TelegramConfig {
  botToken: string | null;
  chatId: string | null;
  enabled: boolean;
}

export const telegramConfig: TelegramConfig = {
  botToken: getEnvString('TELEGRAM_BOT_TOKEN', ''),
  chatId: getEnvString('TELEGRAM_CHAT_ID', ''),
  enabled: !!process.env.TELEGRAM_BOT_TOKEN && !!process.env.TELEGRAM_CHAT_ID,
};
