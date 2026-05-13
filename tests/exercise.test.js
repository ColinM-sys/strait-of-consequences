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

test('throws on unknown scenario', () => {
  assert.throws(() => new ExerciseState('does-not-exist'), /unknown scenario/);
});
