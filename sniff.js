import mqtt from "mqtt";
import fs from "fs";
import path from "path";

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

const { PRINTER_IP, LAN_ACCESS_CODE } = process.env;
if (!PRINTER_IP || !LAN_ACCESS_CODE) {
  console.error("Need PRINTER_IP and LAN_ACCESS_CODE in .env");
  process.exit(1);
}

const url = `mqtts://${PRINTER_IP}:8883`;
const client = mqtt.connect(url, {
  username: "bblp",
  password: LAN_ACCESS_CODE,
  rejectUnauthorized: false, // printer uses TLS but often with self-signed certs
});

client.on("connect", () => {
  console.log("✅ MQTT connected to", url);
  client.subscribe("#", (err) => {
    if (err) console.error("Subscribe error:", err);
    else console.log("📡 Subscribed to # (watching all topics)...");
  });
});

client.on("error", (e) => {
  console.error("❌ MQTT error:", e?.message || e);
});

client.on("message", (topic, payload) => {
  let msg;
  try { msg = JSON.parse(payload.toString()); } catch { return; }

  if (topic.includes("/request") && msg?.system?.command === "ledctrl") {
    console.log("\n➡️ LEDCTRL REQUEST:", topic);
    console.log(JSON.stringify(msg, null, 2));
  }

  if (topic.includes("/report") && msg?.system) {
    console.log("\n🧠 SYSTEM REPORT:", topic);
    console.log(JSON.stringify(msg.system, null, 2));
  }

  if (topic.includes("/report") && msg?.print?.lights_report) {
    console.log("\n🔦 LIGHTS_REPORT:", topic);
    console.log(JSON.stringify(msg.print.lights_report, null, 2));
  }
});