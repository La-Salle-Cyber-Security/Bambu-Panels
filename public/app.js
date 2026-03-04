const elConn = document.getElementById("conn");
const elStatus = document.getElementById("status");
const elLast = document.getElementById("last");
const elJob = document.getElementById("job");
const elErr = document.getElementById("err");

function setConn(connected) {
    elConn.textContent = connected ? "Connected" : "Disconnected";
    elConn.classList.toggle("ok", !!connected);
    elConn.classList.toggle("bad", !connected);
}

async function sendState(state) {
    if (state === "stop") {
        const ok = confirm("Stop the print? (This is the big red button.)");
        if (!ok) return;
    }
    elErr.textContent = "⏳ Sending command...";
    const r = await fetch(`/api/state/${state}`, { method: "POST" });
    const j = await r.json().catch(() => ({}));
    if (!j.ok) elErr.textContent = j.error || "Command failed";
}

async function setLight(node, mode) {
    elErr.textContent = "⏳ Sending command...";
    const r = await fetch(`/api/light/${node}/${mode}`, { method: "POST" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) elErr.textContent = j.error || `Light failed (${r.status})`;
}

document.getElementById("pause").onclick = () => sendState("pause");
document.getElementById("resume").onclick = () => sendState("resume");
document.getElementById("stop").onclick = () => sendState("stop");

const wsProto = location.protocol === "https:" ? "wss" : "ws";
const ws = new WebSocket(`${wsProto}://${location.host}`);

ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);

    if (msg.type === "conn") {
        setConn(!!msg.data.mqttConnected);
        if (msg.data.lastMessageAt) elLast.textContent = `Last update: ${msg.data.lastMessageAt}`;
        if (msg.data.lastError) elErr.textContent = msg.data.lastError;
    }

    if (msg.type === "error") {
        elErr.textContent = msg.data;
    }

    if (msg.type === "system") {
        const s = msg.data;
        if (!s) return;

        // Show a short status line in the same error/status area
        if (s.result === "success") {
            elErr.textContent = `✅ ${s.command} ok`;
        } else {
            elErr.textContent = `❌ ${s.command} failed: ${s.reason || "unknown"}`;
        }
    }

    if (msg.type === "telemetry") {
        const t = msg.data;

        const status = t.gcode_state || "UNKNOWN";
        const pctNum = typeof t.percent === "number" ? t.percent : null;

        elStatus.textContent = status;
        document.getElementById("pct").textContent = pctNum !== null ? `${pctNum}%` : "—";
        document.getElementById("barFill").style.width = pctNum !== null ? `${pctNum}%` : "0%";

        // File / ETA
        document.getElementById("file").textContent = t.file ? `File: ${t.file}` : "—";
        document.getElementById("eta").textContent =
            (typeof t.remainingTimeMin === "number") ? `ETA: ~${t.remainingTimeMin} min` : "ETA: —";

        // Temps
        const fmt = (x) => (typeof x === "number" ? x.toFixed(0) : "—");
        document.getElementById("nozzle").textContent =
            (t.nozzleTemp != null || t.nozzleTarget != null) ? `${fmt(t.nozzleTemp)} / ${fmt(t.nozzleTarget)}°C` : "—";
        document.getElementById("bed").textContent =
            (t.bedTemp != null || t.bedTarget != null) ? `${fmt(t.bedTemp)} / ${fmt(t.bedTarget)}°C` : "—";
        document.getElementById("chamber").textContent =
            t.chamberTemp != null ? `${fmt(t.chamberTemp)}°C` : "—";

        if (t.lastMessageAt) elLast.textContent = `Last update: ${t.lastMessageAt}`;

        // Lights
        const lights = Array.isArray(t.lights) ? t.lights : [];
        const chamber = lights.find(x => x.node === "chamber_light")?.mode ?? "—";
        const work = lights.find(x => x.node === "work_light")?.mode ?? "—";

        document.getElementById("lightChamberState").textContent = chamber;
        document.getElementById("lightWorkState").textContent = work;

        // Optional: disable work light buttons since it's not controllable
        const workBtns = document.querySelectorAll("[data-light='work']");
        workBtns.forEach(b => b.disabled = true);

        // Keep debug JSON small/useful
        elJob.textContent = JSON.stringify(
            {
                mqttConnected: t.mqttConnected,
                gcode_state: t.gcode_state,
                percent: t.percent,
                remainingTimeMin: t.remainingTimeMin,
                layer: t.layer,
                totalLayers: t.totalLayers,
                temps: {
                    nozzleTemp: t.nozzleTemp,
                    nozzleTarget: t.nozzleTarget,
                    bedTemp: t.bedTemp,
                    bedTarget: t.bedTarget,
                    chamberTemp: t.chamberTemp,
                },
                file: t.file,
                lastMessageAt: t.lastMessageAt,
            },
            null,
            2
        );
    }
};

ws.onopen = () => setConn(false);
ws.onclose = () => setConn(false);

ws.onopen = () => setConn(false);
ws.onclose = () => setConn(false);
