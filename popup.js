/**
 * CYBERCLIP // POPUP LOGIC (popup.js) v1.3.0
 * High-Tech Cyberpunk HUD Controller
 * Features v1.3.0:
 *  - 4 Navigation Tabs: 01 BANCO DATOS (default), 02 NOTA RÁPIDA, 03 TELEMETRÍA, 04 CONFIG.
 *  - Comunicación por mensajes con el motor de almacenamiento único en background.js.
 *  - Modo Standby (⏻ ONLINE / STANDBY) con badge reactivo.
 *  - Soporte bilingüe (Español / Inglés) configurable desde 04. CONFIG.
 *  - Edición en línea de clips (contenido, nota, tags, color).
 *  - Deshacer borrado con banner toast de 5 segundos.
 *  - Ordenación (más recientes, más antiguos, A-Z) y filtro por fecha (hoy, 7 días, todo).
 *  - Atajo Alt+V copiado rápido con confirmación visual.
 *  - Lista de sitios bloqueados (blocklist) editable en CONFIG.
 *  - Guía completa de atajos de teclado en CONFIG.
 *  - Navegación por teclado dentro del HUD (↑/↓, Enter, Supr, '/' para buscar).
 *  - Protección anti-purga blindada para favoritos (★).
 */

(() => {
  'use strict';

  const S = globalThis.CyberClipShared || {
    DEFAULT_PALETTE: [
      { id: 'c1', color: '#FCEE0A', tag: 'IDEA' },
      { id: 'c2', color: '#00F0FF', tag: 'RESEARCH' },
      { id: 'c3', color: '#00FF66', tag: 'DEV' },
      { id: 'c4', color: '#FF007F', tag: 'BUG' },
      { id: 'c5', color: '#FFA500', tag: 'LECTURA' },
      { id: 'c6', color: '#0070FF', tag: 'DOCS' }
    ],
    escapeHtml: s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'),
    safeColor: c => (/^#[0-9a-f]{6}$/i.test(c) ? c.toUpperCase() : '#FCEE0A'),
    formatTechDate: () => new Date().toISOString(),
    normalizePageUrl: u => u,
    extractDomain: u => 'localhost',
    byteSize: () => 0
  };

  // --- DICCIONARIO BILINGÜE ---
  const I18N = {
    es: {
      sysOnline: 'SYS_CORE: ONLINE',
      sysStandby: 'SYS_CORE: STANDBY (APAGADA)',
      onlineBtn: 'ONLINE',
      standbyBtn: 'STANDBY',
      favsBadge: '★ FAVS',
      nodesBadge: 'NODOS',
      targetScanner: 'TARGET // URL ACTIVA',
      tab01: 'BANCO DATOS',
      tab02: 'NOTA RÁPIDA',
      tab03: 'TELEMETRÍA',
      tab04: 'CONFIG',
      searchPlaceholder: 'BUSCAR POR TEXTO O TAG (pulsa /)...',
      thisPage: 'ESTA PÁGINA',
      allVault: 'TODO EL BANCO',
      favorites: 'FAVORITOS',
      emptyVault: 'SIN REGISTROS ENCONTRADOS',
      emptyDesc: 'No hay fragmentos vinculados a este filtro. Usa el clic derecho, el botón flotante [⚡ CLIP] o Alt+C.',
      btnSaveNote: '// GUARDAR REGISTRO EN HUD',
      btnSaveSub: 'INDEXAR A URL ACTUAL [ENTER]',
      btnCopy: '[COPIAR]',
      btnOpen: '[IR A URL]',
      btnMd: '[MD]',
      btnEdit: '[EDITAR]',
      btnDelete: '[BORRAR]',
      undo: 'DESHACER',
      deletedMsg: 'Fragmento eliminado.',
      copiedMsg: 'COPIADO AL PORTAPAPELES',
      savedMsg: '⚡ FRAGMENTO REGISTRADO EN HUD',
      favSavedMsg: '★ FRAGMENTO FAVORITO REGISTRADO',
      updatedMsg: 'REGISTRO ACTUALIZADO',
      quotaMsg: '⛔ LÍMITE DE 100 MB ALCANZADO // PURGA REGISTROS',
      dupMsg: '⚡ FRAGMENTO YA REGISTRADO EN ESTA PÁGINA',
      purgeConfirm: '¿Deseas purgar la memoria local de fragmentos?',
      purgeExecuted: 'PURGA EJECUTADA'
    },
    en: {
      sysOnline: 'SYS_CORE: ONLINE',
      sysStandby: 'SYS_CORE: STANDBY (OFF)',
      onlineBtn: 'ONLINE',
      standbyBtn: 'STANDBY',
      favsBadge: '★ FAVS',
      nodesBadge: 'NODES',
      targetScanner: 'TARGET // ACTIVE URL',
      tab01: 'DATA VAULT',
      tab02: 'QUICK NOTE',
      tab03: 'TELEMETRY',
      tab04: 'CONFIG',
      searchPlaceholder: 'SEARCH BY TEXT OR TAG (press /)...',
      thisPage: 'THIS PAGE',
      allVault: 'ALL VAULT',
      favorites: 'FAVORITES',
      emptyVault: 'NO RECORDS FOUND',
      emptyDesc: 'No clips match this filter. Use right click, floating [⚡ CLIP] button, or Alt+C.',
      btnSaveNote: '// SAVE RECORD TO HUD',
      btnSaveSub: 'INDEX TO CURRENT URL [ENTER]',
      btnCopy: '[COPY]',
      btnOpen: '[OPEN URL]',
      btnMd: '[MD]',
      btnEdit: '[EDIT]',
      btnDelete: '[DELETE]',
      undo: 'UNDO',
      deletedMsg: 'Clip deleted.',
      copiedMsg: 'COPIED TO CLIPBOARD',
      savedMsg: '⚡ CLIP SAVED TO HUD',
      favSavedMsg: '★ FAVORITE CLIP SAVED',
      updatedMsg: 'RECORD UPDATED',
      quotaMsg: '⛔ 100 MB LIMIT REACHED // PURGE RECORDS',
      dupMsg: '⚡ CLIP ALREADY SAVED ON THIS PAGE',
      purgeConfirm: 'Do you want to purge local memory clips?',
      purgeExecuted: 'PURGE EXECUTED'
    }
  };

  let state = {
    records: [],
    settings: {
      masterEnabled: true,
      highlightEnabled: true,
      palette: JSON.parse(JSON.stringify(S.DEFAULT_PALETTE)),
      selectedColor: '#FCEE0A',
      selectedTag: 'IDEA',
      language: 'es',
      blockedSites: [],
      dedupe: true
    },
    formFavorite: false,
    activeTab: {
      url: 'https://developer.mozilla.org/es/docs/Web/API/Storage',
      title: 'MDN Web Docs // Storage API Specification',
      domain: 'developer.mozilla.org'
    },
    filter: {
      query: '',
      scope: 'current',
      selectedTag: null,
      dateRange: 'all', // 'today' | 'week' | 'all'
      sort: 'newest'     // 'newest' | 'oldest' | 'alpha'
    },
    undoStack: [],
    focusedCardIndex: -1
  };

  // Cache DOM
  let el = {};

  document.addEventListener('DOMContentLoaded', async () => {
    cacheElements();
    setupTabNavigation();
    setupEventHandlers();
    setupKeyboardNavigation();
    await loadSettings();
    applyLanguage();
    updateMasterPowerUI();
    await detectActiveTab();
    await refreshRecords();
    renderFormColorSelector();
    renderConfigDashboard();
    renderAll();

    // Sincronizar reactivamente si storage cambia
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local') {
          if (changes[S.STORAGE_KEY]) refreshRecords();
          if (changes[S.SETTINGS_KEY]) {
            state.settings = Object.assign({}, state.settings, changes[S.SETTINGS_KEY].newValue || {});
            applyLanguage();
            updateMasterPowerUI();
            renderConfigDashboard();
          }
        }
      });
    }
  });

  function t(key) {
    const lang = state.settings.language === 'en' ? 'en' : 'es';
    return (I18N[lang] && I18N[lang][key]) || (I18N.es && I18N.es[key]) || key;
  }

  function cacheElements() {
    el = {
      btnMasterPower: document.getElementById('btnMasterPower'),
      powerBtnLabel: document.getElementById('powerBtnLabel'),
      hudStatusPulse: document.getElementById('hudStatusPulse'),
      hudSysStatus: document.getElementById('hudSysStatus'),
      chkMasterPower: document.getElementById('chkMasterPower'),
      configMasterStatusTitle: document.getElementById('configMasterStatusTitle'),

      hudFavCount: document.getElementById('hudFavCount'),
      hudTotalCount: document.getElementById('hudTotalCount'),
      hudStorageSize: document.getElementById('hudStorageSize'),

      activeDomainLabel: document.getElementById('activeDomainLabel'),
      activeUrlText: document.getElementById('activeUrlText'),
      btnCopyActiveUrl: document.getElementById('btnCopyActiveUrl'),

      tabBtns: document.querySelectorAll('.hud-tab-btn'),
      panels: document.querySelectorAll('.hud-panel'),
      tabVaultCount: document.getElementById('tabVaultCount'),

      // Vault
      searchFilterInput: document.getElementById('searchFilterInput'),
      btnClearSearch: document.getElementById('btnClearSearch'),
      btnScopeThisPage: document.getElementById('btnScopeThisPage'),
      btnScopeAll: document.getElementById('btnScopeAll'),
      btnScopeFavorites: document.getElementById('btnScopeFavorites'),
      countThisPage: document.getElementById('countThisPage'),
      countAll: document.getElementById('countAll'),
      countFavorites: document.getElementById('countFavorites'),
      activeTagPillsBar: document.getElementById('activeTagPillsBar'),
      vaultCardsContainer: document.getElementById('vaultCardsContainer'),
      vaultEmptyState: document.getElementById('vaultEmptyState'),
      selectSortOrder: document.getElementById('selectSortOrder'),
      selectDateFilter: document.getElementById('selectDateFilter'),

      // Note Form
      formQuickNote: document.getElementById('formQuickNote'),
      btnToggleFavoriteForm: document.getElementById('btnToggleFavoriteForm'),
      btnGrabSelection: document.getElementById('btnGrabSelection'),
      inputContent: document.getElementById('inputContent'),
      inputNote: document.getElementById('inputNote'),
      inputTags: document.getElementById('inputTags'),
      quickTagBtns: document.querySelectorAll('.quick-tag-btn'),
      btnSaveRecord: document.getElementById('btnSaveRecord'),
      formColorSwatchesRow: document.getElementById('formColorSwatchesRow'),
      formColorTagLabel: document.getElementById('formColorTagLabel'),
      formActiveTagBadge: document.getElementById('formActiveTagBadge'),

      // Telemetry
      diagTotalNodes: document.getElementById('diagTotalNodes'),
      diagFavNodes: document.getElementById('diagFavNodes'),
      diagTotalDomains: document.getElementById('diagTotalDomains'),
      diagStorageBytes: document.getElementById('diagStorageBytes'),
      diagDomainsList: document.getElementById('diagDomainsList'),
      btnExportMarkdown: document.getElementById('btnExportMarkdown'),
      btnExportJSON: document.getElementById('btnExportJSON'),
      fileImportJSON: document.getElementById('fileImportJSON'),
      btnPurgeAll: document.getElementById('btnPurgeAll'),

      // Config
      chkHighlightEnabled: document.getElementById('chkHighlightEnabled'),
      chkDedupe: document.getElementById('chkDedupe'),
      selectLanguage: document.getElementById('selectLanguage'),
      textareaBlockedSites: document.getElementById('textareaBlockedSites'),
      btnSaveBlockedSites: document.getElementById('btnSaveBlockedSites'),
      colorSlotsConfigContainer: document.getElementById('colorSlotsConfigContainer'),
      btnSavePaletteConfig: document.getElementById('btnSavePaletteConfig'),
      btnResetPaletteConfig: document.getElementById('btnResetPaletteConfig'),

      // Purge Modal
      modalPurgeConfirm: document.getElementById('modalPurgeConfirm'),
      modalPurgeDesc: document.getElementById('modalPurgeDesc'),
      modalFavShieldBox: document.getElementById('modalFavShieldBox'),
      modalFavProtectedCount: document.getElementById('modalFavProtectedCount'),
      chkIncludeFavoritesPurge: document.getElementById('chkIncludeFavoritesPurge'),
      btnCancelPurge: document.getElementById('btnCancelPurge'),
      btnExecutePurge: document.getElementById('btnExecutePurge'),

      // Toast
      hudToast: document.getElementById('hudToast'),
      hudToastMsg: document.getElementById('hudToastMsg'),
      hudToastAction: document.getElementById('hudToastAction')
    };
  }

  // --- BACKGROUND BRIDGE ---
  async function callBg(msg) {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        return await chrome.runtime.sendMessage(msg);
      }
    } catch (e) {}
    // Fallback para demo.html standalone (localStorage)
    return handleLocalFallback(msg);
  }

  function handleLocalFallback(msg) {
    const rawRec = localStorage.getItem(S.STORAGE_KEY);
    let records = rawRec ? JSON.parse(rawRec) : [];
    const rawSet = localStorage.getItem(S.SETTINGS_KEY);
    let settings = rawSet ? JSON.parse(rawSet) : S.DEFAULT_SETTINGS;

    switch (msg.action) {
      case 'GET_SETTINGS': return { ok: true, settings };
      case 'SAVE_SETTINGS':
        settings = Object.assign({}, settings, msg.patch || {});
        localStorage.setItem(S.SETTINGS_KEY, JSON.stringify(settings));
        return { ok: true, settings };
      case 'GET_ALL_RECORDS': return { ok: true, records };
      case 'SAVE_CLIP': {
        const rec = S.sanitizeRecord(msg.record);
        if (!rec) return { ok: false, error: 'INVALID' };
        records.unshift(rec);
        localStorage.setItem(S.STORAGE_KEY, JSON.stringify(records));
        return { ok: true, record: rec };
      }
      case 'UPDATE_RECORD': {
        const i = records.findIndex(r => r.id === msg.id);
        if (i < 0) return { ok: false, error: 'NOT_FOUND' };
        records[i] = Object.assign({}, records[i], msg.patch);
        localStorage.setItem(S.STORAGE_KEY, JSON.stringify(records));
        return { ok: true, record: records[i] };
      }
      case 'DELETE_RECORDS': {
        const ids = new Set(msg.ids || []);
        const removed = records.filter(r => ids.has(r.id));
        records = records.filter(r => !ids.has(r.id));
        localStorage.setItem(S.STORAGE_KEY, JSON.stringify(records));
        return { ok: true, removed };
      }
      case 'RESTORE_RECORDS': {
        records = records.concat(msg.records || []).sort((a, b) => b.timestamp - a.timestamp);
        localStorage.setItem(S.STORAGE_KEY, JSON.stringify(records));
        return { ok: true };
      }
      case 'PURGE': {
        const keep = msg.includeFavorites ? [] : records.filter(r => r.favorite);
        records = keep;
        localStorage.setItem(S.STORAGE_KEY, JSON.stringify(records));
        return { ok: true };
      }
      default: return { ok: true };
    }
  }

  // --- SETTINGS & I18N ---
  async function loadSettings() {
    const res = await callBg({ action: 'GET_SETTINGS' });
    if (res && res.ok && res.settings) {
      state.settings = Object.assign({}, state.settings, res.settings);
    }
  }

  function applyLanguage() {
    const lang = state.settings.language === 'en' ? 'en' : 'es';
    document.documentElement.lang = lang;

    // Tabs
    const tabVault = document.getElementById('tabBtnVault');
    const tabCap = document.getElementById('tabBtnCapture');
    const tabSys = document.getElementById('tabBtnSystem');
    const tabCfg = document.getElementById('tabBtnConfig');
    if (tabVault) tabVault.querySelector('.tab-label').textContent = t('tab01');
    if (tabCap) tabCap.querySelector('.tab-label').textContent = t('tab02');
    if (tabSys) tabSys.querySelector('.tab-label').textContent = t('tab03');
    if (tabCfg) tabCfg.querySelector('.tab-label').textContent = t('tab04');

    if (el.searchFilterInput) el.searchFilterInput.placeholder = t('searchPlaceholder');
    if (el.btnScopeThisPage) el.btnScopeThisPage.childNodes[0].textContent = `${t('thisPage')} `;
    if (el.btnScopeAll) el.btnScopeAll.childNodes[0].textContent = `${t('allVault')} `;
    if (el.btnScopeFavorites) el.btnScopeFavorites.querySelector('.fav-scope-label').textContent = `${t('favorites')} `;

    const bannerLbl = document.querySelector('.scanner-label');
    if (bannerLbl) bannerLbl.textContent = t('targetScanner');

    const submitBtn = el.btnSaveRecord;
    if (submitBtn) {
      const gl = submitBtn.querySelector('.btn-glitch-text');
      const sb = submitBtn.querySelector('.btn-subtext');
      if (gl) gl.textContent = t('btnSaveNote');
      if (sb) sb.textContent = t('btnSaveSub');
    }

    if (el.selectLanguage) el.selectLanguage.value = lang;
  }

  async function setLanguage(newLang) {
    state.settings.language = newLang === 'en' ? 'en' : 'es';
    await callBg({ action: 'SAVE_SETTINGS', patch: { language: state.settings.language } });
    applyLanguage();
    renderAll();
  }

  async function refreshRecords() {
    const res = await callBg({ action: 'GET_ALL_RECORDS' });
    state.records = (res && res.ok && Array.isArray(res.records)) ? res.records : [];
    renderAll();
  }

  // --- MASTER POWER ---
  function updateMasterPowerUI() {
    const isOnline = state.settings.masterEnabled !== false;
    if (el.btnMasterPower) {
      el.btnMasterPower.classList.toggle('active', isOnline);
      el.btnMasterPower.classList.toggle('off', !isOnline);
      if (el.powerBtnLabel) el.powerBtnLabel.textContent = isOnline ? t('onlineBtn') : t('standbyBtn');
    }
    if (el.hudStatusPulse) el.hudStatusPulse.classList.toggle('off', !isOnline);
    if (el.hudSysStatus) {
      el.hudSysStatus.textContent = isOnline ? t('sysOnline') : t('sysStandby');
      el.hudSysStatus.style.color = isOnline ? 'var(--electric-cyan)' : 'var(--neon-crimson)';
    }
    if (el.chkMasterPower) el.chkMasterPower.checked = isOnline;
    if (el.configMasterStatusTitle) {
      el.configMasterStatusTitle.textContent = isOnline ? 'Extensión Activada (ONLINE)' : 'Extensión Apagada (MODO STANDBY)';
      el.configMasterStatusTitle.style.color = isOnline ? '' : 'var(--neon-crimson)';
    }
  }

  async function toggleMasterPower() {
    const next = state.settings.masterEnabled === false;
    state.settings.masterEnabled = next;
    await callBg({ action: 'MASTER_POWER_TOGGLED', enabled: next });
    updateMasterPowerUI();
    showToast(next ? '⚡ CYBERCLIP ACTIVADA // ONLINE' : '⛔ CYBERCLIP EN STANDBY // APAGADA');
  }

  // --- TAB NAVIGATION ---
  function setupTabNavigation() {
    el.tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-tab');
        el.tabBtns.forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-selected', 'false');
        });
        el.panels.forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');

        const panel = document.getElementById(target);
        if (panel) panel.classList.add('active');

        if (target === 'tab-vault') renderVault();
        else if (target === 'tab-system') renderTelemetry();
        else if (target === 'tab-config') renderConfigDashboard();
      });
    });
  }

  // --- EVENT HANDLERS ---
  function setupEventHandlers() {
    if (el.btnMasterPower) el.btnMasterPower.addEventListener('click', toggleMasterPower);
    if (el.chkMasterPower) el.chkMasterPower.addEventListener('change', (e) => {
      state.settings.masterEnabled = e.target.checked;
      callBg({ action: 'MASTER_POWER_TOGGLED', enabled: e.target.checked });
      updateMasterPowerUI();
    });

    el.btnCopyActiveUrl.addEventListener('click', () => copyToClipboard(state.activeTab.url, t('copiedMsg')));
    el.activeUrlText.addEventListener('click', () => copyToClipboard(state.activeTab.url, t('copiedMsg')));

    el.btnToggleFavoriteForm.addEventListener('click', () => {
      state.formFavorite = !state.formFavorite;
      updateFormFavoriteButton();
    });

    el.formQuickNote.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleSaveManualNote();
    });

    el.btnGrabSelection.addEventListener('click', handleGrabSelection);

    el.quickTagBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tag = btn.getAttribute('data-tag');
        const cur = el.inputTags.value.trim();
        if (!cur) el.inputTags.value = tag;
        else if (!cur.split(',').map(s => s.trim().toUpperCase()).includes(tag)) {
          el.inputTags.value = `${cur}, ${tag}`;
        }
        el.inputTags.focus();
      });
    });

    el.searchFilterInput.addEventListener('input', (e) => {
      state.filter.query = e.target.value.trim().toLowerCase();
      renderVault();
    });

    el.btnClearSearch.addEventListener('click', () => {
      el.searchFilterInput.value = '';
      state.filter.query = '';
      renderVault();
    });

    el.btnScopeThisPage.addEventListener('click', () => setVaultScope('current'));
    el.btnScopeAll.addEventListener('click', () => setVaultScope('all'));
    el.btnScopeFavorites.addEventListener('click', () => setVaultScope('favorites'));

    if (el.selectSortOrder) {
      el.selectSortOrder.addEventListener('change', (e) => {
        state.filter.sort = e.target.value;
        renderVault();
      });
    }

    if (el.selectDateFilter) {
      el.selectDateFilter.addEventListener('change', (e) => {
        state.filter.dateRange = e.target.value;
        renderVault();
      });
    }

    el.btnExportMarkdown.addEventListener('click', exportToMarkdown);
    el.btnExportJSON.addEventListener('click', exportToJSON);
    el.fileImportJSON.addEventListener('change', handleImportJSON);
    el.btnPurgeAll.addEventListener('click', openPurgeModal);
    el.btnCancelPurge.addEventListener('click', closePurgeModal);
    el.btnExecutePurge.addEventListener('click', handleExecutePurge);

    el.btnSavePaletteConfig.addEventListener('click', handleSaveConfigFromUi);
    el.btnResetPaletteConfig.addEventListener('click', handleResetDefaultPalette);

    el.chkHighlightEnabled.addEventListener('change', async (e) => {
      state.settings.highlightEnabled = e.target.checked;
      await callBg({ action: 'SAVE_SETTINGS', patch: { highlightEnabled: e.target.checked } });
      showToast(e.target.checked ? 'RESALTADO ACTIVADO' : 'RESALTADO DESACTIVADO');
    });

    if (el.chkDedupe) {
      el.chkDedupe.addEventListener('change', async (e) => {
        state.settings.dedupe = e.target.checked;
        await callBg({ action: 'SAVE_SETTINGS', patch: { dedupe: e.target.checked } });
      });
    }

    if (el.selectLanguage) {
      el.selectLanguage.addEventListener('change', (e) => setLanguage(e.target.value));
    }

    if (el.btnSaveBlockedSites) {
      el.btnSaveBlockedSites.addEventListener('click', async () => {
        const raw = el.textareaBlockedSites.value;
        const list = raw.split('\n').map(s => s.trim()).filter(Boolean);
        const res = await callBg({ action: 'SAVE_SETTINGS', patch: { blockedSites: list } });
        if (res && res.ok) {
          state.settings.blockedSites = res.settings.blockedSites;
          showToast('LISTA DE SITIOS BLOQUEADOS ACTUALIZADA');
        }
      });
    }
  }

  // --- KEYBOARD ACCESSIBILITY WITHIN HUD ---
  function setupKeyboardNavigation() {
    document.addEventListener('keydown', (e) => {
      // '/' enfoca el buscador si no estamos en un textarea/input
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        e.preventDefault();
        const tabVault = document.getElementById('tabBtnVault');
        if (tabVault) tabVault.click();
        if (el.searchFilterInput) {
          el.searchFilterInput.focus();
          el.searchFilterInput.select();
        }
        return;
      }

      // Navegación con flechas en la lista de tarjetas
      const cards = Array.from(el.vaultCardsContainer.querySelectorAll('.vault-card'));
      if (cards.length === 0) return;

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const activePanel = document.querySelector('.hud-panel.active');
        if (!activePanel || activePanel.id !== 'tab-vault') return;
        if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

        e.preventDefault();
        if (e.key === 'ArrowDown') {
          state.focusedCardIndex = Math.min(cards.length - 1, state.focusedCardIndex + 1);
        } else {
          state.focusedCardIndex = Math.max(0, state.focusedCardIndex - 1);
        }
        cards.forEach((c, idx) => c.classList.toggle('card-focused', idx === state.focusedCardIndex));
        if (cards[state.focusedCardIndex]) {
          cards[state.focusedCardIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      } else if (e.key === 'Delete' && state.focusedCardIndex >= 0) {
        if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
        const cur = cards[state.focusedCardIndex];
        if (cur) {
          const id = cur.getAttribute('data-id');
          if (id) deleteRecord(id);
        }
      }
    });
  }

  function setVaultScope(scope) {
    state.filter.scope = scope;
    el.btnScopeThisPage.classList.toggle('active', scope === 'current');
    el.btnScopeAll.classList.toggle('active', scope === 'all');
    el.btnScopeFavorites.classList.toggle('active', scope === 'favorites');
    renderVault();
  }

  function updateFormFavoriteButton() {
    const isFav = state.formFavorite;
    el.btnToggleFavoriteForm.classList.toggle('is-favorite', isFav);
    const st = el.btnToggleFavoriteForm.querySelector('.fav-status-text');
    if (st) st.textContent = isFav ? '★ BLINDADO' : 'NO FAV';
  }

  // --- ACTIVE TAB ---
  async function detectActiveTab() {
    try {
      if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs && tabs[0] && tabs[0].url) {
          const t = tabs[0];
          state.activeTab = {
            url: t.url,
            title: t.title || S.extractDomain(t.url),
            domain: S.extractDomain(t.url)
          };
        }
      }
    } catch (e) {}

    el.activeDomainLabel.textContent = `HOST: ${state.activeTab.domain.toUpperCase()}`;
    el.activeUrlText.textContent = state.activeTab.url;
    el.activeUrlText.title = `${state.activeTab.title} — ${state.activeTab.url}`;
  }

  // --- SAVE / GRAB SELECTION ---
  async function handleSaveManualNote() {
    const content = el.inputContent.value.trim();
    const note = el.inputNote.value.trim();
    const tagsRaw = el.inputTags.value.trim();

    if (!content && !note) {
      showToast('⚠️ INGRESA AL MENOS UN FRAGMENTO O NOTA');
      el.inputContent.focus();
      return;
    }

    const assignedTag = state.settings.selectedTag || 'IDEA';
    const otherTags = tagsRaw ? tagsRaw.split(',').map(t => t.trim().toUpperCase()).filter(Boolean) : [];
    const finalTags = [assignedTag, ...otherTags.filter(t => t !== assignedTag)];

    const rec = {
      type: content ? 'SNIPPET' : 'NOTE',
      title: state.activeTab.title,
      url: state.activeTab.url,
      domain: state.activeTab.domain,
      content: content || '(Sin fragmento de texto)',
      note,
      color: state.settings.selectedColor || '#FCEE0A',
      favorite: state.formFavorite,
      tags: finalTags,
      timestamp: Date.now(),
      formattedDate: S.formatTechDate(new Date())
    };

    const res = await callBg({ action: 'SAVE_CLIP', record: rec });
    if (!res || !res.ok) {
      if (res && res.error === 'QUOTA_EXCEEDED') showToast(t('quotaMsg'));
      else if (res && res.error === 'DUPLICATE') showToast(t('dupMsg'));
      else showToast('ERROR AL GUARDAR');
      return;
    }

    el.inputContent.value = '';
    el.inputNote.value = '';
    el.inputTags.value = '';
    state.formFavorite = false;
    updateFormFavoriteButton();

    showToast(rec.favorite ? t('favSavedMsg') : t('savedMsg'));
    await refreshRecords();

    setTimeout(() => {
      document.getElementById('tabBtnVault').click();
    }, 350);
  }

  async function handleGrabSelection() {
    try {
      if (typeof chrome !== 'undefined' && chrome.tabs && chrome.scripting) {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs && tabs[0] && tabs[0].id) {
          const [inj] = await chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: () => window.getSelection().toString()
          });
          const text = inj && inj.result ? inj.result.trim() : '';
          if (text) {
            el.inputContent.value = text;
            showToast('⚡ SELECCIÓN EXTRAÍDA');
            return;
          }
        }
      }
    } catch (e) {}
    showToast('⚠️ RESALTA TEXTO EN LA PÁGINA O USA CLIC DERECHO');
  }

  // --- VAULT LIST & CARD CREATION ---
  function renderVault() {
    const filtered = getFilteredRecords();
    el.vaultCardsContainer.innerHTML = '';
    state.focusedCardIndex = -1;

    const pageClips = state.records.filter(r => isSameUrl(r.url, state.activeTab.url));
    const favClips = state.records.filter(r => r.favorite);
    el.countThisPage.textContent = pageClips.length;
    el.countAll.textContent = state.records.length;
    el.countFavorites.textContent = favClips.length;

    renderTagFilterPills();

    if (filtered.length === 0) {
      el.vaultEmptyState.style.display = 'flex';
      const title = el.vaultEmptyState.querySelector('.empty-title');
      const desc = el.vaultEmptyState.querySelector('.empty-desc');
      if (title) title.textContent = t('emptyVault');
      if (desc) desc.textContent = t('emptyDesc');
      return;
    }

    el.vaultEmptyState.style.display = 'none';
    filtered.forEach(record => {
      el.vaultCardsContainer.appendChild(createCardElement(record));
    });
  }

  function getFilteredRecords() {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    let out = state.records.filter(item => {
      if (state.filter.scope === 'current') {
        if (!isSameUrl(item.url, state.activeTab.url)) return false;
      } else if (state.filter.scope === 'favorites') {
        if (!item.favorite) return false;
      }

      if (state.filter.selectedTag) {
        if (!item.tags || !item.tags.includes(state.filter.selectedTag)) return false;
      }

      if (state.filter.dateRange === 'today') {
        if (now - (item.timestamp || 0) > oneDay) return false;
      } else if (state.filter.dateRange === 'week') {
        if (now - (item.timestamp || 0) > 7 * oneDay) return false;
      }

      if (state.filter.query) {
        const q = state.filter.query;
        const matches = (item.content || '').toLowerCase().includes(q) ||
          (item.note || '').toLowerCase().includes(q) ||
          (item.title || '').toLowerCase().includes(q) ||
          (item.domain || '').toLowerCase().includes(q) ||
          (item.tags || []).some(tg => tg.toLowerCase().includes(q));
        if (!matches) return false;
      }
      return true;
    });

    // Orden
    if (state.filter.sort === 'oldest') {
      out.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    } else if (state.filter.sort === 'alpha') {
      out.sort((a, b) => (a.title || a.content || '').localeCompare(b.title || b.content || ''));
    } else {
      out.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    }

    return out;
  }

  function createCardElement(record) {
    const card = document.createElement('article');
    card.className = 'vault-card';
    card.setAttribute('data-id', record.id);

    const clipColor = S.safeColor(record.color);
    card.style.setProperty('--card-accent', clipColor);

    const typeClass = record.type || 'SNIPPET';
    const primaryTag = (record.tags && record.tags[0]) ? record.tags[0] : null;

    const tagsHtml = (record.tags || [])
      .map(tg => `<span class="card-tag-item">#${S.escapeHtml(tg)}</span>`)
      .join('');

    card.innerHTML = `
      <div class="card-topbar">
        <div class="card-topbar-left">
          <button type="button" class="card-btn-star ${record.favorite ? 'is-favorite' : ''}" title="${record.favorite ? 'Quitar de favoritos blindados' : 'Marcar como favorito protegido (★)'}">
            ★
          </button>
          <span class="card-badge-type ${typeClass}">${S.escapeHtml(typeClass)}</span>
          ${primaryTag ? `<span class="card-tag-color-chip" style="border-color:${clipColor};color:${clipColor}">#${S.escapeHtml(primaryTag)}</span>` : ''}
          ${record.edited ? '<span class="card-edited-flag">[EDITADO]</span>' : ''}
        </div>
        <span class="card-meta-date">${S.escapeHtml(record.formattedDate || '')}</span>
      </div>

      <div class="card-origin">
        <span class="origin-bracket">▶</span>
        <a href="${S.escapeHtml(record.url)}" target="_blank" rel="noopener noreferrer" title="${S.escapeHtml(record.url)}">
          ${S.escapeHtml(record.title || record.domain || 'ORIGEN')}
        </a>
      </div>

      <div class="card-content-body" style="border-left-color:${clipColor}">${S.escapeHtml(record.content || '')}</div>

      ${record.note ? `<div class="card-user-note">// ${S.escapeHtml(record.note)}</div>` : ''}

      ${tagsHtml ? `<div class="card-tags-list">${tagsHtml}</div>` : ''}

      <div class="card-actions-bar">
        <button type="button" class="card-btn btn-copy" title="Copiar">${t('btnCopy')}</button>
        <button type="button" class="card-btn btn-open" title="Abrir URL">${t('btnOpen')}</button>
        <button type="button" class="card-btn btn-edit" title="Editar fragmento">${t('btnEdit')}</button>
        <button type="button" class="card-btn btn-md" title="Descargar Markdown">${t('btnMd')}</button>
        <button type="button" class="card-btn btn-delete" title="Eliminar">${t('btnDelete')}</button>
      </div>

      <!-- INLINE EDITOR (oculto por defecto) -->
      <div class="card-inline-editor" style="display:none;">
        <label class="edit-label">CONTENIDO:</label>
        <textarea class="edit-content-input" rows="3"></textarea>
        <label class="edit-label">NOTA PERSONAL:</label>
        <input type="text" class="edit-note-input" />
        <label class="edit-label">TAGS (separados por coma):</label>
        <input type="text" class="edit-tags-input" />
        <div class="edit-buttons-row">
          <button type="button" class="cyber-btn-primary btn-save-edit">GUARDAR CAMBIOS</button>
          <button type="button" class="cyber-btn-secondary btn-cancel-edit">CANCELAR</button>
        </div>
      </div>
    `;

    // Star toggle
    card.querySelector('.card-btn-star').addEventListener('click', async (e) => {
      e.stopPropagation();
      const res = await callBg({ action: 'UPDATE_RECORD', id: record.id, patch: { favorite: !record.favorite } });
      if (res && res.ok) {
        record.favorite = !record.favorite;
        showToast(record.favorite ? '★ FAVORITO PROTEGIDO' : '☆ REMOVIDO DE FAVORITOS');
        await refreshRecords();
      }
    });

    // Copy
    card.querySelector('.btn-copy').addEventListener('click', () => {
      const text = record.content + (record.note ? `\n\nNota: ${record.note}` : '');
      copyToClipboard(text, t('copiedMsg'));
    });

    // Open URL
    card.querySelector('.btn-open').addEventListener('click', () => {
      if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
        chrome.tabs.create({ url: record.url });
      } else {
        window.open(record.url, '_blank');
      }
    });

    // Edit
    const editor = card.querySelector('.card-inline-editor');
    const btnEdit = card.querySelector('.btn-edit');
    const editContent = card.querySelector('.edit-content-input');
    const editNote = card.querySelector('.edit-note-input');
    const editTags = card.querySelector('.edit-tags-input');

    btnEdit.addEventListener('click', () => {
      const isVisible = editor.style.display !== 'none';
      if (!isVisible) {
        editContent.value = record.content || '';
        editNote.value = record.note || '';
        editTags.value = (record.tags || []).join(', ');
        editor.style.display = 'block';
      } else {
        editor.style.display = 'none';
      }
    });

    card.querySelector('.btn-cancel-edit').addEventListener('click', () => {
      editor.style.display = 'none';
    });

    card.querySelector('.btn-save-edit').addEventListener('click', async () => {
      const patch = {
        content: editContent.value.trim(),
        note: editNote.value.trim(),
        tags: editTags.value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
      };
      const res = await callBg({ action: 'UPDATE_RECORD', id: record.id, patch });
      if (res && res.ok) {
        showToast(t('updatedMsg'));
        editor.style.display = 'none';
        await refreshRecords();
      }
    });

    // Single MD
    card.querySelector('.btn-md').addEventListener('click', () => exportSingleToMarkdown(record));

    // Delete
    card.querySelector('.btn-delete').addEventListener('click', async () => {
      await deleteRecord(record.id);
    });

    return card;
  }

  function renderTagFilterPills() {
    const allTags = new Set();
    state.records.forEach(r => (r.tags || []).forEach(tg => allTags.add(tg)));
    el.activeTagPillsBar.innerHTML = '';
    if (allTags.size === 0) return;

    const allPill = document.createElement('button');
    allPill.type = 'button';
    allPill.className = `tag-pill ${state.filter.selectedTag === null ? 'active' : ''}`;
    allPill.textContent = 'TODOS';
    allPill.addEventListener('click', () => {
      state.filter.selectedTag = null;
      renderVault();
    });
    el.activeTagPillsBar.appendChild(allPill);

    allTags.forEach(tag => {
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = `tag-pill ${state.filter.selectedTag === tag ? 'active' : ''}`;
      pill.textContent = `#${tag}`;
      pill.addEventListener('click', () => {
        state.filter.selectedTag = state.filter.selectedTag === tag ? null : tag;
        renderVault();
      });
      el.activeTagPillsBar.appendChild(pill);
    });
  }

  async function deleteRecord(id) {
    const res = await callBg({ action: 'DELETE_RECORDS', ids: [id] });
    if (res && res.ok && Array.isArray(res.removed) && res.removed.length > 0) {
      showToastWithUndo(t('deletedMsg'), res.removed);
      await refreshRecords();
    }
  }

  function showToastWithUndo(msg, removedRecords) {
    showToast(msg, {
      actionLabel: t('undo'),
      onAction: async () => {
        await callBg({ action: 'RESTORE_RECORDS', records: removedRecords });
        showToast('ACCION DESHECHA // REGISTRO RESTAURADO');
        await refreshRecords();
      }
    });
  }

  // --- FORM COLOR SELECTOR ---
  function renderFormColorSelector() {
    el.formColorSwatchesRow.innerHTML = '';
    const palette = (state.settings.palette && state.settings.palette.length === 6)
      ? state.settings.palette
      : S.DEFAULT_PALETTE;

    palette.forEach(slot => {
      const btn = document.createElement('button');
      btn.type = 'button';
      const c = S.safeColor(slot.color);
      btn.className = `swatch-btn ${c === state.settings.selectedColor ? 'active' : ''}`;
      btn.style.backgroundColor = c;
      btn.style.color = c;
      btn.setAttribute('data-color', c);
      btn.setAttribute('data-tag', slot.tag);
      btn.title = `#${slot.tag} — ${slot.name || c}`;

      btn.addEventListener('mouseenter', () => {
        el.formColorTagLabel.textContent = `#${slot.tag}`;
        el.formColorTagLabel.style.color = c;
      });

      btn.addEventListener('mouseleave', () => {
        el.formColorTagLabel.textContent = `#${state.settings.selectedTag || 'IDEA'}`;
        el.formColorTagLabel.style.color = state.settings.selectedColor || '#00F0FF';
      });

      btn.addEventListener('click', () => {
        state.settings.selectedColor = c;
        state.settings.selectedTag = slot.tag;
        updateActiveFormSwatch();
      });

      el.formColorSwatchesRow.appendChild(btn);
    });

    updateActiveFormSwatch();
  }

  function updateActiveFormSwatch() {
    const buttons = el.formColorSwatchesRow.querySelectorAll('.swatch-btn');
    buttons.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-color') === state.settings.selectedColor);
    });
    el.formColorTagLabel.textContent = `#${state.settings.selectedTag || 'IDEA'}`;
    el.formColorTagLabel.style.color = state.settings.selectedColor || '#00F0FF';
    el.formActiveTagBadge.textContent = `TAG: #${state.settings.selectedTag || 'IDEA'}`;
    el.formActiveTagBadge.style.color = state.settings.selectedColor || '#FCEE0A';
  }

  // --- TELEMETRY ---
  async function renderTelemetry() {
    const total = state.records.length;
    const favCount = state.records.filter(r => r.favorite).length;

    el.diagTotalNodes.textContent = String(total).padStart(2, '0');
    el.diagFavNodes.textContent = String(favCount).padStart(2, '0');

    const domainCounts = {};
    state.records.forEach(r => {
      const d = r.domain || S.extractDomain(r.url);
      domainCounts[d] = (domainCounts[d] || 0) + 1;
    });
    el.diagTotalDomains.textContent = String(Object.keys(domainCounts).length).padStart(2, '0');

    const usageRes = await callBg({ action: 'GET_USAGE' });
    const bytes = (usageRes && usageRes.bytes) || 0;
    const kb = (bytes / 1024).toFixed(2);
    const isFull = bytes >= S.MAX_STORAGE_BYTES;

    el.diagStorageBytes.textContent = `${kb} KB`;
    el.hudStorageSize.textContent = isFull ? '100MB (LLENO)' : `${kb} KB / 100MB`;
    el.hudStorageSize.style.color = isFull ? 'var(--neon-crimson)' : '';

    el.diagDomainsList.innerHTML = '';
    const sorted = Object.entries(domainCounts).sort((a, b) => b[1] - a[1]);
    if (sorted.length === 0) {
      el.diagDomainsList.innerHTML = '<div class="diag-loading">Sin datos de dominios.</div>';
    } else {
      sorted.slice(0, 5).forEach(([dom, count]) => {
        const row = document.createElement('div');
        row.className = 'domain-stat-row';
        row.innerHTML = `
          <span class="domain-stat-name">${S.escapeHtml(dom)}</span>
          <span class="domain-stat-count">${count} SNIPPET(S)</span>
        `;
        el.diagDomainsList.appendChild(row);
      });
    }
  }

  // --- PURGE ---
  function openPurgeModal() {
    if (state.records.length === 0) {
      showToast('⚠️ EL BANCO DE DATOS YA ESTÁ VACÍO');
      return;
    }
    const total = state.records.length;
    const favCount = state.records.filter(r => r.favorite).length;
    el.modalPurgeDesc.textContent = `${t('purgeConfirm')} (Total: ${total}).`;
    el.modalFavProtectedCount.textContent = `${favCount} FAVORITOS`;
    el.chkIncludeFavoritesPurge.checked = false;

    if (favCount === 0) {
      el.modalFavShieldBox.style.display = 'none';
      el.chkIncludeFavoritesPurge.parentElement.style.display = 'none';
    } else {
      el.modalFavShieldBox.style.display = 'flex';
      el.chkIncludeFavoritesPurge.parentElement.style.display = 'flex';
    }
    el.modalPurgeConfirm.style.display = 'flex';
  }

  function closePurgeModal() {
    el.modalPurgeConfirm.style.display = 'none';
  }

  async function handleExecutePurge() {
    const incFav = el.chkIncludeFavoritesPurge.checked;
    const res = await callBg({ action: 'PURGE', includeFavorites: incFav });
    closePurgeModal();
    if (res && res.ok) {
      showToast(`⚠️ ${t('purgeExecuted')}: ${res.purged} eliminados, ${res.kept} conservados`);
      await refreshRecords();
    }
  }

  // --- CONFIG PANEL ---
  function renderConfigDashboard() {
    el.chkHighlightEnabled.checked = state.settings.highlightEnabled !== false;
    if (el.chkDedupe) el.chkDedupe.checked = state.settings.dedupe !== false;
    if (el.selectLanguage) el.selectLanguage.value = state.settings.language || 'es';
    if (el.textareaBlockedSites) {
      el.textareaBlockedSites.value = (state.settings.blockedSites || []).join('\n');
    }

    el.colorSlotsConfigContainer.innerHTML = '';
    const palette = (state.settings.palette && state.settings.palette.length === 6)
      ? state.settings.palette
      : S.DEFAULT_PALETTE;

    palette.forEach((slot, idx) => {
      const c = S.safeColor(slot.color);
      const row = document.createElement('div');
      row.className = 'slot-row';
      row.style.borderLeftColor = c;

      row.innerHTML = `
        <span class="slot-index">SLOT 0${idx + 1}</span>
        <div class="slot-picker-wrap" title="Cambiar color">
          <input type="color" class="slot-color-picker" value="${c}" data-idx="${idx}" />
          <span class="slot-color-preview" style="background-color:${c};"></span>
        </div>
        <input type="text" class="slot-hex-input" value="${c}" maxlength="7" data-idx="${idx}" spellcheck="false" />
        <input type="text" class="slot-tag-input" value="${S.escapeHtml(slot.tag)}" placeholder="ETIQUETA" maxlength="16" data-idx="${idx}" spellcheck="false" />
      `;

      const picker = row.querySelector('.slot-color-picker');
      const hexInput = row.querySelector('.slot-hex-input');
      const preview = row.querySelector('.slot-color-preview');
      const tagInput = row.querySelector('.slot-tag-input');

      picker.addEventListener('input', (e) => {
        const val = e.target.value.toUpperCase();
        hexInput.value = val;
        preview.style.backgroundColor = val;
        row.style.borderLeftColor = val;
      });

      hexInput.addEventListener('input', (e) => {
        let val = e.target.value.trim().toUpperCase();
        if (!val.startsWith('#') && val.length > 0) val = '#' + val;
        if (S.isValidHexColor(val)) {
          picker.value = val;
          preview.style.backgroundColor = val;
          row.style.borderLeftColor = val;
        }
      });

      tagInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9_ÁÉÍÓÚÑÜ-]/g, '');
      });

      el.colorSlotsConfigContainer.appendChild(row);
    });
  }

  async function handleSaveConfigFromUi() {
    const rows = el.colorSlotsConfigContainer.querySelectorAll('.slot-row');
    const newPalette = [];

    rows.forEach((row, idx) => {
      const hex = row.querySelector('.slot-hex-input').value.trim().toUpperCase();
      let tag = row.querySelector('.slot-tag-input').value.trim().toUpperCase();
      if (!tag) tag = `TAG${idx + 1}`;
      newPalette.push({
        id: `c${idx + 1}`,
        color: S.safeColor(hex, S.DEFAULT_PALETTE[idx].color),
        tag: S.sanitizeTag(tag).slice(0, 16) || S.DEFAULT_PALETTE[idx].tag,
        name: S.DEFAULT_PALETTE[idx].name
      });
    });

    const patch = {
      palette: newPalette,
      highlightEnabled: el.chkHighlightEnabled.checked,
      dedupe: el.chkDedupe ? el.chkDedupe.checked : true,
      language: el.selectLanguage ? el.selectLanguage.value : 'es'
    };

    const res = await callBg({ action: 'SAVE_SETTINGS', patch });
    if (res && res.ok) {
      state.settings = res.settings;
      renderFormColorSelector();
      renderConfigDashboard();
      applyLanguage();
      showToast('💾 CONFIGURACIÓN & PALETA GUARDADAS');
    }
  }

  async function handleResetDefaultPalette() {
    const res = await callBg({
      action: 'SAVE_SETTINGS',
      patch: { palette: S.DEFAULT_PALETTE, selectedColor: S.DEFAULT_PALETTE[0].color, selectedTag: S.DEFAULT_PALETTE[0].tag }
    });
    if (res && res.ok) {
      state.settings = res.settings;
      renderFormColorSelector();
      renderConfigDashboard();
      showToast('↺ PALETA RESTABLECIDA A VALORES DE FÁBRICA');
    }
  }

  // --- EXPORT & IMPORT ---
  function exportToMarkdown() {
    if (state.records.length === 0) {
      showToast('⚠️ EL BANCO ESTÁ VACÍO');
      return;
    }
    let md = `# CYBERCLIP // EXPORTACIÓN DE FRAGMENTOS Y NOTAS\n`;
    md += `> Generado el: ${new Date().toLocaleString()} | Total registros: ${state.records.length}\n\n---\n\n`;

    state.records.forEach((r, idx) => {
      const favStar = r.favorite ? '★ [FAVORITO] ' : '';
      md += `### [${idx + 1}] ${favStar}${r.title || r.domain}\n\n`;
      md += `- **Tipo:** \`${r.type}\`\n`;
      md += `- **Color HUD:** \`${r.color || '#FCEE0A'}\`\n`;
      md += `- **Favorito:** \`${r.favorite ? 'SÍ (★)' : 'NO'}\`\n`;
      md += `- **URL:** [${r.url}](${r.url})\n`;
      md += `- **Dominio:** \`${r.domain}\`\n`;
      md += `- **Fecha:** \`${r.formattedDate}\`\n`;
      if (r.tags && r.tags.length) {
        md += `- **Tags:** ${r.tags.map(tg => `\`#${tg}\``).join(' ')}\n`;
      }
      md += `\n**Fragmento capturado:**\n\n\`\`\`text\n${r.content}\n\`\`\`\n\n`;
      if (r.note) md += `**Nota personal:**\n> ${r.note}\n\n`;
      md += `---\n\n`;
    });

    downloadBlob(md, `cyberclip_export_${getTimestampStr()}.md`, 'text/markdown;charset=utf-8');
    showToast('📄 MARKDOWN EXPORTADO');
  }

  function exportSingleToMarkdown(r) {
    const favStar = r.favorite ? '★ ' : '';
    let md = `# ${favStar}${r.title || 'CYBERCLIP FRAGMENTO'}\n\n`;
    md += `- **URL:** [${r.url}](${r.url})\n`;
    md += `- **Color HUD:** \`${r.color || '#FCEE0A'}\`\n`;
    md += `- **Favorito:** \`${r.favorite ? 'SÍ (★)' : 'NO'}\`\n`;
    md += `- **Fecha:** \`${r.formattedDate}\`\n`;
    if (r.tags && r.tags.length) {
      md += `- **Tags:** ${r.tags.map(tg => `\`#${tg}\``).join(' ')}\n`;
    }
    md += `\n## Contenido\n\n\`\`\`text\n${r.content}\n\`\`\`\n\n`;
    if (r.note) md += `## Nota Personal\n\n> ${r.note}\n\n`;
    const safeName = (r.domain || 'snippet').replace(/[^a-zA-Z0-9]/g, '_');
    downloadBlob(md, `cyberclip_${safeName}_${r.id}.md`, 'text/markdown;charset=utf-8');
    showToast('📄 FRAGMENTO MD DESCARGADO');
  }

  function exportToJSON() {
    if (state.records.length === 0) {
      showToast('⚠️ EL BANCO ESTÁ VACÍO');
      return;
    }
    const payload = {
      version: '1.3.0',
      client: 'CYBERCLIP_HUD_EXTENSION',
      exportedAt: new Date().toISOString(),
      totalRecords: state.records.length,
      settings: state.settings,
      records: state.records
    };
    downloadBlob(JSON.stringify(payload, null, 2), `cyberclip_backup_${getTimestampStr()}.json`, 'application/json;charset=utf-8');
    showToast('💾 ARCHIVO JSON GENERADO');
  }

  function handleImportJSON(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        const list = Array.isArray(parsed) ? parsed : (parsed.records || []);
        const res = await callBg({ action: 'IMPORT_MANY', items: list });
        if (res && res.ok) {
          showToast(`📂 IMPORTACIÓN: +${res.added} añadidos, ${res.skipped} duplicados, ${res.rejected} rechazados`);
          await refreshRecords();
        } else {
          showToast('⚠️ ERROR AL IMPORTAR');
        }
        event.target.value = '';
      } catch (err) {
        showToast('⚠️ ERROR AL PROCESAR EL JSON');
      }
    };
    reader.readAsText(file);
  }

  // --- HELPERS ---
  function renderAll() {
    const total = state.records.length;
    const favCount = state.records.filter(r => r.favorite).length;
    el.hudTotalCount.textContent = String(total).padStart(2, '0');
    el.hudFavCount.textContent = String(favCount).padStart(2, '0');
    el.tabVaultCount.textContent = String(total);
    renderVault();
    renderTelemetry();
  }

  function copyToClipboard(text, successMsg) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      showToast(successMsg || 'COPIADO AL PORTAPAPELES');
    }).catch(() => {
      const t = document.createElement('textarea');
      t.value = text;
      document.body.appendChild(t);
      t.select();
      document.execCommand('copy');
      document.body.removeChild(t);
      showToast(successMsg || 'COPIADO AL PORTAPAPELES');
    });
  }

  let toastTimer = null;
  function showToast(msg, options) {
    if (toastTimer) clearTimeout(toastTimer);
    el.hudToastMsg.textContent = msg;

    if (el.hudToastAction) {
      if (options && options.actionLabel && typeof options.onAction === 'function') {
        el.hudToastAction.textContent = `[${options.actionLabel}]`;
        el.hudToastAction.style.display = 'inline-block';
        el.hudToastAction.onclick = (e) => {
          e.preventDefault();
          options.onAction();
          el.hudToast.classList.remove('show');
        };
      } else {
        el.hudToastAction.style.display = 'none';
        el.hudToastAction.onclick = null;
      }
    }

    el.hudToast.classList.add('show');
    toastTimer = setTimeout(() => {
      el.hudToast.classList.remove('show');
    }, options && options.duration ? options.duration : 3500);
  }

  function downloadBlob(content, filename, contentType) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 300);
  }

  function isSameUrl(a, b) {
    if (!a || !b) return false;
    try {
      const uA = new URL(a);
      const uB = new URL(b);
      return (uA.origin + uA.pathname) === (uB.origin + uB.pathname);
    } catch (e) {
      return a === b;
    }
  }

  function getTimestampStr() {
    return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  }

})();
