/**
 * CYBERCLIP // STORAGE ENGINE (lib/store.js)
 * Único escritor: todas las operaciones pasan por una cola serializada,
 * evitando condiciones de carrera entre popup, content scripts y menús.
 * `area` debe implementar get(keys), set(obj) y opcionalmente getBytesInUse(keys).
 */
(function (root, factory) {
  const api = factory(root.CyberClipShared || (typeof require === 'function' ? require('./shared.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.CyberClipStore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (S) {
  'use strict';

  function createStore(area) {
    let queue = Promise.resolve();
    const run = (fn) => {
      const p = queue.then(fn, fn);
      queue = p.catch(() => {});
      return p;
    };

    async function readList() {
      const d = await area.get([S.STORAGE_KEY]);
      return Array.isArray(d[S.STORAGE_KEY]) ? d[S.STORAGE_KEY] : [];
    }

    async function usedBytes() {
      if (typeof area.getBytesInUse === 'function') {
        try { return await area.getBytesInUse(null); } catch (e) { /* fallthrough */ }
      }
      const all = await area.get(null);
      return S.byteSize(all || {});
    }

    async function write(list) {
      await area.set({ [S.STORAGE_KEY]: list });
      return list;
    }

    async function getSettings() {
      const d = await area.get([S.SETTINGS_KEY]);
      return S.sanitizeSettings(d[S.SETTINGS_KEY]);
    }

    return {
      getAll: () => run(readList),
      getSettings: () => run(getSettings),
      usage: () => run(async () => ({ bytes: await usedBytes(), max: S.MAX_STORAGE_BYTES })),

      saveSettings: (patch) => run(async () => {
        const cur = await getSettings();
        const next = S.sanitizeSettings(Object.assign({}, cur, patch));
        await area.set({ [S.SETTINGS_KEY]: next });
        return next;
      }),

      add: (raw) => run(async () => {
        const rec = S.sanitizeRecord(raw);
        if (!rec) return { ok: false, error: 'INVALID' };
        const list = await readList();
        const settings = await getSettings();
        if (settings.dedupe && S.isDuplicate(list, rec)) return { ok: false, error: 'DUPLICATE' };
        if (list.some(r => r.id === rec.id)) rec.id = S.makeId('clip');
        const bytes = await usedBytes();
        if (bytes + S.byteSize(rec) > S.MAX_STORAGE_BYTES) return { ok: false, error: 'QUOTA_EXCEEDED' };
        list.unshift(rec);
        await write(list);
        return { ok: true, record: rec, count: list.length };
      }),

      update: (id, patch) => run(async () => {
        const list = await readList();
        const i = list.findIndex(r => r.id === id);
        if (i < 0) return { ok: false, error: 'NOT_FOUND' };
        const allowed = {};
        ['content', 'note', 'tags', 'color', 'favorite'].forEach(k => { if (k in (patch || {})) allowed[k] = patch[k]; });
        const merged = S.sanitizeRecord(Object.assign({}, list[i], allowed, { id: list[i].id }));
        if (!merged) return { ok: false, error: 'INVALID' };
        if ('content' in allowed || 'note' in allowed || 'tags' in allowed) merged.edited = Date.now();
        const delta = S.byteSize(merged) - S.byteSize(list[i]);
        if (delta > 0 && (await usedBytes()) + delta > S.MAX_STORAGE_BYTES) return { ok: false, error: 'QUOTA_EXCEEDED' };
        list[i] = merged;
        await write(list);
        return { ok: true, record: merged };
      }),

      remove: (ids) => run(async () => {
        const set = new Set(ids || []);
        const list = await readList();
        const removed = list.filter(r => set.has(r.id));
        await write(list.filter(r => !set.has(r.id)));
        return { ok: true, removed };
      }),

      /** Re-inserta registros borrados (deshacer). */
      restore: (records) => run(async () => {
        const list = await readList();
        const ids = new Set(list.map(r => r.id));
        const clean = (records || []).map(S.sanitizeRecord).filter(r => r && !ids.has(r.id));
        const next = list.concat(clean).sort((a, b) => b.timestamp - a.timestamp);
        await write(next);
        return { ok: true, restored: clean.length };
      }),

      purge: (includeFavorites) => run(async () => {
        const list = await readList();
        const keep = includeFavorites ? [] : list.filter(r => r.favorite);
        await write(keep);
        return { ok: true, purged: list.length - keep.length, kept: keep.length };
      }),

      importMany: (items) => run(async () => {
        const list = await readList();
        const ids = new Set(list.map(r => r.id));
        let bytes = await usedBytes();
        let added = 0, rejected = 0, skipped = 0;
        const fresh = [];
        for (const it of (Array.isArray(items) ? items : [])) {
          const rec = S.sanitizeRecord(it);
          if (!rec) { rejected++; continue; }
          if (ids.has(rec.id) || S.isDuplicate(list.concat(fresh), rec)) { skipped++; continue; }
          const size = S.byteSize(rec);
          if (bytes + size > S.MAX_STORAGE_BYTES) { rejected++; continue; }
          bytes += size;
          ids.add(rec.id);
          fresh.push(rec);
          added++;
        }
        await write(list.concat(fresh).sort((a, b) => b.timestamp - a.timestamp));
        return { ok: true, added, rejected, skipped };
      }),

      /** Migración v1.3.0: sanea todos los registros y elimina los seeds demo no modificados. */
      migrate: () => run(async () => {
        const d = await area.get([S.STORAGE_KEY, S.SETTINGS_KEY, 'cyberclip_schema']);
        if (d.cyberclip_schema >= 2) return { ok: true, migrated: false };
        const list = Array.isArray(d[S.STORAGE_KEY]) ? d[S.STORAGE_KEY] : [];
        const out = [];
        let removedSeeds = 0;
        for (const r of list) {
          if (r && S.SEED_IDS.includes(r.id) && !r.edited) { removedSeeds++; continue; }
          const c = S.sanitizeRecord(r);
          if (c) out.push(c);
          else if (r) out.push(r); // nunca perder datos: si no se puede sanear, se conserva tal cual
        }
        await area.set({
          [S.STORAGE_KEY]: out,
          [S.SETTINGS_KEY]: S.sanitizeSettings(d[S.SETTINGS_KEY]),
          cyberclip_schema: 2
        });
        return { ok: true, migrated: true, removedSeeds, total: out.length };
      })
    };
  }

  return { createStore };
});
