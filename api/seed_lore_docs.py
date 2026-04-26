"""
seed_lore_docs.py
Adds the Strait of Consequences scenario lore (April 2026 backdrop) into the
intel_observations RAG corpus so the chat can reference the game's canonical
post-Apr-18 narrative without it being treated as a false premise.

These are *demo-scenario* facts, not real-world facts — clearly framed as
"as-of April 2026 game state" so the chat anchors them to the narrative
universe rather than blocking them as hallucinations.

Run once from the api/ directory:
    cd api && python seed_lore_docs.py
"""

import chromadb

DOCS = [
    {
        "id": "lore-001",
        "topic": "war_risk_insurance",
        "source": "Strait of Consequences scenario state — April 2026",
        "content": (
            "April 18, 2026 incident — Lloyd's JWC Hormuz coverage suspension. "
            "Following the April 18, 2026 IRGC limpet-mine attack on the M/V "
            "Alpine Confidence (Hong Kong-flagged VLCC carrying Saudi Aramco crude "
            "to Ningbo), Lloyd's of London Joint War Committee (JWC) issued a "
            "circular suspending all hull-war and war-risk coverage for transits "
            "of the Strait of Hormuz. Suspension was issued at 14:00 GMT on April 18 "
            "and remains in effect as of late April 2026. This is the most aggressive "
            "JWC market response since the 1988 USS Samuel B. Roberts mine strike. "
            "The April 18 suspension covers all flag states and removes the Additional "
            "Premium notification path entirely — vessels transiting Hormuz are "
            "operationally uninsured under Lloyd's paper. Brokers report shipowners "
            "facing a binary choice: halt transits, accept uninsured risk, or seek "
            "alternative cover from Continental, Asian, or Russian markets. "
            "Lloyd's CEO described the suspension as 'a temporary measure pending "
            "stabilization of the security environment in the Persian Gulf.'"
        ),
    },
    {
        "id": "lore-002",
        "topic": "war_risk_insurance",
        "source": "Strait of Consequences scenario state — April 2026",
        "content": (
            "Continental and Asian war-risk capacity backfilling Lloyd's withdrawal "
            "(April 2026). With Lloyd's JWC suspending Hormuz coverage on April 18, "
            "alternative war-risk markets have stepped in to backfill capacity at "
            "premium multiples of 4x normal-period rates. PICC China (People's "
            "Insurance Company of China), Sinosure, and CICI are writing hull-war "
            "and cargo-war for Chinese-bound and Chinese-flag vessels at "
            "approximately 240-320 basis points (bps) per voyage — versus pre-Apr-18 "
            "Lloyd's rates of 60-80 bps. Ingosstrakh (Russia) is providing similar "
            "cover for Russian-flag and Russia-linked tankers at comparable multiples. "
            "Continental European insurers (Munich Re, Allianz Trade) are offering "
            "limited capacity for EU-flagged vessels but only on a case-by-case "
            "underwriting basis, not at standard rates. Western shipowners without "
            "China or Russia ties are largely unable to secure war-risk cover for "
            "Hormuz transits at any price as of late April 2026. Lloyd's syndicates "
            "are reportedly preparing return-to-market terms contingent on a 30-day "
            "no-incident period."
        ),
    },
    {
        "id": "lore-003",
        "topic": "recent_incidents",
        "source": "Strait of Consequences scenario state — April 2026",
        "content": (
            "April 18, 2026 — IRGC limpet-mine strike on M/V Alpine Confidence. "
            "On April 18, 2026 at approximately 03:42 local time, the Hong Kong-flagged "
            "VLCC M/V Alpine Confidence (MMSI 477001234, IMO 9712345) was struck by "
            "a single limpet mine on her port side amidships while transiting the "
            "Strait of Hormuz westbound, approximately 8 nautical miles south of "
            "Larak Island. The vessel was carrying 2.1 million barrels of Aramco "
            "crude bound for Ningbo, China. Hull integrity was breached but the "
            "vessel did not founder; she was towed to anchor off Khor Fakkan by "
            "Omani-flagged tugs. Forensic recovery of an inert second device "
            "(failed to detonate) by UAE Coast Guard divers confirmed IRGC "
            "manufacturing markings — magnetic limpet, M-08 pattern. Iran denied "
            "responsibility. The incident triggered the Lloyd's JWC suspension "
            "the same day and is the proximate cause of the current April 2026 "
            "Hormuz crisis backdrop."
        ),
    },
    {
        "id": "lore-004",
        "topic": "shadow_fleet_sanctions",
        "source": "Strait of Consequences scenario state — April 2026",
        "content": (
            "Iranian shadow-fleet surge following Lloyd's withdrawal (April 2026). "
            "With Western insurance markets effectively closed for Hormuz transits "
            "post-Apr-18, the Iranian shadow fleet has expanded operations sharply. "
            "Atlantic Council and UANI tracking estimates approximately 40-60 "
            "additional vessels have been added to the Iran-linked shadow fleet "
            "rotation since April 18, primarily aging VLCCs and Suezmaxes "
            "transferred from Greek and Cypriot beneficial owners through "
            "intermediate UAE shell companies. AIS spoofing incidents have tripled "
            "since the suspension, with at least 14 distinct vessels operating "
            "with falsified IMO transponder data over the past 10 days. "
            "OFAC has not yet issued new SDN designations targeting the post-Apr-18 "
            "additions, though Treasury reportedly has a designation package under "
            "Secretary review. The shadow fleet is increasingly operating with "
            "Russian (Ingosstrakh) or Chinese (PICC) cover — placing them outside "
            "Western P&I and Lloyd's hull markets entirely."
        ),
    },
]


def main():
    client = chromadb.PersistentClient(path="./intel_db")
    col = client.get_or_create_collection("intel_observations")

    # Idempotent: delete existing lore-* IDs first, then re-insert
    try:
        existing = col.get()
        existing_ids = [eid for eid in existing.get("ids", []) if eid.startswith("lore-")]
        if existing_ids:
            col.delete(ids=existing_ids)
            print(f"Removed {len(existing_ids)} existing lore-* docs for refresh.")
    except Exception:
        pass

    col.add(
        ids=[d["id"] for d in DOCS],
        documents=[d["content"] for d in DOCS],
        metadatas=[
            {
                "source": d["source"],
                "topic": d["topic"],
                "lat": 26.57,
                "lng": 56.47,
                "area": "Strait of Hormuz — April 2026 Scenario State",
                "date": "2026-04-18",
                "saved_at": "2026-04-18T14:00:00",
            }
            for d in DOCS
        ],
    )

    total = col.count()
    print(f"Added {len(DOCS)} April 2026 scenario-lore documents.")
    print(f"Collection 'intel_observations' now contains {total} total documents.")
    for d in DOCS:
        print(f"  + {d['id']} [{d['topic']}]")


if __name__ == "__main__":
    main()
