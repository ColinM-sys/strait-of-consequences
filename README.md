# STRAIT OF CONSEQUENCES

**AI Wargame Exercise // Strait of Hormuz // 2026**

A locally-hosted, air-gapped wargame exercise tool simulating crisis escalation in the Strait of Hormuz. Built for the SCSP Hackathon 2026 — Wargaming Track.

Format follows the canonical professional wargame pattern (RAND / CSIS / NWC Newport / NSC crisis sims): scenario brief → multi-turn injects → Blue Cell decisions → adjudicated effects + indicator deltas. Map and ships serve as the visualization layer; the loop is decision-driven, not unit-movement-driven.

---

## What It Does

### Core Exercise Loop
- **Scenario Mode** — Pick a pre-scripted crisis scenario, play through 4 adjudicated turns. Each turn: inject text → DIME+ decision card → assessment + indicator deltas + map effect.
- **Four Starter Scenarios** drawn from the escalation ladder:
  - 🟡 **SEIZURE** — IRGC boards a UAE-flagged tanker
  - 🟠 **MINING** — Limpet mines on a Saudi crude tanker; transit ambiguity
  - 🔴 **STRIKE** — Anti-ship missile salvo against a U.S.-linked tanker
  - 🛰 **AIRBASE INTEL** — IRGC strike-package buildup at Bandar Abbas (HARASS rung; live VLM demo focus)
- **DIME+ Decision Cards** (5 per turn): 🤝 Diplomatic / 📻 Information / ⚔ Military / 💰 Economic / 🛰 Intelligence
- **Indicators Tracked**: Escalation Rung (HARASS→WAR, 6 levels), Oil Price ($/bbl), War-Risk Insurance (bps), Alliance Cohesion (0–100), Attribution Confidence (0–100), Iran Coercion (0–100)
- **Bottom Sticky Overlay** — Turn counter, sitrep log, decision history. Same UX pattern as our Space Domain Awareness exercise tool.
- **Hand-Authored Branching** — Turn 1 MILITARY pick → ESCALATION path (Tehran reinforces FACs, war-risk spike, decisions about doubling-down vs. recall). Turn 1 DIPLOMATIC pick → DE-ESCALATION path (Tehran issues counter-statement, China declines, decisions about narrative warfare + UN escalation). Other lanes follow the default scripted Turn 2. 8 branch turns × 5 decisions each = 40 alternate decisions hand-authored across the 4 scenarios.
- **Live Map Visualization on Every Pick** — Picked decision text + the next turn's inject + decisions are parsed for known entities (Bandar Abbas / Fujairah / Strait of Hormuz / Larak / Qeshm / Ras Tanura / Jebel Ali / Kish / Tehran + every named SIM_VESSEL + every game unit by name). Map flies to bounding box, pulses every mentioned location/asset with green rings, draws connecting dashed lines, and dims all unmentioned ships to 18% opacity for 8 seconds (SDA-style isolation).

### AI & Adjudication
- **Local Inference Only** — Air-gapped via Ollama. No cloud LLM calls, no API keys, no telemetry.
- **AI Adjudication Endpoint** (`POST /scenario/next_turn`) — Local Llama 3.1 8B reads scenario context + Blue's specific pick + indicator state and generates a fresh next-turn inject + 5 DIME+ decisions on the fly. Validated for strict JSON schema. Disabled by default for demo speed (8B on a Lenovo laptop is 25-35s per turn); enable in browser console with `window.AI_ADJUDICATE = true` when a faster GPU (Main Desktop RTX 4090) is reachable.
- **Custom Modelfiles** — `hormuz-vision` (no-refusal vessel/aircraft counter) and `hormuz-count` for VLM analysis.
- **Scenario Engine** — Generate new crisis scenarios with the local LLM (strategic briefing, blue cell intel report, rules of engagement, IRGC starting posture).
- **AI Reveal Overlay** — When AI adjudication completes, a centered popup displays Tehran's response and the 5 newly-generated decisions for 12 seconds, then transitions into the side panel.

### Map & Visualization
- **Leaflet Map** with ArcGIS World Imagery basemap, focused on the Persian Gulf / Strait of Hormuz.
- **Live AIS Ship Traffic** — Civilian vessels (tankers, LNG carriers, cargo ships, naval escorts) transit the navigable channel in real time, rotating to face heading. Click any vessel for AIS details (cargo, route, stakeholder interest scores).
- **Ship Expand-Arrow → Side Panel** — Click ▶ STRIKE CONSEQUENCES on any ship popup to open a wide left-side panel showing:
  - Ship-specific cargo, origin, destination, flag, MMSI
  - **WHO STANDS TO LOSE** — per-stakeholder impact bars (China, Saudi Arabia, Japan, Korea, USA, EU, etc.) with per-stakeholder context strings (e.g., *"Primary buyer — 2.1M bbl Aramco crude"* for Saudi exposure on a China-bound VLCC)
  - Collapsed ▸ TAXONOMY section: Red Cell view, Blue Cell view, category-level strike consequences (1-20 actor taxonomy: U.S. military / Saudi crude / Qatari LNG / Chinese-bound / humanitarian / flag-of-convenience / media-symbolic / etc.)
- **OSM Infrastructure Layer** — Real Persian Gulf ports, oil terminals, airbases, refineries pulled live from OpenStreetMap via Overpass API (Bandar Abbas, Fujairah, Yanbu, Ras Tanura, Jebel Ali, Khor Fakkan, Kuwait, Basra, Sohar).
- **Strike & Transit Animations** — 8 named effect types (STRIKE / DISABLED / SINKING / BOARDED / MINED / OIL_SLICK / CONVOY_FORM / TRANSIT_HALT). Animations fire when scenario decisions trigger them.
- **Historical Mine + Attack Markers** — Toggle ⚠ MINE / ATTACK HISTORY in the action bar to drop 6 real geocoded incidents on the map: USS Samuel B. Roberts (1988), SS Bridgeton (1987), Fujairah 4-tanker limpet attack (2019), Front Altair / Kokuka Courageous (2019), Stena Impero seizure (2019), M. Star (2010). Each marker has a popup with date + open-source description.
- **Simulate Blue Transit** — Paint a path through the strait with the 🟡 PATH paint tool, then click ▶ EXECUTE PAINTED ROUTE (or ⏃ SIMULATE BLUE TRANSIT for the default route). MV PACIFIC LION (tanker) animates west-bound along the path with DDG-102 SAMPSON + DDG-119 D.BLACK flanking ~20 km port/starboard, ~11 km astern. Heading auto-rotates per segment. As the formation passes within 90 km of any historical incident, a banner pops up at top-center: *"⚠ ESCORT-ROUTE PROXIMITY — MINE / 1988 / USS Samuel B. Roberts · 76 km"* with the full incident description, and the historical marker pulses on the map. End report: "N/6 incidents in proximity."
- **Hide All Ships** — Action-bar toggle clears every ship marker for clean-map screenshots / route planning.
- **MINING Scenario Mine Field** — When MINING starts, 4 limpet-mine markers drop onto the map at the live-scenario detonation points + the historical mine-strike coordinates. Pulsing kill-radius circles. Auto-cleared when exercise ends.
- **Iran-Only Airport Overlay** — ✈ AIR INTEL toggle now filters to red-team bases only (14 IRIAF / IRGC AF airports across Iran: Bandar Abbas, Mehrabad, Imam Khomeini, Kish, Isfahan, Shiraz, Mashhad, Tabriz, Ahvaz, Qeshm, etc.). Other Gulf-state airports excluded.

### Intelligence & Imagery
- **RAG Intel Chat** — Military intelligence database (5,400+ docs) powering a chat interface. Ask about IRGC tactics, order of battle, mine warfare, tanker operations.
- **Doctrinal Grounding** — Joint Chiefs Doctrine Library (JP 3-0 Joint Operations, JP 5-0 Joint Planning, JP 3-32 Maritime Operations) ingested into RAG. Blue Cell assessments reference real doctrinal language with inline citations.
- **CSIS Analysis Library** — CSIS Hormuz wargame reports + Iran A2/AD analysis ingested into RAG. Scenario briefs cite specific CSIS analyses.
- **ACLED Regional Feed** — Live geocoded Gulf-area incidents (last 90 days, lat 22–30N / lng 47–58E). Scenarios anchor to real ACLED records.
- **VLM Satellite Analysis** — Draw a box anywhere on the map, capture the ArcGIS satellite image, run Llama 3.2 Vision 11B analysis: aircraft count, vessel count, infrastructure classification, position estimates. Results stream progressively as each query completes (no longer waiting 30s for all-or-nothing). When triggered from an exercise INTELLIGENCE decision (AIRBASE scenario), VLM output also appends live to the bottom-overlay sitrep entry with a green `[VLM LIVE — Llama 3.2 Vision]` callout.
- **Interactive VLM in Exercise Mode** — AIRBASE scenario INTELLIGENCE decisions fly the map to Bandar Abbas (27.22°N 56.38°E, zoom 13), then drop the user into draw-to-select mode. User drags a box around the airport apron; live Llama 3.2 Vision analysis runs on the captured Sentinel/ArcGIS frame.
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
- ✅ VLM box-draw analysis (now streams progressively + bridges into exercise sitrep)
- ✅ Airport intel overlay (now Iran-only, 14 IRIAF/IRGC AF airports)
- ✅ Exercise mode — 4 scenarios (SEIZURE / MINING / STRIKE / AIRBASE INTEL), DIME+ decisions, indicators, AAR screen
- ✅ Ship expand-arrow → side panel with per-stakeholder impact bars + actor-category taxonomy
- ✅ Hand-authored branching (Turn 1 MILITARY → escalation; Turn 1 DIPLOMATIC → de-escalation; 8 branch turns × 5 decisions = 40 alternates)
- ✅ Live map visualization on every pick (entity pulse + auto-zoom + dim isolation)
- ✅ Per-vessel impact animations (8 named effect types)
- ✅ Key-vessel isolation (dim non-relevant ships when scenario active, pulsing highlight on key actors)
- ✅ Historical mine + attack marker overlay (6 real geocoded incidents)
- ✅ Painted-route tanker transit simulation (escort formation auto-rotates heading + proximity alerts on historical mines)
- ✅ MINING scenario mine-field markers
- ✅ AI adjudicator endpoint (built; disabled by default for demo speed; re-enable via console flag when faster GPU is reachable)
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
