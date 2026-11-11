/**
 * CYBERCLIP // SHARED CORE (lib/shared.js)
 * Usado por background (importScripts), content script, popup y tests (node).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.CyberClipShared = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STORAGE_KEY = 'cyberclip_records';
  const SETTINGS_KEY = 'cyberclip_settings';
  const MAX_STORAGE_BYTES = 100 * 1024 * 1024; // 104.857.600 bytes (tope estricto)
  const MAX_CONTENT = 20000;
  const MAX_NOTE = 2000;
  const MAX_TITLE = 300;
  const MAX_TAGS = 20;
  const MAX_TAG_LEN = 32;
  const TYPES = ['SNIPPET', 'NOTE', 'URL_REF'];
  const SEED_IDS = ['seed_01', 'seed_02', 'seed_03'];

  const DEFAULT_PALETTE = [
    { id: 'c1', color: '#FCEE0A', tag: 'IDEA', name: 'Amarillo Neón' },
    { id: 'c2', color: '#00F0FF', tag: 'RESEARCH', name: 'Cian Eléctrico' },
    { id: 'c3', color: '#00FF66', tag: 'DEV', name: 'Verde Neón' },
    { id: 'c4', color: '#FF007F', tag: 'BUG', name: 'Magenta Neón' },
    { id: 'c5', color: '#FFA500', tag: 'LECTURA', name: 'Naranja Ámbar' },
    { id: 'c6', color: '#0070FF', tag: 'DOCS', name: 'Azul Eléctrico' }
  ];

  const DEFAULT_SETTINGS = {
    masterEnabled: true,
    highlightEnabled: true,
    palette: DEFAULT_PALETTE,
    selectedColor: '#FCEE0A',
    selectedTag: 'IDEA',
    language: 'es',
    blockedSites: [],
    dedupe: true
  };

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function isValidHexColor(c) {
    return typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);
  }

  function safeColor(c, fallback) {
    return isValidHexColor(c) ? c.toUpperCase() : (fallback || '#FCEE0A');
  }

  function isHttpUrl(u) {
    if (typeof u !== 'string') return false;
    try {
      const p = new URL(u);
      return p.protocol === 'http:' || p.protocol === 'https:';
    } catch (e) {
      return false;
    }
  }

  function normalizePageUrl(u) {
    try {
      const p = new URL(u);
      return p.origin + p.pathname;
    } catch (e) {
      return String(u || '');
    }
  }

  function extractDomain(u) {
    try {
      return new URL(u).hostname.replace(/^www\./, '') || 'unknown_host';
    } catch (e) {
      return 'unknown_host';
    }
  }

  function sanitizeTag(t) {
    return String(t || '')
      .toUpperCase()
      .replace(/[^A-Z0-9_ÁÉÍÓÚÑÜ-]/g, '_')
      .replace(/_+/g, '_')
      .slice(0, MAX_TAG_LEN);
  }

  function sanitizeTags(tags) {
    if (!Array.isArray(tags)) return [];
    const out = [];
    for (const t of tags) {
      const s = sanitizeTag(t);
      if (s && s !== '_' && !out.includes(s)) out.push(s);
      if (out.length >= MAX_TAGS) break;
    }
    return out;
  }

  function formatTechDate(d) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} // ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  function makeId(prefix) {
    return `${prefix || 'clip'}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  /** Devuelve un registro limpio o null si no es válido. */
  function sanitizeRecord(item) {
    if (!item || typeof item !== 'object') return null;
    const content = typeof item.content === 'string' ? item.content.slice(0, MAX_CONTENT) : '';
    const note = typeof item.note === 'string' ? item.note.slice(0, MAX_NOTE) : '';
    if (!content.trim() && !note.trim()) return null;
    const url = isHttpUrl(item.url) ? item.url : '';
    const ts = Number.isFinite(item.timestamp) && item.timestamp > 0 ? item.timestamp : Date.now();
    const id = typeof item.id === 'string' && /^[\w-]{1,80}$/.test(item.id) ? item.id : makeId('imp');
    return {
      id,
      type: TYPES.includes(item.type) ? item.type : 'SNIPPET',
      title: String(item.title || extractDomain(url) || 'CYBERCLIP').slice(0, MAX_TITLE),
      url,
      domain: url ? extractDomain(url) : 'local',
      content,
      note,
      color: safeColor(item.color),
      favorite: item.favorite === true,
      tags: sanitizeTags(item.tags),
      timestamp: ts,
      formattedDate: typeof item.formattedDate === 'string' ? item.formattedDate.slice(0, 40) : formatTechDate(new Date(ts)),
      edited: Number.isFinite(item.edited) ? item.edited : undefined
    };
  }

  function sanitizePalette(p) {
    if (!Array.isArray(p) || p.length !== 6) return JSON.parse(JSON.stringify(DEFAULT_PALETTE));
    return p.map((s, i) => ({
      id: `c${i + 1}`,
      color: safeColor(s && s.color, DEFAULT_PALETTE[i].color),
      tag: sanitizeTag(s && s.tag).slice(0, 16) || DEFAULT_PALETTE[i].tag,
      name: DEFAULT_PALETTE[i].name
    }));
  }

  function sanitizeHost(h) {
    let s = String(h || '').trim().toLowerCase();
    try { if (s.includes('://')) s = new URL(s).hostname; } catch (e) { return ''; }
    s = s.replace(/^www\./, '').replace(/\/.*$/, '');
    return /^[a-z0-9.-]{1,253}$/.test(s) ? s : '';
  }

  function sanitizeSettings(s) {
    const src = (s && typeof s === 'object') ? s : {};
    const out = Object.assign({}, DEFAULT_SETTINGS);
    out.masterEnabled = src.masterEnabled !== false;
    out.highlightEnabled = src.highlightEnabled !== false;
    out.dedupe = src.dedupe !== false;
    out.palette = sanitizePalette(src.palette);
    out.selectedColor = safeColor(src.selectedColor, out.palette[0].color);
    const match = out.palette.find(p => p.color === out.selectedColor);
    out.selectedTag = match ? match.tag : out.palette[0].tag;
    if (!match) out.selectedColor = out.palette[0].color;
    out.language = src.language === 'en' ? 'en' : 'es';
    out.blockedSites = Array.isArray(src.blockedSites)
      ? [...new Set(src.blockedSites.map(sanitizeHost).filter(Boolean))].slice(0, 500)
      : [];
    return out;
  }

  function isHostBlocked(hostname, blockedSites) {
    const h = String(hostname || '').toLowerCase().replace(/^www\./, '');
    return (blockedSites || []).some(b => h === b || h.endsWith('.' + b));
  }

  function byteSize(obj) {
    const s = JSON.stringify(obj);
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s).length;
    return s.length * 2;
  }

  function isDuplicate(list, rec) {
    const key = normalizePageUrl(rec.url);
    const c = (rec.content || '').trim();
    return list.some(r => normalizePageUrl(r.url) === key && (r.content || '').trim() === c && (r.note || '') === (rec.note || ''));
  }

  function hexToRgba(hex, alpha) {
    if (!isValidHexColor(hex)) return `rgba(0, 240, 255, ${alpha})`;
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
  }

  return {
    STORAGE_KEY, SETTINGS_KEY, MAX_STORAGE_BYTES, DEFAULT_PALETTE, DEFAULT_SETTINGS, SEED_IDS, TYPES,
    escapeHtml, isValidHexColor, safeColor, isHttpUrl, normalizePageUrl, extractDomain,
    sanitizeTag, sanitizeTags, sanitizeRecord, sanitizeSettings, sanitizePalette, sanitizeHost,
    isHostBlocked, byteSize, isDuplicate, formatTechDate, makeId, hexToRgba
  };
});
