const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../lib/shared.js');
const { createStore } = require('../lib/store.js');

function createFakeArea(initial = {}) {
  const data = JSON.parse(JSON.stringify(initial));
  return {
    _data: data,
    async get(keys) {
      if (keys === null) return JSON.parse(JSON.stringify(data));
      const res = {};
      const arr = Array.isArray(keys) ? keys : [keys];
      arr.forEach(k => { if (k in data) res[k] = JSON.parse(JSON.stringify(data[k])); });
      return res;
    },
    async set(obj) {
      Object.assign(data, JSON.parse(JSON.stringify(obj)));
    },
    async getBytesInUse() {
      return Buffer.byteLength(JSON.stringify(data), 'utf8');
    }
  };
}

test('shared: escapeHtml sanitizes dangerous chars', () => {
  assert.equal(S.escapeHtml('<script>"x" & \'y\'</script>'), '&lt;script&gt;&quot;x&quot; &amp; &#039;y&#039;&lt;/script&gt;');
});

test('shared: isValidHexColor & safeColor', () => {
  assert.equal(S.isValidHexColor('#00f0ff'), true);
  assert.equal(S.isValidHexColor('#00F0FF'), true);
  assert.equal(S.isValidHexColor('red'), false);
  assert.equal(S.isValidHexColor('javascript:'), false);
  assert.equal(S.isValidHexColor('#12345'), false);
  assert.equal(S.safeColor('bad', '#FCEE0A'), '#FCEE0A');
  assert.equal(S.safeColor('#00f0ff'), '#00F0FF');
});

test('shared: sanitizeRecord blocks invalid or dangerous input', () => {
  const bad = S.sanitizeRecord({
    content: '<script>alert(1)</script>',
    url: 'javascript:alert(1)',
    color: '"; background: red;',
    tags: ['<img src=x>', 'dev', 'A'.repeat(50)],
    type: 'MALICIOUS'
  });
  assert.equal(bad.type, 'SNIPPET');
  assert.equal(bad.url, ''); // javascript: dropped
  assert.equal(bad.color, '#FCEE0A'); // bad hex replaced
  assert.equal(bad.tags[0], '_IMG_SRC_X_');
  assert.equal(bad.tags[1], 'DEV');
  assert.equal(bad.tags[2].length <= 32, true);
});

test('shared: isHostBlocked supports subdomains', () => {
  const blocked = ['facebook.com', 'internal.corp'];
  assert.equal(S.isHostBlocked('facebook.com', blocked), true);
  assert.equal(S.isHostBlocked('m.facebook.com', blocked), true);
  assert.equal(S.isHostBlocked('www.facebook.com', blocked), true);
  assert.equal(S.isHostBlocked('google.com', blocked), false);
});

test('store: serializes 50 concurrent saves without race conditions', async () => {
  const area = createFakeArea({ [S.STORAGE_KEY]: [] });
  const store = createStore(area);

  const promises = [];
  for (let i = 0; i < 50; i++) {
    promises.push(store.add({
      content: `Snippet #${i}`,
      url: `https://example.com/p/${i}`,
      color: '#00F0FF',
      note: `Note #${i}`
    }));
  }
  const results = await Promise.all(promises);
  assert.equal(results.every(r => r.ok), true);

  const all = await store.getAll();
  assert.equal(all.length, 50);
});

test('store: dedupe blocks duplicate clips on same page', async () => {
  const area = createFakeArea({ [S.STORAGE_KEY]: [] });
  const store = createStore(area);

  const r1 = await store.add({ content: 'Hello world', url: 'https://example.com/a', note: '' });
  assert.equal(r1.ok, true);

  const r2 = await store.add({ content: 'Hello world', url: 'https://example.com/a', note: '' });
  assert.equal(r2.ok, false);
  assert.equal(r2.error, 'DUPLICATE');

  // Same content on a different page is allowed
  const r3 = await store.add({ content: 'Hello world', url: 'https://example.com/b', note: '' });
  assert.equal(r3.ok, true);
});

test('store: purge preserves favorites by default', async () => {
  const area = createFakeArea({
    [S.STORAGE_KEY]: [
      { id: '1', content: 'Normal 1', favorite: false, timestamp: 1 },
      { id: '2', content: 'Fav 1', favorite: true, timestamp: 2 },
      { id: '3', content: 'Normal 2', favorite: false, timestamp: 3 },
      { id: '4', content: 'Fav 2', favorite: true, timestamp: 4 }
    ]
  });
  const store = createStore(area);

  const res = await store.purge(false);
  assert.equal(res.purged, 2);
  assert.equal(res.kept, 2);

  const remaining = await store.getAll();
  assert.equal(remaining.length, 2);
  assert.equal(remaining.every(r => r.favorite), true);
});

test('store: restore brings back deleted records (undo)', async () => {
  const area = createFakeArea({
    [S.STORAGE_KEY]: [
      { id: '1', content: 'A', timestamp: 10 },
      { id: '2', content: 'B', timestamp: 20 }
    ]
  });
  const store = createStore(area);

  const del = await store.remove(['1']);
  assert.equal(del.removed.length, 1);
  assert.equal((await store.getAll()).length, 1);

  await store.restore(del.removed);
  const after = await store.getAll();
  assert.equal(after.length, 2);
  assert.equal(after.some(r => r.id === '1'), true);
});

test('store: migration strips unedited seed records', async () => {
  const area = createFakeArea({
    [S.STORAGE_KEY]: [
      { id: 'seed_01', content: 'Seed 1', timestamp: 1 },
      { id: 'seed_02', content: 'Seed 2', timestamp: 2, edited: Date.now() }, // edited: keep
      { id: 'custom_01', content: 'My custom clip', url: 'https://test.com', timestamp: 3 }
    ]
  });
  const store = createStore(area);
  const res = await store.migrate();
  assert.equal(res.migrated, true);
  assert.equal(res.removedSeeds, 1);

  const all = await store.getAll();
  assert.equal(all.length, 2);
  assert.equal(all.some(r => r.id === 'seed_01'), false);
  assert.equal(all.some(r => r.id === 'seed_02'), true);
  assert.equal(all.some(r => r.id === 'custom_01'), true);
});
