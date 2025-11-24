const fs = require("fs");
const path = require("path");

function safeRequire(p) {
  try {
    delete require.cache[require.resolve(p)];
    require(p);
    console.log(`✅ Loaded: ${p}`);
  } catch (err) {
    console.log(`❌ Error in ${p}:`, err.message);
    console.log(`🔁 Retrying in 5s...\n`);
    setTimeout(() => safeRequire(p), 5000);
  }
}

function loadAll(dir) {
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);

    if (stat.isDirectory()) {
      loadAll(full);
    } else if (full.endsWith(".js") && path.basename(full) !== "index.js") {
      safeRequire(full);
    }
  }
}

loadAll(__dirname);

console.log("🔥 All bot modules loaded!");
