import fs from "fs";
import path from "path";
import { BambuClient } from "bambu-node";

function loadDotEnv() {
  const p = path.join(process.cwd(), ".env");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}
loadDotEnv();

const { PRINTER_IP, PRINTER_SN, LAN_ACCESS_CODE } = process.env;

console.log("Connecting to:", PRINTER_IP, PRINTER_SN ? PRINTER_SN.slice(0,3)+"…" : null);

const client = new BambuClient({
  host: PRINTER_IP,
  accessToken: LAN_ACCESS_CODE,
  serialNumber: PRINTER_SN,
});

client.on("client:connect", () => console.log("✅ CONNECTED"));
client.on("client:disconnect", () => console.log("⚠️ DISCONNECTED"));
client.on("client:error", (e) => console.log("❌ ERROR:", e));

client.connect();