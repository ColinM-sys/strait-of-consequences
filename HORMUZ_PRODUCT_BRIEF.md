# HORMUZ WARGAME — Strait of Hormuz Strategic Simulation
### Local · Browser-Based · No Account Required

---

## What It Is
HORMUZ WARGAME is an **interactive strategic wargame** simulating conflict scenarios in and around the Strait of Hormuz — the world's most critical maritime chokepoint. Players command naval and air assets across multiple factions, making decisions that reflect real-world force postures, weapon systems, and geographic constraints. Runs entirely in-browser with **no server, no account, no data collection**.

---

## Scenario Overview
The Strait of Hormuz (54km wide at its narrowest) carries 20% of global oil supply. Controlling or contesting it has asymmetric consequences for global energy markets. This simulation models:

- **Iranian A2/AD operations**: IRGCN swarm tactics, ASCM batteries (Noor/Qader/Khalij Fars), GPS jamming, mine warfare
- **US 5th Fleet response**: Carrier strike group operations, TLAM strikes, maritime patrol aircraft
- **Proxy escalation**: Houthi missile/drone attacks from Yemen, PMF activation in Iraq
- **Diplomatic off-ramps**: Strait closure economics, ceasefire triggers, oil price cascade

---

## Key Features

### 1. Real-World Order of Battle
Every platform in the simulation corresponds to actual deployed hardware:
- IRGCN Bladerunner fast attack boats (65+ knot swarm)
- Sina-class missile FAC with C-802 Noor ASCMs
- US DDG-51 Arleigh Burke destroyers with SM-2/SM-6
- P-8A Poseidon maritime patrol aircraft from Bahrain
- Iranian Emad MRBM strikes against Al Udeid and Al Dhafra

### 2. Geographic Fidelity
Map built from OpenStreetMap and satellite reference data:
- Bandar Abbas and Qeshm Island IRGCN basing
- Strait chokepoints and tanker traffic lanes
- NSA Bahrain, Al Udeid Qatar, Al Dhafra UAE — US base locations
- Abu Musa Island IRGCN garrison
- Minab coastal defense missile batteries

### 3. Turn-Based with Real Consequences
Each turn represents 6 hours. Decisions cascade:
- Mines take 24-72 hours to fully close shipping lanes
- Carrier group repositioning takes 2-3 turns
- Tanker insurance rates update each turn (oil price mechanic)
- Air sorties consume munitions that cannot be immediately replaced

### 4. Intelligence Layer
Integrated with real capability data:
- Weapon system ranges drawn to scale on map
- Detection probabilities based on sensor type vs. platform signature
- IRGCN force reconstitution after attrition
- S-300/Bavar-373 engagement envelopes for Iranian air defense

---

## Technology Stack

| Component | Technology |
|-----------|-----------|
| Game Engine | Vanilla JavaScript (no framework) |
| Map | Leaflet.js + OpenStreetMap |
| Server | Python HTTP server (static file serve) |
| Data | JSON flat files — no database required |
| AI Opponent | Rule-based decision trees (no LLM required) |
| Deployment | Browser — open `index.html` or serve on port 3000 |

---

## Privacy Architecture
- **Zero backend** — no user data, no sessions, no analytics
- **No account** — launch and play immediately
- **Fully offline** after initial load (static assets only)
- **No external API calls** during gameplay
- All game state stored in browser memory only — resets on close

---

## Use Cases
- **Wargaming cells** modeling Gulf escalation scenarios
- **Educational** — visual understanding of Hormuz force balance for briefings
- **Red team exercises** — planning Iranian counter-naval options against US assets
- **Think tank / policy** — rapid prototyping of conflict escalation ladders
- **Training** — junior analysts learning order of battle and A2/AD concepts

---

## Run It Yourself
```bash
# No installation required
cd hormuz-wargame
python serve.py          # opens on http://localhost:3000
# OR: just open index.html directly in Chrome
```

---

*Strategic clarity. Zero exposure. No subscription.*
