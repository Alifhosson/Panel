const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const os = require('os');
const path = require('path');
const XLSX = require('xlsx');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const token = '7142079092:AAGRrSPa3su8iuGG4r9n5x1LZOwsFPaFoQ0';
const bot = new TelegramBot(token, { polling: true });

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const startMessage = `
👋 স্বাগতম!

📌 এডমিন Info:
 - নাম: Alif Hosson
 - যোগাযোগ: @Alifhosson

📌 join চ্যানেল:
 - লিংক: t.me/TEAM_X4X

🚀 এখন আপনার ফাইল আপলোড করুন (.txt, .csv, .xlsx) এবং আমি নাম্বার প্রসেস করে আপনার জন্য প্রস্তুত করে দেব!
💡 ফিচারসমূহ:
- প্রিফিক্স যোগ (➕ বা t.me/+)
- আউটপুট আপলোড করা ফাইলের নাম অনুযায়ী .txt আকারে পাঠানো হবে।
`;
  bot.sendMessage(chatId, startMessage);
});


bot.on('document', async (msg) => {
    const chatId = msg.chat.id;
    const fileId = msg.document.file_id;
    const originalFileName = path.parse(msg.document.file_name).name;

    const fileUrl = await bot.getFileLink(fileId);
    let fileData = await fetch(fileUrl).then(res => res.arrayBuffer());
    let numbers = [];

    const ext = path.extname(msg.document.file_name).toLowerCase();

    if (ext === '.xlsx') {
        const workbook = XLSX.read(Buffer.from(fileData), { type: 'buffer' });
        workbook.SheetNames.forEach(sheetName => {
            const sheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            jsonData.forEach(row => {
                row.forEach(cell => {
                    if (cell != null) {
                        const cellNumbers = String(cell).match(/\d+/g);
                        if (cellNumbers) {
                            cellNumbers.forEach(num => {
                                if (num.length >= 8) numbers.push(num); // 7 অঙ্ক বা বেশি
                            });
                        }
                    }
                });
            });
        });
    } else {
        const textData = Buffer.from(fileData).toString('utf-8');
        numbers = textData.split(/\r?\n/)
            .map(line => line.match(/\d+/g)?.filter(num => num.length >= 8))
            .flat()
            .filter(Boolean);
    }

    if (numbers.length === 0) return bot.sendMessage(chatId, "কোনো ৭ অঙ্ক বা তার বেশি নাম্বার পাওয়া যায়নি।");

    // প্রিফিক্স বাটন দেখানো এবং পরে মুছে ফেলা
    bot.sendMessage(chatId, "কোন প্রিফিক্স অ্যাড করবেন?", {
        reply_markup: {
            inline_keyboard: [
                [{ text: "PLUS ➕", callback_data: "PLUS" }],
                [{ text: "LINK📎📎 t.me/+", callback_data: "LINK" }]
            ]
        }
    }).then((sentMsg) => {
        const messageId = sentMsg.message_id;

        bot.once('callback_query', (cbQuery) => {
            let prefix = '';
            if (cbQuery.data === 'PLUS') prefix = '+';
            if (cbQuery.data === 'LINK') prefix = 't.me/+';

            const updatedNumbers = numbers.map(num => prefix + num);

            // প্রথম লাইনে স্ট্যাটিক লেখা যুক্ত করা
            const fileContent = ['bot make by Alif Hosson', ...updatedNumbers].join('\n');
            const tempFile = path.join(os.tmpdir(), 'temp_numbers.txt');

            fs.writeFileSync(tempFile, fileContent);

            bot.sendDocument(chatId, tempFile, {}, { filename: `${originalFileName}.txt` })
                .then(() => fs.unlinkSync(tempFile));

            bot.answerCallbackQuery(cbQuery.id, { text: "ফাইল প্রস্তুত!" });

            // প্রিফিক্স মেসেজ মুছে ফেলা
            bot.deleteMessage(chatId, messageId).catch(() => {});
        });
    });
});
