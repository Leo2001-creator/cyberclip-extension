/**
 * CYBERCLIP // POPUP LOGIC (popup.js) v1.2.0
 * High-Tech Cyberpunk HUD Controller
 * Features:
 *  - 4 Navigation Tabs: 01. NOTA RÁPIDA, 02. BANCO DATOS, 03. TELEMETRÍA, 04. CONFIG
 *  - Configurable 6-color palette linked to customizable tags (IDEA, RESEARCH, DEV, BUG, LECTURA, DOCS)
 *  - Favorite system (★) with small yellow star, favorites filter, and anti-purge memory protection shield
 *  - In-Page neon highlighter toggle
 *  - Rectangular color selector widget with electric yellow border & dark blue fill
 *  - Storage persistence (chrome.storage.local with localStorage fallback)
 *  - Live text search, URL scope filtering, Markdown & JSON I/O
 */

(() => {
  'use strict';

  // --- CONSTANTS & CONFIGURATION ---
  const STORAGE_KEY = 'cyberclip_records';
  const SETTINGS_KEY = 'cyberclip_settings';
  const MAX_STORAGE_BYTES = 100 * 1024 * 1024; // Límite estricto: 100 MB exactos (104.857.600 bytes)

  const DEFAULT_PALETTE = [
    { id: 'c1', color: '#FCEE0A', tag: 'IDEA', name: 'Amarillo Neón' },
    { id: 'c2', color: '#00F0FF', tag: 'RESEARCH', name: 'Cian Eléctrico' },
    { id: 'c3', color: '#00FF66', tag: 'DEV', name: 'Verde Neón' },
    { id: 'c4', color: '#FF007F', tag: 'BUG', name: 'Magenta Neón' },
    { id: 'c5', color: '#FFA500', tag: 'LECTURA', name: 'Naranja Ámbar' },
    { id: 'c6', color: '#0070FF', tag: 'DOCS', name: 'Azul Eléctrico' }
  ];

  let state = {
    records: [],
    settings: {
      palette: JSON.parse(JSON.stringify(DEFAULT_PALETTE)),
      highlightEnabled: true,
      selectedColor: '#FCEE0A',
      selectedTag: 'IDEA'
    },
    formFavorite: false,
    activeTab: {
      url: 'https://developer.mozilla.org/es/docs/Web/API/Storage',
      title: 'MDN Web Docs // Storage API Specification',
      domain: 'developer.mozilla.org'
    },
    filter: {
      query: '',
      scope: 'current', // 'current' | 'all' | 'favorites'
      selectedTag: null
    }
  };

  // --- DOM ELEMENTS CACHE ---
  const elements = {
    // Top Telemetry Header
    hudFavCount: document.getElementById('hudFavCount'),
    hudTotalCount: document.getElementById('hudTotalCount'),
    hudStorageSize: document.getElementById('hudStorageSize'),

    // Scanner
    activeTargetBanner: document.getElementById('activeTargetBanner'),
    activeDomainLabel: document.getElementById('activeDomainLabel'),
    activeUrlText: document.getElementById('activeUrlText'),
    btnCopyActiveUrl: document.getElementById('btnCopyActiveUrl'),

    // Nav Tabs & Panels
    tabBtns: document.querySelectorAll('.hud-tab-btn'),
    panels: document.querySelectorAll('.hud-panel'),
    tabVaultCount: document.getElementById('tabVaultCount'),

    // Panel 1: Note Form
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

    // Panel 2: Vault
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

    // Panel 3: Telemetry
    diagTotalNodes: document.getElementById('diagTotalNodes'),
    diagFavNodes: document.getElementById('diagFavNodes'),
    diagTotalDomains: document.getElementById('diagTotalDomains'),
    diagStorageBytes: document.getElementById('diagStorageBytes'),
    diagDomainsList: document.getElementById('diagDomainsList'),
    btnExportMarkdown: document.getElementById('btnExportMarkdown'),
    btnExportJSON: document.getElementById('btnExportJSON'),
    fileImportJSON: document.getElementById('fileImportJSON'),
    btnPurgeAll: document.getElementById('btnPurgeAll'),

    // Panel 4: Config
    chkHighlightEnabled: document.getElementById('chkHighlightEnabled'),
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
    hudToastMsg: document.getElementById('hudToastMsg')
  };

  // --- INITIALIZATION ---
  document.addEventListener('DOMContentLoaded', async () => {
    setupTabNavigation();
    setupEventHandlers();
    await loadSettings();
    await detectActiveTab();
    await loadStorageRecords();
    renderFormColorSelector();
    renderConfigDashboard();
    renderAll();
  });

  // =========================================================================
  // 1. SETTINGS & STORAGE INTEGRATION
  // =========================================================================
  async function loadSettings() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const data = await chrome.storage.local.get([SETTINGS_KEY]);
        if (data[SETTINGS_KEY]) {
          state.settings = Object.assign({}, state.settings, data[SETTINGS_KEY]);
        }
      } else {
        const stored = localStorage.getItem(SETTINGS_KEY);
        if (stored) {
          state.settings = Object.assign({}, state.settings, JSON.parse(stored));
        }
      }
    } catch (e) {
      console.warn('[CYBERCLIP // POPUP] Settings fallback:', e);
    }

    if (!Array.isArray(state.settings.palette) || state.settings.palette.length !== 6) {
      state.settings.palette = JSON.parse(JSON.stringify(DEFAULT_PALETTE));
    }

    // Default selection
    if (!state.settings.selectedColor && state.settings.palette[0]) {
      state.settings.selectedColor = state.settings.palette[0].color;
      state.settings.selectedTag = state.settings.palette[0].tag;
    }
  }

  async function persistSettings() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({ [SETTINGS_KEY]: state.settings });
      } else {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
      }
    } catch (e) {
      console.error('[CYBERCLIP // POPUP] Error saving settings:', e);
    }
  }

  async function loadStorageRecords() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const result = await chrome.storage.local.get([STORAGE_KEY]);
        if (Array.isArray(result[STORAGE_KEY])) {
          state.records = result[STORAGE_KEY];
        } else {
          state.records = getDemoSeedData();
          await chrome.storage.local.set({ [STORAGE_KEY]: state.records });
        }
      } else {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          state.records = JSON.parse(stored);
        } else {
          state.records = getDemoSeedData();
          localStorage.setItem(STORAGE_KEY, JSON.stringify(state.records));
        }
      }
    } catch (err) {
      console.error('[CYBERCLIP // POPUP] Storage load error:', err);
      state.records = getDemoSeedData();
    }

    // Ensure all records have favorite & color normalized
    state.records.forEach(r => {
      if (typeof r.favorite !== 'boolean') r.favorite = false;
      if (!r.color) r.color = '#FCEE0A';
    });
  }

  async function persistRecords() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({ [STORAGE_KEY]: state.records });
        chrome.runtime.sendMessage({ action: 'UPDATE_BADGE' }).catch(() => {});
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.records));
      }
    } catch (err) {
      console.error('[CYBERCLIP // POPUP] Persist error:', err);
    }
    renderAll();
  }

  // =========================================================================
  // 2. TAB NAVIGATION
  // =========================================================================
  function setupTabNavigation() {
    elements.tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');

        elements.tabBtns.forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-selected', 'false');
        });
        elements.panels.forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');

        const panel = document.getElementById(targetTab);
        if (panel) panel.classList.add('active');

        if (targetTab === 'tab-vault') {
          renderVault();
        } else if (targetTab === 'tab-system') {
          renderTelemetry();
        } else if (targetTab === 'tab-config') {
          renderConfigDashboard();
        }
      });
    });
  }

  // =========================================================================
  // 3. EVENT HANDLERS
  // =========================================================================
  function setupEventHandlers() {
    // Copy active URL
    elements.btnCopyActiveUrl.addEventListener('click', () => {
      copyToClipboard(state.activeTab.url, 'URL COPIADA AL PORTAPAPELES');
    });

    elements.activeUrlText.addEventListener('click', () => {
      copyToClipboard(state.activeTab.url, 'URL COPIADA AL PORTAPAPELES');
    });

    // Form: Favorite Star toggle
    elements.btnToggleFavoriteForm.addEventListener('click', () => {
      state.formFavorite = !state.formFavorite;
      updateFormFavoriteButton();
    });

    // Form submit
    elements.formQuickNote.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleSaveManualNote();
    });

    // Grab selection
    elements.btnGrabSelection.addEventListener('click', handleGrabSelection);

    // Quick tags
    elements.quickTagBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tag = btn.getAttribute('data-tag');
        const current = elements.inputTags.value.trim();
        if (!current) {
          elements.inputTags.value = tag;
        } else if (!current.split(',').map(s => s.trim().toUpperCase()).includes(tag)) {
          elements.inputTags.value = `${current}, ${tag}`;
        }
        elements.inputTags.focus();
      });
    });

    // Vault search
    elements.searchFilterInput.addEventListener('input', (e) => {
      state.filter.query = e.target.value.trim().toLowerCase();
      renderVault();
    });

    elements.btnClearSearch.addEventListener('click', () => {
      elements.searchFilterInput.value = '';
      state.filter.query = '';
      renderVault();
    });

    // Vault scope toggles (ESTA PÁGINA | TODOS | FAVORITOS)
    elements.btnScopeThisPage.addEventListener('click', () => setVaultScope('current'));
    elements.btnScopeAll.addEventListener('click', () => setVaultScope('all'));
    elements.btnScopeFavorites.addEventListener('click', () => setVaultScope('favorites'));

    // Telemetry I/O Actions
    elements.btnExportMarkdown.addEventListener('click', exportToMarkdown);
    elements.btnExportJSON.addEventListener('click', exportToJSON);
    elements.fileImportJSON.addEventListener('change', handleImportJSON);
    elements.btnPurgeAll.addEventListener('click', openPurgeModal);

    // Purge Modal actions
    elements.btnCancelPurge.addEventListener('click', closePurgeModal);
    elements.btnExecutePurge.addEventListener('click', handleExecutePurge);

    // Config Panel actions
    elements.btnSavePaletteConfig.addEventListener('click', handleSaveConfigFromUi);
    elements.btnResetPaletteConfig.addEventListener('click', handleResetDefaultPalette);
    elements.chkHighlightEnabled.addEventListener('change', async (e) => {
      state.settings.highlightEnabled = e.target.checked;
      await persistSettings();
      showToast(state.settings.highlightEnabled ? 'RESALTADO EN PÁGINA: ACTIVADO' : 'RESALTADO EN PÁGINA: DESACTIVADO');
    });
  }

  function setVaultScope(scope) {
    state.filter.scope = scope;
    elements.btnScopeThisPage.classList.toggle('active', scope === 'current');
    elements.btnScopeAll.classList.toggle('active', scope === 'all');
    elements.btnScopeFavorites.classList.toggle('active', scope === 'favorites');
    renderVault();
  }

  function updateFormFavoriteButton() {
    const isFav = state.formFavorite;
    elements.btnToggleFavoriteForm.classList.toggle('is-favorite', isFav);
    const statusText = elements.btnToggleFavoriteForm.querySelector('.fav-status-text');
    if (statusText) {
      statusText.textContent = isFav ? '★ BLINDADO' : 'NO FAV';
    }
  }

  // =========================================================================
  // 4. FORM RECTANGULAR COLOR SELECTOR (YELLOW BORDER + DARK BLUE FILL)
  // =========================================================================
  function renderFormColorSelector() {
    elements.formColorSwatchesRow.innerHTML = '';
    const palette = state.settings.palette || DEFAULT_PALETTE;

    palette.forEach(slot => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `swatch-btn ${slot.color === state.settings.selectedColor ? 'active' : ''}`;
      btn.style.backgroundColor = slot.color;
      btn.style.color = slot.color;
      btn.setAttribute('data-color', slot.color);
      btn.setAttribute('data-tag', slot.tag);
      btn.title = `#${slot.tag} — ${slot.name || slot.color}`;

      btn.addEventListener('mouseenter', () => {
        elements.formColorTagLabel.textContent = `#${slot.tag}`;
        elements.formColorTagLabel.style.color = slot.color;
      });

      btn.addEventListener('mouseleave', () => {
        elements.formColorTagLabel.textContent = `#${state.settings.selectedTag || 'IDEA'}`;
        elements.formColorTagLabel.style.color = state.settings.selectedColor || '#00F0FF';
      });

      btn.addEventListener('click', () => {
        state.settings.selectedColor = slot.color;
        state.settings.selectedTag = slot.tag;
        updateActiveFormSwatch();
      });

      elements.formColorSwatchesRow.appendChild(btn);
    });

    updateActiveFormSwatch();
  }

  function updateActiveFormSwatch() {
    const buttons = elements.formColorSwatchesRow.querySelectorAll('.swatch-btn');
    buttons.forEach(btn => {
      const matches = btn.getAttribute('data-color') === state.settings.selectedColor;
      btn.classList.toggle('active', matches);
    });

    elements.formColorTagLabel.textContent = `#${state.settings.selectedTag || 'IDEA'}`;
    elements.formColorTagLabel.style.color = state.settings.selectedColor || '#00F0FF';
    elements.formActiveTagBadge.textContent = `TAG: #${state.settings.selectedTag || 'IDEA'}`;
    elements.formActiveTagBadge.style.color = state.settings.selectedColor || '#FCEE0A';
  }

  // =========================================================================
  // 5. ACTIVE TAB DETECTION
  // =========================================================================
  async function detectActiveTab() {
    try {
      if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs && tabs[0] && tabs[0].url) {
          const tab = tabs[0];
          state.activeTab = {
            url: tab.url,
            title: tab.title || extractDomain(tab.url),
            domain: extractDomain(tab.url)
          };
        }
      }
    } catch (err) {
      console.warn('[CYBERCLIP] Tab detection fallback:', err);
    }

    elements.activeDomainLabel.textContent = `HOST: ${state.activeTab.domain.toUpperCase()}`;
    elements.activeUrlText.textContent = state.activeTab.url;
    elements.activeUrlText.title = `${state.activeTab.title} — ${state.activeTab.url}`;
  }

  // =========================================================================
  // 6. SAVE RECORD (NOTE / SNIPPET)
  // =========================================================================
  async function handleSaveManualNote() {
    const content = elements.inputContent.value.trim();
    const note = elements.inputNote.value.trim();
    const tagsRaw = elements.inputTags.value.trim();

    if (!content && !note) {
      showToast('⚠️ INGRESA AL MENOS UN FRAGMENTO O NOTA');
      elements.inputContent.focus();
      return;
    }

    const assignedTag = state.settings.selectedTag || 'IDEA';
    const otherTags = tagsRaw
      ? tagsRaw.split(',').map(t => t.trim().toUpperCase()).filter(Boolean)
      : [];

    const finalTags = [assignedTag, ...otherTags.filter(t => t !== assignedTag)];

    const newRecord = {
      id: `manual_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: content ? 'SNIPPET' : 'NOTE',
      title: state.activeTab.title,
      url: state.activeTab.url,
      domain: state.activeTab.domain,
      content: content || '(Sin fragmento de texto)',
      note: note,
      color: state.settings.selectedColor || '#FCEE0A',
      favorite: state.formFavorite,
      tags: finalTags,
      timestamp: Date.now(),
      formattedDate: formatTechDate(new Date())
    };

    const currentBytes = new Blob([JSON.stringify(state.records)]).size;
    const newBytes = new Blob([JSON.stringify(newRecord)]).size;
    if (currentBytes + newBytes > MAX_STORAGE_BYTES) {
      showToast('⛔ LÍMITE ESTRICTO DE 100 MB ALCANZADO // PURGA REGISTROS');
      return;
    }

    state.records.unshift(newRecord);
    await persistRecords();

    // Reset Form
    elements.inputContent.value = '';
    elements.inputNote.value = '';
    elements.inputTags.value = '';
    state.formFavorite = false;
    updateFormFavoriteButton();

    showToast(newRecord.favorite ? '★ FRAGMENTO FAVORITO REGISTRADO' : '⚡ FRAGMENTO REGISTRADO EN HUD');

    setTimeout(() => {
      document.getElementById('tabBtnVault').click();
    }, 380);
  }

  async function handleGrabSelection() {
    try {
      if (typeof chrome !== 'undefined' && chrome.tabs && chrome.scripting) {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs && tabs[0]) {
          const results = await chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: () => window.getSelection().toString()
          });

          if (results && results[0] && results[0].result) {
            const sel = results[0].result.trim();
            if (sel) {
              elements.inputContent.value = sel;
              showToast('⚡ SELECCIÓN EXTRAÍDA DE LA PÁGINA');
              return;
            }
          }
        }
      }

      if (navigator.clipboard && navigator.clipboard.readText) {
        try {
          const text = await navigator.clipboard.readText();
          if (text) {
            elements.inputContent.value = text;
            showToast('📋 TEXTO PEGADO DESDE PORTAPAPELES');
            return;
          }
        } catch (e) {}
      }

      showToast('⚠️ NO HAY TEXTO SELECCIONADO EN LA PÁGINA');
    } catch (err) {
      showToast('⚠️ RESALTA TEXTO EN LA PÁGINA O USA CLIC DERECHO');
    }
  }

  // =========================================================================
  // 7. VAULT RENDERING, FAVORITES & CARDS
  // =========================================================================
  function renderVault() {
    const filtered = getFilteredRecords();
    elements.vaultCardsContainer.innerHTML = '';

    // Update scope counters
    const pageClips = state.records.filter(r => isSameUrl(r.url, state.activeTab.url));
    const favClips = state.records.filter(r => r.favorite);
    elements.countThisPage.textContent = pageClips.length;
    elements.countAll.textContent = state.records.length;
    elements.countFavorites.textContent = favClips.length;

    renderTagFilterPills();

    if (filtered.length === 0) {
      elements.vaultEmptyState.style.display = 'flex';
      return;
    }

    elements.vaultEmptyState.style.display = 'none';

    filtered.forEach(record => {
      const card = createCardElement(record);
      elements.vaultCardsContainer.appendChild(card);
    });
  }

  function getFilteredRecords() {
    return state.records.filter(item => {
      // Scope filter
      if (state.filter.scope === 'current') {
        if (!isSameUrl(item.url, state.activeTab.url)) return false;
      } else if (state.filter.scope === 'favorites') {
        if (!item.favorite) return false;
      }

      // Tag filter
      if (state.filter.selectedTag) {
        if (!item.tags || !item.tags.includes(state.filter.selectedTag)) return false;
      }

      // Search query
      if (state.filter.query) {
        const q = state.filter.query;
        const matchesContent = (item.content || '').toLowerCase().includes(q);
        const matchesNote = (item.note || '').toLowerCase().includes(q);
        const matchesTitle = (item.title || '').toLowerCase().includes(q);
        const matchesDomain = (item.domain || '').toLowerCase().includes(q);
        const matchesTag = (item.tags || []).some(t => t.toLowerCase().includes(q));
        if (!matchesContent && !matchesNote && !matchesTitle && !matchesDomain && !matchesTag) {
          return false;
        }
      }

      return true;
    });
  }

  function createCardElement(record) {
    const card = document.createElement('article');
    card.className = 'vault-card';
    card.setAttribute('data-id', record.id);

    const clipColor = record.color || '#FCEE0A';
    card.style.setProperty('--card-accent', clipColor);

    const typeClass = record.type || 'SNIPPET';
    const primaryTag = (record.tags && record.tags[0]) ? record.tags[0] : null;

    // Build tags markup
    const tagsHtml = (record.tags || [])
      .map(t => `<span class="card-tag-item">#${escapeHtml(t)}</span>`)
      .join('');

    card.innerHTML = `
      <div class="card-topbar">
        <div class="card-topbar-left">
          <button type="button" class="card-btn-star ${record.favorite ? 'is-favorite' : ''}" title="${record.favorite ? 'Quitar de favoritos blindados' : 'Marcar como favorito protegido (★)'}">
            ★
          </button>
          <span class="card-badge-type ${typeClass}">${escapeHtml(typeClass)}</span>
          ${primaryTag ? `<span class="card-tag-color-chip" style="border-color:${clipColor};color:${clipColor}">#${escapeHtml(primaryTag)}</span>` : ''}
        </div>
        <span class="card-meta-date">${escapeHtml(record.formattedDate || '')}</span>
      </div>

      <div class="card-origin">
        <span class="origin-bracket">▶</span>
        <a href="${escapeHtml(record.url)}" target="_blank" title="${escapeHtml(record.url)}">
          ${escapeHtml(record.title || record.domain || 'ORIGEN DESCONOCIDO')}
        </a>
      </div>

      <div class="card-content-body" style="border-left-color:${clipColor}">${escapeHtml(record.content || '')}</div>

      ${record.note ? `<div class="card-user-note">// ${escapeHtml(record.note)}</div>` : ''}

      ${tagsHtml ? `<div class="card-tags-list">${tagsHtml}</div>` : ''}

      <div class="card-actions-bar">
        <button type="button" class="card-btn btn-copy" title="Copiar al portapapeles">[COPIAR]</button>
        <button type="button" class="card-btn btn-open" title="Abrir URL original">[IR A URL]</button>
        <button type="button" class="card-btn btn-md" title="Descargar Markdown">[MD]</button>
        <button type="button" class="card-btn btn-delete" title="Eliminar fragmento">[BORRAR]</button>
      </div>
    `;

    // Star favorite toggle click
    const starBtn = card.querySelector('.card-btn-star');
    starBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      record.favorite = !record.favorite;
      await persistRecords();
      showToast(record.favorite ? '★ MARCADO COMO FAVORITO PROTEGIDO' : '☆ REMOVIDO DE FAVORITOS');
    });

    // Copy action
    card.querySelector('.btn-copy').addEventListener('click', () => {
      const textToCopy = record.content + (record.note ? `\n\nNota: ${record.note}` : '');
      copyToClipboard(textToCopy, 'FRAGMENTO COPIADO');
    });

    // Open URL action
    card.querySelector('.btn-open').addEventListener('click', () => {
      if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
        chrome.tabs.create({ url: record.url });
      } else {
        window.open(record.url, '_blank');
      }
    });

    // Markdown single download
    card.querySelector('.btn-md').addEventListener('click', () => {
      exportSingleToMarkdown(record);
    });

    // Delete single record
    card.querySelector('.btn-delete').addEventListener('click', async () => {
      await deleteRecord(record.id);
    });

    return card;
  }

  function renderTagFilterPills() {
    const allTags = new Set();
    state.records.forEach(r => (r.tags || []).forEach(t => allTags.add(t)));

    elements.activeTagPillsBar.innerHTML = '';
    if (allTags.size === 0) return;

    // "Todos los tags"
    const allPill = document.createElement('button');
    allPill.type = 'button';
    allPill.className = `tag-pill ${state.filter.selectedTag === null ? 'active' : ''}`;
    allPill.textContent = 'TODOS';
    allPill.addEventListener('click', () => {
      state.filter.selectedTag = null;
      renderVault();
    });
    elements.activeTagPillsBar.appendChild(allPill);

    allTags.forEach(tag => {
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = `tag-pill ${state.filter.selectedTag === tag ? 'active' : ''}`;
      pill.textContent = `#${tag}`;
      pill.addEventListener('click', () => {
        state.filter.selectedTag = state.filter.selectedTag === tag ? null : tag;
        renderVault();
      });
      elements.activeTagPillsBar.appendChild(pill);
    });
  }

  async function deleteRecord(id) {
    state.records = state.records.filter(r => r.id !== id);
    await persistRecords();
    showToast('FRAGMENTO ELIMINADO');
    renderVault();
  }

  // =========================================================================
  // 8. TELEMETRY & PURGE WITH FAVORITES SHIELD
  // =========================================================================
  async function renderTelemetry() {
    const total = state.records.length;
    const favCount = state.records.filter(r => r.favorite).length;

    elements.diagTotalNodes.textContent = String(total).padStart(2, '0');
    elements.diagFavNodes.textContent = String(favCount).padStart(2, '0');

    // Unique domains
    const domainCounts = {};
    state.records.forEach(r => {
      const d = r.domain || extractDomain(r.url);
      domainCounts[d] = (domainCounts[d] || 0) + 1;
    });

    const uniqueDomainsCount = Object.keys(domainCounts).length;
    elements.diagTotalDomains.textContent = String(uniqueDomainsCount).padStart(2, '0');

    // Storage memory size
    let bytesUsed = 0;
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local && chrome.storage.local.getBytesInUse) {
      try {
        bytesUsed = await chrome.storage.local.getBytesInUse([STORAGE_KEY, SETTINGS_KEY]);
      } catch (e) {
        bytesUsed = new Blob([JSON.stringify(state.records)]).size;
      }
    } else {
      bytesUsed = new Blob([JSON.stringify(state.records)]).size;
    }

    const kbUsed = (bytesUsed / 1024).toFixed(2);
    const isFull = bytesUsed >= MAX_STORAGE_BYTES;
    elements.diagStorageBytes.textContent = `${kbUsed} KB`;
    elements.hudStorageSize.textContent = isFull ? '100MB (LLENO)' : `${kbUsed} KB / 100MB`;
    if (isFull) {
      elements.hudStorageSize.style.color = '#FF003C';
    } else {
      elements.hudStorageSize.style.color = '';
    }

    // Render domain breakdown
    elements.diagDomainsList.innerHTML = '';
    const sortedDomains = Object.entries(domainCounts).sort((a, b) => b[1] - a[1]);

    if (sortedDomains.length === 0) {
      elements.diagDomainsList.innerHTML = '<div class="diag-loading">Sin datos de dominios.</div>';
    } else {
      sortedDomains.slice(0, 5).forEach(([dom, count]) => {
        const row = document.createElement('div');
        row.className = 'domain-stat-row';
        row.innerHTML = `
          <span class="domain-stat-name">${escapeHtml(dom)}</span>
          <span class="domain-stat-count">${count} SNIPPET(S)</span>
        `;
        elements.diagDomainsList.appendChild(row);
      });
    }
  }

  // Purge modal logic
  function openPurgeModal() {
    if (state.records.length === 0) {
      showToast('⚠️ EL BANCO DE DATOS YA ESTÁ VACÍO');
      return;
    }

    const total = state.records.length;
    const favCount = state.records.filter(r => r.favorite).length;

    elements.modalPurgeDesc.textContent = `Se eliminarán registros de la memoria local (Total: ${total}).`;
    elements.modalFavProtectedCount.textContent = `${favCount} FAVORITOS`;
    elements.chkIncludeFavoritesPurge.checked = false;

    if (favCount === 0) {
      elements.modalFavShieldBox.style.display = 'none';
      elements.chkIncludeFavoritesPurge.parentElement.style.display = 'none';
    } else {
      elements.modalFavShieldBox.style.display = 'flex';
      elements.chkIncludeFavoritesPurge.parentElement.style.display = 'flex';
    }

    elements.modalPurgeConfirm.style.display = 'flex';
  }

  function closePurgeModal() {
    elements.modalPurgeConfirm.style.display = 'none';
  }

  async function handleExecutePurge() {
    const includeFavorites = elements.chkIncludeFavoritesPurge.checked;
    const initialCount = state.records.length;
    const favCount = state.records.filter(r => r.favorite).length;

    if (includeFavorites || favCount === 0) {
      // Complete purge
      state.records = [];
      await persistRecords();
      closePurgeModal();
      showToast(`⚠️ PURGA TOTAL: ${initialCount} REGISTROS ELIMINADOS`);
    } else {
      // Protected purge: KEEP FAVORITES
      state.records = state.records.filter(r => r.favorite);
      const purgedCount = initialCount - state.records.length;
      await persistRecords();
      closePurgeModal();
      showToast(`🛡️ ${purgedCount} PURGADOS. ${favCount} FAVORITOS BLINDADOS CONSERVADOS.`);
    }

    renderAll();
  }

  // =========================================================================
  // 9. CONFIG DASHBOARD (04. CONFIG)
  // =========================================================================
  function renderConfigDashboard() {
    elements.chkHighlightEnabled.checked = state.settings.highlightEnabled !== false;
    elements.colorSlotsConfigContainer.innerHTML = '';

    const palette = state.settings.palette || DEFAULT_PALETTE;

    palette.forEach((slot, index) => {
      const row = document.createElement('div');
      row.className = 'slot-row';
      row.style.borderLeftColor = slot.color;

      row.innerHTML = `
        <span class="slot-index">SLOT 0${index + 1}</span>
        <div class="slot-picker-wrap" title="Cambiar color">
          <input type="color" class="slot-color-picker" value="${slot.color}" data-idx="${index}" />
          <span class="slot-color-preview" style="background-color: ${slot.color};"></span>
        </div>
        <input type="text" class="slot-hex-input" value="${slot.color}" maxlength="7" data-idx="${index}" spellcheck="false" />
        <input type="text" class="slot-tag-input" value="${escapeHtml(slot.tag)}" placeholder="ETIQUETA" maxlength="16" data-idx="${index}" spellcheck="false" />
      `;

      // Picker input change
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
        if (/^#[0-9A-F]{6}$/i.test(val)) {
          picker.value = val;
          preview.style.backgroundColor = val;
          row.style.borderLeftColor = val;
        }
      });

      tagInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '');
      });

      elements.colorSlotsConfigContainer.appendChild(row);
    });
  }

  async function handleSaveConfigFromUi() {
    const rows = elements.colorSlotsConfigContainer.querySelectorAll('.slot-row');
    const newPalette = [];

    rows.forEach((row, idx) => {
      const hex = row.querySelector('.slot-hex-input').value.trim().toUpperCase();
      let tag = row.querySelector('.slot-tag-input').value.trim().toUpperCase();
      if (!tag) tag = `TAG${idx + 1}`;

      const safeColor = /^#[0-9A-F]{6}$/i.test(hex) ? hex : DEFAULT_PALETTE[idx].color;

      newPalette.push({
        id: `c${idx + 1}`,
        color: safeColor,
        tag: tag,
        name: DEFAULT_PALETTE[idx].name || `Color 0${idx + 1}`
      });
    });

    state.settings.palette = newPalette;
    state.settings.highlightEnabled = elements.chkHighlightEnabled.checked;

    // Check selectedColor still exists
    const matching = newPalette.find(p => p.color === state.settings.selectedColor);
    if (matching) {
      state.settings.selectedTag = matching.tag;
    } else {
      state.settings.selectedColor = newPalette[0].color;
      state.settings.selectedTag = newPalette[0].tag;
    }

    await persistSettings();
    renderFormColorSelector();
    renderConfigDashboard();
    showToast('💾 CONFIGURACIÓN & PALETA GUARDADAS CON ÉXITO');
  }

  async function handleResetDefaultPalette() {
    state.settings.palette = JSON.parse(JSON.stringify(DEFAULT_PALETTE));
    state.settings.selectedColor = DEFAULT_PALETTE[0].color;
    state.settings.selectedTag = DEFAULT_PALETTE[0].tag;

    await persistSettings();
    renderFormColorSelector();
    renderConfigDashboard();
    showToast('↺ PALETA RESTABLECIDA A VALORES DE FÁBRICA');
  }

  // =========================================================================
  // 10. EXPORT & IMPORT MODULES
  // =========================================================================
  function exportToMarkdown() {
    if (state.records.length === 0) {
      showToast('⚠️ EL BANCO ESTÁ VACÍO');
      return;
    }

    let md = `# CYBERCLIP // EXPORTACIÓN DE FRAGMENTOS Y NOTAS\n`;
    md += `> Generado el: ${new Date().toLocaleString()} | Total registros: ${state.records.length}\n\n`;
    md += `---\n\n`;

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
        md += `- **Tags:** ${r.tags.map(t => `\`#${t}\``).join(' ')}\n`;
      }
      md += `\n**Fragmento capturado:**\n\n`;
      md += `\`\`\`text\n${r.content}\n\`\`\`\n\n`;
      if (r.note) {
        md += `**Nota personal:**\n> ${r.note}\n\n`;
      }
      md += `---\n\n`;
    });

    downloadBlob(md, `cyberclip_export_${getTimestampStr()}.md`, 'text/markdown;charset=utf-8');
    showToast('📄 MARKDOWN EXPORTADO CON ÉXITO');
  }

  function exportSingleToMarkdown(r) {
    const favStar = r.favorite ? '★ ' : '';
    let md = `# ${favStar}${r.title || 'CYBERCLIP FRAGMENTO'}\n\n`;
    md += `- **URL:** [${r.url}](${r.url})\n`;
    md += `- **Color HUD:** \`${r.color || '#FCEE0A'}\`\n`;
    md += `- **Favorito:** \`${r.favorite ? 'SÍ (★)' : 'NO'}\`\n`;
    md += `- **Fecha:** \`${r.formattedDate}\`\n`;
    if (r.tags && r.tags.length) {
      md += `- **Tags:** ${r.tags.map(t => `\`#${t}\``).join(' ')}\n`;
    }
    md += `\n## Contenido\n\n\`\`\`text\n${r.content}\n\`\`\`\n\n`;
    if (r.note) {
      md += `## Nota Personal\n\n> ${r.note}\n\n`;
    }

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
      version: '1.2.0',
      client: 'CYBERCLIP_HUD_EXTENSION',
      exportedAt: new Date().toISOString(),
      totalRecords: state.records.length,
      settings: state.settings,
      records: state.records
    };

    const jsonStr = JSON.stringify(payload, null, 2);
    downloadBlob(jsonStr, `cyberclip_backup_${getTimestampStr()}.json`, 'application/json;charset=utf-8');
    showToast('💾 ARCHIVO JSON GENERADO');
  }

  function handleImportJSON(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        const importedList = Array.isArray(parsed) ? parsed : (parsed.records || []);

        if (!Array.isArray(importedList) || importedList.length === 0) {
          showToast('⚠️ ARCHIVO JSON INVÁLIDO O VACÍO');
          return;
        }

        const existingIds = new Set(state.records.map(r => r.id));
        let addedCount = 0;

        importedList.forEach(item => {
          if (item && item.content && !existingIds.has(item.id)) {
            state.records.push({
              id: item.id || `imp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              type: item.type || 'SNIPPET',
              title: item.title || 'Importado',
              url: item.url || 'https://unknown',
              domain: item.domain || extractDomain(item.url || ''),
              content: item.content,
              note: item.note || '',
              color: item.color || '#FCEE0A',
              favorite: Boolean(item.favorite),
              tags: Array.isArray(item.tags) ? item.tags : ['IMPORTADO'],
              timestamp: item.timestamp || Date.now(),
              formattedDate: item.formattedDate || formatTechDate(new Date())
            });
            existingIds.add(item.id);
            addedCount++;
          }
        });

        if (parsed.settings && Array.isArray(parsed.settings.palette)) {
          state.settings = Object.assign({}, state.settings, parsed.settings);
          await persistSettings();
          renderFormColorSelector();
          renderConfigDashboard();
        }

        await persistRecords();
        showToast(`📂 ${addedCount} FRAGMENTOS IMPORTADOS`);
        event.target.value = '';
      } catch (err) {
        showToast('⚠️ ERROR AL PROCESAR EL JSON');
      }
    };
    reader.readAsText(file);
  }

  // =========================================================================
  // 11. GENERAL HELPERS & SEED DATA
  // =========================================================================
  function renderAll() {
    const total = state.records.length;
    const favCount = state.records.filter(r => r.favorite).length;

    elements.hudTotalCount.textContent = String(total).padStart(2, '0');
    elements.hudFavCount.textContent = String(favCount).padStart(2, '0');
    elements.tabVaultCount.textContent = String(total);

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
  function showToast(msg) {
    if (toastTimer) clearTimeout(toastTimer);
    elements.hudToastMsg.textContent = msg;
    elements.hudToast.classList.add('show');
    toastTimer = setTimeout(() => {
      elements.hudToast.classList.remove('show');
    }, 2400);
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

  function isSameUrl(urlA, urlB) {
    if (!urlA || !urlB) return false;
    try {
      const a = new URL(urlA);
      const b = new URL(urlB);
      return (a.origin + a.pathname) === (b.origin + b.pathname);
    } catch (e) {
      return urlA === urlB;
    }
  }

  function extractDomain(urlStr) {
    try {
      const parsed = new URL(urlStr);
      return parsed.hostname.replace(/^www\./, '');
    } catch (e) {
      return 'localhost';
    }
  }

  function formatTechDate(d) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}.${pad(d.getMonth()+1)}.${pad(d.getDate())} // ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  function getTimestampStr() {
    return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getDemoSeedData() {
    const now = new Date();
    return [
      {
        id: 'seed_01',
        type: 'SNIPPET',
        title: 'MDN Web Docs // chrome.storage Local API',
        url: 'https://developer.mozilla.org/es/docs/Web/API/Storage',
        domain: 'developer.mozilla.org',
        content: 'chrome.storage.local permite persistir estructuras JSON asíncronas sin límite estricto de 5MB como el localStorage tradicional.',
        note: 'Ideal para almacenar miles de fragmentos sin bloquear el hilo principal.',
        color: '#FCEE0A',
        favorite: true,
        tags: ['IDEA', 'CHROME_API', 'STORAGE'],
        timestamp: now.getTime() - 1000 * 60 * 30,
        formattedDate: formatTechDate(new Date(now.getTime() - 1000 * 60 * 30))
      },
      {
        id: 'seed_02',
        type: 'SNIPPET',
        title: 'GitHub // Architecture Notes Manifest V3',
        url: 'https://github.com/developer/manifest-v3-guide',
        domain: 'github.com',
        content: 'En Manifest V3 los Background Scripts son sustituidos por Service Workers efímeros que se activan bajo eventos de chrome.contextMenus.',
        note: 'Revisar ciclo de vida: no almacenar variables globales en memoria RAM.',
        color: '#00F0FF',
        favorite: false,
        tags: ['RESEARCH', 'MANIFEST_V3', 'SERVICE_WORKER'],
        timestamp: now.getTime() - 1000 * 60 * 60 * 2,
        formattedDate: formatTechDate(new Date(now.getTime() - 1000 * 60 * 60 * 2))
      },
      {
        id: 'seed_03',
        type: 'SNIPPET',
        title: 'Security // Memory Purge Guard & Data Vault',
        url: 'https://developer.mozilla.org/es/docs/Web/API/Storage',
        domain: 'developer.mozilla.org',
        content: 'Los fragmentos marcados como FAVORITOS (★) poseen blindaje contra purgas masivas accidentales en el HUD terminal.',
        note: 'Sistema de protección de seguridad activo en v1.2.0.',
        color: '#00FF66',
        favorite: true,
        tags: ['DEV', 'SEGURIDAD', 'FAVORITOS'],
        timestamp: now.getTime() - 1000 * 60 * 15,
        formattedDate: formatTechDate(new Date(now.getTime() - 1000 * 60 * 15))
      }
    ];
  }

})();
