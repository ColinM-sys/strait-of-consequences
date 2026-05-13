"""
seed_doctrine_docs.py
Adds 10 strategy / doctrine / contingency-planning chunks to the
intel_observations ChromaDB collection. Material is summarized from
publicly-available unclassified analytical work (CSIS, RAND, USNI,
CNAS, CRS, Atlantic Council, IISS) on Hormuz contingency, ROE doctrine,
Iranian A2/AD, escalation off-ramps, and coalition warfighting.

Run once from the api/ directory:
    cd api && python seed_doctrine_docs.py

Idempotent — re-running just refreshes the existing IDs.
"""

import chromadb

DOCS = [
    {
        "id": "doctrine-001",
        "topic": "hormuz_contingency",
        "source": "CSIS / CNAS Hormuz contingency analysis (public)",
        "content": (
            "USCENTCOM Hormuz contingency framework. Public CSIS and CNAS analytical "
            "work characterizes the standing US contingency posture for a Hormuz crisis "
            "around three concurrent lines of effort: (1) freedom-of-navigation through "
            "rotational CSG presence (typically one Nimitz-class CVN forward-deployed in "
            "the FIFTH FLEET AOR, paired with DDGs / CGs running CTF-152 / IMSC escort "
            "patterns); (2) coalition burden-sharing via the International Maritime "
            "Security Construct (IMSC) and the European-led EMASOH, both providing "
            "non-US Coalition presence to keep transits multilateral rather than "
            "US-unilateral; (3) economic deterrent posture via OFAC enforcement and "
            "sanctions snapback options. The doctrine assumes Iran will avoid full "
            "closure (which would alienate China and India) but will use harassment, "
            "boarding, and limpet-mine ambiguity to create insurance and political "
            "pressure without crossing the threshold for direct Coalition retaliation."
        ),
    },
    {
        "id": "doctrine-002",
        "topic": "roe_doctrine",
        "source": "USN / NATO published ROE primers + USNI articles",
        "content": (
            "Rules of Engagement (ROE) escalation ladder for naval forces in contested "
            "waters. Standard USN ROE moves through five graduated levels: BRAVO "
            "(self-defense only, no preemption); CHARLIE (defensive posture, may use "
            "force to repel positively-identified hostile intent); DELTA (active "
            "defense — engage demonstrated hostile act, including incoming missiles, "
            "torpedoes, fast-attack-craft swarming inside the engagement envelope); "
            "ECHO (preemptive defense — engage threats showing hostile intent before "
            "they fire, requires SECDEF or higher authorization in peacetime); "
            "FOXTROT (war-time, full combat ROE). Most Hormuz-period US ROE has "
            "operated at CHARLIE-DELTA. The escalation friction in real Hormuz "
            "scenarios is rarely the kinetic engagement itself — it's the timeline "
            "between an IRGC FAC sortie being detected and the on-scene commander "
            "having authorization to engage. ESSM and CIWS handle the kinetic; "
            "the political/legal layer handles the rest."
        ),
    },
    {
        "id": "doctrine-003",
        "topic": "iranian_a2ad",
        "source": "RAND / IISS Iranian military analysis",
        "content": (
            "Iranian A2/AD (anti-access / area denial) strategy in Hormuz. Iran's "
            "denial posture leans on layered, asymmetric threats designed to make "
            "transit costly without enabling decisive Iranian victory in any single "
            "engagement. Layers include: (1) Coastal anti-ship cruise missiles "
            "(C-802 Noor, Qader, Soumar — 120-300 km range) on truck-mounted launchers "
            "scattered across the Iranian coast and Greater/Lesser Tunb islands; "
            "(2) IRGC fast-attack craft swarms (Boghammar, Peykaap, Zolfaqar — designed "
            "for distributed multi-vector strikes against larger combatants); "
            "(3) Ghadir-class midget submarines (~150 ton, capable of 53-cm torpedo "
            "launch in shallow water); (4) Mining capability (limpet, contact, and "
            "influence mines, with 2000+ in inventory); (5) Drone swarms (Shahed-136, "
            "Mohajer) for cheap kinetic effects against infrastructure or saturating "
            "ship defenses. The strategy assumes individual systems will lose against "
            "Coalition forces, but the cumulative cost — political, insurance, "
            "operational tempo — accumulates faster than Coalition tolerance. Iran "
            "wins by extending the timeline."
        ),
    },
    {
        "id": "doctrine-004",
        "topic": "escalation_offramps",
        "source": "CSIS / Belfer Center Hormuz crisis stability analysis",
        "content": (
            "Off-ramps in a Hormuz crisis. Crisis-stability analysis identifies four "
            "primary off-ramps that historically de-escalate Hormuz incidents: "
            "(1) Omani backchannel — Sultanate of Oman has hosted US-Iran indirect "
            "communication since the 1979 hostage crisis and remains the primary "
            "neutral interlocutor for prisoner-exchange and threshold-clarification "
            "messaging; (2) Tanker-for-tanker swap — the 2019 Stena Impero release "
            "after Grace 1 was freed established the modern template for symmetric "
            "de-escalation; (3) Sanctions easing as concession — limited OFAC waivers "
            "or Iraqi electricity sanctions licenses have been used to give Iran a "
            "face-saving exit without formal negotiation; (4) Time. Most Hormuz "
            "incidents de-escalate naturally as oil markets reprice, alliance "
            "attention shifts, and Iran's domestic incentives change. Crisis "
            "stability literature warns that the absence of a clear off-ramp is "
            "what drives 1962-Cuba-style accidental escalation, not the kinetic "
            "exchange itself."
        ),
    },
    {
        "id": "doctrine-005",
        "topic": "coalition_warfighting",
        "source": "CENTCOM IMSC / EMASOH public posture statements",
        "content": (
            "Coalition warfighting frameworks active in Hormuz. Three overlapping "
            "constructs operate concurrently: (1) Combined Task Force 152 (CTF-152), "
            "a US-led standing maritime security task force under the Combined "
            "Maritime Forces (CMF) — focused on intra-Gulf security, includes "
            "rotational members from UK, France, Saudi Arabia, UAE, Bahrain, Kuwait, "
            "Italy, and others; (2) International Maritime Security Construct (IMSC), "
            "a US-led non-NATO coalition stood up in July 2019 specifically for "
            "Strait of Hormuz freedom-of-navigation — members include UK, Australia, "
            "Bahrain, Saudi Arabia, UAE, Albania, Lithuania, Estonia; "
            "(3) European Maritime Awareness in the Strait of Hormuz (EMASOH), "
            "a French-led European-only construct stood up January 2020 — members "
            "include France, Belgium, Denmark, Germany, Greece, Italy, Netherlands, "
            "Norway, Portugal — explicitly designed to provide a non-US coalition "
            "option for European shipping. The fragmentation reflects that no "
            "single coalition format satisfies all partners politically; "
            "operationally the three frameworks deconflict but do not unify command."
        ),
    },
    {
        "id": "doctrine-006",
        "topic": "earnest_will_lessons",
        "source": "USNI / Naval History reviews of Operation Earnest Will",
        "content": (
            "Operation Earnest Will (1987-1988) — escort doctrine lessons for modern "
            "Hormuz contingency. The reflagging of 11 Kuwaiti tankers under US flag "
            "and naval escort during the Tanker War established several enduring "
            "doctrinal points still cited in modern Hormuz planning: (1) Escort "
            "formation: tanker centerline with two DDGs/FFGs flanking at 5-10 nm, "
            "minesweeper-helo (RH-53) ahead at 15 nm — the geometry now reflected "
            "in CTF-152 escort patterns; (2) Mining is the dominant kinetic threat — "
            "USS Samuel B. Roberts (FFG-58) struck a mine on April 14, 1988, "
            "validating that even in a low-intensity contest mines produce "
            "disproportionate effects; (3) Symmetric retaliation via Operation Praying "
            "Mantis (April 18, 1988) — destroying two Iranian oil platforms after the "
            "FFG-58 strike — established that limited, proportional kinetic response "
            "to mine warfare is doctrinally acceptable and not automatically "
            "escalatory; (4) Reflagging changes the legal calculus — once Kuwaiti "
            "tankers carried US flags, attacks became attacks on US interests, "
            "shifting the political math substantially. Modern analogues exist in "
            "considering UK or French escort options for non-US-flagged tankers."
        ),
    },
    {
        "id": "doctrine-007",
        "topic": "iranian_proxy_framework",
        "source": "Atlantic Council / FDD Iran tracker analysis",
        "content": (
            "Iranian proxy framework affecting Hormuz. Iran's regional shadow-war "
            "doctrine extends naturally into Hormuz operations through three primary "
            "proxy/proxy-adjacent vectors: (1) Houthi forces in Yemen — Iran-supplied "
            "anti-ship missiles (Quds-class, Sayyad), drones (Shahed-136), and "
            "explosive USVs that can range Bab el-Mandeb but also threaten Hormuz "
            "approaches via Iranian transshipment; (2) IRGC Quds Force operations — "
            "deniable kinetic actions outside formal IRGC Navy chain of command, "
            "providing Iran with attribution-deniability for limpet attacks and "
            "small-boat harassment; (3) Iraqi Shia militia networks — capable of "
            "kinetic action against US interests in Iraq that creates pressure on "
            "Hormuz force-protection posture. The doctrine treats Hormuz, the Red Sea, "
            "and US bases in Iraq/Syria as a single integrated theater where Iran "
            "can apply pressure at the cheapest available vector. A Hormuz incident "
            "rarely happens in isolation — escalation should be analyzed across the "
            "full proxy network, not just maritime."
        ),
    },
    {
        "id": "doctrine-008",
        "topic": "mda_gaps",
        "source": "USNI / CNAS Maritime Domain Awareness assessments",
        "content": (
            "Maritime Domain Awareness (MDA) gaps in Hormuz. Despite extensive "
            "Coalition surveillance, several MDA gaps recur in Hormuz contingency "
            "planning: (1) AIS spoofing — Iranian shadow-fleet tankers manipulate "
            "transponder data at scale, creating ghost vessels and identity blending "
            "that complicates targeting and monitoring; (2) ESA Sentinel-2 / Sentinel-1 "
            "revisit cadence — civil European satellite constellations provide "
            "5-day revisit at best, leaving operational gaps that Iran can exploit "
            "for staging; (3) IRGC small-craft signature — Boghammars and Peykaaps "
            "have low radar cross-section and operate from coastal coves invisible "
            "to standing patrols; (4) Submarine awareness in shallow water — "
            "Ghadir-class diesel-electric subs in the 30-100 m littoral are notoriously "
            "hard to track for maritime patrol aircraft (P-8) optimized for blue-water "
            "ASW. Closing these gaps drives commercial SAR (Capella, ICEYE), "
            "VLM-augmented imagery analysis, and AI-assisted track-fusion as the "
            "primary investment vectors."
        ),
    },
    {
        "id": "doctrine-009",
        "topic": "crisis_stability",
        "source": "Belfer Center / Brookings crisis stability analysis",
        "content": (
            "Crisis stability theory applied to Hormuz. Schelling-style crisis "
            "stability analysis identifies the critical risk in Hormuz scenarios as "
            "the absence of clear escalation thresholds combined with the presence of "
            "many low-cost kinetic options. The destabilizing factors: (1) Multi-actor "
            "ambiguity — IRGC, IRIN, Quds, and proxy attribution is inherently "
            "fungible, denying both sides a clean escalation index; (2) Time pressure "
            "from oil markets — every hour of uncertainty repriced into Brent crude, "
            "forcing political pressure to act before all-source intel matures; "
            "(3) Asymmetric stakes — Iran can absorb tactical losses politically "
            "while the US faces immediate domestic pressure on energy prices; "
            "(4) Strategic learning effects — past successful Iranian harassment "
            "(2019 Stena Impero) lowers Iranian uncertainty about Coalition response, "
            "making future provocations more likely. The doctrinal recommendation "
            "from this literature: signal red lines clearly and early, maintain "
            "Coalition multilateralism, and resist the urge to retaliate at the "
            "first provocation if a credible off-ramp exists."
        ),
    },
    {
        "id": "doctrine-010",
        "topic": "sanctions_enforcement",
        "source": "CRS / Atlantic Council Iran sanctions reports",
        "content": (
            "Sanctions enforcement options around Hormuz transit. CRS and Atlantic "
            "Council reporting outlines the enforcement toolkit available to "
            "interdict sanctioned crude moving through Hormuz: (1) OFAC Specially "
            "Designated Nationals (SDN) listings — direct designation of vessels, "
            "owners, or insurers triggers asset freezes and bars from US financial "
            "system; (2) Secondary sanctions on third-country buyers — Indian, "
            "Turkish, Chinese refiners face penalty exposure for taking Iranian crude, "
            "creating economic deterrence without direct interdiction; (3) Maritime "
            "interdiction — UK Royal Marines / US Navy boardings of vessels reasonably "
            "suspected of carrying sanctioned cargo, legally defended under UN "
            "resolutions on Iran (e.g., UNSCR 2231 expired October 2023; "
            "EU-imposed measures continue); (4) Insurance/registry pressure — "
            "denying P&I cover, classification society services, or flag-state "
            "registration to suspect vessels effectively prices them out of normal "
            "commerce; (5) Cyber and electronic disruption — capability publicly "
            "alleged but rarely confirmed. The toolkit blends diplomatic, economic, "
            "and limited kinetic measures designed to raise costs without triggering "
            "open conflict — the central tension Hormuz contingency planning navigates."
        ),
    },
]


def main():
    # Match server.py — same DB the FastAPI /intel/query reads from
    client = chromadb.PersistentClient(path="./intel_db")
    col = client.get_or_create_collection("intel_observations")

    # Idempotent: delete any existing doctrine-* IDs first, then re-insert
    existing_ids = []
    try:
        existing = col.get()
        existing_ids = [eid for eid in existing.get("ids", []) if eid.startswith("doctrine-")]
        if existing_ids:
            col.delete(ids=existing_ids)
            print(f"Removed {len(existing_ids)} existing doctrine-* docs for refresh.")
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
                "area": "Strait of Hormuz — Doctrine/Strategy Domain",
                "date": "2024",
                "saved_at": "2024-01-01T00:00:00",
            }
            for d in DOCS
        ],
    )

    total = col.count()
    print(f"Added {len(DOCS)} doctrine/strategy documents.")
    print(f"Collection 'intel_observations' now contains {total} total documents.")
    for d in DOCS:
        print(f"  + {d['id']} [{d['topic']}]")


if __name__ == "__main__":
    main()
