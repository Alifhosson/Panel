// sms-bot-dual.js
const axios = require("axios").default;
const tough = require("tough-cookie");
const { wrapper } = require("axios-cookiejar-support");
const cheerio = require("cheerio");
const TelegramBot = require("node-telegram-bot-api");
const { parsePhoneNumberFromString } = require("libphonenumber-js");
const countryEmoji = require("country-emoji");

// === CONFIG ===
// 🟢 Bot1 Config
const BOT1_TOKEN = process.env.BOT1_TOKEN || "8038496658:AAH56cp1BgeEmneJCOcDp72gtQ0iQ8lfvdA";
const BOT1_CHAT_ID = process.env.BOT1_CHAT_ID || "-1002391889544";

// 🟢 Bot2 Config
const BOT2_TOKEN = process.env.BOT2_TOKEN || "8430148380:AAF3yvkNPJYGoZwmwxoJh9qguMDpwIzHViw";
const BOT2_CHAT_ID = process.env.BOT2_CHAT_ID || "-1002789126504";

const LOGIN_PAGE_URL = "http://109.236.84.81/ints/login";
const LOGIN_POST_URL = "http://109.236.84.81/ints/signin";
const SMS_REPORTS_URL = "http://109.236.84.81/ints/agent/SMSCDRReports";
const SMS_DATA_API_URL = "http://109.236.84.81/ints/agent/res/data_smscdr.php";

const USERNAME = process.env.SMS_USER || "Smartmethod";
const PASSWORD = process.env.SMS_PASS || "Smartmethod904@";

// === INIT ===
const jar = new tough.CookieJar();
const client = wrapper(axios.create({ jar, withCredentials: true }));

const bot1 = new TelegramBot(BOT1_TOKEN, { polling: false });
const bot2 = new TelegramBot(BOT2_TOKEN, { polling: false });

let lastIdBot1 = null;
let lastIdBot2 = null;

// Extract OTP
function extractOtp(text) {
  if (!text) return null;
  const m = text.match(/\b\d{3,4}(?:[-\s]?\d{2,4})\b/);
  if (m) {
    return m[0];
  }
  return null;
}

// Country detect from number
function getCountryInfo(number) {
  if (!number) return "Unknown 🌍";
  let s = String(number).trim().replace(/[^\d+]/g, "");
  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (!s.startsWith("+")) s = "+" + s;

  try {
    const phone = parsePhoneNumberFromString(s);
    if (phone && phone.country) {
      const iso = phone.country;
      const name = countryEmoji.name(iso) || iso;
      const flag = countryEmoji.flag(iso) || "🌍";
      return `${name} ${flag}`;
    }
  } catch (e) {
    return "Unknown 🌍";
  }
  return "Unknown 🌍";
}

// Map API row to object
function mapRow(row) {
  return {
    id: row[0],
    date: row[0],
    number: row[2],
    cli: row[3],
    client: row[4],
    message: row[5],
    country: getCountryInfo(row[2]),
  };
}

async function sendTelegramSMS(botInstance, chatId, sms) {
  const otp = extractOtp(sms.message) || "N/A";
  const final = `<b>${sms.country} ${sms.cli} OTP Received...</b>

📞 <b>Number:</b> <code>${sms.number}</code>
🌍 <b>𝐂𝐨𝐮𝐧𝐭𝐫𝐲:</b> ${sms.country}
📱 <b>𝐒𝐞𝐫𝐯𝐢𝐜𝐞:</b> ${sms.cli}

🔑 <b>𝐘𝐨𝐮𝐫 𝐎𝐓𝐏:</b> <code>${otp}</code>

💬 <b>𝐅𝐮𝐥𝐥 𝐒𝐌𝐒:</b>
<pre>${sms.message}</pre>
`;

  try {
    await botInstance.sendMessage(chatId, final, { parse_mode: "HTML" });
  } catch (e) {
    console.error(`Telegram send error for bot to chat ${chatId}:`, e.message);
  }
}

// Login with captcha
async function performLoginAndSaveCookies() {
  try {
    console.log("🔐 GET login page...");
    const getRes = await client.get(LOGIN_PAGE_URL, { headers: { "User-Agent": "Mozilla/5.0" } });
    const $ = cheerio.load(String(getRes.data || ""));

    // parse captcha
    let captchaAnswer = null;
    const bodyText = $("body").text();
    const qMatch = bodyText.match(/What is\s*([\-]?\d+)\s*([\+\-\*xX\/])\s*([\-]?\d+)/i);
    if (qMatch) {
      const a = Number(qMatch[1]), op = qMatch[2], b = Number(qMatch[3]);
      switch (op) {
        case "+": captchaAnswer = String(a + b); break;
        case "-": captchaAnswer = String(a - b); break;
        case "*": case "x": case "X": captchaAnswer = String(a * b); break;
        case "/": captchaAnswer = b !== 0 ? String(Math.floor(a / b)) : "0"; break;
      }
      console.log("Detected captcha:", qMatch[0], "=>", captchaAnswer);
    }

    const formParams = new URLSearchParams();
    formParams.append("username", USERNAME);
    formParams.append("password", PASSWORD);
    if (captchaAnswer !== null) formParams.append("capt", captchaAnswer);

    $("form input[type=hidden]").each((i, el) => {
      const name = $(el).attr("name");
      const val = $(el).attr("value") || "";
      if (name && !["username","password","capt"].includes(name)) formParams.append(name, val);
    });

    const postRes = await client.post(LOGIN_POST_URL, formParams.toString(), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Origin": "http://109.236.84.81",
        "Referer": LOGIN_PAGE_URL,
        "User-Agent": "Mozilla/5.0",
      },
      maxRedirects: 0,
      validateStatus: s => s >= 200 && s < 400,
    });

    console.log("Login POST status:", postRes.status);
    const body = String(postRes.data || "");
    const looksLikeLoginPage = /<title>.*Login/i.test(body);
    if ((postRes.status === 302 || postRes.status === 303) && !looksLikeLoginPage) return true;
    if (!looksLikeLoginPage && postRes.status === 200) return true;

    console.warn("❌ Login failed, got login page again.");
    return false;
  } catch (err) {
    console.error("Login error:", err.message);
    return false;
  }
}

// Fetch SMS API
async function fetchSmsApi() {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const today = `${year}-${month}-${day}`;

    const reportParams = new URLSearchParams();
    reportParams.append("fdate1", `${today} 00:00:00`);
    reportParams.append("fdate2", `${today} 23:59:59`);
    reportParams.append("frange", "");
    reportParams.append("fclient", "");
    reportParams.append("fnum", "");
    reportParams.append("fcli", "");

    await client.post(SMS_REPORTS_URL, reportParams.toString(), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Origin": "http://109.236.84.81",
        "Referer": "http://109.236.84.81/ints/agent/SMSCDRReports",
        "User-Agent": "Mozilla/5.0",
      },
      maxRedirects: 0,
      validateStatus: s => s >= 200 && s < 400,
    });

    const dataApiUrl = `${SMS_DATA_API_URL}?fdate1=${encodeURIComponent(`${today} 00:00:00`)}&fdate2=${encodeURIComponent(`${today} 23:59:59`)}&frange=&fclient=&fnum=&fcli=&fgdate=&fgmonth=&fgrange=&fgclient=&fgnumber=&fgcli=&fg=0&sEcho=1&iColumns=9&sColumns=%2C%2C%2C%2C%2C%2C%2C%2C%2C&iDisplayStart=0&iDisplayLength=25&mDataProp_0=0&sSearch_0=&bRegex_0=false&bSearchable_0=true&bSortable_0=true&mDataProp_1=1&sSearch_1=&bRegex_1=false&bSearchable_1=true&bSortable_1=true&mDataProp_2=2&sSearch_2=&bRegex_2=false&bSearchable_2=true&bSortable_2=true&mDataProp_3=3&sSearch_3=&bRegex_3=false&bSearchable_3=true&bSortable_3=true&mDataProp_4=4&sSearch_4=&bRegex_4=false&bSearchable_4=true&bSortable_4=true&mDataProp_5=5&sSearch_5=&bRegex_5=false&bSearchable_5=true&bSortable_5=true&mDataProp_6=6&sSearch_6=&bRegex_6=false&bSearchable_6=true&bSortable_6=true&mDataProp_7=7&sSearch_7=&bRegex_7=false&bSearchable_7=true&bSortable_7=true&mDataProp_8=8&sSearch_8=&bRegex_8=false&bSearchable_8=false&sSearch=&bRegex=false&iSortCol_0=0&sSortDir_0=desc&iSortingCols=1`;

    const res = await client.get(dataApiUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "X-Requested-With": "XMLHttpRequest",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Referer": SMS_REPORTS_URL,
      },
    });
    return res.data;
  } catch (e) {
    console.error("Fetch SMS API error:", e.message);
    return null;
  }
}

// Worker
async function startWorker() {
  const ok = await performLoginAndSaveCookies();
  if (!ok) return console.error("Login failed — aborting.");

  const data = await fetchSmsApi();
  if (data && Array.isArray(data.aaData) && data.aaData.length > 0) {
    const latest = mapRow(data.aaData[0]);
    lastIdBot1 = latest.id;
    lastIdBot2 = latest.id;
    await sendTelegramSMS(bot1, BOT1_CHAT_ID, latest);
    await sendTelegramSMS(bot2, BOT2_CHAT_ID, latest);
  } else {
    console.log("No SMS found initially.");
  }

  setInterval(async () => {
    const d = await fetchSmsApi();
    if (!d || !Array.isArray(d.aaData) || d.aaData.length === 0) return;
    const latest = mapRow(d.aaData[0]);

    if (latest.id !== lastIdBot1) {
      lastIdBot1 = latest.id;
      await sendTelegramSMS(bot1, BOT1_CHAT_ID, latest);
    }
    if (latest.id !== lastIdBot2) {
      lastIdBot2 = latest.id;
      await sendTelegramSMS(bot2, BOT2_CHAT_ID, latest);
    }
  }, 10000);
}

// Run
startWorker();

console.log("Poton bot is rinug.....");