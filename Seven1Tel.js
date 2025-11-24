// sms-bot.js
const axios = require("axios").default;
const tough = require("tough-cookie");
const { wrapper } = require("axios-cookiejar-support");
const cheerio = require("cheerio");
const TelegramBot = require("node-telegram-bot-api");
const { parsePhoneNumberFromString } = require("libphonenumber-js");
const countryEmoji = require("country-emoji");

// === 🟢 BOT CONFIGURATION ===

// Bot 1 Credentials
const BOT1_TOKEN = process.env.BOT1_TOKEN || "8038496658:AAH56cp1BgeEmneJCOcDp72gtQ0iQ8lfvdA";
const BOT1_CHAT_ID = process.env.BOT1_CHAT_ID || "-1002391889544";

// Bot 2 Credentials
const BOT2_TOKEN = process.env.BOT2_TOKEN || "8430148380:AAF3yvkNPJYGoZwmwxoJh9qguMDpwIzHViw";
const BOT2_CHAT_ID = process.env.BOT2_CHAT_ID || "-1002789126504";

// === SERVER CONFIG ===
const BASE_IP = "94.23.120.156";
const LOGIN_PAGE_URL = `http://${BASE_IP}/ints/login`;
const LOGIN_POST_URL = `http://${BASE_IP}/ints/signin`;
const DASHBOARD_URL = `http://${BASE_IP}/ints/agent/SMSCDRReports`;
const API_BASE_URL = `http://${BASE_IP}/ints/agent/res/data_smscdr.php`;

// === CREDENTIALS ===
const USERNAME = process.env.SMS_USER || "yasinffyadin";
const PASSWORD = process.env.SMS_PASS || "yasinyasg11";

// === INIT ===
const jar = new tough.CookieJar();
const client = wrapper(axios.create({ jar, withCredentials: true }));

const bot1 = new TelegramBot(BOT1_TOKEN, { polling: false });
const bot2 = new TelegramBot(BOT2_TOKEN, { polling: false });

let lastId = null;
let sessionKey = "";

function getTodayDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Helper: Generate API URL with dynamic date and session key
function getApiUrl() {
    const today = getTodayDate();
    const fdate1 = encodeURIComponent(`${today} 00:00:00`);
    const fdate2 = encodeURIComponent(`${today} 23:59:59`);

    return `${API_BASE_URL}?fdate1=${fdate1}&fdate2=${fdate2}&frange=&fclient=&fnum=&fcli=&fgdate=&fgmonth=&fgrange=&fgclient=&fgnumber=&fgcli=&fg=0&sesskey=${sessionKey}&sEcho=1&iColumns=9&sColumns=%2C%2C%2C%2C%2C%2C%2C%2C%2C&iDisplayStart=0&iDisplayLength=25&mDataProp_0=0&sSearch_0=&bRegex_0=false&bSearchable_0=true&bSortable_0=true&mDataProp_1=1&sSearch_1=&bRegex_1=false&bSearchable_1=true&bSortable_1=true&mDataProp_2=2&sSearch_2=&bRegex_2=false&bSearchable_2=true&bSortable_2=true&mDataProp_3=3&sSearch_3=&bRegex_3=false&bSearchable_3=true&bSortable_3=true&mDataProp_4=4&sSearch_4=&bRegex_4=false&bSearchable_4=true&bSortable_4=true&mDataProp_5=5&sSearch_5=&bRegex_5=false&bSearchable_5=true&bSortable_5=true&mDataProp_6=6&sSearch_6=&bRegex_6=false&bSearchable_6=true&bSortable_6=true&mDataProp_7=7&sSearch_7=&bRegex_7=false&bSearchable_7=true&bSortable_7=true&mDataProp_8=8&sSearch_8=&bRegex_8=false&bSearchable_8=false&sSearch=&bRegex=false&iSortCol_0=0&sSortDir_0=desc&iSortingCols=1`;
}

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

// Send SMS to BOTH Telegram Bots
async function sendTelegramSMS(sms) {
    const otp = extractOtp(sms.message) || "N/A";
    const final = `<b>${sms.country} ${sms.cli} OTP Received...</b>

📞 <b>Number:</b> <code>${sms.number}</code>
🌍 <b>𝐂𝐨𝐮𝐧𝐭𝐫𝐲:</b> ${sms.country}
📱 <b>𝐒𝐞𝐫𝐯𝐢𝐜𝐞:</b> ${sms.cli}

🔑 <b>𝐘𝐨𝐮𝐫 𝐎𝐓𝐏:</b> <code>${otp}</code>

💬 <b>𝐅𝐮𝐥𝐥 𝐒𝐌𝐒:</b>
<pre>${sms.message}</pre>`;

    // Send to Bot 1
    try {
        await bot1.sendMessage(BOT1_CHAT_ID, final, { parse_mode: "HTML" });
    } catch (e) {
        console.error("❌ Bot 1 failed:", e.message);
    }

    // Send to Bot 2
    try {
        await bot2.sendMessage(BOT2_CHAT_ID, final, { parse_mode: "HTML" });
    } catch (e) {
        console.error("❌ Bot 2 failed:", e.message);
    }
}

// Login with captcha
async function performLoginAndSaveCookies() {
    try {
        console.log(`🔐 GET login page (${LOGIN_PAGE_URL})...`);
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
            if (name && !["username", "password", "capt"].includes(name)) formParams.append(name, val);
        });

        console.log("Posting credentials...");
        const postRes = await client.post(LOGIN_POST_URL, formParams.toString(), {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Origin": `http://${BASE_IP}`,
                "Referer": LOGIN_PAGE_URL,
                "User-Agent": "Mozilla/5.0",
            },
            maxRedirects: 0,
            validateStatus: s => s >= 200 && s < 400,
        });

        console.log("Login POST status:", postRes.status);

        const body = String(postRes.data || "");
        const looksLikeLoginPage = /<title>.*Login/i.test(body);

        if ((postRes.status === 302 || postRes.status === 303) && !looksLikeLoginPage) {
            return true;
        }
        if (!looksLikeLoginPage && postRes.status === 200) {
            return true;
        }

        console.warn("❌ Login failed, got login page again or bad status.");
        return false;

    } catch (err) {
        console.error("Login error:", err.message);
        return false;
    }
}

// Fetch Dashboard to get Session Key
async function fetchSessionKey() {
    try {
        const res = await client.get(DASHBOARD_URL, {
            headers: {
                "User-Agent": "Mozilla/5.0",
                "Referer": LOGIN_PAGE_URL
            }
        });

        const html = res.data;
        const match = html.match(/sesskey\s*[:=]\s*['"]?([a-zA-Z0-9=]+)['"]?/);

        if (match && match[1]) {
            sessionKey = match[1];
            console.log("🔑 New Session Key Fetched:", sessionKey);
        } else {
            console.log("⚠️ Session key not found. Attempting anyway.");
        }
    } catch (e) {
        console.error("Error fetching session key:", e.message);
        throw e; // Throw error to trigger re-login
    }
}

// Fetch SMS API
async function fetchSmsApi() {
    const url = getApiUrl();
    try {
        const res = await client.get(url, {
            headers: {
                "User-Agent": "Mozilla/5.0",
                "X-Requested-With": "XMLHttpRequest",
                "Accept": "application/json, text/javascript, /; q=0.01",
                "Referer": DASHBOARD_URL,
            },
        });
        return res.data;
    } catch (e) {
        // Throw Error to trigger catch block in loop
        throw new Error(`Fetch SMS API error: ${e.message}`);
    }
}

// === MAIN LOOP WITH AUTO RE-LOGIN ===
async function loop() {
    try {
        const data = await fetchSmsApi();

        if (data && Array.isArray(data.aaData) && data.aaData.length > 0) {
            const latest = mapRow(data.aaData[0]);

            if (lastId === null) {
                lastId = latest.id;
                console.log("✅ Initial latest ID Set:", lastId);
                // Optional: Send first msg on start
                // await sendTelegramSMS(latest);
            } else if (latest.id !== lastId) {
                lastId = latest.id;
                console.log("🔥 New SMS Found!", latest.id);
                await sendTelegramSMS(latest);
            } else {
                process.stdout.write("."); // Alive tick
            }
            
            // Wait 5 seconds and loop again
            setTimeout(loop, 5000);
        } else {
            // No data, just wait and retry
            process.stdout.write(".");
            setTimeout(loop, 5000);
        }

    } catch (e) {
        console.log("\n❌ Connection Error (Likely 503 or Session Expired).");
        console.log("🔄 Re-authenticating in 5 seconds...");

        // Wait 5s before trying to login
        await new Promise(resolve => setTimeout(resolve, 5000));

        try {
            const loggedIn = await performLoginAndSaveCookies();
            if (loggedIn) {
                await fetchSessionKey();
                console.log("✅ Re-login successful. Resuming watcher...");
                loop(); // Resume loop
            } else {
                console.log("❌ Re-login failed. Retrying...");
                loop(); // Retry loop (which will hit catch again if still broken)
            }
        } catch (loginErr) {
            console.error("❌ Fatal Login Error:", loginErr.message);
            setTimeout(loop, 10000);
        }
    }
}

// Worker Start
async function startWorker() {
    console.log("🚀 Seven1Tel Bot Started...");

    // First Login
    const ok = await performLoginAndSaveCookies();
    if (!ok) {
        console.error("❌ Initial Login failed. Retrying in 10s...");
        setTimeout(startWorker, 10000);
        return;
    }

    await fetchSessionKey();
    
    // Start the loop
    loop();
}

// Run
startWorker();