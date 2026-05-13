"""
seed_insurance_docs.py
Adds ~20 insurance / sanctions / shadow-fleet document chunks to the
intel_observations ChromaDB collection used by the INTEL CHAT RAG.

Run once from the api/ directory:
    cd api && python seed_insurance_docs.py

Does NOT delete any existing documents.
All content sourced from publicly-available unclassified material.
"""

import chromadb

DOCS = [
    # ── Lloyd's JWC + war-risk basics ─────────────────────────────────────────
    {
        "id": "insurance-001",
        "topic": "war_risk_insurance",
        "source": "Lloyd's JWC / public market guidance",
        "content": (
            "Lloyd's of London Joint War Committee (JWC) — Listed Areas. "
            "The JWC is a standing committee of Lloyd's marine underwriters that issues "
            "formal 'Listed Area' designations for geographies deemed to pose elevated "
            "war-risk. Once an area is listed, hull-war policies typically trigger an "
            "Additional Premium (AP) clause: shipowners must notify their broker before "
            "entering, pay an additional premium, and confirm the vessel's return. "
            "As of 2024, the Persian Gulf, Gulf of Oman, Strait of Hormuz approaches, "
            "and the Red Sea / Gulf of Aden corridor are all listed. Iranian port calls "
            "and anchorages off Abu Musa and the Tunbs carry the highest AP multipliers. "
            "A JWC listing does not prohibit transit; it reprices risk and shifts the "
            "burden of notification to the assured. Absence of notification voids war-risk "
            "cover for that voyage."
        ),
    },
    {
        "id": "insurance-002",
        "topic": "war_risk_insurance",
        "source": "Lloyd's / BIMCO public guidance",
        "content": (
            "War-risk insurance basics. War-risk marine policies cover perils of war, "
            "warlike operations, acts of terrorism, piracy, capture, seizure, arrest, "
            "restraint, detainment, and derelict mines. Premiums are quoted as basis "
            "points (bps) of the vessel's insured hull value per voyage or per annum. "
            "For Hormuz transits, normal-period premiums run 5–30 bps per voyage. "
            "During heightened tension (e.g., June 2019 Gulf of Oman attacks), rates "
            "spiked to 60–100 bps for a single transit. The policy typically excludes "
            "CBRN risk and nuclear peril. P&I (Protection & Indemnity) clubs provide "
            "liability cover separately; war-risk hull is a distinct placement. "
            "BIMCO's standard voyage charter clause requires owners to notify charterers "
            "within 48 hours of any JWC listing change affecting the agreed route."
        ),
    },
    {
        "id": "insurance-003",
        "topic": "war_risk_insurance",
        "source": "Lloyd's market public records",
        "content": (
            "Lloyd's syndicates writing Strait of Hormuz war-risk. The principal Lloyd's "
            "syndicates active in Hormuz marine war-risk include: Hiscox Syndicate 33 "
            "(lead market, largest capacity), Beazley Syndicates 623 and 2623 (specialty "
            "marine), Atrium Syndicate 609, Brit Syndicate 2987, and Talbot Syndicate 1183. "
            "Lloyd's operates as a subscription market: a broker places a risk across "
            "multiple syndicates each taking a percentage share; the lead syndicate sets "
            "the rate and terms. Following the 2019 Gulf of Oman incidents, several "
            "syndicates reduced their Hormuz line sizes or excluded Iranian-port-call "
            "voyages entirely. Lloyd's Corporation publishes the JWC bulletin updates "
            "via the Lloyds.com market portal; all active syndicates receive simultaneous "
            "notification of area listing changes."
        ),
    },
    {
        "id": "insurance-004",
        "topic": "war_risk_insurance",
        "source": "Market analyst reports / public",
        "content": (
            "Continental and Asian war-risk markets. Beyond Lloyd's, major war-risk "
            "capacity comes from AXA XL (Paris/Bermuda), Munich Re Specialty Marine, "
            "Hannover Re, MS Amlin (part of MS&AD group), and Lloyd's Asia Singapore. "
            "Post-2019 and accelerating post-2022, a meaningful capacity shift occurred "
            "toward Asian markets — particularly Singapore and Tokyo — as Western syndicates "
            "tightened terms. The China market (PICC, CICI, Sinosure) now writes "
            "significant volume for China-flagged tankers transiting the Gulf. "
            "Ingosstrakh (Russia) became the primary war-risk and hull underwriter for "
            "Russian-flagged vessels after EU and Lloyd's sanctions-related withdrawals "
            "in 2022. The net effect is a bifurcated market: Western-insured vessels "
            "carry Lloyd's / European paper; sanctioned or shadow-fleet vessels carry "
            "Russian, Chinese, or unverifiable cover."
        ),
    },
    {
        "id": "insurance-005",
        "topic": "war_risk_insurance",
        "source": "Historical market data / public reports",
        "content": (
            "Historical Hormuz war-risk premium spikes. Three benchmark events: "
            "(1) 1988 USS Samuel B. Roberts mine strike (Operation Praying Mantis context) "
            "— Lloyd's Hormuz premiums roughly doubled within one week as insurers repriced "
            "mine risk; the Tanker War period 1984–1988 saw sustained elevated rates. "
            "(2) May–June 2019 Fujairah and Gulf of Oman attacks — following the four-tanker "
            "limpet-mine attack off Fujairah (May 12) and the Front Altair / Kokuka "
            "Courageous attacks (June 13), JWC updated its Listed Areas bulletin and "
            "Hormuz single-voyage premiums tripled within 72 hours, peaking near 0.5% "
            "of hull value per voyage. (3) 2023–2024 Houthi Red Sea campaign — "
            "BIMCO and the JWC issued updated advisories; Bab el-Mandeb rates reached "
            "0.7% per voyage; Hormuz rates rose in sympathy as rerouting increased "
            "Hormuz traffic density."
        ),
    },

    # ── Iranian shadow fleet + sanctions ──────────────────────────────────────
    {
        "id": "insurance-006",
        "topic": "shadow_fleet_sanctions",
        "source": "UANI / Atlantic Council public reports",
        "content": (
            "Iranian shadow fleet overview. Iran operates an estimated 300+ vessel "
            "shadow fleet (per UANI and Atlantic Council tracking as of 2023–2024), "
            "consisting primarily of aging crude tankers — VLCCs, Suezmaxes, and "
            "Aframaxes — most over 15 years old. National Iranian Tanker Company (NITC) "
            "controls the state core; the broader fleet uses flag-of-convenience "
            "registrations (Panama, Cook Islands, Palau, Cameroon), opaque ownership "
            "chains through UAE and Hong Kong shell companies, and frequent AIS "
            "transponder manipulation (spoofing, dark periods). These vessels operate "
            "outside Western P&I clubs, Lloyd's hull cover, and Western class societies "
            "(DNV, Lloyd's Register, Bureau Veritas). Cover, if any, is provided by "
            "Ingosstrakh, PICC, or simply self-insured. Spill liability in case of "
            "incident falls on no recognized CLC/IOPC Fund contributor."
        ),
    },
    {
        "id": "insurance-007",
        "topic": "shadow_fleet_sanctions",
        "source": "Public company records / sanctions designations",
        "content": (
            "Russian Insurance Group (Ingosstrakh). Ingosstrakh (OJSC Ingosstrakh) "
            "is Russia's largest non-life insurer and a major alternative underwriter "
            "for Russian and Iran-linked maritime war-risk and hull cover. "
            "Following the 2022 Western sanctions on Russia and withdrawal of Lloyd's "
            "and European reinsurers from Russian risk, Ingosstrakh became the "
            "principal hull and war-risk underwriter for Russian-flagged tankers "
            "carrying crude from Russian Arctic and Baltic terminals. Reinsurance is "
            "routed through Russian National Reinsurance Company (RNRC) and reportedly "
            "through intermediaries in UAE, India, and China. Ingosstrakh also "
            "provides cover for some Iranian shadow-fleet vessels operating under "
            "bilateral Iran–Russia trade arrangements. Western sanctions compliance "
            "officers flag Ingosstrakh-issued certificates as potentially non-compliant "
            "with EU Directive 2009/20/EC on ship-owner civil liability insurance."
        ),
    },
    {
        "id": "insurance-008",
        "topic": "shadow_fleet_sanctions",
        "source": "US Treasury OFAC / public regulatory filings",
        "content": (
            "PICC China + China Insurance Holdings (CICI). People's Insurance Company "
            "of China (PICC Property and Casualty) and China P&I Club (part of CICI, "
            "China Shipowners Mutual Assurance Association) write hull, cargo, and "
            "war-risk cover for China-flagged vessels and Iran-bound tanker voyages. "
            "Since 2018, as OFAC secondary-sanctions enforcement tightened against "
            "third-country entities facilitating Iranian crude exports, Chinese "
            "state-owned insurers have become the de facto underwriters for the "
            "China–Iran oil trade corridor. Sinopec and CNOOC affiliate tankers "
            "transporting Iranian crude under the China–Iran comprehensive cooperation "
            "agreement carry PICC hull and CICI P&I cover. Western port-state authorities "
            "and US Treasury have noted CICI certificates as non-compliant with IG "
            "(International Group of P&I Clubs) pooling arrangements."
        ),
    },
    {
        "id": "insurance-009",
        "topic": "shadow_fleet_sanctions",
        "source": "US Federal Register / Treasury OFAC public notices",
        "content": (
            "OFAC sanctions on Iranian oil exports. The US Treasury Office of Foreign "
            "Assets Control (OFAC) sanctions framework targeting Iranian oil exports rests "
            "on three principal authorities: (1) Executive Order 13846 (August 2018, "
            "reimposed after JCPOA withdrawal) — prohibits significant transactions with "
            "the National Iranian Oil Company (NIOC), NITC, and Iranian petroleum sector; "
            "(2) Section 1245 of the FY2012 National Defense Authorization Act — "
            "imposes sanctions on foreign financial institutions conducting significant "
            "transactions with the Central Bank of Iran for oil purchases; "
            "(3) 2023–2024 secondary-sanctions enforcement actions — OFAC designated "
            "multiple third-country refiners (Chinese teapot refineries), UAE-based "
            "shipping brokers, and individual vessel masters facilitating Iranian crude "
            "exports. Penalties include SDN designation, US correspondent banking "
            "denial, and civil monetary penalties up to $1.5 million per transaction."
        ),
    },
    {
        "id": "insurance-010",
        "topic": "shadow_fleet_sanctions",
        "source": "International Group of P&I Clubs public statements",
        "content": (
            "International Group of P&I Clubs (IG) + sanctions compliance. The IG "
            "is an association of 13 mutual Protection and Indemnity clubs providing "
            "third-party liability cover (crew injury, oil pollution, cargo liability, "
            "wreck removal) for approximately 90% of the world's ocean-going tonnage. "
            "IG clubs include: Gard, Skuld, Britannia, North (NEPIA), West, UK Club, "
            "American Club, Steamship Mutual, Standard Club, Swedish Club, and others. "
            "All IG clubs publish comprehensive sanctions compliance policies declining "
            "to provide cover for: voyages involving sanctioned Iranian crude, calls at "
            "Iranian ports under OFAC/EU designation, and vessels owned or managed by "
            "SDN-listed entities. Skuld (Oslo) and North (NEPIA, Newcastle) have "
            "published explicit circulars declining cover for Iran-listed voyages. "
            "A vessel trading sanctioned Iranian cargo therefore has no IG P&I cover — "
            "meaning any pollution spill, crew claim, or third-party liability incident "
            "in the Strait would be uninsured under the CLC/IOPC Fund system."
        ),
    },

    # ── Strait-specific maritime governance ────────────────────────────────────
    {
        "id": "insurance-011",
        "topic": "maritime_governance",
        "source": "IMO / EIA public data",
        "content": (
            "Strait of Hormuz Traffic Separation Scheme (TSS). The IMO-approved Traffic "
            "Separation Scheme for the Strait of Hormuz establishes two approximately "
            "3-km-wide lanes — northwestbound (inbound/Persian Gulf-bound) and "
            "southeastbound (outbound) — separated by a precautionary zone, running "
            "south of Larak Island and Hengam Island in Iranian-controlled waters. "
            "The strait narrows to approximately 21 nautical miles at its minimum width "
            "between Qeshm Island (Iran) and the Musandam Peninsula (Oman). "
            "Approximately 21% of global oil supply (17–20 million barrels per day) and "
            "28% of global LNG transits the strait annually (EIA 2023 data). "
            "VLCC traffic averages 17–18 vessels per day in each direction. "
            "Iran's Ports and Maritime Organization nominally oversees TSS compliance "
            "in Iranian waters; Oman monitors from the southern shore."
        ),
    },
    {
        "id": "insurance-012",
        "topic": "maritime_governance",
        "source": "UNCLOS / academic international law (public)",
        "content": (
            "UNCLOS transit passage regime — Strait of Hormuz. The United Nations "
            "Convention on the Law of the Sea (UNCLOS) Article 38 establishes a right "
            "of 'transit passage' through straits used for international navigation — "
            "a stronger right than innocent passage, applying even to warships and "
            "submarines (the latter may transit submerged). Iran has signed but not "
            "ratified UNCLOS, and asserts that foreign warships require prior "
            "notification and consent for innocent passage through its territorial sea. "
            "The United States, UK, and most maritime states reject this interpretation, "
            "asserting that customary international law provides the transit passage "
            "right regardless of UNCLOS ratification status. Iran periodically asserts "
            "that the strait's waters are exclusively Iranian and Omani territorial sea "
            "— a position rejected by the Omani government. This legal ambiguity is a "
            "recurring source of IRGC Navy intercept and harassment incidents."
        ),
    },
    {
        "id": "insurance-013",
        "topic": "maritime_governance",
        "source": "BIMCO / Lloyd's MIU public advisories",
        "content": (
            "Bab el-Mandeb / Red Sea spillover effects on Hormuz insurance. "
            "The 2023–2024 Houthi (Ansar Allah) anti-shipping campaign in the Red Sea "
            "and Bab el-Mandeb strait produced significant Hormuz insurance market "
            "effects. As insurers declined to write Red Sea transits at any price "
            "following ballistic-missile and drone attacks on commercial vessels, "
            "shipping diverted around the Cape of Good Hope — increasing voyage "
            "lengths by 10–14 days. This displacement raised Hormuz traffic density "
            "(more LNG and product tankers routing via the Gulf rather than Red Sea) "
            "and correlated war-risk premium increases for the Hormuz corridor even "
            "in the absence of direct Hormuz incidents. BIMCO issued a Hormuz/Gulf "
            "advisory (2024) noting that the cross-strait spillover effect created "
            "heightened underwriter sensitivity to any Hormuz incident signal. "
            "JWC bulletin updates for the Red Sea and Persian Gulf are now issued "
            "on a near-monthly cycle versus previously annual or ad hoc."
        ),
    },
    {
        "id": "insurance-014",
        "topic": "maritime_governance",
        "source": "US Naval Institute / public historical record",
        "content": (
            "Iran–Iraq Tanker War (1984–1988) — insurance and escalation precedent. "
            "During the Iran–Iraq War 'Tanker War' phase, 451 attacks on commercial "
            "shipping in the Gulf were recorded (1984–1988). Lloyd's war-risk premiums "
            "for Gulf transits rose from near-zero to 0.5–2.0% of hull value per voyage "
            "at peak. Operation Earnest Will (1987–1988) saw the United States reflag "
            "11 Kuwaiti tankers under the Stars and Stripes and provide naval escorts. "
            "USS Stark (FFG-31) was struck by two Iraqi Exocet AM39 missiles on "
            "May 17, 1987, killing 37 sailors — despite no war-risk trigger, "
            "underwriters immediately raised premiums fleetwide. USS Samuel B. Roberts "
            "(FFG-58) struck a mine on April 14, 1988; Operation Praying Mantis on "
            "April 18, 1988 destroyed two Iranian oil platforms and sank or damaged "
            "several IRIN vessels — the largest US surface engagement since World War II. "
            "This period established the benchmark for how Hormuz-area military "
            "incidents translate to immediate insurance market repricing."
        ),
    },

    # ── Recent precedent + scenarios ──────────────────────────────────────────
    {
        "id": "insurance-015",
        "topic": "recent_incidents",
        "source": "UKMTO / public shipping records",
        "content": (
            "Stena Impero seizure — July 19, 2019. British-flagged Stena Impero "
            "(IMO 9797400) was boarded and seized by IRGC Navy fast-attack craft and "
            "an IRGC Mil Mi-17 helicopter (rappel boarding) near Larak Island in the "
            "Strait of Hormuz on July 19, 2019. The 23-member crew was held for 65 days. "
            "Iran stated the seizure was in retaliation for the UK Royal Marines-assisted "
            "detention of supertanker Grace 1 (carrying Iranian crude to Syria in "
            "violation of EU sanctions) off Gibraltar on July 4, 2019. "
            "Stena Impero's war-risk underwriters (Lloyd's syndicate) paid out for the "
            "constructive total-loss threat period; the vessel was ultimately released "
            "intact on September 27, 2019. The incident demonstrated IRGC willingness "
            "to target Western-flagged, IG-insured commercial vessels as political "
            "leverage — a capability explicitly factored into post-2019 JWC listed-area "
            "premium calculations."
        ),
    },
    {
        "id": "insurance-016",
        "topic": "recent_incidents",
        "source": "CENTCOM / UKMTO public statements",
        "content": (
            "Fujairah four-tanker limpet attack — May 12, 2019. Four commercial tankers "
            "anchored off Fujairah, UAE were damaged by limpet mines on May 12, 2019: "
            "Saudi VLCC Amjad, Saudi VLCC Al Marzoqah, Norwegian Aframax Andrea Victory, "
            "and UAE bunker tanker A Michel. US CENTCOM and UAE investigators attributed "
            "the attack to IRGC operatives; Iran denied involvement. "
            "No crew casualties. Structural damage to all four hulls above and below "
            "the waterline consistent with magnetically-attached IEDs. "
            "Immediate market effect: Hormuz single-voyage war-risk premiums roughly "
            "doubled within 48 hours; by the end of the week (post–JWC bulletin update) "
            "rates had tripled versus pre-incident levels. Multiple syndicates placed "
            "Fujairah anchorage under additional AP notification requirements. "
            "The incident, combined with the June 2019 Gulf of Oman attacks, prompted "
            "the most significant Lloyd's JWC Gulf revision since the 1988 Tanker War."
        ),
    },
    {
        "id": "insurance-017",
        "topic": "recent_incidents",
        "source": "CENTCOM / Norwegian Maritime Authority public statements",
        "content": (
            "Front Altair and Kokuka Courageous attacks — June 13, 2019. Norwegian-owned "
            "crude tanker Front Altair (IMO 9727014) and Japanese-owned chemical tanker "
            "Kokuka Courageous (IMO 9301119) were attacked in the Gulf of Oman on "
            "June 13, 2019. Front Altair was struck twice and caught fire; Kokuka "
            "Courageous suffered a hull breach. US CENTCOM released video footage "
            "showing an IRGC Hendijan-class patrol craft removing an unexploded limpet "
            "mine from Kokuka Courageous's hull — the principal public attribution "
            "evidence. Japan disputed the attribution publicly. "
            "Both vessels' war-risk underwriters triggered AP clauses; Front Altair "
            "was declared a constructive total loss by Norwegian hull underwriters "
            "before being salvaged. The attacks occurred as Japanese Prime Minister Abe "
            "was in Tehran on a mediation visit, maximizing political sensitivity. "
            "Combined with the Fujairah incident, these attacks drove JWC's 2019 "
            "Gulf-wide premium restructuring and the addition of explicit 'mine and "
            "IED attachment' sub-limits to several syndicate policies."
        ),
    },

    # ── Treasury / regulator context ──────────────────────────────────────────
    {
        "id": "insurance-018",
        "topic": "ofac_sanctions",
        "source": "US Treasury OFAC SDN list / public Federal Register",
        "content": (
            "US Treasury OFAC SDN designations — Iranian shipping. The OFAC Specially "
            "Designated Nationals (SDN) list includes: National Iranian Tanker Company "
            "(NITC) — designated 2012, redesignated 2019; individual NITC vessel "
            "masters; specific vessel IMO numbers with known Iranian crude lifting history. "
            "Notable designations include: Clavel (formerly Happiness I), Dune "
            "(formerly Golestan), and approximately 50+ additional NITC-managed "
            "VLCCs and Suezmaxes as of 2024. OFAC also designated multiple UAE-based "
            "and Hong Kong-based ship management companies providing cover services to "
            "the shadow fleet. US persons are prohibited from any transaction with SDN "
            "entities; non-US persons face secondary sanctions risk. Ship buyers at "
            "auction, Class societies issuing interim certificates, and P&I clubs "
            "issuing pro-forma cover letters have all been targeted for potential OFAC "
            "enforcement action when providing services to SDN-designated vessels."
        ),
    },
    {
        "id": "insurance-019",
        "topic": "eu_sanctions",
        "source": "EU Official Journal / Council Regulation 2023/2691",
        "content": (
            "EU Council Regulation 2023/2691 — Iranian shipping sanctions. "
            "EU Council Regulation (EU) 2023/2691 (December 2023) expanded the EU "
            "sanctions framework against Iran to include enhanced shipping provisions: "
            "designation of shadow-fleet vessels carrying Iranian crude, prohibition on "
            "EU persons providing maritime services (insurance, classification, flagging, "
            "crewing, bunkering, port services) to listed vessels. EU port-state control "
            "authorities (Paris MOU member states) are directed to detain vessels "
            "presenting suspect flag-state, classification, or insurance documentation "
            "consistent with shadow-fleet indicators. The regulation coordinates with "
            "UK post-Brexit equivalent provisions (UK OFSI designations mirror EU list). "
            "Practical effect: EU-flagged tugs, EU-licensed pilots, and EU-port-based "
            "bunker suppliers must screen vessel IMO numbers against the EU consolidated "
            "list before providing services — creating friction at EU-adjacent choke "
            "points but leaving Hormuz-area services (UAE, Oman, Fujairah) largely "
            "outside EU jurisdictional reach."
        ),
    },
    {
        "id": "insurance-020",
        "topic": "maritime_governance",
        "source": "BIMCO / IMO MSC public circulars",
        "content": (
            "BIMCO and IMO MSC.1 advisories on Hormuz security. BIMCO (Baltic and "
            "International Maritime Council) and the IMO Maritime Safety Committee "
            "have issued multiple advisories to operators on Hormuz / Gulf of Oman "
            "security posture. Key guidance elements: (1) Maintain bridge watch with "
            "officer on duty at all times during strait transit; (2) Register with "
            "UKMTO (United Kingdom Maritime Trade Operations) Dubai before entering "
            "the IRTC (Internationally Recommended Transit Corridor); (3) Report all "
            "suspicious approaches to UKMTO, US NAVCENT, and the ship's flag-state "
            "authority; (4) Avoid Iranian EEZ anchorage absent commercial necessity; "
            "5) If approached by IRGCN vessels, comply calmly, transmit distress "
            "via AIS/SSAS, and do not offer armed resistance (per BIMCO guidance on "
            "armed guards in the Gulf, which differs from Somali Basin doctrine). "
            "IMO MSC.1/Circ.1601 (2021) provides the current recommended reporting "
            "procedures for incidents in the Gulf. Non-compliance with UKMTO "
            "registration is noted by P&I clubs as a potential prejudice to cover."
        ),
    },
]


def main():
    client = chromadb.PersistentClient(path="./intel_db")
    col = client.get_or_create_collection(
        name="intel_observations",
        metadata={"hnsw:space": "cosine"},
    )

    existing_ids = set(col.get(include=[])["ids"])
    new_docs = [d for d in DOCS if d["id"] not in existing_ids]

    if not new_docs:
        print(f"All {len(DOCS)} documents already present — nothing to add.")
        return

    col.add(
        ids=[d["id"] for d in new_docs],
        documents=[d["content"] for d in new_docs],
        metadatas=[
            {
                "source": d["source"],
                "topic": d["topic"],
                # Geographic metadata: Hormuz centroid so geo-proximity
                # queries still return these docs when querying strait area.
                "lat": 26.57,
                "lng": 56.47,
                "area": "Strait of Hormuz — Insurance/Sanctions Domain",
                "date": "2024",
                "saved_at": "2024-01-01T00:00:00",
            }
            for d in new_docs
        ],
    )

    total = col.count()
    print(f"Added {len(new_docs)} insurance/sanctions documents.")
    print(f"Collection 'intel_observations' now contains {total} total documents.")
    for d in new_docs:
        print(f"  + {d['id']} [{d['topic']}]")


if __name__ == "__main__":
    main()
