// Gabungkan apps-script/skema.js + apps-script/server.js menjadi satu file Code.gs untuk ditempel di editor Apps Script.
const fs = require("fs");
const path = require("path");
const dir = path.join(__dirname, "..", "apps-script");
const skema = fs.readFileSync(path.join(dir, "skema.js"), "utf8").replace(/^if \(typeof module[^\n]*\n?/m, "");
const server = fs.readFileSync(path.join(dir, "server.js"), "utf8");
const isi = `// ===== Code.gs — dibuat otomatis oleh tools/bangun-gs.js, jangan diedit langsung =====\n\n${skema}\n${server}`;
fs.writeFileSync(path.join(dir, "Code.gs"), isi);
console.log("apps-script/Code.gs", isi.length, "karakter");
