function safeRequire(path) {
  try {
    delete require.cache[require.resolve(path)]; // old cache clear
    require(path);
    console.log(`✅ ${path} loaded successfully.`);
  } catch (err) {
    console.log(`\n❌ ERROR in file: ${path}`);
    console.log("📛 Error Message:", err.message);
    console.log("📄 Error Stack:\n", err.stack);

    console.log(`🔁 Retrying ${path} in 5 seconds...\n`);

    setTimeout(() => safeRequire(path), 5000);
  }
}

// বটগুলো লোড করুন
safeRequire('./degrup');

console.log('Bot1, Bot2, are running...');
