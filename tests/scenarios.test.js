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

test('has SEIZURE, MINING, STRIKE, AIRBASE scenarios with 4 turns each', () => {
  for (const id of ['seizure', 'mining', 'strike', 'airbase']) {
    const s = getScenario(id);
    assert.ok(s, `scenario ${id} missing`);
    assert.strictEqual(s.turns.length, 4, `${id} should have 4 turns`);
    for (const turn of s.turns) {
      assert.strictEqual(turn.decisions.length, 5, `${id} turn missing decisions`);
      const lanes = turn.decisions.map(d => d.lane).sort();
      assert.deepStrictEqual(
        lanes,
        ['DIPLOMATIC','ECONOMIC','INFORMATION','INTELLIGENCE','MILITARY'],
        `${id} turn lanes wrong`
      );
    }
  }
});
