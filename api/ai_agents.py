import os
import json
import re
import httpx
from prompts import SCENARIO_SYSTEM, ADJUDICATOR_SYSTEM, RED_CELL_SYSTEM

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
MODEL      = os.environ.get("MODEL", "qwen2.5:14b")


def _extract_json(text: str) -> dict:
    match = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", text)
    if match:
        return json.loads(match.group(1))
    match = re.search(r"\{[\s\S]+\}", text)
    if match:
        return json.loads(match.group(0))
    return {}


async def _call(system: str, user: str) -> dict:
    async with httpx.AsyncClient(timeout=60.0) as client:
        res = await client.post(
            f"{OLLAMA_URL}/api/chat",
            json={
                "model": MODEL,
                "messages": [
                    {"role": "system",  "content": system},
                    {"role": "user",    "content": user},
                ],
                "stream": False,
            },
        )
        res.raise_for_status()
        text = res.json()["message"]["content"]
        return _extract_json(text)


# ── Public API ────────────────────────────────────────────────────────────────

async def generate_scenario() -> dict:
    try:
        return await _call(
            SCENARIO_SYSTEM,
            "Generate a Strait of Hormuz wargame opening scenario for April 2026. Return JSON only.",
        )
    except Exception as e:
        return _fallback_scenario(str(e))


async def adjudicate(state, moves, threat_context=None, unit_threat_levels=None) -> dict:
    state_json = json.dumps({
        "turn": state.turn,
        "units": [u.model_dump() for u in state.units],
    }, indent=2)
    moves_json  = json.dumps([m.model_dump() for m in moves], indent=2)
    threat_json = json.dumps(threat_context or {}, indent=2)
    levels_json = json.dumps(unit_threat_levels or [], indent=2)

    try:
        return await _call(
            ADJUDICATOR_SYSTEM,
            f"GAME STATE (turn {state.turn}):\n{state_json}\n\n"
            f"PLAYER MOVES THIS TURN:\n{moves_json}\n\n"
            f"THREAT CONTEXT:\n{threat_json}\n\n"
            f"UNIT THREAT LEVELS:\n{levels_json}\n\n"
            "Adjudicate all engagements. Return JSON only.",
        )
    except Exception as e:
        return {
            "narrative": f"Adjudication failed ({e}).",
            "outcomes": [],
            "strategic_assessment": "AI backend error.",
        }


async def red_cell(state) -> dict:
    state_json = json.dumps({
        "turn": state.turn,
        "units": [u.model_dump() for u in state.units],
    }, indent=2)

    try:
        return await _call(
            RED_CELL_SYSTEM,
            f"CURRENT GAME STATE (turn {state.turn}):\n{state_json}\n\n"
            "Choose your IRGC moves for this turn. Return JSON only.",
        )
    except Exception as e:
        return {
            "reasoning": f"Red Cell AI error ({e}). IRGC holds position.",
            "moves": [],
        }


def _fallback_scenario(err: str) -> dict:
    return {
        "title": "CEASEFIRE EXPIRING",
        "situation": (
            "Day 51. USS Spruance seized Iranian cargo vessel Touska at 0340 local. "
            "IRGC fast attack craft are massing near Abu Musa Island. "
            "MV Pacific Lion convoy must transit the strait before dawn. Ceasefire expires 0600."
        ),
        "blue_briefing": (
            "USS Reagan carrier group: escort MV Pacific Lion through the Hormuz chokepoint. "
            "Defensive fire authorized. Protect the tanker at all costs."
        ),
        "red_briefing": (
            "IRGC command: deny strait passage. Swarm FACs to interdict the tanker convoy. "
            "Submarine Ghadir-881 is in position for ambush."
        ),
        "special_rules": [
            "Safe corridor (green lane) reduces hit chance 65%",
            "Submarines cannot be targeted until they fire",
            "Coastal batteries have fixed position — destroy radar with SIGINT",
        ],
        "_error": err,
    }
