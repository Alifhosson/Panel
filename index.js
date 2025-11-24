const axios = require("axios");
const JSZip = require("jszip");
const vm = require("vm");
const path = require("path");

// In-Memory Virtual File System
let vfs = {};

function loadModule(filePath) {
    const code = vfs[filePath];
    if (!code) throw new Error("Module not found: " + filePath);

    const dirname = path.dirname(filePath);
    const module = { exports: {} };

    // Fake require (RAM-based + built-in support)
    const fakeRequire = (reqPath) => {

        // 1) Node built-in modules
        if (require("module").builtinModules.includes(reqPath)) {
            return require(reqPath);
        }

        // 2) Local RAM modules
        const resolved = path.join(dirname, reqPath);
        return loadModule(resolved);
    };

    // require.resolve support
    fakeRequire.resolve = (reqPath) => {
        return path.join(dirname, reqPath);
    };

    const script = new vm.Script(code, { filename: filePath });

    const context = vm.createContext({
        require: fakeRequire,
        module,
        exports: module.exports,
        console,
        process,
        setTimeout,
        clearTimeout,
        Buffer
    });

    script.runInContext(context);
    return module.exports;
}

async function loadRepo() {
    console.log("📥 Downloading repo ZIP...");

    const zipUrl = "https://github.com/Alifhosson/Panel/archive/refs/heads/main.zip";
    const res = await axios.get(zipUrl, { responseType: "arraybuffer" });

    console.log("📦 Extracting in memory...");
    const zip = await JSZip.loadAsync(res.data);

    for (const filename of Object.keys(zip.files)) {
        const file = zip.files[filename];

        if (!file.dir) {
            const content = await file.async("string");
            const cleanPath = filename.replace("Panel-main/", "");
            vfs["/" + cleanPath] = content;
        }
    }

    console.log("✔ Loaded all files into memory!");
}

// Run main file
function runBot() {
    console.log("🚀 Starting Bot from RAM...");
    loadModule("/index.js");
}

(async () => {
    await loadRepo();
    runBot();
})();
