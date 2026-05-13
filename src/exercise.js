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
