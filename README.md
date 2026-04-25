# STRAIT OF CONSEQUENCES

**AI Wargame // Strait of Hormuz // 2026**

A real-time AI-powered wargame simulating military escalation in the Strait of Hormuz. Built for the SCSP Hackathon 2026 — Wargaming Track.

## What It Does

- **AI Adjudication** — Local Llama 3.1 8B runs the red cell (IRGC), adjudicates combat outcomes, and generates scenario briefings. No cloud, no API calls, fully air-gapped.
- **Escalation Engine** — 6-rung ladder (HARASS → SEIZURE → MINING → STRIKE → CLOSURE → WAR) with economic indicators: oil price risk, war-risk insurance, strait closure status.
- **Live AIS Ship Traffic** — 15 simulated civilian vessels (tankers, cargo ships) transit the navigable channel in real time, rotating to face their heading. Click any vessel for AIS details.
- **RAG Intel Chat** — Military intelligence database (5,400+ docs) powering a chat interface. Ask about IRGC tactics, order of battle, mine warfare, tanker operations — answers grounded in the intel corpus.
- **VLM Satellite Analysis** — Draw a box anywhere on the map, capture the ArcGIS satellite image, and run Llama 3.2 Vision 11B analysis: aircraft count, vessel count, infrastructure classification.
- **Sentinel-2 Imagery** — Pull real ESA satellite passes (last 10 days) for any area. Compare before/after imagery with a drag slider. AI analysis detects ship presence and military buildup.
- **Airport Intel Overlay** — AI-analyzed aircraft counts at 66 airports across Iran, Iraq, UAE, Saudi Arabia, Pakistan.
- **Scenario Engine** — Generate new crisis scenarios with the local LLM: strategic briefing, blue cell intel report, rules of engagement, IRGC starting posture.

## Track

SCSP Hackathon 2026 — **Wargaming Track**

## Team

- Colin McDonough
- Alex Smith
- Deborah Debeauville

## Datasets & APIs Used

- ArcGIS World Imagery (satellite basemap)
- ESA Sentinel-2 via Copernicus Data Space
- Simulated AIS vessel traffic (real vessel names, MMSI, positions from April 2026 transits)
- Military intel RAG corpus (open-source, unclassified)
- Ollama (local inference — Llama 3.1 8B, Llama 3.2 Vision 11B)
- Leaflet.js for mapping

## How To Run

**Requirements:** Python 3.11+, Node.js, Ollama with `llama3.1:8b` and `llama3.2-vision:11b` pulled.

```bash
# Start the RAG server (port 8001)
cd api
pip install fastapi uvicorn chromadb
python -m uvicorn server:app --host 0.0.0.0 --port 8001

# Start the wargame frontend (port 3000)
python serve.py
```

Then open `http://localhost:3000`.

For Ollama: `ollama serve` (separate terminal).

## Architecture

- **Frontend**: Vanilla JS + Leaflet, served by Python SimpleHTTPRequestHandler
- **AI**: Ollama local inference (no external API calls)
- **RAG**: ChromaDB + FastAPI on port 8001
- **Satellite proxy**: Python handles Sentinel-2 OAuth + tile requests
