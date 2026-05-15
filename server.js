// server.js
// Panel A backend: Express + WebSocket + direct MQTT (Bambu LAN mode)
// .env needed:
//   PRINTER_IP=
//   PRINTER_SN=
//   LAN_ACCESS_CODE=
//   PORT=8787 (optional)

import express from "express";
import path from "path";
import fs from "fs";
import http from "http";
import { WebSocketServer } from "ws";
import { fileURLToPath } from "url";
import mqtt from "mqtt";

// --------------------
// Minimal .env loader (no deps)
// --------------------
function loadDotEnv() {
    const envPath = path.join(process.cwd(), ".env");
    if (!fs.existsSync(envPath)) return;

    for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq < 0) continue;

        const key = trimmed.slice(0, eq).trim();
        const val = trimmed.slice(eq + 1).trim();
        if (!process.env[key]) process.env[key] = val;
    }
}
loadDotEnv();

// --------------------
// Config
// --------------------
const PRINTER_IP = process.env.PRINTER_IP;
const PRINTER_SN = process.env.PRINTER_SN;
const LAN_ACCESS_CODE = process.env.LAN_ACCESS_CODE;
const PORT = Number(process.env.PORT || 8787);
const CAMERA_URL = process.env.CAMERA_URL; // optional
const DEBUG = process.env.DEBUG === "true";

if (!PRINTER_IP || !PRINTER_SN || !LAN_ACCESS_CODE) {
    console.error(
        "Missing .env values. You need:\n" +
        "  PRINTER_IP=...\n" +
        "  PRINTER_SN=...   (EXACT from device/<SN>/report)\n" +
        "  LAN_ACCESS_CODE=...\n"
    );
    process.exit(1);
}

const REPORT_TOPIC = `device/${PRINTER_SN}/report`;
const REQUEST_TOPIC = `device/${PRINTER_SN}/request`;

// --------------------
// Web server
// --------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

function safeJson(x) {
    try {
        return JSON.stringify(x);
    } catch {
        return JSON.stringify({ error: "Unable to serialize object" });
    }
}

function broadcast(obj) {
    const msg = safeJson(obj);
    for (const ws of wss.clients) {
        if (ws.readyState === ws.OPEN) ws.send(msg);
    }
}

const latest = {
    mqttConnected: false,
    lastMessageAt: null,
    lastError: null,

    // Raw-ish printer telemetry (from "print" object)
    print: null,

    // Convenience fields
    gcode_state: "UNKNOWN",
    percent: null,
    nozzleTemp: null,
    nozzleTarget: null,
    bedTemp: null,
    bedTarget: null,
    chamberTemp: null,
    remainingTimeMin: null,
    layer: null,
    totalLayers: null,
    file: null,
};


function stamp() {
    latest.lastMessageAt = new Date().toISOString();
}

// --------------------
// MQTT connection
// --------------------
const mqttUrl = `mqtts://${PRINTER_IP}:8883`;

const mqttClient = mqtt.connect(mqttUrl, {
    username: "bblp",
    password: LAN_ACCESS_CODE,

    // Bambu commonly uses TLS with certs that aren’t CA-trusted from your Mac’s POV
    rejectUnauthorized: false,

    // Quality-of-life:
    connectTimeout: 8000,
    reconnectPeriod: 2000,
    keepalive: 20,
});

mqttClient.on("connect", () => {
    latest.mqttConnected = true;
    latest.lastError = null;
    stamp();
    console.log("✅ MQTT CONNECTED", mqttUrl);
    console.log("📡 Subscribing:", REPORT_TOPIC);

    mqttClient.subscribe(REPORT_TOPIC, (err) => {
        if (err) {
            latest.lastError = `Subscribe error: ${err.message || err}`;
            console.log("❌", latest.lastError);
        } else {
            console.log("✅ Subscribed OK");
        }
        broadcast({ type: "conn", data: latest });
    });
});

mqttClient.on("reconnect", () => {
    console.log("↻ MQTT reconnecting...");
});

mqttClient.on("close", () => {
    latest.mqttConnected = false;
    stamp();
    console.log("⚠️ MQTT CLOSED");
    broadcast({ type: "conn", data: latest });
});

mqttClient.on("offline", () => {
    latest.mqttConnected = false;
    stamp();
    console.log("⚠️ MQTT OFFLINE");
    broadcast({ type: "conn", data: latest });
});

mqttClient.on("error", (err) => {
    latest.lastError = String(err?.message || err);
    stamp();
    console.log("❌ MQTT ERROR:", latest.lastError);
    broadcast({ type: "error", data: latest.lastError });
});

mqttClient.on("message", (topic, payload) => {
    stamp();

    let msg;
    try {
        msg = JSON.parse(payload.toString());
    } catch {
        return; // ignore non-JSON
    }

    // --- System responses (ACK/NAK for commands like ledctrl) ---
    if (DEBUG) console.log("🧠 SYSTEM REPORT:", JSON.stringify(msg, null, 2));

    // Most Bambu telemetry looks like: { "print": {...} }
    const print = msg?.print;

    if (!print) return;

    latest.print = print;

    // Pull commonly useful fields (not all exist all the time)
    latest.gcode_state = print.gcode_state ?? latest.gcode_state;
    latest.percent = print.mc_percent ?? latest.percent;

    latest.nozzleTemp = print.nozzle_temper ?? latest.nozzleTemp;
    latest.nozzleTarget = print.nozzle_target_temper ?? latest.nozzleTarget;

    latest.bedTemp = print.bed_temper ?? latest.bedTemp;
    latest.bedTarget = print.bed_target_temper ?? latest.bedTarget;

    // X1C often uses chamber_temper; sometimes frame_temper exists on other models
    latest.chamberTemp = print.chamber_temper ?? print.frame_temper ?? latest.chamberTemp;

    // Derive a few extra helpful fields if present:
    latest.remainingTimeMin = print.mc_remaining_time ?? latest.remainingTimeMin; // usually minutes
    latest.layer = print.layer_num ?? latest.layer;
    latest.totalLayers = print.total_layer_num ?? latest.totalLayers;
    latest.file = print.subtask_name ?? latest.file;

    // Lights
    latest.lights = print.lights_report ?? latest.lights;


    // If printer rejects a command it may report an error code.
    if (print.err_code != null && print.err_code !== 0) {
        const msg = `Printer err_code=${print.err_code} (command rejected)`;
        latest.lastError = msg;
        console.log("❌", msg, "full:", print);
        broadcast({ type: "error", data: msg });
    }

    broadcast({ type: "telemetry", data: latest });
});

// --------------------
// Command helpers
// --------------------
let seq = 1;

function publishJson(obj, opts = { qos: 1 }) {
    return new Promise((resolve, reject) => {
        const str = JSON.stringify(obj);
        mqttClient.publish(REQUEST_TOPIC, str, opts, (err) => {
            if (err) return reject(err);
            resolve();
        });
    });
}

async function sendState(state) {
    if (!["pause", "resume", "stop"].includes(state)) {
        throw new Error("state must be pause|resume|stop");
    }
    if (!latest.mqttConnected) {
        throw new Error("MQTT not connected to printer");
    }

    const payload = {
        print: {
            sequence_id: String(seq++), // must be string in many examples
            command: state,
            param: "", // important: always empty for these
        },
    };

    console.log("➡️ sending", state, "=>", payload);
    await publishJson(payload, { qos: 1 });
}

// --------------------
// Morse code (chamber_light)
// --------------------
const MORSE = {
    A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".",
    F: "..-.", G: "--.", H: "....", I: "..", J: ".---",
    K: "-.-", L: ".-..", M: "--", N: "-.", O: "---",
    P: ".--.", Q: "--.-", R: ".-.", S: "...", T: "-",
    U: "..-", V: "...-", W: ".--", X: "-..-", Y: "-.--",
    Z: "--..",
    "0": "-----", "1": ".----", "2": "..---", "3": "...--", "4": "....-",
    "5": ".....", "6": "-....", "7": "--...", "8": "---..", "9": "----.",
    ".": ".-.-.-", ",": "--..--", "?": "..--..", "!": "-.-.--",
    ":": "---...", ";": "-.-.-.", "'": ".----.", "-": "-....-",
    "/": "-..-.", "(": "-.--.", ")": "-.--.-", "@": ".--.-.", "&": ".-...",
};

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

function normalizeText(s) {
    return String(s || "")
        .toUpperCase()
        .replace(/\s+/g, " ")
        .trim();
}

// Build a timeline of { on: boolean, ms: number }
function morseTimeline(text, unitMs) {
    const t = normalizeText(text);
    const steps = [];

    const pushOff = (ms) => { if (ms > 0) steps.push({ on: false, ms }); };
    const pushOn = (ms) => { if (ms > 0) steps.push({ on: true, ms }); };

    const DOT = 1 * unitMs;
    const DASH = 3 * unitMs;
    const INTRA = 1 * unitMs;   // between symbols in same letter
    const LETTER = 3 * unitMs;  // between letters
    const WORD = 7 * unitMs;    // between words

    const chars = [...t];
    for (let i = 0; i < chars.length; i++) {
        const ch = chars[i];

        if (ch === " ") {
            // Word gap: but if last step already off, extend it
            pushOff(WORD);
            continue;
        }

        const code = MORSE[ch];
        if (!code) continue; // ignore unknown characters

        for (let j = 0; j < code.length; j++) {
            const sym = code[j];
            pushOn(sym === "." ? DOT : DASH);

            // intra-symbol gap (only if not last symbol)
            if (j !== code.length - 1) pushOff(INTRA);
        }

        // letter gap (only if next char is not space/end)
        const next = chars[i + 1];
        if (next && next !== " ") pushOff(LETTER);
    }

    return steps;
}

// Single running Morse job (so clicks don't overlap)
const morseJob = {
    running: false,
    cancel: false,
    text: "",
    unitMs: 120,
};

async function setChamberLight(mode) {
    const payload = {
        system: {
            sequence_id: String(seq++),
            command: "ledctrl",
            led_node: "chamber_light",
            led_mode: mode,          // "on" | "off"
            led_on_time: 0,
            led_off_time: 0,
            loop_times: 0,
            interval_time: 0,
        },
    };
    await publishJson(payload, { qos: 1 });
}

async function runMorse(text, unitMs) {
    if (!latest.mqttConnected) throw new Error("MQTT not connected");
    if (morseJob.running) throw new Error("Morse already running");

    morseJob.running = true;
    morseJob.cancel = false;
    morseJob.text = text;
    morseJob.unitMs = unitMs;

    broadcast({ type: "morse", data: { running: true, text, unitMs } });

    try {
        const steps = morseTimeline(text, unitMs);

        // Start from OFF
        await setChamberLight("off");

        for (const step of steps) {
            if (morseJob.cancel) break;
            await setChamberLight(step.on ? "on" : "off");
            await sleep(step.ms);
        }
    } finally {
        // Always end off
        try { await setChamberLight("off"); } catch { /* best-effort cleanup */ }
        morseJob.running = false;
        morseJob.cancel = false;
        broadcast({ type: "morse", data: { running: false } });
    }
}

function stopMorse() {
    if (!morseJob.running) return;
    morseJob.cancel = true;
}

// --------------------
// API routes
// --------------------
app.get("/api/health", (_req, res) => {
    res.json({ ok: true, latest, mqttUrl, reportTopic: REPORT_TOPIC, requestTopic: REQUEST_TOPIC });
});

app.post("/api/state/:state", async (req, res) => {
    try {
        await sendState(req.params.state);
        res.json({ ok: true });
    } catch (e) {
        const msg = String(e?.message || e);
        latest.lastError = msg;
        stamp();
        res.status(500).json({ ok: false, error: msg });
    }
});

// --------------------
// Camera proxy
// --------------------
app.get("/camera", async (req, res) => {
    if (!CAMERA_URL) {
        return res.status(400).send("CAMERA_URL not set in .env");
    }

    // MJPEG streams are long-lived; don’t let proxies buffer them.
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    const controller = new AbortController();
    req.on("close", () => controller.abort());

    try {
        const upstream = await fetch(CAMERA_URL, { signal: controller.signal });

        if (!upstream.ok || !upstream.body) {
            res.status(upstream.status).send(`Camera upstream error: ${upstream.status}`);
            return;
        }

        // Pass through content-type (important for MJPEG)
        const ct = upstream.headers.get("content-type");
        if (ct) res.setHeader("Content-Type", ct);

        // Pipe the stream to the browser
        upstream.body.pipeTo(
            new WritableStream({
                write(chunk) {
                    return new Promise((resolve, reject) => {
                        res.write(Buffer.from(chunk), (err) => (err ? reject(err) : resolve()));
                    });
                },
                close() {
                    res.end();
                },
                abort() {
                    try { res.end(); } catch { /* client already gone */ }
                },
            })
        ).catch(() => {
            try { res.end(); } catch { /* client already gone */ }
        });
    } catch (e) {
        const msg = String(e?.message || e);
        res.status(500).send(`Camera proxy failed: ${msg}`);
    }
});

// --------------------
// Lights
// --------------------

app.post("/api/light/:node/:mode", async (req, res) => {
    try {
        const node = String(req.params.node || "");
        const mode = String(req.params.mode || "").toLowerCase();

        if (node !== "chamber_light") {
            return res.status(400).json({
                ok: false,
                error: `Node "${node}" is not user-controllable on this printer (try chamber_light).`,
            });
        }
        if (!["on", "off"].includes(mode)) {
            return res.status(400).json({ ok: false, error: "Mode must be on|off" });
        }
        if (!latest.mqttConnected) {
            return res.status(503).json({ ok: false, error: "MQTT not connected" });
        }

        const payload = {
            system: {
                sequence_id: String(seq++),
                command: "ledctrl",
                led_node: node,
                led_mode: mode,
                led_on_time: 0,
                led_off_time: 0,
                loop_times: 0,
                interval_time: 0,
            },
        };

        await publishJson(payload, { qos: 1 });

        res.json({ ok: true, node, mode });
    } catch (e) {
        const msg = String(e?.message || e);
        res.status(500).json({ ok: false, error: msg });
    }
});

// --------------------
// Morse Code App Post
// --------------------

app.post("/api/morse/start", async (req, res) => {
    try {
        const text = String(req.body?.text || "");
        const unitMs = Number(req.body?.unitMs || 120);

        if (!text.trim()) return res.status(400).json({ ok: false, error: "text required" });
        if (!Number.isFinite(unitMs) || unitMs < 40 || unitMs > 1000) {
            return res.status(400).json({ ok: false, error: "unitMs must be between 40 and 1000" });
        }

        runMorse(text, unitMs); // don't await; let it run
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
});

app.post("/api/morse/stop", (_req, res) => {
    stopMorse();
    res.json({ ok: true });
});

// --------------------
// WebSocket: send current state on connect
// --------------------
wss.on("connection", (ws) => {
    ws.send(safeJson({ type: "conn", data: latest }));
    ws.send(safeJson({ type: "telemetry", data: latest }));
});

// --------------------
// Start
// --------------------
server.listen(PORT, () => {
    console.log(`Panel A running on http://localhost:${PORT}`);
    console.log(`Target printer: ${PRINTER_IP} / ${PRINTER_SN}`);
    console.log(`MQTTS: ${mqttUrl}`);
});

