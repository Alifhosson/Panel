const fs = require("fs");
const path = require("path");

// load safe
function safeRequire(p) {
  try {
    delete require.cache[p];
    require(p);
    console.log("✔ Loaded:", p);
  } catch (err) {
    console.log("❌ Error in", p, err.message);
    setTimeout(() => safeRequire(p), 5000);
  }
}

// Recursive JS loader
function loadAll(dir) {
  const items = fs.readdirSync(dir);

  items.forEach(item => {
    const full = path.join(dir, item);

    if (fs.statSync(full).isDirectory()) {
      loadAll(full);
    } else if (full.endsWith(".js") && path.basename(full) !== "index.js") {
      safeRequire(full);
    }
  });
}

loadAll(__dirname);
console.log("🔥 All bot modules loaded!");
