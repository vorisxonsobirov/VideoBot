




const TelegramBot = require('node-telegram-bot-api');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const axios = require('axios');



const token = process.env.BOT_TOKEN;
// const token = '8101551595:AAGkVgilvl6fcefYN6X7llF8k4AVPdfjNbM';
const bot = new TelegramBot(token, { polling: true });

const downloadDir = './downloads';
if (!fs.existsSync(downloadDir)) {
  fs.mkdirSync(downloadDir, { recursive: true });
}

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, '🎬 Привет! Отправь мне ссылку на Instagram-видео, и я его скачаю.');
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!text || !text.includes('instagram.com')) return;

  bot.sendMessage(chatId, '⏳ Ищу видео, подожди...');

  try {
    const videoUrl = await getInstagramVideoUrl(text);

    if (!videoUrl) {
      bot.sendMessage(chatId, '❌ Видео не найдено.');
      return;
    }

    const filePath = path.join(downloadDir, `insta_${Date.now()}.mp4`);
    const writer = fs.createWriteStream(filePath);

    const response = await axios({
      url: videoUrl,
      method: 'GET',
      responseType: 'stream'
    });

    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    const stats = fs.statSync(filePath);
    const fileSize = stats.size / (1024 * 1024);

    if (fileSize > 50) {
      bot.sendMessage(chatId, '⚠️ Видео слишком большое для отправки в Telegram (>50MB).');
      fs.unlinkSync(filePath);
      return;
    }

    await bot.sendVideo(chatId, filePath);
    bot.sendMessage(chatId, '✅ Готово!');
    fs.unlinkSync(filePath);

  } catch (err) {
    console.error('Ошибка:', err.message);
    bot.sendMessage(chatId, '❌ Ошибка при загрузке видео. Попробуй позже.');
  }
});

async function getInstagramVideoUrl(instagramUrl) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(instagramUrl, { waitUntil: 'networkidle2' });

  const videoUrl = await page.evaluate(() => {
    const video = document.querySelector('video');
    return video ? video.src : null;
  });

  await browser.close();
  return videoUrl;
}
