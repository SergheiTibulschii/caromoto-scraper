import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';

dotenv.config();

async function testBot() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    console.error('❌ TELEGRAM_BOT_TOKEN not found in .env');
    process.exit(1);
  }

  const bot = new TelegramBot(botToken, { polling: false });

  try {
    const me = await bot.getMe();
    console.log('\n✅ Bot Details:');
    console.log(
      '═══════════════════════════════════════════════════════════════',
    );
    console.log(`Bot Name: ${me.first_name}`);
    console.log(`Username: @${me.username}`);
    console.log(`Bot ID: ${me.id}`);
    console.log(
      '═══════════════════════════════════════════════════════════════\n',
    );
    console.log('📝 Next Steps:');
    console.log(
      `1. Add @${me.username} to your group: https://t.me/+yVO1lotwjhc5YmJi`,
    );
    console.log('2. Send any message in the group (e.g., "Hello bot!")');
    console.log('3. Run: npm run telegram:get-chat-id');
    console.log('\n');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testBot();
