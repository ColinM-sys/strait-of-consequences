# STRAIT OF CONSEQUENCES

**AI Wargame Exercise // Strait of Hormuz // 2026**

---

## SCSP Hackathon 2026 Submission

**Team:** Colin McDonough · Alex Smith · Deborah Debeauville
**Track:** Wargaming
**Repo:** https://github.com/ColinM-sys/strait-of-consequences

**What we built:** A locally-hosted, air-gapped AI wargame exercise tool that simulates crisis escalation in the Strait of Hormuz. Replaces the months-long analog wargame design + days-long adjudication cycle with a same-session loop: scenario brief → multi-turn injects → Blue Cell DIME+ decisions → AI-adjudicated effects + indicator deltas + live map visualization. Includes a live AI Red Cell adversary (FACs pursue + fire missiles, sub launches torpedoes) with realistic ROE-bounded fire discipline (3-shot global cap), Monte-Carlo adversary spawning, hand-authored 40-decision branching tree, dynamic oil-at-risk metric computed live from real cargo-manifest data, RAG-augmented intelligence chat grounded in JCS/CSIS doctrinal corpus, and live VLM analysis on user-drawn satellite imagery — all on a single GPU, zero cloud calls, zero API keys.

**Datasets / APIs used:**
- **GDELT 2.0** + **ACLED** — geocoded Gulf-region incident feed for scenario seeding
- **Joint Chiefs Doctrine Library** (JP 3-0, 3-32, 5-0) ingested into ChromaDB RAG corpus
- **CSIS Analysis Library** Hormuz wargame reports + Iran A2/AD analysis ingested into RAG
- **Global Terrorism Database** (1970–2020) for historical analog research (Tanker War, 2019 Fujairah limpet mines, Stena Impero seizure)
- **OpenStreetMap / Overpass API** — live infrastructure layer (Persian Gulf ports, oil terminals, airbases)
- **ESA Sentinel-2** (Copernicus Data Space) — before/after satellite imagery for VLM analysis
- **ArcGIS World Imagery** — base map tiles
- **Custom 5,400-doc military intelligence RAG corpus** (open-source, unclassified) including 20 hand-curated docs on Lloyd's JWC war-risk insurance, OFAC sanctions, Iranian shadow-fleet operations, IMO TSS rules
- **Llama 3.1 8B** (adjudication / chat) + **Llama 3.2 Vision 11B** (satellite VLM) running locally via Ollama
- **Two custom Ollama Modelfiles** (`hormuz-vision`, `hormuz-count`) — operator-tuned overlays of base Llama 3.2 Vision

**How to run:**
```bash
# Prereqs: Python 3.11+, Ollama (with llama3.1:8b + llama3.2-vision:11b pulled)

# Backend (RAG + AI agents) on :8000
cd api
pip install -r requirements.txt
python -m uvicorn server:app --port 8000

# Frontend on :3000 (separate terminal)
cd ..
python serve.py

# Optional: ollama serve  (separate terminal — Windows tray app handles automatically)
```
Open `http://localhost:3000`. One-shot Linux/macOS/Git-Bash launch: `./start.sh`

---

A locally-hosted, air-gapped wargame exercise tool simulating crisis escalation in the Strait of Hormuz. Format follows the canonical professional wargame pattern (RAND / CSIS / NWC Newport / NSC crisis sims): scenario brief → multi-turn injects → Blue Cell decisions → adjudicated effects + indicator deltas. Map and ships serve as the visualization layer; the loop is decision-driven, not unit-movement-driven.

---

## What Sets This Apart (Judge Highlights)

- **Fully air-gapped local AI.** Every model call (Llama 3.1 8B for adjudication / chat, Llama 3.2 Vision 11B for satellite analysis) runs on the local GPU via Ollama. Zero cloud, zero API keys, zero telemetry. Reproducible, deployable, classified-environment-compatible.
- **Two custom Ollama Modelfiles** (`hormuz-vision`, `hormuz-count`) derived from `llama3.2-vision:11b` with hand-tuned system prompts that (a) defeat the base model's refusal-to-count-military-assets behavior and (b) embed visual heuristics for vessel/aircraft detection. Same base model, operator-tuned overlays.
- **Hand-authored branching decision tree.** Turn 1 MILITARY pick → ESCALATION path; Turn 1 DIPLOMATIC pick → DE-ESCALATION path. **40 alternate decisions hand-written** across 4 scenarios. Deterministic, demo-safe, every playthrough actually diverges.
- **Live AI adjudicator endpoint** (`POST /scenario/next_turn`). Llama 3.1 8B reads scenario state + Blue's specific pick + indicator history and generates a fresh inject + 5 brand-new DIME+ decisions on the fly. Strict JSON-schema validation with graceful fallback.
- **Live map visualization on every decision.** Picked decision text is parsed for known entities (cities / ports / SIM_VESSELS / game units). Map flies to bounding box, pulses every mentioned location with green rings, dims unmentioned ships to 18% (SDA-style key-asset isolation).
- **Red AI Combat during transit.** IRGC FACs **pursue Blue formation** at ~52 knots, **fire C-802 ASCMs** at ≤40 km with 45% hit / 55% CIWS-intercept. Iranian Ghadir submarine launches Type-53 torpedoes at ≤80 km with 30% hit. **Realistic global shot budget — max 3 launches per transit total** — so out of 10+ FACs in the area, only 1-2 actually commit before Blue counter-fire suppresses them. Each transit produces a different damage profile (true Monte-Carlo variance).
- **Land-avoidance pathfinding for Red AI.** FACs pursue Blue using vector pursuit but check 11 land-bbox polygons (Iranian coast, Qeshm, Larak, Hengam, the Tunbs, Abu Musa, Musandam Peninsula, UAE/Qatar/Saudi coasts). If direct path hits land, they slide 90° port or starboard to navigate around. No more boats clipping through islands.
- **🎲 Spawn Adversaries (Monte-Carlo button).** One click drops 3-6 randomized red units at water-only anchor points (with ±8 km jitter) — mix of FACs, sub, mine-layer. Every roll produces a different threat geometry. Click multiple times to stack adversaries. RESET clears them.
- **Dynamic OIL AT RISK metric.** Live percentage computed from actual SIM_VESSEL cargo manifests still inside the Persian Gulf bbox (24–28°N / 50.5–58°E). Crude in M bbl + LNG/LPG converted to barrels-of-oil-equivalent (LNG: 7.3 boe/MT, LPG: 11.6 boe/MT), divided by world daily supply (100 MBD). **Decreases live during transit** as westbound tankers exit at lng < 50.5° and eastbound exit at lng > 58°. Idle baseline ~11.6%; lands somewhere in 4-8% by transit end.
- **20-category ship-actor taxonomy** with per-ship stakeholder impact bars + **0-100 US PRIORITY score per vessel** (USN treaty assets = 95-100, China-bound flag-of-convenience = 28, humanitarian = 90).
- **Historical mining + attack overlay** with **6 real geocoded incidents** (USS Samuel B. Roberts 1988, SS Bridgeton 1987, Fujairah 4-tanker limpet 2019, Front Altair / Kokuka Courageous 2019, Stena Impero 2019, M. Star 2010). Toggle on demand via ⚠ MINE/ATTACK HISTORY button.
- **Painted-route tanker transit simulation.** Paint a custom route → MV PACIFIC LION + 4-ship escort (DDG×2 + cruiser + carrier) animates along it in CSG diamond formation, headings auto-rotating per segment.
- **Stacking transit-log overlay.** All combat events (mine sweeps, FAC kills, ASCM launches, hits, CIWS intercepts) route through a single bottom-left log container — newest pushes up, 6-row cap, smooth fades. No more banner pile-ups.
- **Interactive VLM exercise.** AIRBASE INTEL scenario INTELLIGENCE decisions auto-fly the map to Bandar Abbas, drop the user into draw-to-select mode, and run live Llama 3.2 Vision 11B analysis on a captured frame.
- **12 unit tests** covering pure-logic modules (state machine, scenario validation, ship taxonomy). Wargame logic is verified, not vibes.
- **Iran-only airport overlay.** ✈ AIR INTEL filter narrowed from 91 Gulf-region airports down to 14 IRIAF / IRGC AF airports.

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
### Three Distinct Imagery / VLM Tools (top-right of map)

All three use the same base model (`llama3.2-vision:11b` running locally on Ollama) but serve different operational tempos:

| Tool | Tiles | VLM queries | Time | Best for |
|---|---|---|---|---|
| 🔭 **INTEL** | 1 (whatever box you draw) | 4 parallel (aircraft / vessel / infra / position) | ~10 s | Single-shot "what's at this spot?" |
| 🗺 **SURVEY (3×3 GRID)** | 9 (auto-split sub-frames) | ~36 total (4 per tile) | ~60-90 s | High-density target areas — airbases, port complexes — where one frame would miss detail |
| 🛰 **SENTINEL** | Real ESA Sentinel-2 imagery | VLM on before/after diff | ~30 s + revisit pull | Time-machine analysis — see what changed at a location over the last 10 days |

- **INTEL** — fast tactical lookup. Draw a box → 4 parallel VLM queries → tactical summary. Results stream progressively as each query lands (no all-or-nothing 30 s wait).
- **SURVEY (3×3 GRID)** — thorough sweep. Auto-tiles your box into a 9-cell grid, runs the VLM on each, produces a consolidated report (*"NW corner: 2 FACs · center: dock with 3 mines staged · SE: clear water"*). Best for condensed high-density areas where INTEL would miss things.
- **SENTINEL** — pulls real ESA Sentinel-2 satellite passes for any area, last ~10 days. Drag-slider before/after comparison. Optional VLM analysis on the temporal diff to detect ship presence shifts, military buildup, infrastructure changes.

### Interactive VLM in Exercise Mode
- AIRBASE INTEL scenario INTELLIGENCE decisions auto-fly the map to Bandar Abbas (27.22°N 56.38°E, zoom 13), then drop the user into draw-to-select mode. User drags a box around the airport apron; live Llama 3.2 Vision runs on the captured frame and the result streams into the exercise sitrep with a green `[VLM LIVE — Llama 3.2 Vision]` callout.

### Airport Intel Overlay
- ✈ AIR INTEL toggle — Iran-only filter (14 IRIAF / IRGC AF airports). Each marker has a pre-computed AI aircraft count from the `hormuz-count` custom Modelfile.

### IRGC Intel Pins (📋 fictional VLM analysis on red units)
- Action-bar toggle drops VLM-styled annotation pins on every IRGC unit (FACs, sub, mine-layer). Click a pin for a mock analysis: *"IRGC-N FAC sortie · 4× 5-meter Boghammar speedboats · armed: 7.62mm DShK + 107mm rocket pods · last imagery: Sentinel-2 06:14Z"*. Frames the demo as if the user had run the 🔭 INTEL workflow on each Red unit. Source label: "simulated Llama 3.2 Vision 11B output on a Sentinel-2 frame."

### Routes Tab (replaces Markets)
- 🚦 ROUTES tab — 5 preset transit options for the Blue strike group. Each card shows the IRGC engagement profile as colored tags (FAC engagement range, missile chance, swarm spawn, rear intercept, mine hit chance).
- Click ▶ EXECUTE on any card → paints the route polyline, animates the 5-ship formation along it, applies the route's IRGC profile deltas to active exercise indicators (escalation rung / war-risk / oil), and runs proximity alerts + DDG mine-sweep + FAC engagement against everything on the path.
- **TSS LANE** (cyan) — standard commercial route, low IRGC engagement
- **NORTHERN PUSH** (red) — aggressive route close to Iranian coast; FAC swarm probable; +45 bps insurance, +1 rung
- **OMANI HUG** (green) — stays in Omani territorial water; no IRGC engagement; longer transit; insurance unaffected
- **HIGH-SPEED RUN** (amber) — 2× speed, reduced ISR, mines harder to sweep, 35 % mine-hit probability
- **NIGHT TRANSIT** (purple) — reduced IRGC ISR; rear intercept possible; attribution confidence drops 3

### Live State Strip (always visible above scenarios)
- **Escalation Ladder** (HARASS → SEIZURE → MINING → STRIKE → CLOSURE → WAR) — current rung flashes orange and updates live every decision pick. Click any rung for an explanation popover.
- **Econ bar** — OIL AT RISK (computed live from real SIM_VESSEL cargo manifests inside the strait bbox), $ Brent + M BPD held up, WAR-RISK INSURANCE (bps), IRAN CLOSURE status (OPEN / CONTESTED / CLOSED).
- **Coalition flag bar** — 🇬🇧 🇫🇷 🇸🇦 🇺🇳 🇨🇳. Click any flag → popover (auto-clamps to viewport so it never overflows screen edge) with that country's per-scenario position and "WITH BLUE" / "NOT WITH BLUE" badge. UK / France / Saudi auto-flip hostile if alliance cohesion drops below 50.
- Whole strip flashes amber on every decision pick — visible feedback that the system processed your input.

### Combat & Engagement (during transit)
- **Red AI driving every red unit.** FACs scan for nearest Blue, pursue at ~52 kn (with land-bbox avoidance), launch C-802 ASCMs at ≤40 km. Sub launches Type-53 torpedoes at ≤80 km. **Global cap of 3 launches per transit** + per-unit cap of 1, plus probabilistic per-step roll → realistic suppression dynamics where most FACs never get to fire before being killed. Same Blue route, different damage profile every time = true Monte-Carlo variance.
- **Land-avoidance pathfinding.** Red AI checks 11 land-bboxes (Iranian coast, Qeshm, Larak, Hengam, the Tunbs, Abu Musa, Musandam Peninsula, UAE/Qatar/Saudi). If pursuit step lands on land, the FAC slides 90° port or starboard. If both blocked, holds position.
- **Destroyer counter-engagement.** DDG within 5 km of a live mine sweeps it. DDG within 15 km of an IRGC FAC kills it (orange ⊗ wreck icon, FAC marker removed).
- **Stacking transit-log.** All events (sweeps, kills, fires, hits, CIWS intercepts) appear in a single right-anchored stack at bottom-left. Column-reverse (newest on top), 6-row cap with smooth fade, no banner overlapping.
- **Live OIL AT RISK ticker.** SIM_VESSELS drift along their nav direction during transit (~1.3 km/step westbound for inbound, eastbound for outbound). Every 10 steps the % updates from the current ship positions — drops as tankers cross 50.5°E (exiting west) or 58°E (exiting east).
- **Map-event indicator deltas** — every animation type (STRIKE / MINED / OIL_SLICK / BOARDED / DISABLED / SINKING / CONVOY_FORM / TRANSIT_HALT) auto-bumps escalation rung + econ indicators when an exercise is active.

### Diamond Escort Formation
All 5 Blue surface units transit together with proper standoff spacing (no overlap):
- **Tanker (lead)** — MV PACIFIC LION, on the painted route line
- **DDG-102 SAMPSON** — port forward escort, ~44 km lateral, ~22 km astern
- **DDG-119 D.BLACK** — starboard forward escort, ~44 km lateral, ~22 km astern
- **CG-62 CHANCELLORS** — cruiser, ~28 km starboard, ~50 km astern
- **CVN-76 REAGAN** — carrier, deep aft center, ~78 km astern (typical CSG standoff)
- Headings auto-rotate per segment so all 5 ships point bow-forward through every turn

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
- ✅ Per-vessel impact animations (8 named effect types) with auto-bump of exercise indicators
- ✅ Key-vessel isolation (dim non-relevant ships when scenario active, pulsing highlight on key actors)
- ✅ Historical mine + attack marker overlay (6 real geocoded incidents) — toggle on demand
- ✅ Painted-route tanker transit simulation — full 5-ship escort formation, heading auto-rotation, proximity alerts on historical mines, DDG mine-sweep + FAC engagement
- ✅ MINING scenario mine-field markers (drop on scenario start, cleared on end)
- ✅ AI adjudicator endpoint (built; disabled by default for demo speed; re-enable via `window.AI_ADJUDICATE = true`)
- ✅ ROUTES tab — 5 preset transit profiles with IRGC engagement variants, replaces MARKETS
- ✅ Always-visible state strip — escalation ladder + econ bar + coalition flags above scenario picker, flashes on every pick
- ✅ Coalition flags clickable with per-scenario popovers, auto-hostile when alliance cohesion < 50
- ✅ Click-on-water deselects controlled units (was sticky before)
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
