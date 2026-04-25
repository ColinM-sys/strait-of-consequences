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
