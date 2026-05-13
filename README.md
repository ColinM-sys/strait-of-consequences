# STRAIT OF CONSEQUENCES

**AI-Powered Wargame // Strait of Hormuz // SCSP Hackathon 2026**

A real-time AI-powered wargame simulating military escalation in the Strait of Hormuz — the world's most critical maritime chokepoint, carrying 20% of global oil supply. Built for the **SCSP Hackathon 2026, Wargaming Track**.

Runs entirely in the browser. No account, no cloud, no external API calls during gameplay. Local LLM inference only.

---

## Quick Start

**Requirements:** Python 3.11+, Ollama with `llama3.1:8b` and `llama3.2-vision:11b` pulled.

```bash
# Pull the models
ollama pull llama3.1:8b
ollama pull llama3.2-vision:11b
ollama serve   # in a separate terminal

# Start the RAG intel server (port 8001)
cd api
pip install fastapi uvicorn chromadb
python -m uvicorn server:app --host 0.0.0.0 --port 8001

# Start the frontend (port 3000)
cd ..
python serve.py
```

Open `http://localhost:3000`.

---

## Features

### Escalation Engine
Six-rung escalation ladder modeled on real-world crisis theory:

`HARASS → SEIZURE → MINING → STRIKE → CLOSURE → WAR`

Each rung triggers cascading economic and military effects:
- **Oil price risk** index updates with each escalation step
- **War-risk insurance** rates for commercial shipping
- **Strait closure status** — partial or full
- Each rung unlocks new IRGC and US force options

### AI Adjudication — Local LLM
Llama 3.1 8B (via Ollama) runs the red cell (IRGC), adjudicates combat outcomes, and generates scenario briefings. Fully air-gapped — no OpenAI, no cloud inference.

- AI plays the Iranian red cell with doctrine-informed decision-making
- Combat outcomes adjudicated by the LLM using real weapons data
- Generates strategic briefings, intel reports, and rules of engagement on demand

### Live AIS Ship Traffic
15 simulated civilian vessels transit the Strait in real time.

- Real vessel names, MMSI numbers, and April 2026 transit positions
- Ships rotate to face their current heading on the map
- Click any vessel for full AIS details: name, type, flag, speed, destination
- Includes tankers, LNG carriers, container ships, and bulk cargo

### Real-World Order of Battle
Every platform corresponds to actual deployed hardware:

**IRGC / Iranian Forces**
- Bladerunner fast attack boats (65+ knot swarm capability)
- Sina-class missile FAC with C-802 Noor anti-ship missiles
- Emad MRBMs — ranges covering Al Udeid and Al Dhafra
- S-300 / Bavar-373 air defense engagement envelopes
- Coastal defense batteries at Bandar Abbas, Qeshm, Abu Musa, Minab

**US 5th Fleet / Coalition**
- DDG-51 Arleigh Burke destroyers with SM-2/SM-6
- P-8A Poseidon maritime patrol aircraft from NSA Bahrain
- Carrier strike group with TLAM strike capability
- Al Udeid (Qatar), Al Dhafra (UAE) air base assets

### Geographic Fidelity
Map built on ArcGIS World Imagery and OpenStreetMap:

- Strait chokepoints and tanker traffic lanes drawn to scale
- Bandar Abbas, Qeshm Island, and Abu Musa IRGC basing
- NSA Bahrain, Al Udeid Qatar, Al Dhafra UAE
- Weapon system ranges rendered to scale on the live map

### RAG Intel Chat
Military intelligence database powering an in-game chat interface.

- 5,400+ unclassified open-source documents indexed in ChromaDB
- Ask about IRGC tactics, order of battle, mine warfare, tanker operations
- All answers grounded in the intel corpus — answers cite real data
- Backend: FastAPI (port 8001) + ChromaDB vector store

### VLM Satellite Analysis
Draw a bounding box anywhere on the live map, capture the underlying ArcGIS satellite tile, and run AI computer vision analysis.

- Powered by Llama 3.2 Vision 11B (local inference via Ollama)
- Returns: aircraft count, vessel count, infrastructure classification
- Pre-analyzed imagery for 66 airports across Iran, Iraq, UAE, Saudi Arabia, Pakistan
- Supports before/after comparison for change detection

### Sentinel-2 Real Satellite Imagery
Pull real ESA satellite passes (last 10 days) for any area on the map.

- Live data from Copernicus Data Space (ESA)
- Before/after image comparison with a drag slider
- AI analysis detects ship presence and military buildup
- Python proxy handles Sentinel-2 OAuth and tile requests

### Airport Intel Overlay
Pre-analyzed aircraft counts at 66 airports across the region.

- Covers Iran, Iraq, UAE, Saudi Arabia, Pakistan
- Counts by category: fighters, helicopters, transports, UAVs
- Click any airport marker for full aircraft breakdown
- Data in `airport_intel.json`, refreshable via `scan_airports.py`

### Scenario Engine
Generate new crisis scenarios on demand using the local LLM.

- Strategic briefing for the current escalation level
- Blue cell intel report (US perspective)
- Rules of engagement
- IRGC starting posture and red cell objectives

### Turn-Based Mechanics
Each turn = 6 hours of real-world time. Decisions have lasting consequences:

- Mines take 24–72 hours to fully close shipping lanes
- Carrier group repositioning takes 2–3 turns
- Air sorties consume munitions that cannot be immediately replaced
- IRGC force reconstitution modeled after attrition
- Tanker insurance rates and oil price indicators update each turn

---

## Architecture

| Component | Technology |
|-----------|-----------|
| Frontend | Vanilla JS + Leaflet.js |
| Map | ArcGIS World Imagery + OpenStreetMap |
| Server | Python `SimpleHTTPRequestHandler` (port 3000) |
| AI (text) | Ollama — Llama 3.1 8B |
| AI (vision) | Ollama — Llama 3.2 Vision 11B |
| RAG | ChromaDB + FastAPI (port 8001) |
| Satellite | ESA Copernicus Data Space (Sentinel-2) |
| Data | JSON flat files — no database required for game state |

---

## Privacy

- No telemetry, no user data, no sessions, no analytics
- No account required — launch and play immediately
- Fully offline after initial asset load
- All LLM inference is local via Ollama — nothing leaves the machine
- Game state lives in browser memory only — resets on close

---

## Use Cases

- Wargaming cells modeling Gulf escalation scenarios
- Red team exercises for Iranian counter-naval planning
- Educational tool for understanding the Hormuz force balance
- Think tank and policy rapid prototyping
- Analyst training on order of battle and A2/AD concepts

---

## Team

- Colin McDonough
- Alex Smith
- Deborah Debeauville

**SCSP Hackathon 2026 — Wargaming Track**

---

## Datasets & Sources

- ArcGIS World Imagery (satellite basemap)
- ESA Sentinel-2 via Copernicus Data Space
- Simulated AIS vessel traffic (real vessel names, MMSI, April 2026 transit positions)
- Military intel RAG corpus (open-source, unclassified)
- Ollama local inference (Llama 3.1 8B, Llama 3.2 Vision 11B)
- Leaflet.js + OpenStreetMap contributors
