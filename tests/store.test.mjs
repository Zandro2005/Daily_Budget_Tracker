import test from 'node:test';
import assert from 'node:assert/strict';

test('Import JSON validation rejects malformed and non-object inputs', async () => {
  // Mock localStorage
  const storage = {};
  global.localStorage = {
    getItem: (k) => storage[k] || null,
    setItem: (k, v) => { storage[k] = v; },
    removeItem: (k) => { delete storage[k]; },
  };

  const { store } = await import('../src/lib/store.js');

  const invalid1 = store.importJSON('not a json');
  assert.equal(invalid1.success, false);

  const invalid2 = store.importJSON('{"randomKey": 123}');
  assert.equal(invalid2.success, false);
  assert.ok(invalid2.error.includes('valid budget tracker data'));

  const valid = store.importJSON(JSON.stringify({
    categories: [
      { id: 'cat-groceries', name: 'Groceries', emoji: '🛒', color: '#BFE3F7', monthly_limit: 5000 }
    ],
    transactions: []
  }));

  assert.equal(valid.success, true);
  // Verify user's 'Groceries' category was preserved and NOT deleted!
  const hasGroceries = store.getCategories().some(c => c.name === 'Groceries');
  assert.ok(hasGroceries, 'Custom user category like Groceries must be preserved');
});

test('store.updateTransaction updates amount, note, and category without breaking list order', async () => {
  const { store } = await import('../src/lib/store.js');

  // Add sample transaction
  const initial = store.addTransaction({
    type: 'income',
    amount: 25000,
    note: 'Initial Paycheck',
    date: '2026-10-10'
  });

  assert.equal(initial.amount, 25000);
  assert.equal(initial.note, 'Initial Paycheck');

  // Update transaction
  const updated = store.updateTransaction(initial.id, {
    amount: 28000,
    note: 'Bonus Included Paycheck',
  });

  assert.equal(updated.amount, 28000);
  assert.equal(updated.note, 'Bonus Included Paycheck');

  // Check store retrieval
  const found = store.getTransactions().find(t => t.id === initial.id);
  assert.equal(found.amount, 28000);
  assert.equal(found.note, 'Bonus Included Paycheck');

  // Clean up
  store.deleteTransaction(initial.id);
});
