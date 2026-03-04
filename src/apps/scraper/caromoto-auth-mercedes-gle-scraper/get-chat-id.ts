import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Helper Script: Get Telegram Chat ID
 *
 * This script helps you find the chat ID for your Telegram group.
 *
 * Steps:
 * 1. Make sure your bot is added to the group
 * 2. Send any message in the group (mention the bot if needed)
 * 3. Run this script: npm run telegram:get-chat-id
 * 4. The script will display all recent chats and their IDs
 */

async function getChatId() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    console.error('❌ Error: TELEGRAM_BOT_TOKEN not found in .env file');
    console.log('\nPlease add your bot token to the .env file:');
    console.log('TELEGRAM_BOT_TOKEN=your-bot-token-here\n');
    process.exit(1);
  }

  console.log('🤖 Telegram Chat ID Finder\n');
  console.log('Fetching recent updates...\n');

  try {
    const bot = new TelegramBot(botToken, { polling: false });

    // Get recent updates
    const updates = await bot.getUpdates();

    if (updates.length === 0) {
      console.log('⚠️  No recent messages found.');
      console.log('\nTo get the chat ID:');
      console.log('1. Add your bot to the group');
      console.log('2. Send a message in the group (any message)');
      console.log('3. Run this script again\n');
      return;
    }

    console.log(`Found ${updates.length} recent update(s):\n`);
    console.log(
      '═══════════════════════════════════════════════════════════════\n',
    );

    // Display all unique chats
    const chats = new Map();

    updates.forEach((update) => {
      if (update.message?.chat) {
        const chat = update.message.chat;
        const chatKey = chat.id.toString();

        if (!chats.has(chatKey)) {
          chats.set(chatKey, {
            id: chat.id,
            type: chat.type,
            title:
              chat.title ||
              `${chat.first_name || ''} ${chat.last_name || ''}`.trim(),
            username: chat.username,
          });
        }
      }
    });

    chats.forEach((chat) => {
      console.log(`Chat Type: ${chat.type}`);
      console.log(`Chat ID: ${chat.id}`);

      if (chat.title) {
        console.log(`Title: ${chat.title}`);
      }

      if (chat.username) {
        console.log(`Username: @${chat.username}`);
      }

      console.log('\n📋 Add this to your .env file:');
      console.log(`TELEGRAM_CHAT_ID=${chat.id}`);
      console.log(
        '\n═══════════════════════════════════════════════════════════════\n',
      );
    });

    console.log(
      '✅ Done! Copy the TELEGRAM_CHAT_ID from above to your .env file.\n',
    );
  } catch (error) {
    console.error('❌ Error fetching updates:', error);

    if (error instanceof Error) {
      if (error.message.includes('401')) {
        console.log(
          '\n⚠️  Invalid bot token. Please check your TELEGRAM_BOT_TOKEN in .env\n',
        );
      } else {
        console.log('\n⚠️  Error:', error.message, '\n');
      }
    }
  }
}

// Run the script
getChatId();
