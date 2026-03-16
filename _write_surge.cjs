const fs = require("fs");
const base = "C:/Users/OAJAGUN/OneDrive/Documents/Code/VibeApp/frontend/src/components/";
const lines = JSON.parse(fs.readFileSync("C:/Users/OAJAGUN/OneDrive/Documents/Code/VibeApp/_surge_lines.json", "utf8"));
fs.writeFileSync(base + "VibeSurgeBar.tsx", lines.join("
"), "utf8");
console.log("done");