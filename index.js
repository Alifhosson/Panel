const fs = require("fs");
const path = require("path");

// safe loader
function safeRequire(p) {
  try {
    delete require.cache[require.resolve(p)];
    require(p);
    console.log(`✅ Loaded: ${p}`);
  } catch (err) {
    console.log(`❌ Error in ${p}`, err.message);
    console.log(`🔁 Retrying ${p} in 5s`);
    setTimeout(() => safeRequire(p), 5000);
  }
}

// Recursively load all JS files
function loadAllJs(dir) {
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);

    if (stat.isDirectory()) {
      loadAllJs(full); // folder recursion
    } else if (
      full.endsWith(".js") &&
      path.basename(full) !== "index.js" // index.js skip
    ) {
      safeRequire(full);
    }
  }
}

// 시작
loadAllJs(__dirname);
console.log("🔥 All bot modules loaded!");
