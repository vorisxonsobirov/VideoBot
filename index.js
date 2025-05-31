const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { instagramGetUrl } = require('instagram-url-direct');

const token = process.env.BOT_TOKEN;

const bot = new TelegramBot(token, { polling: true });

const downloadDir = './downloads';
if (!fs.existsSync(downloadDir)) {
  fs.mkdirSync(downloadDir, { recursive: true });
}

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, '👋 Привет! Просто отправь мне ссылку на видео с Instagram, и я его скачаю!');
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  // Игнорируем команды и сообщения без ссылок
  if (!text || text.startsWith('/')) return;

  if (text.includes('instagram.com')) {
    try {
      bot.sendMessage(chatId, '⏳ Обрабатываю ссылку, подожди немного...');

      const result = await instagramGetUrl(text);
      const videoUrl = result.url_list[0];

      if (!videoUrl) {
        bot.sendMessage(chatId, '❌ Не удалось найти видео по ссылке.');
        return;
      }

      const filePath = path.join(downloadDir, `video_${Date.now()}.mp4`);
      const writer = fs.createWriteStream(filePath);

      const videoResponse = await axios({
        url: videoUrl,
        method: 'GET',
        responseType: 'stream'
      });

      videoResponse.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      const stats = fs.statSync(filePath);
      const fileSizeInMB = stats.size / (1024 * 1024);
      if (fileSizeInMB > 50) {
        bot.sendMessage(chatId, '⚠️ Видео слишком большое для отправки в Telegram (>50MB).');
        fs.unlinkSync(filePath);
        return;
      }

      await bot.sendVideo(chatId, filePath);
      bot.sendMessage(chatId, '✅ Видео отправлено!');
      fs.unlinkSync(filePath);

    } catch (err) {
      console.error('Ошибка:', err.message);
      bot.sendMessage(chatId, '❌ Произошла ошибка: ' + err.message);
    }
  } else {
    bot.sendMessage(chatId, '📎 Пожалуйста, отправь действительную ссылку на Instagram.');
  }
});

bot.on('polling_error', (error) => {
  console.error('Polling error:', error.message);
});
