# Strait of Consequences — Exercise Pivot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pivot Strait of Consequences from live unit-action wargame to scenario-based exercise mode (SDA-style), with 3 scenarios, DIME+ decisions, ship taxonomy, isolation + animations, OSM/ACLED/RAG data integrations, and AAR screen.

**Architecture:** Strip the live wargame loop. Add `EXERCISE` tab with scenario cards. New `src/scenarios.js` (data) + `src/exercise.js` (state machine). Bottom sticky overlay for turn flow. Reuse map / ships / animations / RAG / VLM / Markets panel. Backend (FastAPI + Ollama) untouched except for new RAG ingest of JCS + CSIS docs.

**Tech Stack:** Vanilla JS + Leaflet (frontend), Python FastAPI (backend), Ollama (LLMs), ChromaDB (RAG). No JS test framework — pure-logic modules tested via Node's built-in `node:test`. UI tasks verified manually in browser.

**Spec source:** `C:\Users\cmcdo\Desktop\hormuz features.txt`

---

## File Structure

### Created
- `src/scenarios.js` — scenario data (3 scenarios, decisions, assessments, ship-actor taxonomy)
- `src/exercise.js` — turn state machine, indicator deltas, sitrep logic
- `src/exercise-ui.js` — DOM rendering for scenario cards, decision cards, sitrep, AAR
- `src/ship-taxonomy.js` — 20-category data (Red/Blue cell views, strike consequences)
- `src/osm-layer.js` — Overpass query + infrastructure markers
- `src/acled-feed.js` — ACLED API client + intel feed widget
- `tests/exercise.test.js` — unit tests for state machine
- `tests/scenarios.test.js` — scenario data validation
- `api/red_cell.py` — FastAPI endpoint for Ollama-driven Red Cell narration
- `api/rag/jcs_doctrine/` — directory for JCS Doctrine PDFs (ingested by ChromaDB)
- `api/rag/csis/` — directory for CSIS analysis PDFs
- `docs/superpowers/plans/2026-04-25-exercise-pivot.md` — this file

### Modified
- `index.html` — tab swap (WARGAME → EXERCISE), bottom overlay markup, ship popup template, OSM layer toggle
- `src/main.js` — strip wargame action handlers, init exercise system, wire ship popup expand
- `src/leaflet-game.js` — strip unit-movement loop; keep ship rendering; expose `dimNonKeyShips()`, `animateImpact()` helpers
- `src/animations.js` — expose impact animation primitives by name (strike/disabled/sinking/boarded/mined/oil-slick/port-effect/convoy-form/transit-halt)
- `api/server.py` — register `red_cell` router; ensure RAG ingest re-runs

### Deleted
- Action button handlers in `index.html` (`#act-strike`, `#act-ciws`, `#act-jam`, `#act-cap`, `#act-sweep`, `#act-sigint`)
- Unit-movement loop functions in `src/leaflet-game.js`

---

## Task Sequencing Rationale

Phase 1 gets a stub running (tab switch works, no scenarios yet).
Phase 2 ships **one scenario end-to-end** (SEIZURE) — proves the full loop.
Phase 3 adds breadth (other scenarios, animations, AAR) and the ship-taxonomy demo piece.
Phase 4 layers on data integrations (OSM, ACLED, RAG, AI Red Cell, VLM tie-in) — each is independent and can be cut if time runs short.

**Stop-line for demoable v1:** end of Phase 3. Phase 4 items are upside.

---

# PHASE 1 — TEAR DOWN & STAND UP

## Task 1: Strip Live Wargame Action UI

**Files:**
- Modify: `index.html` (action button block, tab labels)
- Modify: `src/main.js` (strip action handler wiring)

- [ ] **Step 1: Remove action buttons block from `index.html`**

Search for `<button class="action-btn` block (around the WARGAME tab body). Delete the buttons: `act-strike`, `act-ciws`, `act-jam`, `act-cap`, `act-sweep`, `act-sigint`. Keep the panel div + tab structure.

- [ ] **Step 2: Rename WARGAME tab to EXERCISE**

In `index.html` find:
```html
<button class="panel-tab active" id="tab-wargame">⚔ WARGAME</button>
```
Replace with:
```html
<button class="panel-tab active" id="tab-exercise">⚠ EXERCISE</button>
```
Also change `<div id="panel-wargame">` to `<div id="panel-exercise">` and update CSS selectors that reference these IDs.

- [ ] **Step 3: Remove action handler bindings in `src/main.js`**

Find blocks calling `document.getElementById('act-strike').addEventListener(...)` and the corresponding `act-ciws`, `act-jam`, `act-cap`, `act-sweep`, `act-sigint` bindings. Delete them. Leave the imports alone for now (we'll prune unused later).

- [ ] **Step 4: Verify in browser**

Refresh `http://localhost:3000`. Confirm:
- Page loads without JS errors (DevTools console clean)
- New tab label reads `⚠ EXERCISE`
- Map + ships still render
- No action buttons in tab body

**Commit checkpoint:** "rip out wargame action UI"

---

## Task 2: Empty EXERCISE Tab Scaffolding

**Files:**
- Modify: `index.html` (empty exercise tab body, bottom overlay markup)

- [ ] **Step 1: Replace exercise tab body with placeholder structure**

In `index.html`, inside `<div id="panel-exercise">`, replace contents with:
```html
<div id="exercise-tab-body" style="padding:14px;display:flex;flex-direction:column;gap:10px;overflow-y:auto;flex:1">
  <div id="exercise-scenario-list">
    <div style="color:#ff6600;font-size:11px;letter-spacing:2px;margin-bottom:8px">// SELECT SCENARIO //</div>
    <div id="scenario-cards"></div>
  </div>
  <div id="exercise-active" style="display:none">
    <div id="exercise-brief" style="font-size:12px;line-height:1.5;color:#cce0ff;margin-bottom:10px"></div>
    <div id="exercise-key-vessels"></div>
    <div id="exercise-decisions"></div>
    <button id="exercise-end-btn" style="margin-top:auto;padding:8px;background:rgba(255,80,80,0.1);color:#ff8888;border:1px solid #ff666633;cursor:pointer;font-family:inherit;font-size:11px;letter-spacing:2px">END EXERCISE</button>
  </div>
</div>
```

- [ ] **Step 2: Add bottom overlay markup**

Just before closing `</body>` in `index.html`, add:
```html
<div id="exercise-overlay" style="display:none;position:fixed;bottom:0;left:0;right:420px;z-index:50;background:rgba(0,4,12,0.94);backdrop-filter:blur(4px);border-top:2px solid #ff660066;color:#cce0ff;font-family:'Courier New',monospace;max-height:280px;overflow-y:auto;transition:max-height 0.3s ease">
  <div id="exercise-overlay-header" style="padding:8px 14px;border-bottom:1px solid #ff660033;display:flex;justify-content:space-between;align-items:center">
    <span id="exercise-overlay-title" style="font-size:11px;letter-spacing:2px;color:#ff8800">EXERCISE</span>
    <span id="exercise-overlay-turn" style="font-size:11px;letter-spacing:2px">TURN 1 OF 4</span>
    <button id="exercise-overlay-min" style="background:none;border:1px solid #ff660066;color:#ff8800;cursor:pointer;padding:2px 8px;font-family:inherit">▾</button>
  </div>
  <div id="exercise-overlay-body" style="padding:10px 14px;font-size:12px"></div>
</div>
```
Note `right:420px` reserves space for the side panel.

- [ ] **Step 3: Verify in browser**

Refresh. Confirm:
- EXERCISE tab body shows "// SELECT SCENARIO //" header
- No JS errors
- `#exercise-overlay` is in DOM but `display:none`

**Commit checkpoint:** "exercise tab + overlay scaffolding"

---

# PHASE 2 — CORE EXERCISE LOOP (ONE SCENARIO END-TO-END)

## Task 3: Ship Taxonomy Data Module

**Files:**
- Create: `src/ship-taxonomy.js`
- Create: `tests/ship-taxonomy.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/ship-taxonomy.test.js`:
```javascript
const test = require('node:test');
const assert = require('node:assert');
const { ACTOR_CATEGORIES, getCategory } = require('../src/ship-taxonomy.js');

test('has all 20 actor categories', () => {
  assert.strictEqual(ACTOR_CATEGORIES.length, 20);
});

test('category 4 is Saudi crude tanker', () => {
  const cat = getCategory(4);
  assert.match(cat.name, /Saudi crude/i);
  assert.ok(cat.redCell.length > 0);
  assert.ok(cat.blueCell.length > 0);
  assert.ok(cat.consequences.length > 0);
});

test('every category has all required fields', () => {
  for (const cat of ACTOR_CATEGORIES) {
    assert.ok(cat.id >= 1 && cat.id <= 20);
    assert.ok(cat.name);
    assert.ok(cat.consequences);
    assert.ok(cat.redCell);
    assert.ok(cat.blueCell);
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd C:\Users\cmcdo\Documents\GitHub\strait-of-consequences && node --test tests/ship-taxonomy.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/ship-taxonomy.js`**

Create the file with all 20 categories. Use both CommonJS and browser-global export pattern so it works in tests AND in the browser:
```javascript
const ACTOR_CATEGORIES = [
  { id:1,  name:'U.S. military vessel',
    consequences:'Military escalation, U.S. domestic pressure',
    redCell:'Maximum pressure on U.S. deterrence',
    blueCell:'Immediate national-security crisis' },
  { id:2,  name:'Allied / coalition military vessel',
    consequences:'Alliance credibility, coalition cohesion',
    redCell:'Way to fracture or test coalition resolve',
    blueCell:'Alliance credibility test' },
  { id:3,  name:'Coalition support / logistics vessel',
    consequences:'Sustainment pressure, escalation ambiguity',
    redCell:'Lower-threshold attack on Blue sustainment',
    blueCell:'Operational and escalation concern' },
  { id:4,  name:'Saudi crude tanker',
    consequences:'Oil-price shock, U.S.-Saudi coordination',
    redCell:'Oil-price shock and pressure on Riyadh',
    blueCell:'Energy and Gulf-partner crisis' },
  { id:5,  name:'UAE crude or refined-products tanker',
    consequences:'Fuel-price shock, logistics disruption',
    redCell:'Fuel-market and UAE pressure point',
    blueCell:'Refined-fuel and logistics concern' },
  { id:6,  name:'Qatari LNG carrier',
    consequences:'LNG-price shock, Qatar reassurance',
    redCell:'LNG-market disruption and Qatar pressure',
    blueCell:'Gas-market and ally reassurance issue' },
  { id:7,  name:'Kuwaiti / Iraqi oil tanker',
    consequences:'Oil supply shock, Iraq/Kuwait security pressure',
    redCell:'Regional oil instability',
    blueCell:'Northern Gulf export-security issue' },
  { id:8,  name:'Chinese-owned or China-bound tanker',
    consequences:'U.S.-China-Iran diplomacy, attribution sensitivity',
    redCell:'Way to pull China into crisis politics',
    blueCell:'High-risk diplomatic attribution problem' },
  { id:9,  name:'Indian-owned or India-bound tanker',
    consequences:'India pressure, coalition-framing challenge',
    redCell:'Way to pressure non-aligned importers',
    blueCell:'India crisis-management challenge' },
  { id:10, name:'Japanese / South Korean energy vessel',
    consequences:'U.S. alliance reassurance, LNG/oil concern',
    redCell:'Indirect pressure on U.S. treaty allies',
    blueCell:'Japan / Korea reassurance problem' },
  { id:11, name:'European commercial vessel',
    consequences:'NATO/EU cohesion, insurance shock',
    redCell:'European coalition-fracture target',
    blueCell:'EU / NATO political coordination issue' },
  { id:12, name:'Neutral-flag commercial tanker',
    consequences:'Attribution ambiguity, insurance shock',
    redCell:'Broad commercial fear generator',
    blueCell:'Shipping-confidence and insurance issue' },
  { id:13, name:'Global container ship',
    consequences:'Supply-chain disruption, freight-rate shock',
    redCell:'Supply-chain disruption lever',
    blueCell:'Inflation and freight-rate concern' },
  { id:14, name:'Humanitarian / food / medical cargo vessel',
    consequences:'Legitimacy crisis, UN pressure',
    redCell:'Spoiler or false-flag opportunity',
    blueCell:'Humanitarian legitimacy crisis' },
  { id:15, name:'Omani coastal / service vessel',
    consequences:'Mediation-channel risk, de-escalation pressure',
    redCell:'Mediation-channel spoiler',
    blueCell:'Oman / de-escalation-channel priority' },
  { id:16, name:'Port, tug, pilot, or maritime-service vessel',
    consequences:'Port disruption, shipping confidence loss',
    redCell:'Low-visibility way to disrupt shipping',
    blueCell:'Port-function and transit-confidence issue' },
  { id:17, name:'Energy-infrastructure support vessel',
    consequences:'Infrastructure-risk perception, market fear',
    redCell:'Infrastructure-risk signal',
    blueCell:'Energy-system resilience concern' },
  { id:18, name:'Insurer-sensitive high-value commercial vessel',
    consequences:'War-risk premium spike, shipping slowdown',
    redCell:'Insurance-market shock lever',
    blueCell:'War-risk premium crisis' },
  { id:19, name:'Ambiguous ownership / flag-of-convenience vessel',
    consequences:'Attribution confusion, disinformation opportunity',
    redCell:'Attribution fog generator',
    blueCell:'Intelligence and messaging challenge' },
  { id:20, name:'Media-symbolic civilian vessel',
    consequences:'Information-war shock, public outrage',
    redCell:'Information-war amplifier',
    blueCell:'Public-opinion and media-management crisis' },
];

function getCategory(id) {
  return ACTOR_CATEGORIES.find(c => c.id === id);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ACTOR_CATEGORIES, getCategory };
}
if (typeof window !== 'undefined') {
  window.ACTOR_CATEGORIES = ACTOR_CATEGORIES;
  window.getCategory = getCategory;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/ship-taxonomy.test.js`
Expected: 3 passing tests.

- [ ] **Step 5: Add to index.html**

In `index.html`, add `<script src="src/ship-taxonomy.js"></script>` BEFORE `src/main.js` and `src/leaflet-game.js` script tags.

**Commit checkpoint:** "add 20-category ship taxonomy"

---

## Task 4: Scenarios Data — SEIZURE

**Files:**
- Create: `src/scenarios.js`
- Create: `tests/scenarios.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/scenarios.test.js`:
```javascript
const test = require('node:test');
const assert = require('node:assert');
const { SCENARIOS, getScenario } = require('../src/scenarios.js');

test('has at least one scenario', () => {
  assert.ok(SCENARIOS.length >= 1);
});

test('SEIZURE scenario has 4 turns and 5 decisions per turn', () => {
  const s = getScenario('seizure');
  assert.strictEqual(s.turns.length, 4);
  for (const turn of s.turns) {
    assert.ok(turn.inject);
    assert.strictEqual(turn.decisions.length, 5);
    const lanes = turn.decisions.map(d => d.lane);
    assert.deepStrictEqual(
      lanes.sort(),
      ['DIPLOMATIC','ECONOMIC','INFORMATION','INTELLIGENCE','MILITARY']
    );
    for (const dec of turn.decisions) {
      assert.ok(dec.title);
      assert.ok(dec.assessment);
      assert.ok(dec.deltas);
    }
  }
});

test('SEIZURE has key vessels declared by ship id', () => {
  const s = getScenario('seizure');
  assert.ok(Array.isArray(s.keyVessels) && s.keyVessels.length > 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/scenarios.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement SEIZURE scenario in `src/scenarios.js`**

```javascript
const SCENARIOS = [
  {
    id: 'seizure',
    title: 'IRGC SEIZURE OF UAE-FLAGGED TANKER',
    rung: 'SEIZURE',
    rungColor: '#ffaa00',
    threat: 'HIGH',
    summary: 'IRGC fast attack craft have intercepted and boarded the UAE-flagged tanker GULF MERIDIAN in the international shipping channel near Abu Musa. The crew is being held aboard. Tehran cites alleged "shipping safety violations." Allied attribution is high.',
    coverStory: 'IRGC public statement frames the seizure as a "lawful inspection" under Iranian maritime authority.',
    keyVessels: ['civ-meridian','civ-blue-1','civ-allied-1'],
    initialIndicators: {
      escalationRung: 2,        // SEIZURE rung
      oilPrice: 84,             // $/bbl
      warRiskInsurance: 145,    // bps
      allianceCohesion: 72,
      attributionConfidence: 81,
      iranCoercion: 38,
    },
    turns: [
      // ── TURN 1 ────────────────────────────────────────────────────────────
      {
        inject: 'IRGC has begun a public live broadcast from the bridge of GULF MERIDIAN. Two additional fast-attack craft have positioned at the western edge of the strait. Saudi Aramco signals it may delay tomorrow morning crude departures pending convoy arrangements.',
        decisions: [
          { lane:'DIPLOMATIC', title:'Issue coordinated public attribution with UK, France, UAE',
            assessment:'Joint statement lands within 2 hours. Tehran accuses signatories of "war propaganda." UAE confidence rises. China declines to co-sign — modest fracture in the broader coalition. Attribution confidence ticks up; alliance cohesion holds.',
            deltas:{ allianceCohesion:+2, attributionConfidence:+5, iranCoercion:+1 } },
          { lane:'INFORMATION', title:'Push real-time IMINT/SIGINT to allied capitals',
            assessment:'NSA and partner agencies share unredacted track data on the IRGC craft. Allies move from "high confidence" to "very high confidence" attribution. Intelligence sources risk exposure if the imagery is leaked publicly. Tehran shifts narrative to claim the imagery is fabricated.',
            deltas:{ attributionConfidence:+8, allianceCohesion:+1 } },
          { lane:'MILITARY', title:'Forward-deploy USS-flagged escort within visual range',
            assessment:'A DDG repositions to within 12 nm of GULF MERIDIAN. IRGC reads the move as escalation but does not increase posture. Civilian shipping insurers note the visible Blue presence — war-risk premiums tick down marginally. Iran coercion reading climbs as IRGC sees Blue commitment.',
            deltas:{ warRiskInsurance:-5, iranCoercion:+4, allianceCohesion:+2 } },
          { lane:'ECONOMIC', title:'Activate war-risk insurance backstop with Lloyd\'s',
            assessment:'Treasury commits to underwrite Lloyd\'s war-risk syndicate exposure for transits through the strait. War-risk premiums reverse. Industry confidence in Blue commitment rises. Tehran loses one lever of economic pressure.',
            deltas:{ warRiskInsurance:-15, oilPrice:-2 } },
          { lane:'INTELLIGENCE', title:'Re-task ISR + cue Sentinel-2 collection on IRGC ports',
            assessment:'Within 6 hours, fresh Sentinel-2 imagery confirms IRGC reinforcement craft at Bandar Abbas. VLM analysis flags two additional fast-attack hulls under cover at the docks. Tehran is unaware of the collection but adapts within 24 hours.',
            deltas:{ attributionConfidence:+4, iranCoercion:+1 } },
        ],
      },
      // ── TURN 2 ────────────────────────────────────────────────────────────
      {
        inject: 'Tehran refuses release of GULF MERIDIAN crew. UAE has formally requested U.S. assistance. Oil traders have priced in a 4% Brent premium overnight. CSIS analysts publish a thread arguing Iran is "testing the new floor of acceptable coercion."',
        decisions: [
          { lane:'DIPLOMATIC', title:'Escalate to UN Security Council emergency session',
            assessment:'Russia and China block any binding resolution but a non-binding statement of concern passes 13-2. Tehran is internationally isolated but materially unconstrained. The diplomatic record is established for any future Blue military action.',
            deltas:{ allianceCohesion:+3, iranCoercion:+2 } },
          { lane:'INFORMATION', title:'Run public attribution campaign with declassified imagery',
            assessment:'Selected Sentinel-2 + commercial SAR imagery is released. International press picks up the story within 4 hours. Domestic Iranian media is forced to address the imagery; public Iranian government denial undermines Tehran\'s information narrative globally.',
            deltas:{ attributionConfidence:+6, iranCoercion:+3 } },
          { lane:'MILITARY', title:'Establish convoy escort for outbound UAE traffic',
            assessment:'Two DDGs and a UK Type-23 begin escorting UAE-flagged tankers out of the strait. IRGC declines to challenge active escort. Throughput recovers but at the cost of forward-deployed combat power consumed in escort duty.',
            deltas:{ warRiskInsurance:-10, oilPrice:-3, iranCoercion:+3 } },
          { lane:'ECONOMIC', title:'Coordinate SPR release with IEA partners',
            assessment:'The U.S. announces a 30M-barrel SPR draw coordinated with Japan, Korea, and the IEA. Brent retraces 2.5%. The signal of joint action reassures markets but consumes a strategic reserve lever for limited operational benefit.',
            deltas:{ oilPrice:-5, allianceCohesion:+1 } },
          { lane:'INTELLIGENCE', title:'Activate covert channel to Omani mediator',
            assessment:'Muscat carries a private message to Tehran offering face-saving release pathway. Tehran does not commit but the channel remains open. Omani relations improve; Iran reads the back-channel as Blue weakness alongside public escalation.',
            deltas:{ allianceCohesion:+2, iranCoercion:-2 } },
        ],
      },
      // ── TURN 3 ────────────────────────────────────────────────────────────
      {
        inject: 'IRGC announces "investigative procedures" will continue for 30 days. Two additional civilian tankers turn around at the eastern strait entrance, citing insurance unavailability. A Chinese-owned VLCC requests Iranian naval escort westbound — Tehran assents, framing it as a "service to legitimate commerce."',
        decisions: [
          { lane:'DIPLOMATIC', title:'Demarche Beijing on Chinese-flagged Iranian escort',
            assessment:'A discreet but firm message is delivered through PRC channels. Beijing instructs the China-flagged operator to refuse Iranian escort going forward. The maneuver succeeds but Tehran reads it as evidence Beijing is constrainable by U.S. pressure.',
            deltas:{ attributionConfidence:+2, iranCoercion:+2, allianceCohesion:+1 } },
          { lane:'INFORMATION', title:'Cyber operation against IRGC public broadcast infrastructure',
            assessment:'IRGC livestream goes dark for 6 hours. Tehran cannot publicly acknowledge the attribution. Domestic Iranian commentary turns critical of the IRGC information campaign. Cyber capability is now exposed to Iranian counter-investigation.',
            deltas:{ iranCoercion:+4, attributionConfidence:+1 } },
          { lane:'MILITARY', title:'Authorize visit, board, search, seizure (VBSS) of GULF MERIDIAN',
            assessment:'CTF 152 plans the operation. Risk of casualties is non-trivial — IRGC has 14 personnel aboard. The operation if executed restores the vessel; if it fails, escalation rung jumps to STRIKE. PLAN APPROVED, NOT EXECUTED — held for next turn.',
            deltas:{ iranCoercion:+5, escalationRung:+1, warRiskInsurance:+8 } },
          { lane:'ECONOMIC', title:'Sanction IRGC Navy commander + 3 vessels (OFAC SDN)',
            assessment:'Treasury designates the IRGC Navy commander and the three IRGC craft involved in the boarding. Material impact is low. Symbolic impact is significant. Tehran responds by publicly elevating the named commander\'s status.',
            deltas:{ iranCoercion:+1, attributionConfidence:+1 } },
          { lane:'INTELLIGENCE', title:'Run live VLM analysis on real Sentinel-2 pass over the strait',
            assessment:'A real-time Sentinel-2 frame is captured during the active turn. Llama 3.2 Vision identifies 3 IRGC craft, 1 disabled merchant hulk, dispersed civilian traffic. The analysis is fed into the Blue Cell sitrep. (Demo touchpoint.)',
            deltas:{ attributionConfidence:+3 } },
        ],
      },
      // ── TURN 4 ────────────────────────────────────────────────────────────
      {
        inject: 'Tehran indicates willingness to "consider release" if Western escort operations cease and the Lloyd\'s war-risk backstop is withdrawn. Allied capitals are split: UAE wants the crew home; UK wants no concessions; Riyadh wants the convoy operation continued indefinitely. CSIS publishes a follow-on note arguing this is the off-ramp turn.',
        decisions: [
          { lane:'DIPLOMATIC', title:'Accept Omani-mediated release in exchange for ceasing escort',
            assessment:'Crew is released within 48 hours. Escort operations end. Tehran achieves a partial coercion victory — establishing that escort deployments are negotiable. Coalition members read the outcome differently. The exercise ends with the immediate crisis resolved but Iran emboldened.',
            deltas:{ iranCoercion:+8, allianceCohesion:-4, warRiskInsurance:-20, oilPrice:-3 } },
          { lane:'INFORMATION', title:'Publicly reject all conditions, double down on attribution case',
            assessment:'Tehran loses the off-ramp it offered. Domestic Iranian pressure on Khamenei to release the crew quietly without conditions builds. Crew is released within 14 days without formal Blue concessions. Iran retains coercion capacity but at reputational cost.',
            deltas:{ iranCoercion:-3, attributionConfidence:+4, allianceCohesion:+3 } },
          { lane:'MILITARY', title:'Execute VBSS against GULF MERIDIAN now',
            assessment:'Operation succeeds with 1 IRGC KIA, 0 Blue casualties, crew rescued. Tehran responds with a missile strike on a Saudi tanker 36 hours later — the exercise escalates to STRIKE rung. Crisis is no longer contained.',
            deltas:{ escalationRung:+2, allianceCohesion:+2, iranCoercion:-2, warRiskInsurance:+30 } },
          { lane:'ECONOMIC', title:'Maintain insurance backstop + escort indefinitely',
            assessment:'Tehran calculates the cost of indefinite low-grade coercion exceeds the benefit. Crew is released within 21 days under "humanitarian" framing. Strait throughput normalizes. Blue commitment cost is real (DDG availability, Treasury exposure) but bounded.',
            deltas:{ iranCoercion:-4, allianceCohesion:+2, warRiskInsurance:-10, oilPrice:-2 } },
          { lane:'INTELLIGENCE', title:'Continue covert mediation, no public moves',
            assessment:'Crew is released within 30 days through quiet channels. The crisis fades from public attention but the underlying coercion dynamic is unresolved. Tehran reads the outcome as a successful application of pressure.',
            deltas:{ iranCoercion:+4, allianceCohesion:-1, warRiskInsurance:-10 } },
        ],
      },
    ],
  },
];

function getScenario(id) { return SCENARIOS.find(s => s.id === id); }

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SCENARIOS, getScenario };
}
if (typeof window !== 'undefined') {
  window.SCENARIOS = SCENARIOS;
  window.getScenario = getScenario;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/scenarios.test.js`
Expected: 3 passing tests.

- [ ] **Step 5: Add to index.html**

Add `<script src="src/scenarios.js"></script>` after `ship-taxonomy.js`, before `main.js`.

**Commit checkpoint:** "add scenarios.js with SEIZURE scenario"

---

## Task 5: Exercise State Machine

**Files:**
- Create: `src/exercise.js`
- Create: `tests/exercise.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/exercise.test.js`:
```javascript
const test = require('node:test');
const assert = require('node:assert');
require('../src/ship-taxonomy.js');
require('../src/scenarios.js');
const { ExerciseState } = require('../src/exercise.js');

test('starts at turn 1 with initial indicators', () => {
  const ex = new ExerciseState('seizure');
  assert.strictEqual(ex.turn, 1);
  assert.strictEqual(ex.indicators.oilPrice, 84);
  assert.strictEqual(ex.sitrep.length, 0);
});

test('applying a decision advances turn and updates indicators', () => {
  const ex = new ExerciseState('seizure');
  const economicDecision = ex.currentTurnDecisions().find(d => d.lane === 'ECONOMIC');
  ex.applyDecision(economicDecision);
  assert.strictEqual(ex.turn, 2);
  assert.strictEqual(ex.indicators.warRiskInsurance, 130); // 145 - 15
  assert.strictEqual(ex.sitrep.length, 1);
  assert.strictEqual(ex.sitrep[0].lane, 'ECONOMIC');
});

test('exercise ends after turn 4', () => {
  const ex = new ExerciseState('seizure');
  for (let i = 0; i < 4; i++) {
    ex.applyDecision(ex.currentTurnDecisions()[0]);
  }
  assert.strictEqual(ex.complete, true);
  assert.strictEqual(ex.sitrep.length, 4);
});

test('indicators clamp 0..100 where appropriate', () => {
  const ex = new ExerciseState('seizure');
  ex.indicators.iranCoercion = 98;
  ex.applyDelta({ iranCoercion: +10 });
  assert.strictEqual(ex.indicators.iranCoercion, 100);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/exercise.test.js`
Expected: FAIL — `ExerciseState` not defined.

- [ ] **Step 3: Implement `src/exercise.js`**

```javascript
const CLAMPED_INDICATORS = ['allianceCohesion','attributionConfidence','iranCoercion'];

class ExerciseState {
  constructor(scenarioId) {
    const scenario = (typeof getScenario === 'function')
      ? getScenario(scenarioId)
      : require('./scenarios.js').getScenario(scenarioId);
    if (!scenario) throw new Error('unknown scenario: ' + scenarioId);
    this.scenario = scenario;
    this.turn = 1;
    this.indicators = { ...scenario.initialIndicators };
    this.sitrep = [];
    this.complete = false;
    this.decisionHistory = [];
  }

  currentTurn() {
    return this.scenario.turns[this.turn - 1];
  }

  currentTurnDecisions() {
    return this.currentTurn().decisions;
  }

  applyDelta(delta) {
    for (const [k, v] of Object.entries(delta)) {
      this.indicators[k] = (this.indicators[k] || 0) + v;
      if (CLAMPED_INDICATORS.includes(k)) {
        this.indicators[k] = Math.max(0, Math.min(100, this.indicators[k]));
      }
    }
  }

  applyDecision(decision) {
    if (this.complete) return;
    this.applyDelta(decision.deltas);
    this.sitrep.push({
      turn: this.turn,
      lane: decision.lane,
      title: decision.title,
      assessment: decision.assessment,
      indicatorsAfter: { ...this.indicators },
      timestamp: new Date().toISOString(),
    });
    this.decisionHistory.push(decision);
    this.turn++;
    if (this.turn > this.scenario.turns.length) {
      this.complete = true;
      this.turn = this.scenario.turns.length;
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ExerciseState };
}
if (typeof window !== 'undefined') {
  window.ExerciseState = ExerciseState;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/exercise.test.js`
Expected: 4 passing tests.

- [ ] **Step 5: Add to index.html**

Add `<script src="src/exercise.js"></script>` after `scenarios.js`.

**Commit checkpoint:** "add exercise state machine"

---

## Task 6: Exercise UI — Scenario Cards + Tab Wiring

**Files:**
- Create: `src/exercise-ui.js`
- Modify: `src/main.js` (init exercise UI on load)

- [ ] **Step 1: Implement scenario card rendering in `src/exercise-ui.js`**

```javascript
let activeExercise = null;

function renderScenarioCards() {
  const container = document.getElementById('scenario-cards');
  if (!container) return;
  container.innerHTML = '';
  for (const s of SCENARIOS) {
    const card = document.createElement('div');
    card.style.cssText = `
      border:1px solid ${s.rungColor}66; padding:10px 12px; margin-bottom:8px;
      cursor:pointer; transition:all 0.15s; background:rgba(255,170,0,0.04)`;
    card.innerHTML = `
      <div style="color:${s.rungColor};font-size:11px;letter-spacing:2px;font-weight:bold">${s.rung}</div>
      <div style="color:#e0e8f0;font-size:13px;margin:4px 0">${s.title}</div>
      <div style="color:#7a8896;font-size:10px;line-height:1.4">${s.summary.substring(0, 120)}…</div>
    `;
    card.addEventListener('mouseenter', () => card.style.background = 'rgba(255,170,0,0.12)');
    card.addEventListener('mouseleave', () => card.style.background = 'rgba(255,170,0,0.04)');
    card.addEventListener('click', () => startExercise(s.id));
    container.appendChild(card);
  }
}

function startExercise(scenarioId) {
  activeExercise = new ExerciseState(scenarioId);
  document.getElementById('exercise-scenario-list').style.display = 'none';
  document.getElementById('exercise-active').style.display = 'flex';
  document.getElementById('exercise-active').style.flexDirection = 'column';
  document.getElementById('exercise-overlay').style.display = 'block';
  renderActiveExercise();
}

function endExercise() {
  activeExercise = null;
  document.getElementById('exercise-scenario-list').style.display = 'block';
  document.getElementById('exercise-active').style.display = 'none';
  document.getElementById('exercise-overlay').style.display = 'none';
}

function renderActiveExercise() {
  if (!activeExercise) return;
  const ex = activeExercise;
  const turn = ex.currentTurn();

  // Brief
  document.getElementById('exercise-brief').innerHTML = `
    <div style="color:${ex.scenario.rungColor};font-size:11px;letter-spacing:2px;margin-bottom:6px">${ex.scenario.rung} — ${ex.scenario.threat}</div>
    <div style="color:#e0e8f0;font-size:13px;margin-bottom:8px;font-weight:bold">${ex.scenario.title}</div>
    <div style="color:#a0b0c0;font-size:11px;line-height:1.5;margin-bottom:8px">${turn.inject}</div>
  `;

  // Decision cards
  const decContainer = document.getElementById('exercise-decisions');
  decContainer.innerHTML = `<div style="color:#ff8800;font-size:10px;letter-spacing:2px;margin:8px 0 6px">// CHOOSE ONE — TURN ${ex.turn} OF ${ex.scenario.turns.length} //</div>`;
  const laneColors = { DIPLOMATIC:'#ffcc66', INFORMATION:'#cc66ff', MILITARY:'#ff6666', ECONOMIC:'#66ccff', INTELLIGENCE:'#66ff99' };
  for (const dec of ex.currentTurnDecisions()) {
    const card = document.createElement('div');
    const c = laneColors[dec.lane] || '#cccccc';
    card.style.cssText = `border:1px solid ${c}55; padding:8px 10px; margin-bottom:6px; cursor:pointer; transition:background 0.1s;`;
    card.innerHTML = `
      <div style="color:${c};font-size:9px;letter-spacing:2px;font-weight:bold">${dec.lane}</div>
      <div style="color:#e0e8f0;font-size:12px;margin-top:3px">${dec.title}</div>
    `;
    card.addEventListener('mouseenter', () => card.style.background = `${c}15`);
    card.addEventListener('mouseleave', () => card.style.background = 'transparent');
    card.addEventListener('click', () => onDecisionPicked(dec));
    decContainer.appendChild(card);
  }

  renderOverlay();
}

function onDecisionPicked(dec) {
  if (!activeExercise) return;
  activeExercise.applyDecision(dec);
  if (activeExercise.complete) {
    renderAAR();
    return;
  }
  renderActiveExercise();
}

function renderOverlay() {
  if (!activeExercise) return;
  const ex = activeExercise;
  document.getElementById('exercise-overlay-turn').textContent = ex.complete
    ? 'EXERCISE COMPLETE'
    : `TURN ${ex.turn} OF ${ex.scenario.turns.length}`;
  document.getElementById('exercise-overlay-title').textContent = `EXERCISE — ${ex.scenario.rung}`;

  const body = document.getElementById('exercise-overlay-body');
  if (ex.sitrep.length === 0) {
    body.innerHTML = '<div style="color:#7a8896;font-size:11px">No decisions logged yet. Pick one from the side panel.</div>';
    return;
  }
  body.innerHTML = ex.sitrep.map(s => `
    <div style="border-left:2px solid #ff660055;padding:6px 10px;margin-bottom:6px">
      <div style="color:#ff8800;font-size:10px;letter-spacing:2px">T${s.turn} · ${s.lane}</div>
      <div style="color:#e0e8f0;font-size:12px;margin:3px 0">${s.title}</div>
      <div style="color:#a0b0c0;font-size:11px;line-height:1.5">${s.assessment}</div>
    </div>
  `).join('');
}

function renderAAR() {
  // Placeholder — full AAR is in Task 12
  const body = document.getElementById('exercise-overlay-body');
  body.innerHTML = `<div style="color:#00ff88;font-size:14px;letter-spacing:2px;margin-bottom:10px">✓ EXERCISE COMPLETE</div>` +
    activeExercise.sitrep.map(s => `<div style="margin-bottom:4px;font-size:11px;color:#a0b0c0">T${s.turn}: ${s.lane} — ${s.title}</div>`).join('');
  document.getElementById('exercise-decisions').innerHTML = '';
  renderOverlay();
}

window.renderScenarioCards = renderScenarioCards;
window.startExercise = startExercise;
window.endExercise = endExercise;
```

- [ ] **Step 2: Wire init in `src/main.js`**

Add to the bottom of `main.js` (or wherever DOM-ready code lives):
```javascript
document.addEventListener('DOMContentLoaded', () => {
  if (typeof renderScenarioCards === 'function') renderScenarioCards();
  const endBtn = document.getElementById('exercise-end-btn');
  if (endBtn) endBtn.addEventListener('click', endExercise);
  const minBtn = document.getElementById('exercise-overlay-min');
  if (minBtn) minBtn.addEventListener('click', () => {
    const ov = document.getElementById('exercise-overlay');
    ov.style.maxHeight = ov.style.maxHeight === '40px' ? '280px' : '40px';
  });
});
```

- [ ] **Step 3: Add script tag**

In `index.html`, add `<script src="src/exercise-ui.js"></script>` after `exercise.js`, before `main.js`.

- [ ] **Step 4: Verify in browser**

Refresh. Click EXERCISE tab. Should see SEIZURE scenario card. Click it. Should see brief + 5 decision cards. Click any decision. Should advance to turn 2 with new inject + new decisions; bottom overlay shows the sitrep entry.

**Commit checkpoint:** "core exercise loop working end-to-end with SEIZURE"

---

## Task 7: Indicator Panel — MARKETS Tab Updates Live

**Files:**
- Modify: `src/exercise-ui.js` (call `renderIndicators()` on each turn)
- Modify: `src/main.js` (existing markets tab — add update function)

- [ ] **Step 1: Add `renderIndicators()` in `src/exercise-ui.js`**

Append to `exercise-ui.js`:
```javascript
function renderIndicators() {
  if (!activeExercise) return;
  const ind = activeExercise.indicators;
  const panel = document.getElementById('panel-markets');
  if (!panel) return;
  const rungs = ['—','HARASS','SEIZURE','MINING','STRIKE','CLOSURE','WAR'];
  panel.innerHTML = `
    <div style="color:#ff8800;font-size:10px;letter-spacing:2px;margin-bottom:8px">// EXERCISE INDICATORS //</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      ${indicatorTile('ESCALATION', rungs[ind.escalationRung] || '—', '#ff6666')}
      ${indicatorTile('OIL PRICE', '$' + ind.oilPrice + '/bbl', '#66ccff')}
      ${indicatorTile('WAR-RISK INS', ind.warRiskInsurance + ' bps', '#cc66ff')}
      ${indicatorTile('ALLIANCE COHESION', ind.allianceCohesion + '/100', '#66ff99')}
      ${indicatorTile('ATTRIBUTION CONF', ind.attributionConfidence + '/100', '#ffcc66')}
      ${indicatorTile('IRAN COERCION', ind.iranCoercion + '/100', '#ff8888')}
    </div>
  `;
}

function indicatorTile(label, value, color) {
  return `
    <div style="border:1px solid ${color}33;padding:8px 10px;background:rgba(0,0,0,0.3)">
      <div style="color:${color};font-size:9px;letter-spacing:1.5px">${label}</div>
      <div style="color:#e0e8f0;font-size:14px;margin-top:3px;font-family:'Courier New',monospace">${value}</div>
    </div>`;
}

window.renderIndicators = renderIndicators;
```

- [ ] **Step 2: Call `renderIndicators()` from existing flow**

In `renderActiveExercise()` and `renderAAR()`, add at the end:
```javascript
renderIndicators();
```
Also call it once when `startExercise(scenarioId)` runs, so initial values appear.

- [ ] **Step 3: Verify in browser**

Refresh, start SEIZURE, click MARKETS tab. Should see 6 indicator tiles with initial values. Pick a decision. MARKETS tab values update.

**Commit checkpoint:** "live indicator panel"

---

# PHASE 3 — POLISH FOR DEMO

## Task 8: Ship Expand-Arrow Popup

**Files:**
- Modify: `src/leaflet-game.js` (CIVILIAN_SHIPS array — add `actorCategory`, `fictionalName`)
- Modify: `src/leaflet-game.js` (popup rendering — add expand arrow)

- [ ] **Step 1: Augment CIVILIAN_SHIPS data**

In `src/leaflet-game.js`, find the `CIVILIAN_SHIPS` array. Add `actorCategory` (1-20) and `fictionalName` to each entry. Example:
```javascript
const CIVILIAN_SHIPS = [
  { id:'civ1',  name:'MT GULF STAR', flag:'🇸🇦', lat:26.10, lng:56.90,
    actorCategory:4, fictionalName:'Gulf Meridian' },
  // ... assign categories appropriate to flag/role for all ships
];
```
Map flags to categories: 🇸🇦→4, 🇦🇪→5, 🇶🇦→6, 🇰🇼/🇮🇶→7, 🇨🇳→8, 🇮🇳→9, 🇯🇵/🇰🇷→10, 🇪🇺→11, neutral→12, container→13, etc.

Also assign distinctive ids matching what `keyVessels` in scenarios.js expects (e.g., `civ-meridian` for the SEIZURE target). If the ids in scenarios.js don't match real ship ids, update scenarios.js to use the actual ids.

- [ ] **Step 2: Update popup HTML in `src/leaflet-game.js`**

Find where ship `bindPopup(...)` is called. Replace popup content with expand-arrow version:
```javascript
const cat = window.getCategory ? getCategory(ship.actorCategory) : null;
const popupHtml = `
  <div style="font-family:'Courier New',monospace">
    <div style="font-weight:bold;color:#0044aa">${ship.flag} ${ship.name}</div>
    <div style="font-size:10px;color:#666">${ship.fictionalName ? 'Tracked as: ' + ship.fictionalName : ''}</div>
    ${cat ? `
      <button class="ship-expand-btn" data-cat="${ship.actorCategory}"
        style="margin-top:6px;background:none;border:1px solid #0044aa55;color:#0044aa;cursor:pointer;font-family:inherit;font-size:10px;padding:2px 8px">
        ▼ STRIKE CONSEQUENCES
      </button>
      <div class="ship-expand-body" style="display:none;margin-top:6px;font-size:10px;line-height:1.5;color:#222;max-width:300px">
        <div><b>Category ${cat.id}:</b> ${cat.name}</div>
        <div style="margin-top:4px"><b>Red Cell sees:</b> ${cat.redCell}</div>
        <div><b>Blue Cell sees:</b> ${cat.blueCell}</div>
        <div style="margin-top:4px;color:#a04400"><b>If struck:</b> ${cat.consequences}</div>
      </div>
    ` : ''}
  </div>`;
marker.bindPopup(popupHtml);
```

- [ ] **Step 3: Wire expand-arrow click**

After Leaflet popup opens, the expand button needs a click handler. Add a Leaflet popup-open listener (once, at map setup):
```javascript
this._map.on('popupopen', (e) => {
  const btn = e.popup._container.querySelector('.ship-expand-btn');
  if (btn) {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const body = e.popup._container.querySelector('.ship-expand-body');
      if (!body) return;
      const expanded = body.style.display === 'block';
      body.style.display = expanded ? 'none' : 'block';
      btn.textContent = expanded ? '▼ STRIKE CONSEQUENCES' : '▲ HIDE';
      e.popup.update();
    });
  }
});
```

- [ ] **Step 4: Verify in browser**

Refresh. Click any ship marker. Popup shows ship name + "▼ STRIKE CONSEQUENCES" button. Click it. Body expands showing category, Red Cell, Blue Cell, consequences. Click again to collapse.

**Commit checkpoint:** "ship expand-arrow with actor taxonomy"

---

## Task 9: Key-Vessel Isolation

**Files:**
- Modify: `src/leaflet-game.js` (export `dimNonKeyShips()`, `restoreAllShips()`)
- Modify: `src/exercise-ui.js` (call dim on start, restore on end)

- [ ] **Step 1: Add dim/restore helpers in `src/leaflet-game.js`**

After ship markers are created, store references on the game instance: `this._shipMarkers = { 'civ1': marker, ... }`. Then add:
```javascript
LeafletGame.prototype.dimNonKeyShips = function(keyIds) {
  for (const [id, marker] of Object.entries(this._shipMarkers)) {
    if (keyIds.includes(id)) {
      marker.setOpacity(1.0);
      const el = marker.getElement && marker.getElement();
      if (el) el.classList.add('key-vessel-pulse');
    } else {
      marker.setOpacity(0.25);
      const el = marker.getElement && marker.getElement();
      if (el) el.classList.remove('key-vessel-pulse');
    }
  }
};
LeafletGame.prototype.restoreAllShips = function() {
  for (const marker of Object.values(this._shipMarkers)) {
    marker.setOpacity(1.0);
    const el = marker.getElement && marker.getElement();
    if (el) el.classList.remove('key-vessel-pulse');
  }
};
```

- [ ] **Step 2: Add pulse CSS in `index.html`**

Inside `<style>`:
```css
@keyframes keyVesselPulse {
  0%, 100% { filter: drop-shadow(0 0 2px #ff8800); }
  50%      { filter: drop-shadow(0 0 12px #ff8800); }
}
.key-vessel-pulse { animation: keyVesselPulse 1.6s ease-in-out infinite; }
```

- [ ] **Step 3: Call from exercise UI**

In `src/exercise-ui.js` `startExercise()`, after setting `activeExercise`:
```javascript
if (window.gameInstance && activeExercise.scenario.keyVessels) {
  window.gameInstance.dimNonKeyShips(activeExercise.scenario.keyVessels);
  // zoom to bounding box of key vessels
  const keys = activeExercise.scenario.keyVessels
    .map(id => window.gameInstance._shipMarkers[id])
    .filter(Boolean);
  if (keys.length) {
    const bounds = L.latLngBounds(keys.map(m => m.getLatLng()));
    window.gameInstance._map.fitBounds(bounds, { padding:[60,60] });
  }
}
```
And in `endExercise()`:
```javascript
if (window.gameInstance) window.gameInstance.restoreAllShips();
```

(Note: `gameInstance` global may already exist; if not, expose it from leaflet-game.js setup.)

- [ ] **Step 4: Verify in browser**

Refresh, start SEIZURE. Map auto-zooms to key vessels. Other ships fade to ~25% opacity. Key vessels pulse. End exercise → all ships return to full opacity.

**Commit checkpoint:** "key-vessel isolation with pulse highlight"

---

## Task 10: Per-Vessel Impact Animations

**Files:**
- Modify: `src/animations.js` (expose named impact effects)
- Modify: `src/leaflet-game.js` (add `animateImpact(shipId, type)`)
- Modify: `src/scenarios.js` (per-decision optional `mapEffect` field)
- Modify: `src/exercise-ui.js` (trigger animation when decision applied)

- [ ] **Step 1: Add `animateImpact()` in `src/leaflet-game.js`**

```javascript
LeafletGame.prototype.animateImpact = function(shipId, type) {
  const marker = this._shipMarkers[shipId];
  if (!marker) return;
  const latlng = marker.getLatLng();
  const map = this._map;
  switch (type) {
    case 'STRIKE': {
      const explosion = L.divIcon({ className:'fx-explosion', html:'💥', iconSize:[64,64] });
      const fx = L.marker(latlng, { icon: explosion, interactive:false, zIndexOffset:1000 }).addTo(map);
      setTimeout(() => map.removeLayer(fx), 2200);
      const el = marker.getElement && marker.getElement();
      if (el) el.classList.add('damaged-hulk');
      break;
    }
    case 'SINKING': {
      const wreck = L.divIcon({ className:'fx-wreck', html:'⊗', iconSize:[28,28] });
      L.marker(latlng, { icon: wreck, interactive:false }).addTo(map);
      marker.setOpacity(0.0);
      break;
    }
    case 'BOARDED': {
      const el = marker.getElement && marker.getElement();
      if (el) el.classList.add('boarded-flash');
      break;
    }
    case 'MINED': {
      const ring = L.circle(latlng, { radius:1500, color:'#ff4400', weight:2, fillOpacity:0.2 }).addTo(map);
      setTimeout(() => map.removeLayer(ring), 3000);
      break;
    }
    case 'OIL_SLICK': {
      const slick = L.circle(latlng, { radius:5000, color:'#220011', weight:0, fillColor:'#000', fillOpacity:0.55 }).addTo(map);
      // (persist; do not clear)
      break;
    }
    case 'CONVOY_FORM': {
      const ring = L.circle(latlng, { radius:8000, color:'#0044aa', weight:2, dashArray:'6 4', fillOpacity:0 }).addTo(map);
      setTimeout(() => map.removeLayer(ring), 4000);
      break;
    }
    case 'TRANSIT_HALT': {
      const banner = document.createElement('div');
      banner.textContent = '⚠ STRAIT TRANSIT SUSPENDED';
      banner.style.cssText = 'position:absolute;top:80px;left:50%;transform:translateX(-50%);background:rgba(160,0,0,0.85);color:#fff;padding:8px 16px;letter-spacing:3px;z-index:500;font-family:monospace';
      document.getElementById('map').appendChild(banner);
      setTimeout(() => banner.remove(), 4500);
      break;
    }
    case 'PORT_EFFECT':
    case 'DISABLED':
    default: {
      const el = marker.getElement && marker.getElement();
      if (el) el.classList.add('disabled-ship');
      break;
    }
  }
};
```

- [ ] **Step 2: Add CSS for animation classes**

In `index.html` `<style>`:
```css
.damaged-hulk    { filter: grayscale(1) brightness(0.5); }
.boarded-flash   { animation: boardedFlash 0.6s 4 ease-in-out; }
.disabled-ship   { filter: hue-rotate(180deg) brightness(0.7); }
@keyframes boardedFlash { 0%,100% { filter: none; } 50% { filter: drop-shadow(0 0 12px #ff0000); } }
```

- [ ] **Step 3: Add `mapEffect` field to scenario decisions**

In `src/scenarios.js`, optionally add `mapEffect` to high-impact decisions. Example for SEIZURE Turn 4 MILITARY (VBSS executes):
```javascript
{ lane:'MILITARY', title:'Execute VBSS against GULF MERIDIAN now',
  assessment:'...',
  deltas:{...},
  mapEffect:{ shipId:'civ-meridian', type:'BOARDED' } },
```
Add `mapEffect` to other decisions where appropriate (CONVOY_FORM for "convoy escort" decision; TRANSIT_HALT if Tehran shuts traffic; OIL_SLICK on missile-strike scenarios).

- [ ] **Step 4: Trigger animation from `onDecisionPicked()`**

In `src/exercise-ui.js`:
```javascript
function onDecisionPicked(dec) {
  if (!activeExercise) return;
  if (dec.mapEffect && window.gameInstance) {
    window.gameInstance.animateImpact(dec.mapEffect.shipId, dec.mapEffect.type);
  }
  activeExercise.applyDecision(dec);
  if (activeExercise.complete) { renderAAR(); return; }
  renderActiveExercise();
}
```

- [ ] **Step 5: Verify in browser**

Refresh, start SEIZURE, advance to turn 4, pick MILITARY VBSS. Map should show "boarded flash" red drop-shadow on the target vessel. Test other animation types by adding `mapEffect` to other decisions and replaying.

**Commit checkpoint:** "per-vessel impact animations"

---

## Task 11: Add MINING + STRIKE Scenarios

**Files:**
- Modify: `src/scenarios.js` (append two scenarios)
- Modify: `tests/scenarios.test.js` (assert all three exist with 4 turns)

- [ ] **Step 1: Update test to expect 3 scenarios**

In `tests/scenarios.test.js` add:
```javascript
test('has SEIZURE, MINING, STRIKE scenarios', () => {
  assert.ok(getScenario('seizure'));
  assert.ok(getScenario('mining'));
  assert.ok(getScenario('strike'));
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/scenarios.test.js`
Expected: FAIL on the new test.

- [ ] **Step 3: Append MINING scenario to `SCENARIOS` array**

```javascript
{
  id: 'mining',
  title: 'LIMPET MINE STRIKE ON SAUDI CRUDE TANKER',
  rung: 'MINING',
  rungColor: '#ff7700',
  threat: 'CRITICAL',
  summary: 'A limpet mine has detonated below the waterline of the Saudi-flagged VLCC RAS TANURA II near Fujairah. The vessel is taking on water; crew has abandoned ship. Iran denies responsibility. CENTCOM divers recover one un-detonated mine — IRGC fingerprint is "very high confidence" but not yet public.',
  coverStory: '"Iran denies any role and suggests Israeli or third-party false-flag activity."',
  keyVessels: ['civ-rastanura','civ-uae-1','civ-blue-1'],
  initialIndicators: { escalationRung:3, oilPrice:91, warRiskInsurance:210, allianceCohesion:75, attributionConfidence:62, iranCoercion:46 },
  turns: [
    {
      inject: 'Brent has spiked $7 overnight. Lloyd\'s war-risk premium for strait transits has tripled. Riyadh demands U.S. action; UAE prefers de-escalation; the unexploded mine is en route to FBI lab for forensic analysis. CSIS publishes a thread arguing this is a deliberate ambiguity play.',
      decisions: [
        { lane:'DIPLOMATIC', title:'Public attribution release with forensic mine evidence',
          assessment:'Forensic evidence is released with imagery of the recovered mine — IRGC manufacturer markings are visible. Iranian denial collapses internationally. Coalition tightens. Domestic Iranian commentary becomes incoherent. Attribution confidence climbs sharply.',
          deltas:{ attributionConfidence:+18, allianceCohesion:+3, iranCoercion:+2 } },
        { lane:'INFORMATION', title:'Run cyber operation on IRGC naval logistics network',
          assessment:'Operation degrades IRGC mine-warfare command-and-control for 36 hours. Tehran cannot publicly attribute the attack but adapts within 4 days. The disruption window forces Iran to operate analog, slowing further mining ops.',
          deltas:{ iranCoercion:+5 } },
        { lane:'MILITARY', title:'Stand up multi-national mine-counter-measures task force',
          assessment:'CTF 152 expands to include UK, French, Australian MCM assets. Strait transits resume under MCM screen within 96 hours. Iran reads the move as containment but no further mining attempts. Insurance premiums begin to retrace.',
          deltas:{ warRiskInsurance:-30, oilPrice:-4, allianceCohesion:+4, iranCoercion:+3, mapEffect:'CONVOY_FORM' } },
        { lane:'ECONOMIC', title:'Coordinate massive SPR + IEA release (90M bbl)',
          assessment:'Brent retraces 6%. Markets read the joint commitment as durable. Strategic reserve is significantly depleted; future leverage is reduced. Saudi appreciation is real but partial — Riyadh wanted military response, not financial.',
          deltas:{ oilPrice:-9, allianceCohesion:+1 } },
        { lane:'INTELLIGENCE', title:'Live VLM analysis of mine forensics + Sentinel-2 IRGC base imagery',
          assessment:'Llama 3.2 Vision matches manufacturing markings on the recovered mine to imagery of IRGC depots at Bandar Abbas. Confidence is reportable but not chargeable. Provides the basis for the public attribution case in DIPLOMATIC.',
          deltas:{ attributionConfidence:+8 } },
      ],
      mapEffect:{ shipId:'civ-rastanura', type:'OIL_SLICK' },
    },
    {
      inject: 'A second limpet mine is found inert on a Greek-flagged tanker exiting the strait, suggesting an attempted but failed second attack. Iran offers "humanitarian assistance" with the Ras Tanura II salvage — a diplomatic taunt. Riyadh moves a destroyer toward the strait independently.',
      decisions: [
        { lane:'DIPLOMATIC', title:'Coordinate Saudi destroyer movement under Blue command',
          assessment:'Riyadh accepts CTF integration. Saudi DDG enters the multinational MCM task force. Coalition presence visibly grows. Tehran reads the integration as a threshold crossed — Saudi-U.S. military synchronization is now real.',
          deltas:{ allianceCohesion:+5, iranCoercion:+4 } },
        { lane:'INFORMATION', title:'Release intercepted IRGC communications about mining plan',
          assessment:'Communications published in cleaned form. Iran denies authenticity. Domestic Iranian skepticism of government denial deepens. Sources at risk; one collection method is burned. Coalition attribution case becomes airtight.',
          deltas:{ attributionConfidence:+10, iranCoercion:+3 } },
        { lane:'MILITARY', title:'Pre-emptive strike on identified IRGC mining staging area',
          assessment:'Tomahawks strike a coastal IRGC compound at night. 14 IRGC KIA, no civilian casualties. Iran retaliates by firing two ASCMs at a Western tanker in the strait 40 hours later. Exercise escalates to STRIKE rung. Crisis is no longer contained.',
          deltas:{ escalationRung:+1, iranCoercion:-2, allianceCohesion:+1, warRiskInsurance:+45, mapEffect:'STRIKE' } },
        { lane:'ECONOMIC', title:'Designate IRGC-N as Foreign Terrorist Organization',
          assessment:'OFAC adds IRGC-N to the FTO list. Material impact is symbolic; existing IRGC sanctions are already comprehensive. Iran responds with an asymmetric naval signal but no new mining. Domestic Iranian regime hardliners gain leverage.',
          deltas:{ iranCoercion:+1 } },
        { lane:'INTELLIGENCE', title:'Surge ISR over IRGC bases for forward posture monitoring',
          assessment:'Coverage catches a mid-week IRGC posture relaxation — mining operation is paused. Insurance markets tentatively recover. Without public release of the indication, allied policymakers cannot use the intel for deterrent signaling.',
          deltas:{ warRiskInsurance:-10, attributionConfidence:+2 } },
      ],
    },
    {
      inject: 'Insurance market is in chaos. Two major shipping lines have suspended Strait routing. Brent stays elevated. Tehran offers "regional dialogue" if all U.S. military assets withdraw to pre-crisis positions. Beijing publicly endorses the proposal. UN SecGen schedules emergency session.',
      decisions: [
        { lane:'DIPLOMATIC', title:'Reject Tehran offer; counter with conditional de-escalation framework',
          assessment:'Counter-offer: cessation of mining + crew of Ras Tanura II repatriated + IRGC public statement disavowing. Tehran refuses publicly but discreetly initiates Omani back-channel. Off-ramp is structurally available even as public posture stays hostile.',
          deltas:{ iranCoercion:-3, allianceCohesion:+2 } },
        { lane:'INFORMATION', title:'Saturate global media with VLM-verified mine forensics',
          assessment:'Coordinated information release: 12 major outlets receive briefing packages. Visual narrative becomes uncontested. Domestic Iranian elite signaling shifts. Beijing quietly distances. Tehran reads the information environment as adverse.',
          deltas:{ attributionConfidence:+12, iranCoercion:+2 } },
        { lane:'MILITARY', title:'Maintain MCM operations + escort tempo, no further strikes',
          assessment:'Coalition holds posture. Tehran calculates further mining is cost-ineffective given visible MCM coverage. Mining campaign quietly ends within 10 days. Crisis remains active but bounded. Throughput slowly recovers.',
          deltas:{ warRiskInsurance:-20, oilPrice:-4, iranCoercion:-3 } },
        { lane:'ECONOMIC', title:'Sanction Iranian crude buyers in third-country jurisdictions',
          assessment:'Secondary sanctions notices issued to Indian, Turkish, and PRC refiners taking Iranian crude. Iranian export volumes drop 12% within 30 days. Iran feels material economic pressure but reads the move as Blue overreach.',
          deltas:{ iranCoercion:+3 } },
        { lane:'INTELLIGENCE', title:'Run RAG-augmented INTEL CHAT briefing for principals',
          assessment:'INTEL CHAT pulls JP 3-32 + CSIS Hormuz analyses + ACLED recent regional events into a synthesized brief for principals. Decision quality improves. (Demo touchpoint — INTEL CHAT used in real time.)',
          deltas:{ attributionConfidence:+3 } },
        ],
    },
    {
      inject: 'Mining campaign appears to have ended. Tehran wants visible Blue concessions to declare victory. Coalition is unified but stretched. Allied capitals want the off-ramp. Riyadh wants a permanent presence. Domestic Iranian regime needs a face-saver.',
      decisions: [
        { lane:'DIPLOMATIC', title:'Public crisis resolution agreement via Oman + UAE mediation',
          assessment:'Agreement: Iran disavows mining campaign; Blue draws down by 30% over 60 days; freedom of navigation reaffirmed. Crisis resolves at MINING rung without further escalation. Both sides claim partial victory.',
          deltas:{ iranCoercion:-5, allianceCohesion:+3, warRiskInsurance:-50, oilPrice:-6 } },
        { lane:'INFORMATION', title:'Maintain attribution case publicly indefinitely',
          assessment:'Tehran cannot rebuild operational legitimacy in the strait. Mining stays off the table for 18+ months. Crisis fades but no formal closure — ambiguity persists. Insurance recovery is slow.',
          deltas:{ iranCoercion:-2, allianceCohesion:+2, warRiskInsurance:-25 } },
        { lane:'MILITARY', title:'Establish permanent MCM forward presence at Fujairah',
          assessment:'Multi-national MCM presence formalized. Iran reads the presence as containment infrastructure. Saudi-UAE-U.S. trilateral defense cooperation deepens. Long-term Iranian deterrent posture in the strait shifts adversely.',
          deltas:{ iranCoercion:-6, allianceCohesion:+5, warRiskInsurance:-40 } },
        { lane:'ECONOMIC', title:'Permanent Lloyd\'s war-risk backstop with cost-share to Gulf partners',
          assessment:'Insurance backstop becomes structural. Strait commercial risk is institutionally absorbed. Iran loses the insurance lever for future coercion. Treasury exposure is durable but defined.',
          deltas:{ iranCoercion:-4, warRiskInsurance:-60, oilPrice:-3 } },
        { lane:'INTELLIGENCE', title:'Continue ISR posture; classified after-action with allies',
          assessment:'Crisis fades. Allied IC partnerships strengthen. Public closure absent. Iran reconsiders mine warfare doctrine but does not abandon it. Crisis is paused, not concluded.',
          deltas:{ allianceCohesion:+2, warRiskInsurance:-15 } },
      ],
    },
  ],
},
```

- [ ] **Step 4: Append STRIKE scenario**

Same pattern. Title: "ANTI-SHIP MISSILE SALVO ON US-FLAGGED TANKER". Rung: STRIKE. rungColor: `#cc2222`. Threat: CRITICAL. Initial indicators: escalationRung 4, oilPrice 102, warRiskInsurance 350, allianceCohesion 80, attributionConfidence 92, iranCoercion 58. Write 4 turns × 5 decisions following same conventions. Use `mapEffect:{ shipId, type:'STRIKE' }` on Turn 1. Decisions span CINDER ESCALATION → TIT-FOR-TAT vs DETERRENT-RESTORE-FOOTING.

- [ ] **Step 5: Run tests**

Run: `node --test tests/scenarios.test.js`
Expected: all tests pass.

- [ ] **Step 6: Verify in browser**

Refresh. EXERCISE tab now shows 3 scenario cards in different colors. Each is playable end-to-end.

**Commit checkpoint:** "add MINING + STRIKE scenarios"

---

## Task 12: After-Action Review (AAR) Screen

**Files:**
- Modify: `src/exercise-ui.js` (proper AAR rendering replacing placeholder)

- [ ] **Step 1: Replace `renderAAR()` with full implementation**

```javascript
function renderAAR() {
  if (!activeExercise) return;
  const ex = activeExercise;
  const ind0 = ex.scenario.initialIndicators;
  const indN = ex.indicators;
  const indKeys = Object.keys(ind0);

  document.getElementById('exercise-decisions').innerHTML = '';
  document.getElementById('exercise-brief').innerHTML = `
    <div style="color:#00ff88;font-size:14px;letter-spacing:2px;margin-bottom:6px">✓ EXERCISE COMPLETE</div>
    <div style="color:#a0b0c0;font-size:11px">${ex.scenario.title}</div>`;

  const body = document.getElementById('exercise-overlay-body');
  const timelineHtml = ex.sitrep.map(s => `
    <div style="border-left:2px solid #00ff8855;padding:5px 10px;margin-bottom:4px">
      <div style="color:#00ff88;font-size:10px;letter-spacing:2px">T${s.turn} · ${s.lane}</div>
      <div style="color:#e0e8f0;font-size:11px">${s.title}</div>
    </div>`).join('');

  const indicatorHtml = indKeys.map(k => {
    const before = ind0[k];
    const after = indN[k];
    const delta = after - before;
    const sign = delta > 0 ? '+' : '';
    const color = delta > 0 ? '#ff8888' : delta < 0 ? '#88ff88' : '#888';
    return `<div style="display:flex;justify-content:space-between;font-size:11px;padding:3px 0">
      <span style="color:#a0b0c0">${k}</span>
      <span style="color:#e0e8f0;font-family:monospace">${before} → ${after} <span style="color:${color}">(${sign}${delta})</span></span>
    </div>`;
  }).join('');

  body.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      <div>
        <div style="color:#00ff88;font-size:10px;letter-spacing:2px;margin-bottom:6px">// DECISION TIMELINE //</div>
        ${timelineHtml}
      </div>
      <div>
        <div style="color:#00ff88;font-size:10px;letter-spacing:2px;margin-bottom:6px">// INDICATOR DELTAS //</div>
        <div style="border:1px solid #00ff8833;padding:8px 12px;background:rgba(0,30,15,0.4)">${indicatorHtml}</div>
        <button id="aar-restart-btn" style="margin-top:14px;width:100%;padding:8px;background:rgba(0,255,136,0.1);color:#00ff88;border:1px solid #00ff8866;cursor:pointer;font-family:inherit;font-size:11px;letter-spacing:2px">▶ NEW EXERCISE</button>
      </div>
    </div>`;
  const restart = document.getElementById('aar-restart-btn');
  if (restart) restart.addEventListener('click', endExercise);
  renderIndicators();
}
```

- [ ] **Step 2: Verify in browser**

Refresh, run a scenario to completion. Bottom overlay shows side-by-side: decision timeline (left) + indicator deltas with red/green deltas (right) + "NEW EXERCISE" button. Click button → returns to scenario picker.

**Commit checkpoint:** "AAR end screen with timeline + indicator deltas"

---

# PHASE 4 — DATA INTEGRATIONS (each task is independent; cut any if time is short)

## Task 13: OSM Infrastructure Layer

**Files:**
- Create: `src/osm-layer.js`
- Modify: `index.html` (add layer toggle button to map controls)

- [ ] **Step 1: Implement Overpass query in `src/osm-layer.js`**

```javascript
const OVERPASS_QUERY = `
  [out:json][timeout:25];
  (
    node["harbour"="yes"](22,47,30,58);
    node["amenity"="ferry_terminal"](22,47,30,58);
    node["man_made"="petroleum_well"](22,47,30,58);
    node["industrial"="oil"](22,47,30,58);
    node["aeroway"="aerodrome"](22,47,30,58);
    way["industrial"="refinery"](22,47,30,58);
  );
  out center;
`;
let osmLayerGroup = null;

async function loadOSMInfrastructure(map) {
  if (osmLayerGroup) { osmLayerGroup.addTo(map); return; }
  const url = 'https://overpass-api.de/api/interpreter';
  const resp = await fetch(url, { method:'POST', body:'data='+encodeURIComponent(OVERPASS_QUERY) });
  if (!resp.ok) { console.warn('Overpass failed', resp.status); return; }
  const data = await resp.json();
  osmLayerGroup = L.layerGroup();
  for (const el of data.elements) {
    const lat = el.lat || (el.center && el.center.lat);
    const lng = el.lon || (el.center && el.center.lon);
    if (!lat) continue;
    const tag = el.tags || {};
    let icon = '⚓'; let color = '#66ccff';
    if (tag.aeroway) { icon='✈'; color='#ffcc66'; }
    else if (tag.industrial === 'refinery' || tag.industrial === 'oil') { icon='⛽'; color='#ff8800'; }
    const m = L.marker([lat,lng], {
      icon: L.divIcon({ className:'osm-marker', html:`<div style="color:${color};font-size:18px;text-shadow:0 0 4px #000">${icon}</div>`, iconSize:[24,24] })
    });
    m.bindPopup(`<b>${tag.name || '(unnamed)'}</b><br><small>${Object.entries(tag).slice(0,4).map(([k,v])=>k+'='+v).join(' · ')}</small>`);
    osmLayerGroup.addLayer(m);
  }
  osmLayerGroup.addTo(map);
}

function hideOSMLayer(map) {
  if (osmLayerGroup) map.removeLayer(osmLayerGroup);
}

window.loadOSMInfrastructure = loadOSMInfrastructure;
window.hideOSMLayer = hideOSMLayer;
```

- [ ] **Step 2: Add toggle button + wire**

In `index.html` find existing map controls (paint toolbar etc.) and add:
```html
<button id="btn-osm-layer" style="background:rgba(0,8,16,0.85);color:#66ccff;border:1px solid #66ccff66;padding:6px 10px;cursor:pointer;font-family:'Courier New',monospace;font-size:11px;letter-spacing:1px">⚓ INFRASTRUCTURE</button>
```

In `src/main.js`:
```javascript
let osmShown = false;
document.getElementById('btn-osm-layer').addEventListener('click', async () => {
  osmShown = !osmShown;
  const btn = document.getElementById('btn-osm-layer');
  if (osmShown) {
    btn.textContent = '⚓ INFRASTRUCTURE ✓';
    await loadOSMInfrastructure(window.gameInstance._map);
  } else {
    btn.textContent = '⚓ INFRASTRUCTURE';
    hideOSMLayer(window.gameInstance._map);
  }
});
```

Add script tag for `osm-layer.js` in `index.html`.

- [ ] **Step 3: Verify in browser**

Refresh. Click ⚓ INFRASTRUCTURE button. Within ~5s, Persian Gulf ports / refineries / airports appear as colored icons. Click again to hide. Click an icon → popup shows OSM tag data.

**Commit checkpoint:** "OSM infrastructure layer toggle"

---

## Task 14: ACLED Regional Intel Feed

**Files:**
- Create: `src/acled-feed.js`
- Modify: `index.html` (add ACLED widget container)

- [ ] **Step 1: Get ACLED API key**

ACLED requires registration: https://developer.acleddata.com/. Once you have the key + email:
- Save as `ACLED_KEY` and `ACLED_EMAIL` env vars OR hardcode in `src/acled-feed.js` (acceptable for hackathon).

- [ ] **Step 2: Implement client in `src/acled-feed.js`**

```javascript
const ACLED_KEY = 'YOUR_KEY_HERE';
const ACLED_EMAIL = 'YOUR_EMAIL_HERE';

async function fetchACLEDGulf() {
  // Filter: bounding box around the strait + last 90 days
  const today = new Date();
  const start = new Date(today.getTime() - 90*86400e3).toISOString().slice(0,10);
  const url = `https://api.acleddata.com/acled/read?key=${ACLED_KEY}&email=${encodeURIComponent(ACLED_EMAIL)}&country=Iran|Iraq|Saudi%20Arabia|Yemen|United%20Arab%20Emirates|Qatar|Kuwait|Oman|Bahrain&event_date=${start}|${today.toISOString().slice(0,10)}&event_date_where=BETWEEN&limit=20`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error('ACLED ' + resp.status);
  const data = await resp.json();
  return data.data || [];
}

async function renderACLEDFeed() {
  const container = document.getElementById('acled-feed');
  if (!container) return;
  container.innerHTML = '<div style="color:#7a8896;font-size:11px">Loading regional intel…</div>';
  try {
    const events = await fetchACLEDGulf();
    container.innerHTML = `
      <div style="color:#ff8800;font-size:10px;letter-spacing:2px;margin-bottom:6px">// REGIONAL ACTIVITY (LAST 90 DAYS) //</div>
      ${events.map(e => `
        <div style="border-left:2px solid #ff660033;padding:4px 10px;margin-bottom:4px;font-size:11px">
          <div style="color:#a0b0c0">${e.event_date} · ${e.country} · ${e.event_type}</div>
          <div style="color:#e0e8f0;line-height:1.4">${e.notes ? e.notes.substring(0,140)+'…' : ''}</div>
        </div>`).join('')}`;
  } catch (e) {
    container.innerHTML = `<div style="color:#ff6666;font-size:11px">ACLED feed unavailable: ${e.message}</div>`;
  }
}

window.renderACLEDFeed = renderACLEDFeed;
```

- [ ] **Step 3: Add widget container in EXERCISE tab body**

In `index.html` inside `#exercise-tab-body`:
```html
<div id="acled-feed" style="margin-top:14px;border-top:1px solid #ff660033;padding-top:10px"></div>
```

In `src/main.js` DOMContentLoaded:
```javascript
if (typeof renderACLEDFeed === 'function') renderACLEDFeed();
```

Add script tag for `acled-feed.js`.

- [ ] **Step 4: Verify in browser**

Refresh. EXERCISE tab now shows ACLED feed at bottom with recent Gulf incidents. If the API key is missing or rate-limited, error message appears (graceful failure).

**Commit checkpoint:** "ACLED regional intel feed"

---

## Task 15: Ingest JCS + CSIS Docs into RAG

**Files:**
- Create: `api/rag/jcs_doctrine/` (directory; drop PDFs)
- Create: `api/rag/csis/` (directory; drop PDFs)
- Modify: `api/server.py` (re-run ingest on next startup)

- [ ] **Step 1: Locate the existing ingest script**

In the project, find how the current RAG corpus is loaded. Likely a script in `api/` that walks a folder and adds documents to ChromaDB. If unsure run:
```bash
grep -rn "chromadb\|add_documents\|persist_directory" "C:/Users/cmcdo/Documents/GitHub/strait-of-consequences/api/"
```

- [ ] **Step 2: Download source PDFs**

JCS Doctrine (free, public):
- JP 3-0 Joint Operations: https://www.jcs.mil/Portals/36/Documents/Doctrine/pubs/jp3_0.pdf
- JP 5-0 Joint Planning: https://www.jcs.mil/Portals/36/Documents/Doctrine/pubs/jp5_0.pdf
- JP 3-32 Maritime Operations: https://www.jcs.mil/Portals/36/Documents/Doctrine/pubs/jp3_32.pdf

CSIS (free, public):
- Search csis.org for "Hormuz wargame" and "Iran A2/AD". Save the PDFs.

Place all in `api/rag/jcs_doctrine/` and `api/rag/csis/` respectively.

- [ ] **Step 3: Re-run RAG ingest**

Run the existing ingest command (the script you found in Step 1). Verify ChromaDB count increased:
```bash
python -c "import chromadb; c = chromadb.PersistentClient(path='api/intel_db'); print(c.get_collection('intel').count())"
```

- [ ] **Step 4: Verify in browser**

Restart backend. Open INTEL CHAT tab. Ask "What does JP 3-0 say about phase IV stabilization?" Response should quote actual JP 3-0 content.

**Commit checkpoint:** "ingest JCS doctrine + CSIS analyses into RAG"

---

## Task 16: Red Cell AI Roleplay (Per-Turn Ollama Generation)

**Files:**
- Create: `api/red_cell.py`
- Modify: `api/server.py` (register router)
- Modify: `src/exercise-ui.js` (call Red Cell endpoint between turns)

- [ ] **Step 1: Create FastAPI endpoint `api/red_cell.py`**

```python
from fastapi import APIRouter
from pydantic import BaseModel
import os, httpx

router = APIRouter()
OLLAMA_URL = os.environ.get('OLLAMA_URL', 'http://localhost:11434')
MODEL = os.environ.get('RED_CELL_MODEL', 'llama3.1:8b')

class RedCellReq(BaseModel):
    scenario_id: str
    turn: int
    last_blue_decision: str | None = None
    indicator_state: dict
    scripted_inject: str

@router.post('/red_cell/narrate')
async def narrate(req: RedCellReq):
    sys = (
        "You are the IRGC Red Cell narrator for a Hormuz wargame exercise. "
        "Given the scripted inject and Blue's last decision, produce a SHORT (3-4 sentences) "
        "Red Cell perspective on what Tehran will do next. Match the doctrinal style of CSIS and "
        "RAND red-cell papers. Do NOT exceed 4 sentences."
    )
    user = (
        f"Scenario: {req.scenario_id} · Turn {req.turn}\n"
        f"Scripted inject: {req.scripted_inject}\n"
        f"Last Blue decision: {req.last_blue_decision or '(none yet)'}\n"
        f"Indicators: {req.indicator_state}\n\n"
        "Red Cell narration (3-4 sentences):"
    )
    async with httpx.AsyncClient(timeout=30) as cli:
        r = await cli.post(f'{OLLAMA_URL}/api/chat', json={
            'model': MODEL, 'stream': False,
            'messages': [
                {'role':'system','content':sys},
                {'role':'user','content':user},
            ],
        })
    out = r.json()
    return { 'narration': out.get('message',{}).get('content','') }
```

- [ ] **Step 2: Register router in `api/server.py`**

```python
from red_cell import router as red_cell_router
app.include_router(red_cell_router)
```

- [ ] **Step 3: Call from frontend**

In `src/exercise-ui.js`, after `applyDecision()` and before `renderActiveExercise()`:
```javascript
async function maybeFetchRedCell() {
  if (!activeExercise || activeExercise.complete) return;
  const ex = activeExercise;
  try {
    const resp = await fetch('http://localhost:8000/red_cell/narrate', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        scenario_id: ex.scenario.id,
        turn: ex.turn,
        last_blue_decision: ex.decisionHistory.at(-1)?.title || null,
        indicator_state: ex.indicators,
        scripted_inject: ex.currentTurn().inject,
      }),
    });
    if (!resp.ok) return;
    const data = await resp.json();
    if (data.narration) {
      document.getElementById('exercise-brief').innerHTML += `
        <div style="margin-top:8px;border-top:1px dashed #ff666633;padding-top:8px">
          <div style="color:#ff6666;font-size:9px;letter-spacing:2px;margin-bottom:3px">// RED CELL — LIVE //</div>
          <div style="color:#ffaaaa;font-size:11px;line-height:1.5;font-style:italic">${data.narration}</div>
        </div>`;
    }
  } catch (e) { console.warn('Red Cell fetch failed', e); }
}
```
Then in `renderActiveExercise()` add `maybeFetchRedCell();` at the end.

- [ ] **Step 4: Restart backend, verify in browser**

```bash
# stop old uvicorn, restart
```
Refresh, start any scenario. After picking a decision, the new turn's brief should append a "RED CELL — LIVE" box with 3-4 sentences generated by Ollama.

**Commit checkpoint:** "Red Cell AI live narration via Ollama"

---

## Task 17: VLM Tie-In on Strike Events

**Files:**
- Modify: `src/exercise-ui.js` (after high-impact decision, run VLM on Sentinel-2)

- [ ] **Step 1: Identify existing Sentinel-2 + VLM pipeline**

Find existing functions in `src/main.js` (or related) that capture Sentinel-2 imagery + run VLM analysis. They were used by the SAT BOX painting feature. Likely named like `runVLMAnalysis()` or similar. If unsure:
```bash
grep -rn "vision\|VLM\|sentinel\|llama3.2-vision" "C:/Users/cmcdo/Documents/GitHub/strait-of-consequences/src/"
```

- [ ] **Step 2: Wire to high-impact mapEffects**

In `src/exercise-ui.js`, in `onDecisionPicked()`:
```javascript
async function onDecisionPicked(dec) {
  if (!activeExercise) return;
  if (dec.mapEffect && window.gameInstance) {
    window.gameInstance.animateImpact(dec.mapEffect.shipId, dec.mapEffect.type);
    if (['STRIKE','MINED','OIL_SLICK'].includes(dec.mapEffect.type)) {
      // Auto-VLM
      const marker = window.gameInstance._shipMarkers[dec.mapEffect.shipId];
      if (marker && typeof window.runVLMAnalysisAtLatLng === 'function') {
        const ll = marker.getLatLng();
        const result = await window.runVLMAnalysisAtLatLng(ll.lat, ll.lng);
        if (result) {
          const sitrepEntry = document.querySelector('#exercise-overlay-body > div:last-child');
          if (sitrepEntry) {
            sitrepEntry.innerHTML += `
              <div style="margin-top:6px;padding:6px 8px;background:rgba(102,255,153,0.05);border-left:2px solid #66ff99">
                <div style="color:#66ff99;font-size:9px;letter-spacing:2px">// VLM ANALYSIS · LLAMA 3.2 VISION //</div>
                <div style="color:#ccffd9;font-size:11px;line-height:1.5">${result}</div>
              </div>`;
          }
        }
      }
    }
  }
  activeExercise.applyDecision(dec);
  if (activeExercise.complete) { renderAAR(); return; }
  renderActiveExercise();
}
```
You may need to expose `runVLMAnalysisAtLatLng()` from existing code (small refactor — wrap the existing painted-box flow to accept programmatic lat/lng).

- [ ] **Step 3: Verify in browser**

Trigger a STRIKE or MINED scenario decision. After animation, sitrep entry shows VLM analysis output below the assessment text.

**Commit checkpoint:** "auto-VLM on strike events"

---

# DONE CRITERIA

**Demoable v1 (end of Phase 3):**
- [ ] EXERCISE tab replaces WARGAME tab
- [ ] 3 scenarios (SEIZURE / MINING / STRIKE), each playable end-to-end
- [ ] DIME+ decisions update sitrep + indicators per turn
- [ ] Ship expand-arrow shows actor taxonomy
- [ ] Key-vessel isolation + map zoom on scenario start
- [ ] Per-vessel impact animations on `mapEffect` decisions
- [ ] AAR end screen with timeline + indicator deltas
- [ ] All unit tests pass: `node --test tests/`

**Full v1 (end of Phase 4):**
- [ ] OSM Infrastructure layer toggle
- [ ] ACLED feed in EXERCISE tab
- [ ] JCS + CSIS in RAG corpus (verifiable via INTEL CHAT)
- [ ] Red Cell live narration appears after each turn
- [ ] VLM auto-analysis on STRIKE/MINED/OIL_SLICK events

---

# RISKS / WATCH-OUTS

1. **Frontend script load order** — `ship-taxonomy.js` and `scenarios.js` must load BEFORE `exercise.js`, which must load BEFORE `exercise-ui.js`, which must load BEFORE `main.js`. Verify in `index.html`.
2. **Existing CIVILIAN_SHIPS ids** — scenarios reference ship ids; either use the existing ids or rename ships in CIVILIAN_SHIPS to match scenario `keyVessels` arrays.
3. **ACLED API key** — required for live feed. If unavailable at demo time, hardcode a 5-incident fallback array in `acled-feed.js` so the widget still shows something.
4. **Ollama Red Cell latency** — Red Cell endpoint may take 4-10 sec per turn. UI should NOT block. Implement as fire-and-forget that appends to brief when it returns.
5. **VLM tie-in needs existing Sentinel-2 wrapper** — if the existing function isn't trivially refactorable, defer Task 17 to v2.
6. **Browser cache** — every scenarios.js / exercise.js change may need Ctrl+F5 to defeat browser cache during testing.

---

# EXECUTION

Plan complete. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using `executing-plans` skill, batch with checkpoints.

Which approach?
