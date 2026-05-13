
# Function Interaction Diagram

## 1. Server-Side Flow

```mermaid
flowchart LR
    subgraph INIT["Startup"]
        ENV[".env file"] --> loadDotEnv
        loadDotEnv --> MQTT_CONNECT["mqtt.connect()"]
        loadDotEnv --> EXPRESS["Express app"]
    end

    subgraph MQTT["MQTT Client"]
        MQTT_CONNECT --> onConnect["on('connect')\nsubscribe REPORT_TOPIC"]
        MQTT_CONNECT --> onMessage["on('message')\nparse + update latest{}"]
        MQTT_CONNECT --> onError["on('error'/'close')\nupdate lastError"]
    end

    subgraph STATE["Shared State"]
        latest[("latest{}\ngcode_state · percent\ntemps · layer · file\nlights · mqttConnected")]
        morseJob[("morseJob{}\nrunning · cancel\ntext · unitMs")]
    end

    subgraph ROUTES["HTTP Routes"]
        GET_HEALTH["GET /api/health"]
        POST_STATE["POST /api/state/:state"]
        GET_CAMERA["GET /camera"]
        POST_LIGHT["POST /api/light/:node/:mode"]
        POST_MORSE_START["POST /api/morse/start"]
        POST_MORSE_STOP["POST /api/morse/stop"]
    end

    subgraph CMDS["Command Functions"]
        sendState["sendState(state)"]
        publishJson["publishJson(obj)"]
        setChamberLight["setChamberLight(mode)"]
        runMorse["runMorse(text, unitMs)"]
        stopMorse["stopMorse()"]
        normalizeText["normalizeText(s)"]
        morseTimeline["morseTimeline(text, unitMs)"]
        sleep["sleep(ms)"]
    end

    subgraph BROADCAST["Broadcast"]
        broadcast["broadcast(obj)"]
        safeJson["safeJson(x)"]
        WS_CLIENTS["All WebSocket Clients"]
    end

    PRINTER[("Bambu Printer\nMQTT :8883")]
    CAMERA_SRC["MJPEG Camera URL"]

    onConnect --> latest
    onMessage --> latest
    onError --> latest
    latest --> GET_HEALTH
    latest --> broadcast

    onConnect --> broadcast
    onError --> broadcast

    POST_STATE --> sendState --> publishJson
    POST_LIGHT --> publishJson
    POST_MORSE_START --> runMorse
    POST_MORSE_STOP --> stopMorse

    runMorse --> normalizeText
    runMorse --> morseTimeline --> normalizeText
    runMorse --> setChamberLight --> publishJson
    runMorse --> sleep
    runMorse --> morseJob
    runMorse --> broadcast
    stopMorse --> morseJob

    publishJson --> PRINTER --> onMessage
    GET_CAMERA --> CAMERA_SRC

    broadcast --> safeJson --> WS_CLIENTS
```

---

## 2. Frontend Flow

```mermaid
flowchart LR
    subgraph BUTTONS["Button Clicks"]
        B1["Pause"]
        B2["Resume"]
        B3["Stop"]
        B4["Chamber Light On"]
        B5["Chamber Light Off"]
        B6["Morse Send"]
        B7["Morse Stop"]
    end

    subgraph ACTIONS["fetch() Calls"]
        fState["sendState(state)\nPOST /api/state/:state"]
        fLight["setLight(node, mode)\nPOST /api/light/:node/:mode"]
        fMorseStart["morseStart()\nPOST /api/morse/start"]
        fMorseStop["morseStop()\nPOST /api/morse/stop"]
    end

    subgraph WS["WebSocket"]
        wsOpen["onopen → setConn(true)"]
        wsClose["onclose → setConn(false)"]
        wsMsg["onmessage\nroute by msg.type"]
    end

    subgraph DOM["DOM Updates"]
        D1["#conn — connected?"]
        D2["#status — gcode_state"]
        D3["#pct / #barFill — progress"]
        D4["#nozzle / #bed / #chamber — temps"]
        D5["#file — filename"]
        D6["#eta — time remaining"]
        D7["#lightChamberState / #lightWorkState"]
        D8["#err — errors"]
    end

    SERVER["server.js\n(WebSocket)"]

    B1 & B2 & B3 --> fState
    B4 & B5 --> fLight
    B6 --> fMorseStart
    B7 --> fMorseStop

    SERVER --> wsOpen --> D1
    SERVER --> wsClose --> D1
    SERVER --> wsMsg

    wsMsg -->|conn| D1
    wsMsg -->|telemetry| D2
    wsMsg -->|telemetry| D3
    wsMsg -->|telemetry| D4
    wsMsg -->|telemetry| D5
    wsMsg -->|telemetry| D6
    wsMsg -->|telemetry| D7
    wsMsg -->|error / system| D8

    fState --> D8
    fLight --> D8
    fMorseStart --> D8
    fMorseStop --> D8
```

---

## 3. MQTT Sequence

```mermaid
sequenceDiagram
    participant P as Printer (MQTT :8883)
    participant S as server.js
    participant B as Browser

    S->>P: connect()
    P-->>S: on('connect')
    S->>P: subscribe(REPORT_TOPIC)
    S->>B: broadcast {type:'conn', data:true}

    loop Every telemetry tick
        P->>S: publish(REPORT_TOPIC, payload)
        S->>S: update latest{}
        S->>B: broadcast {type:'telemetry', data:latest}
    end

    B->>S: POST /api/state/pause
    S->>P: publish(REQUEST_TOPIC, {print:{command:'pause'}})

    B->>S: POST /api/light/chamber_light/on
    S->>P: publish(REQUEST_TOPIC, {system:{command:'ledctrl', on}})

    B->>S: POST /api/morse/start {text, unitMs}
    loop Per morse symbol
        S->>P: ledctrl ON
        S->>S: sleep(dot/dash ms)
        S->>P: ledctrl OFF
        S->>S: sleep(gap ms)
    end
    S->>B: broadcast {type:'morse', data:morseJob}
```

---

## 4. WebSocket Message Types

```mermaid
flowchart LR
    SRV["server.js\nbroadcast()"]

    SRV -->|"conn"| C["setConn()\n#conn"]
    SRV -->|"telemetry"| T["#status #pct\n#nozzle #bed #chamber\n#file #eta #lights"]
    SRV -->|"error"| E["#err"]
    SRV -->|"system"| Y["#err"]
    SRV -->|"morse"| M["#morseStatus"]
```

## Message Types (WebSocket Protocol)

```mermaid
flowchart LR
    server["server.js\nbroadcast(obj)"]

    server -->|"{ type: 'conn',\n  data: bool }"| conn["→ setConn()\n→ #conn"]
    server -->|"{ type: 'telemetry',\n  data: latest.* }"| telem["→ #status #pct\n→ #nozzle #bed\n→ #file #eta\n→ #lights"]
    server -->|"{ type: 'error',\n  data: message }"| err["→ #err"]
    server -->|"{ type: 'system',\n  data: response }"| sys["→ #err"]
    server -->|"{ type: 'morse',\n  data: morseJob }"| morse["→ #morseStatus"]
```

## MQTT Data Flow

```mermaid
sequenceDiagram
    participant P as Printer (MQTT)
    participant S as server.js
    participant W as WebSocket Clients

    S->>P: mqtt.connect(:8883)
    P-->>S: on('connect')
    S->>P: subscribe(REPORT_TOPIC)

    loop Telemetry Loop
        P->>S: publish(REPORT_TOPIC, payload)
        S->>S: parse JSON → update latest{}
        S->>W: broadcast({ type:'telemetry', data:latest })
    end

    W->>S: POST /api/state/pause
    S->>P: publish(REQUEST_TOPIC, {print:{command:'pause'}})

    W->>S: POST /api/light/chamber_light/on
    S->>P: publish(REQUEST_TOPIC, {system:{command:'ledctrl',...}})

    W->>S: POST /api/morse/start {text, unitMs}
    loop Morse Timeline
        S->>P: publish(REQUEST_TOPIC, ledctrl 'on')
        S->>S: sleep(dotDuration)
        S->>P: publish(REQUEST_TOPIC, ledctrl 'off')
        S->>S: sleep(pauseDuration)
        S->>W: broadcast({ type:'morse', data:morseJob })
    end
```
