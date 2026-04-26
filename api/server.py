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
    lat: float
    lng: float
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
    # Pull candidate observations then filter by proximity
    try:
        results = _intel_col.get(include=["documents", "metadatas"])
        nearby = []
        for doc, meta in zip(results["documents"], results["metadatas"]):
            dist = ((meta["lat"] - q.lat)**2 + (meta["lng"] - q.lng)**2) ** 0.5
            if dist <= q.radius_deg:
                nearby.append({"analysis": doc, "meta": meta, "dist": round(dist, 4)})
        nearby.sort(key=lambda x: x["meta"].get("saved_at", ""))
        return {"observations": nearby[-q.limit:][::-1]}  # most recent first
    except Exception as e:
        return {"observations": [], "error": str(e)}

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
