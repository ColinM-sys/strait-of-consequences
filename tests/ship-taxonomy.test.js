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
