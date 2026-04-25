# STRAIT OF CONSEQUENCES

**AI Wargame Exercise // Strait of Hormuz // 2026**

A locally-hosted, air-gapped wargame exercise tool simulating crisis escalation in the Strait of Hormuz. Built for the SCSP Hackathon 2026 — Wargaming Track.

Format follows the canonical professional wargame pattern (RAND / CSIS / NWC Newport / NSC crisis sims): scenario brief → multi-turn injects → Blue Cell decisions → adjudicated effects + indicator deltas. Map and ships serve as the visualization layer; the loop is decision-driven, not unit-movement-driven.

---

## What It Does

### Core Exercise Loop
- **Scenario Mode** — Pick a pre-scripted crisis scenario, play through 4 adjudicated turns. Each turn: inject text → DIME+ decision card → assessment + indicator deltas + map effect.
- **Three Starter Scenarios** drawn from the escalation ladder:
  - 🟡 **SEIZURE** — IRGC boards a UAE-flagged tanker
  - 🟠 **MINING** — Limpet mines on a Saudi crude tanker; transit ambiguity
  - 🔴 **STRIKE** — Anti-ship missile salvo against a Western-flagged vessel
- **DIME+ Decision Cards** (5 per turn): 🤝 Diplomatic / 📻 Information / ⚔ Military / 💰 Economic / 🛰 Intelligence
- **Indicators Tracked**: Escalation Rung (HARASS→WAR, 6 levels), Oil Price ($/bbl), War-Risk Insurance (bps), Alliance Cohesion (0–100), Attribution Confidence (0–100), Iran Coercion (0–100)
- **Bottom Sticky Overlay** — Turn counter, sitrep log, decision history. Same UX pattern as our Space Domain Awareness exercise tool.

### AI & Adjudication
- **Local Inference Only** — Air-gapped via Ollama. No cloud LLM calls, no API keys, no telemetry.
- **AI Adjudication** — Local Llama 3.1 8B runs Red Cell behavior; assessment text grounded in RAG retrieval over the intel corpus.
- **Custom Modelfiles** — `hormuz-vision` (no-refusal vessel/aircraft counter) and `hormuz-count` for VLM analysis.
- **Scenario Engine** — Generate new crisis scenarios with the local LLM (strategic briefing, blue cell intel report, rules of engagement, IRGC starting posture).

### Map & Visualization
- **Leaflet Map** with ArcGIS World Imagery basemap, focused on the Persian Gulf / Strait of Hormuz.
- **Live AIS Ship Traffic** — Civilian vessels (tankers, LNG carriers, cargo ships, naval escorts) transit the navigable channel in real time, rotating to face heading. Click any vessel for AIS details (cargo, route, stakeholder interest scores).
- **Ship Expand-Arrow** — Click ▼ on any ship popup to reveal:
  - Actor category (1–20: U.S. military / Saudi crude / Qatari LNG / Chinese-bound / humanitarian / etc.)
  - Red Cell vs. Blue Cell perception of that target
  - Strike consequences (oil-price shock, alliance test, attribution sensitivity, etc.)
- **OSM Infrastructure Layer** — Real Persian Gulf ports, oil terminals, airbases, refineries pulled live from OpenStreetMap via Overpass API (Bandar Abbas, Fujairah, Yanbu, Ras Tanura, Jebel Ali, Khor Fakkan, Kuwait, Basra, Sohar).
- **Strike & Transit Animations** — Visual effects for ship strikes, transit suspended overlays, oil-rig burning markers.

### Intelligence & Imagery
- **RAG Intel Chat** — Military intelligence database (5,400+ docs) powering a chat interface. Ask about IRGC tactics, order of battle, mine warfare, tanker operations.
- **Doctrinal Grounding** — Joint Chiefs Doctrine Library (JP 3-0 Joint Operations, JP 5-0 Joint Planning, JP 3-32 Maritime Operations) ingested into RAG. Blue Cell assessments reference real doctrinal language with inline citations.
- **CSIS Analysis Library** — CSIS Hormuz wargame reports + Iran A2/AD analysis ingested into RAG. Scenario briefs cite specific CSIS analyses.
- **ACLED Regional Feed** — Live geocoded Gulf-area incidents (last 90 days, lat 22–30N / lng 47–58E). Scenarios anchor to real ACLED records.
- **VLM Satellite Analysis** — Draw a box anywhere on the map, capture the ArcGIS satellite image, run Llama 3.2 Vision 11B analysis: aircraft count, vessel count, infrastructure classification.
- **Sentinel-2 Imagery** — Pull real ESA satellite passes (last 10 days) for any area. Compare before/after imagery with a drag slider. AI analysis detects ship presence and military buildup.
- **Airport Intel Overlay** — AI-analyzed aircraft counts at 66 airports across Iran, Iraq, UAE, Saudi Arabia, Pakistan.

### Markets Panel
- Real-time indicator dashboard: Brent / WTI prices, war-risk insurance basis points, strait-closure probability, alliance cohesion meter.
- Updates from exercise indicator deltas turn-by-turn.

---

## Architecture

| Layer | Tech | Port |
|---|---|---|
| Frontend | Vanilla JS + Leaflet, served by Python `SimpleHTTPRequestHandler` | 3000 |
| Backend | FastAPI (RAG, AI agents, Sentinel proxy) | 8000 |
| LLM Inference | Ollama (local, GPU) | 11434 |
| Vector DB | ChromaDB (in-process via FastAPI) | — |

**No external LLM calls. No cloud.** All model inference runs on the local GPU.

---

## Datasets & APIs

| Source | Use |
|---|---|
| ArcGIS World Imagery | Satellite basemap |
| ESA Sentinel-2 (Copernicus Data Space) | Before/after imagery comparison |
| OpenStreetMap / Overpass API | Live infrastructure layer (ports, terminals, airbases) |
| ACLED | Geocoded Gulf-region incident feed; scenario anchoring |
| Joint Chiefs Doctrine Library | JP 3-0 / 5-0 / 3-32 ingested into RAG corpus |
| CSIS Analysis Library | Hormuz wargame reports + Iran A2/AD analysis ingested into RAG |
| Global Terrorism Database (1970–2020) | Historical analog research (1987 Tanker War, 2019 Fujairah limpet mines, 2019 Stena Impero) |
| Simulated AIS vessel traffic | Real vessel names, MMSI, positions from April 2026 transits |
| Military intel RAG corpus | 5,400+ open-source unclassified docs |

---

## Team

- Colin McDonough
- Alex Smith
- Deborah Debeauville

## Track

SCSP Hackathon 2026 — **Wargaming Track**

---

## How To Run

**Requirements:** Python 3.11+, Node.js, Ollama with `llama3.1:8b` and `llama3.2-vision:11b` pulled. (Custom models `hormuz-vision` and `hormuz-count` optional but recommended for full VLM features.)

```bash
# Start the RAG / AI backend (port 8000)
cd api
pip install -r requirements.txt
python -m uvicorn server:app --port 8000

# Start the frontend (port 3000)
cd ..
python serve.py
```

Then open `http://localhost:3000`.

For Ollama: `ollama serve` (separate terminal). On Windows the Ollama tray app handles this automatically.

### One-shot start (Linux / macOS / Git Bash)

```bash
./start.sh
```

---

## Why This Format

Real wargames are not video games. RAND, CSIS, the National War College, and the NSC's crisis simulations all run on the same pattern: scenario brief → multi-turn injects → cell decisions → adjudicated effects → indicators. Real-time tactical simulation is the *unusual* format — almost no one builds wargames that way because it doesn't match how policy decisions are actually deliberated.

This tool is built to that canonical pattern, locally hosted, fully air-gapped, with real geocoded incident data anchoring fictional scenarios and real doctrinal language grounding the adjudication.

---

## Roadmap

- ✅ Map + ship visualization with AIS popups
- ✅ Local Ollama inference (Llama 3.1 8B + 3.2 Vision 11B)
- ✅ RAG corpus + INTEL CHAT
- ✅ Sentinel-2 before/after viewer
- ✅ VLM box-draw analysis
- ✅ Airport intel overlay
- 🟡 Exercise mode (3 starter scenarios, DIME+, indicators) — **in progress**
- 🟡 Ship expand-arrow with actor-category taxonomy — in progress
- 🟡 OSM infrastructure layer — in progress
- 🟡 ACLED feed integration — in progress
- 🟡 JCS / CSIS doctrinal RAG ingestion — in progress
- ⏳ HARASS / CLOSURE / WAR scenarios (fill out the ladder)
- ⏳ Save/load exercise state for after-action review
- ⏳ Decision-quality scoring at end of exercise
- ⏳ Multi-player Blue/Red split

---

## License

Open-source for the SCSP Hackathon 2026 evaluation. License TBD.
