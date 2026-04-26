from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import ai_agents
import chromadb
import uuid
from datetime import datetime

# ── ChromaDB intel memory ─────────────────────────────────────────────────────
_chroma = chromadb.PersistentClient(path="./intel_db")
_intel_col = _chroma.get_or_create_collection(
    name="intel_observations",
    metadata={"hnsw:space": "cosine"},
)

app = FastAPI(title="Hormuz Wargame AI", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def _prewarm_ollama():
    """Pre-load llama3.1:8b into VRAM at backend startup so the first
    judge-facing scenario generation doesn't pay the ~10s model-load cost.
    Uses keep_alive=-1 so the model stays resident forever."""
    import httpx as _hx
    try:
        async with _hx.AsyncClient(timeout=60.0) as c:
            await c.post("http://localhost:11434/api/generate", json={
                "model": "llama3.1:8b",
                "prompt": "ok",
                "stream": False,
                "keep_alive": -1,
                "options": {"num_predict": 1},
            })
        print("[PREWARM] llama3.1:8b loaded into VRAM with keep_alive=-1")
    except Exception as e:
        print(f"[PREWARM] skipped (Ollama not reachable yet): {e}")


# ── Pydantic models ───────────────────────────────────────────────────────────

class Position(BaseModel):
    lat: float
    lng: float

class UnitState(BaseModel):
    id: str
    name: str
    side: str
    type: str
    health: int
    position: Position

class GameState(BaseModel):
    turn: int
    units: List[UnitState]

class MoveRecord(BaseModel):
    unitId: str
    to: Optional[Position] = None

class TurnRequest(BaseModel):
    state: GameState
    moves: List[MoveRecord]
    threat_context: dict = {}
    unit_threat_levels: list = []

class RedCellRequest(BaseModel):
    state: GameState
    threat_context: dict = {}


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/scenario")
async def get_scenario():
    return await ai_agents.generate_scenario()


@app.post("/adjudicate")
async def post_adjudicate(req: TurnRequest):
    return await ai_agents.adjudicate(
        req.state, req.moves, req.threat_context, req.unit_threat_levels
    )


@app.post("/redcell")
async def post_redcell(req: RedCellRequest):
    return await ai_agents.red_cell(req.state)


@app.get("/health")
async def health():
    return {"status": "ok"}


# ── AI-adjudicated next-turn generator (Option A branching) ───────────────────
import httpx, json, os, re

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("ADJUDICATE_MODEL", "llama3.1:8b")


class NextTurnRequest(BaseModel):
    scenario_id: str
    scenario_title: str
    rung: str
    turn_number: int           # turn user just completed
    total_turns: int
    blue_pick: dict            # { lane, title, assessment }
    indicators: dict
    decision_history: List[dict]  # [{turn, lane, title, assessment}, ...]


NEXT_TURN_SYSTEM = """You are the Red Cell + Adjudicator for a Hormuz strait wargame.

CRITICAL RULES:
- Each of your 5 decisions MUST be a direct second-order consequence of Blue's specific last pick. If Blue picked MILITARY, do NOT propose another generic MILITARY strike — propose what FOLLOWS LOGICALLY from that specific move (e.g., "Recall the deployed DDG to give Tehran an off-ramp" or "Add a second escort to harden the formation").
- The inject must explicitly reference Blue's last pick by name (e.g., "After the DDG forward-deployed within visual range, IRGC reinforces FACs...").
- Decision titles must reference SPECIFIC ASSETS, NAMES, or LOCATIONS from the scenario (e.g., "USS NITZE", "GULF MERIDIAN", "Bandar Abbas", "Lloyd's", "CTF 152") — not generic phrases like "Conduct intel operation".
- Avoid textbook NSC options (UNSC, SPR, sanctions) UNLESS they directly follow from Blue's pick.
- Vary the indicator deltas — they should reflect the unique trade-offs of THIS specific moment in THIS specific scenario, not generic +2/-1 patterns.
- DO NOT REPEAT the structure, tone, or actor focus of any prior turn injects you've seen. If prior injects featured "Tehran's MFA" or "IRGC commander", shift to a DIFFERENT actor lens (e.g., maritime industry, Lloyd's, civilian press, regional partner).
- DO NOT REPEAT decision titles or themes from prior turns. The Blue Cell already saw those options.

OUTPUT SHAPE:
1. "inject" — 1-3 sentences. MUST reference Blue's last pick. Tehran's response + situational shift.
2. "decisions" — exactly 5, ONE PER LANE: DIPLOMATIC, INFORMATION, MILITARY, ECONOMIC, INTELLIGENCE.
   Each: { lane, title (action-verb + specific asset/location), assessment (3-4 sentences), deltas (object) }.

Indicator keys (adjust as appropriate, magnitudes 1-15):
  escalationRung (0-6 int), oilPrice ($/bbl), warRiskInsurance (bps),
  allianceCohesion (0-100), attributionConfidence (0-100), iranCoercion (0-100).

Tone: CSIS/RAND tabletop adjudication. Doctrinal, specific, no drama, no narration.

Respond with ONLY valid JSON in this schema:
{"inject":"...","decisions":[{"lane":"DIPLOMATIC","title":"...","assessment":"...","deltas":{...}},{"lane":"INFORMATION",...},{"lane":"MILITARY",...},{"lane":"ECONOMIC",...},{"lane":"INTELLIGENCE",...}]}
NO prose outside the JSON. NO markdown fences. NO comments."""


def _extract_json(text: str):
    """Extract the first JSON object from text, even if wrapped in fences/prose."""
    text = text.strip()
    # Strip ```json ... ``` fences if present
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```\s*$", "", text)
    # Find first { ... last matching }
    start = text.find("{")
    if start < 0:
        return None
    depth = 0
    for i in range(start, len(text)):
        if text[i] == "{": depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(text[start:i+1])
                except json.JSONDecodeError:
                    return None
    return None


def _validate_next_turn(obj):
    """Ensure the LLM output has the right shape; return obj or None."""
    if not isinstance(obj, dict): return None
    if "inject" not in obj or "decisions" not in obj: return None
    if not isinstance(obj["decisions"], list) or len(obj["decisions"]) != 5: return None
    required_lanes = {"DIPLOMATIC","INFORMATION","MILITARY","ECONOMIC","INTELLIGENCE"}
    seen_lanes = set()
    for d in obj["decisions"]:
        if not isinstance(d, dict): return None
        if d.get("lane") not in required_lanes: return None
        if not d.get("title") or not d.get("assessment"): return None
        if not isinstance(d.get("deltas"), dict): d["deltas"] = {}
        seen_lanes.add(d["lane"])
    if seen_lanes != required_lanes: return None
    return obj


@app.post("/scenario/next_turn")
async def post_next_turn(req: NextTurnRequest):
    """Generate the next turn dynamically based on Blue's last pick + state."""
    history_text = "\n".join(
        f"  T{h['turn']}: {h['lane']} — {h['title']}" for h in (req.decision_history or [])
    )
    user_prompt = (
        f"Scenario: {req.scenario_title} ({req.rung} rung)\n"
        f"Turn just completed: {req.turn_number} of {req.total_turns}\n"
        f"Decision history so far:\n{history_text or '  (none)'}\n\n"
        f"Blue just picked:\n"
        f"  Lane: {req.blue_pick.get('lane')}\n"
        f"  Title: {req.blue_pick.get('title')}\n"
        f"  Assessment: {req.blue_pick.get('assessment')}\n\n"
        f"Current indicators (post-pick): {json.dumps(req.indicators)}\n\n"
        f"Generate the JSON for turn {req.turn_number + 1}:"
    )
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            r = await client.post(f"{OLLAMA_URL}/api/chat", json={
                "model": OLLAMA_MODEL, "stream": False,
                "messages": [
                    {"role": "system", "content": NEXT_TURN_SYSTEM},
                    {"role": "user",   "content": user_prompt},
                ],
                "options": {"temperature": 0.7, "num_predict": 600, "num_ctx": 4096},
                "format": "json",
            })
        raw = (r.json().get("message", {}) or {}).get("content", "") or ""
        parsed = _extract_json(raw)
        valid = _validate_next_turn(parsed) if parsed else None
        if valid is None:
            return {"ok": False, "error": "invalid_llm_output", "raw": raw[:500]}
        return {"ok": True, "turn": valid}
    except Exception as e:
        return {"ok": False, "error": str(e)}


# ── Intel RAG endpoints ───────────────────────────────────────────────────────

class IntelObservation(BaseModel):
    lat: float
    lng: float
    area_name: str
    date_label: str
    source: str          # 'sentinel' or 'intel'
    analysis: str

class IntelQuery(BaseModel):
    # Text-semantic mode (used by Intel Chat): supply query + optional n
    query: Optional[str] = None
    n: int = 8
    # Geo-proximity mode (used by map panel): supply lat + lng
    lat: Optional[float] = None
    lng: Optional[float] = None
    radius_deg: float = 0.5
    limit: int = 5

@app.post("/intel/save")
async def save_intel(obs: IntelObservation):
    doc_id = str(uuid.uuid4())
    _intel_col.add(
        ids=[doc_id],
        documents=[obs.analysis],
        metadatas=[{
            "lat":        obs.lat,
            "lng":        obs.lng,
            "area":       obs.area_name,
            "date":       obs.date_label,
            "source":     obs.source,
            "saved_at":   datetime.utcnow().isoformat(),
        }],
    )
    return {"id": doc_id, "saved": True}

@app.post("/intel/query")
async def query_intel(q: IntelQuery):
    # ── Text-semantic mode (Intel Chat RAG) ──────────────────────────────────
    if q.query:
        try:
            # Detect doctrine/strategy/insurance/incident-style queries — for these,
            # exclude the 864 OSM-base entries (which only carry geo metadata, no topic)
            # so doctrine/insurance/incident docs aren't drowned by base-name noise.
            qlow = q.query.lower()
            doctrine_kw = ('doctrine', 'roe', 'rules of engagement', 'off-ramp', 'offramp',
                           'a2/ad', 'a2ad', 'contingency', 'insurance', 'sanction',
                           'shadow fleet', 'tanker war', 'earnest will', 'praying mantis',
                           'lloyd', 'jwc', 'p&i', 'ofac', 'ingosstrakh', 'picc', 'rnrc',
                           'crisis', 'escalation', 'ladder', 'imsc', 'emasoh', 'ctf-152',
                           'iranian proxy', 'houthi', 'mda', 'maritime domain', 'stena',
                           'fujairah', 'bridgeton', 'samuel b. roberts', 'limpet')
            need_filter = any(k in qlow for k in doctrine_kw)
            # Whitelist topics — anything with a real topic field (i.e., NOT the 864 OSM bases
            # that have no topic metadata). ChromaDB $in matches exact strings.
            DOCTRINE_TOPICS = [
                "hormuz_contingency", "roe_doctrine", "iranian_a2ad", "escalation_offramps",
                "coalition_warfighting", "earnest_will_lessons", "iranian_proxy_framework",
                "mda_gaps", "crisis_stability", "sanctions_enforcement",
                "war_risk_insurance", "shadow_fleet_sanctions", "maritime_governance",
                "recent_incidents", "ofac_sanctions", "eu_sanctions",
            ]
            where_clause = {"topic": {"$in": DOCTRINE_TOPICS}} if need_filter else None

            kwargs = dict(
                query_texts=[q.query],
                n_results=min(q.n, _intel_col.count() or 1),
                include=["documents", "metadatas", "distances"],
            )
            if where_clause:
                kwargs["where"] = where_clause

            results = _intel_col.query(**kwargs)
            docs  = results["documents"][0] if results["documents"] else []
            metas = results["metadatas"][0]  if results["metadatas"]  else []
            dists = results["distances"][0]  if results["distances"]  else []
            hits = [
                {"text": doc, "meta": meta, "score": round(1.0 - dist, 4)}
                for doc, meta, dist in zip(docs, metas, dists)
            ]
            return {
                "results": hits,
                "observations": [{"analysis": h["text"], "meta": h["meta"]} for h in hits],
            }
        except Exception as e:
            return {"results": [], "observations": [], "error": str(e)}

    # ── Geo-proximity mode (map panel) ────────────────────────────────────────
    if q.lat is None or q.lng is None:
        return {"observations": [], "results": [], "error": "Provide query text or lat+lng"}
    try:
        results = _intel_col.get(include=["documents", "metadatas"])
        nearby = []
        for doc, meta in zip(results["documents"], results["metadatas"]):
            dist = ((meta["lat"] - q.lat)**2 + (meta["lng"] - q.lng)**2) ** 0.5
            if dist <= q.radius_deg:
                nearby.append({"analysis": doc, "meta": meta, "dist": round(dist, 4)})
        nearby.sort(key=lambda x: x["meta"].get("saved_at", ""))
        obs = nearby[-q.limit:][::-1]   # most recent first
        return {
            "observations": obs,
            "results": [{"text": o["analysis"], "meta": o["meta"]} for o in obs],
        }
    except Exception as e:
        return {"observations": [], "results": [], "error": str(e)}

@app.get("/intel/all")
async def all_intel():
    try:
        results = _intel_col.get(include=["documents", "metadatas"])
        obs = [{"analysis": d, "meta": m}
               for d, m in zip(results["documents"], results["metadatas"])]
        obs.sort(key=lambda x: x["meta"].get("saved_at",""), reverse=True)
        return {"observations": obs, "total": len(obs)}
    except Exception as e:
        return {"observations": [], "error": str(e)}


# ── AI agent endpoints (scenario gen, OOB, adaptive Red Cell, AAR observations) ──

import json as _json
import os as _os

import os as _os_init
# Default to local. Override with OLLAMA_HOST env var (e.g. for Tailscale → 4090).
OLLAMA_URL_LOCAL = _os_init.environ.get("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_MODEL_LOCAL = _os_init.environ.get("OLLAMA_MODEL", "llama3.1:8b")


def _llm_json(system: str, user: str, temp: float = 0.85, num_predict: int = 1200, retries: int = 2):
    """Call Ollama with JSON mode + retries until valid JSON returned.
    keep_alive=-1 locks the model in VRAM forever so judges never hit a cold-load."""
    last_err = None
    for attempt in range(retries + 1):
        try:
            with httpx.Client(timeout=180.0) as client:
                r = client.post(f"{OLLAMA_URL_LOCAL}/api/chat", json={
                    "model": OLLAMA_MODEL_LOCAL, "stream": False,
                    "keep_alive": -1,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                    "options": {"temperature": temp, "num_predict": num_predict, "num_ctx": 3072,
                                "seed": int.from_bytes(_os.urandom(4), 'big')},
                    "format": "json",
                })
            raw = (r.json().get("message", {}) or {}).get("content", "") or ""
            parsed = _extract_json(raw)
            if parsed:
                return parsed, raw
        except Exception as e:
            last_err = str(e)
    return None, last_err or "no valid JSON after retries"


SCENARIO_GEN_SYSTEM = """Generate a 4-turn Hormuz wargame. Output ONLY JSON. Be terse but COMPLETE.

CRITICAL: turns array MUST contain EXACTLY 4 entries. Not 1, not 2, not 3 — exactly 4.
Each turn MUST have 3 decisions (DIPLOMATIC, MILITARY, ECONOMIC).

Real names only: Bandar Abbas, Larak, Fujairah, Ras Tanura, USN CSG, IRGC Boghammar, Lloyd's JWC, Aramco. Ranges: oilPrice 80-180, warRiskInsurance 100-2500, escalationRung 0-6.

SHAPE (note 4 turn entries in turns array):
{"id":"kebab","title":"CAPS","rung":"HARASS|SEIZURE|MINING|STRIKE|CLOSURE","rungColor":"#hex","threat":"...","summary":"...","keyVessels":[],"initialIndicators":{"escalationRung":2,"oilPrice":110,"warRiskInsurance":900,"allianceCohesion":60,"attributionConfidence":60,"iranCoercion":50},"turns":[
  {"inject":"T1 incident inject","decisions":[{"lane":"DIPLOMATIC","title":"...","assessment":"...","deltas":{"escalationRung":0,"oilPrice":0,"warRiskInsurance":0,"allianceCohesion":0,"attributionConfidence":0,"iranCoercion":0}},{"lane":"MILITARY","title":"...","assessment":"...","deltas":{"escalationRung":0,"oilPrice":0,"warRiskInsurance":0,"allianceCohesion":0,"attributionConfidence":0,"iranCoercion":0}},{"lane":"ECONOMIC","title":"...","assessment":"...","deltas":{"escalationRung":0,"oilPrice":0,"warRiskInsurance":0,"allianceCohesion":0,"attributionConfidence":0,"iranCoercion":0}}]},
  {"inject":"T2 escalation inject","decisions":[3 decisions same shape]},
  {"inject":"T3 markets inject","decisions":[3 decisions same shape]},
  {"inject":"T4 off-ramp inject","decisions":[3 decisions same shape]}
]}"""


class ScenarioGenRequest(BaseModel):
    premise: str


@app.post("/scenario/generate")
async def post_scenario_generate(req: ScenarioGenRequest):
    user_prompt = (
        f"Premise: {req.premise.strip()}\n"
        "Generate ALL 4 turns: T1 incident · T2 escalation · T3 markets · T4 off-ramp. "
        "Each turn has 3 decisions (DIPLOMATIC, MILITARY, ECONOMIC). "
        "REMINDER: turns array length must be exactly 4. Do not stop after T1."
    )
    # 2400 tokens to fit 4 full turns. Was 1700 — caused truncation to 1 turn.
    parsed, raw = _llm_json(SCENARIO_GEN_SYSTEM, user_prompt, temp=0.7, num_predict=2400)
    if not parsed:
        return {"ok": False, "error": "invalid_llm_output", "raw": str(raw)[:500]}
    if "turns" not in parsed or len(parsed.get("turns", [])) != 4:
        return {"ok": False, "error": "wrong_turn_count", "got": len(parsed.get("turns", []))}
    return {"ok": True, "scenario": parsed}


REDCELL_SYSTEM = """You are an IRGC operations officer running a Red Cell adversary simulation.
Given the current scenario state and what Blue just did, decide Iran's next move.

You ALWAYS pick from these 4 doctrine responses:
- ESCALATE: order second-strike package, deploy more FACs, harden mining
- HOLD: maintain current posture, no further kinetic action
- DEESCALATE: signal off-ramp, recall FACs, accept Omani mediation
- COVERT: deny attribution, switch to non-kinetic disruption (cyber, AIS spoofing)

Reasoning factors: casualty-averse Tehran, Lloyd's premium feedback, China's diplomatic exposure, IRGC vs. Artesh tension.

Output JSON: {"choice":"ESCALATE|HOLD|DEESCALATE|COVERT","rationale":"<2-3 sentence reasoning>","next_action":"<1-sentence specific action>","indicator_deltas":{"escalationRung":int,"warRiskInsurance":int,"iranCoercion":int}}
Output ONLY valid JSON."""


class RedCellRequest(BaseModel):
    scenario_title: str
    rung: str
    blue_action: str
    current_indicators: dict
    prior_red_actions: List[str] = []


@app.post("/redcell/decide")
async def post_redcell_decide(req: RedCellRequest):
    prior = "\n".join(f"  - {a}" for a in (req.prior_red_actions or [])) or "  (none)"
    user_prompt = (
        f"Scenario: {req.scenario_title} ({req.rung} rung)\n"
        f"Blue just did: {req.blue_action}\n"
        f"Current indicators: {_json.dumps(req.current_indicators)}\n"
        f"Iran's prior actions this exercise:\n{prior}\n\n"
        f"What does Iran do next?"
    )
    parsed, raw = _llm_json(REDCELL_SYSTEM, user_prompt, temp=0.85, num_predict=400)
    if not parsed or "choice" not in parsed:
        return {"ok": False, "error": "invalid_llm_output", "raw": str(raw)[:300]}
    return {"ok": True, "decision": parsed}


AAR_SYSTEM = """You are a wargame after-action review (AAR) author at NWC Newport.
Given a transit's event log + Blue's command decisions + indicator deltas, write 3-5 doctrinal observations.

EACH observation must:
- Reference a specific event from the log (FAC fire, hit, intercept, sweep)
- Reference Blue's specific ROE-level choice
- Cite a doctrine concept where relevant (CIWS performance, ROE Level N, alliance signaling, market pass-through, distributional analysis)
- Be 1-2 sentences max
- NOT use generic phrases like "good job" or "more research needed"

Output JSON: {"observations":[{"icon":"✓|⚠|⊠|⚓|⚔|🔴|✗","text":"..."}]}
3 to 5 observations. Output ONLY valid JSON."""


class AarRequest(BaseModel):
    outcome: str
    duration_sec: int
    blue_choice: Optional[str]
    events: List[dict]
    indicators_before: dict
    indicators_after: dict


EXERCISE_AAR_SYSTEM = """You are a wargame after-action analyst. Write a tight, grounded narrative about what happened in the exercise.

STRICT RULES:
- Reference ONLY decisions and indicators provided. Do NOT invent additional events, ship names, dates, or quotes.
- Cite the actual decision titles + lanes provided.
- Cite indicator changes by name + numeric delta.
- 4-6 short sentences total. No bullet points. No headings.
- Tone: terse, doctrinal, like a real AAR officer.

Output JSON: {"narrative":"..."}"""


class ExerciseAarRequest(BaseModel):
    scenario_title: str
    scenario_summary: str
    decisions: List[dict]   # [{turn, lane, title, assessment}]
    indicators_before: dict
    indicators_after: dict


@app.post("/exercise/aar")
async def post_exercise_aar(req: ExerciseAarRequest):
    decision_lines = "\n".join(
        f"  T{d.get('turn')}: {d.get('lane')} — {d.get('title')}"
        for d in (req.decisions or [])
    ) or "  (no decisions)"
    deltas = {k: req.indicators_after.get(k, 0) - req.indicators_before.get(k, 0) for k in req.indicators_before}
    user_prompt = (
        f"Scenario: {req.scenario_title}\n"
        f"Summary: {req.scenario_summary}\n\n"
        f"Decisions Blue made (in order):\n{decision_lines}\n\n"
        f"Indicators before → after:\n"
        + "\n".join(f"  {k}: {req.indicators_before[k]} → {req.indicators_after.get(k, 0)} ({'+' if deltas[k]>=0 else ''}{deltas[k]})" for k in req.indicators_before)
        + "\n\nWrite the AAR narrative now (4-6 sentences). Reference specific decisions and indicator deltas. Do not invent."
    )
    parsed, raw = _llm_json(EXERCISE_AAR_SYSTEM, user_prompt, temp=0.4, num_predict=500)
    if not parsed or "narrative" not in parsed:
        return {"ok": False, "error": "invalid_llm_output", "raw": str(raw)[:300]}
    return {"ok": True, "narrative": parsed["narrative"]}


@app.post("/aar/observations")
async def post_aar_observations(req: AarRequest):
    events_summary = "\n".join(f"  - [{e.get('type')}] {_json.dumps({k: v for k, v in e.items() if k not in ('type', 't')})}" for e in (req.events or [])) or "  (none)"
    user_prompt = (
        f"Transit outcome: {req.outcome}\n"
        f"Duration: {req.duration_sec}s\n"
        f"Blue ROE choice: {req.blue_choice or '(no engagement)'}\n"
        f"Events:\n{events_summary}\n"
        f"Indicators before: {_json.dumps(req.indicators_before)}\n"
        f"Indicators after: {_json.dumps(req.indicators_after)}\n\n"
        f"Write 3-5 AAR observations now."
    )
    parsed, raw = _llm_json(AAR_SYSTEM, user_prompt, temp=0.75, num_predict=600)
    if not parsed or "observations" not in parsed:
        return {"ok": False, "error": "invalid_llm_output", "raw": str(raw)[:300]}
    return {"ok": True, "observations": parsed["observations"]}


OOB_SYSTEM = """You are a defense intelligence analyst writing an Order of Battle dossier.

CRITICAL: Generate the OOB for THE EXACT theater the user names. Do NOT substitute another theater. Do NOT default to Hormuz/Persian Gulf if the user names Taiwan, South China Sea, Red Sea, Bab el-Mandeb, Eastern Mediterranean, etc. The "theater" field in the output MUST match the user's input verbatim. Lat/lng coordinates MUST fall within that theater's actual geography.

OUTPUT JSON: {"theater":"<user's exact input>","blue_force":[{"unit":"...","type":"...","lat":float,"lng":float,"capability":"..."}],"red_force":[{"unit":"...","type":"...","lat":float,"lng":float,"capability":"..."}],"key_terrain":[{"name":"...","lat":float,"lng":float,"significance":"..."}]}

Use real coordinates within the user's theater. Use real platform names appropriate for forces in that theater. Output ONLY valid JSON."""


class OobRequest(BaseModel):
    theater: str


@app.post("/scenario/oob")
async def post_oob(req: OobRequest):
    user_prompt = f"Generate realistic Order of Battle for: {req.theater.strip()}\n\n6-10 Blue units, 6-10 Red units, 4-6 key terrain features."
    parsed, raw = _llm_json(OOB_SYSTEM, user_prompt, temp=0.8, num_predict=2000)
    if not parsed:
        return {"ok": False, "error": "invalid_llm_output", "raw": str(raw)[:300]}
    return {"ok": True, "oob": parsed}


@app.get("/gdelt/feed")
async def get_gulf_events():
    """Returns cached Gulf-region events from gulf_events.json."""
    here = _os.path.dirname(_os.path.abspath(__file__))
    path = _os.path.normpath(_os.path.join(here, "..", "gulf_events.json"))
    if not _os.path.exists(path):
        return {"ok": False, "error": "gulf_events.json not present — run seed_gulf_events.py", "events": []}
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = _json.load(f)
        return {"ok": True, "events": data.get("events", []), "source": data.get("source", "ACLED-cached"), "count": len(data.get("events", []))}
    except Exception as e:
        return {"ok": False, "error": str(e), "events": []}
