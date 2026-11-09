/**
 * CYBERCLIP // POPUP LOGIC (popup.js)
 * High-Tech Cyberpunk HUD Controller
 * Features:
 *  - chrome.storage.local persistence (with localStorage fallback for demo/standalone)
 *  - Active tab URL & title detection
 *  - Live text search & URL-scoped filtering
 *  - Markdown & JSON export / JSON import
 *  - Telemetry byte counter and domain statistics
 */

(() => {
  'use strict';

  // --- CONSTANTS & STATE ---
  const STORAGE_KEY = 'cyberclip_records';
  
  let state = {
    records: [],
    activeTab: {
      url: 'https://developer.mozilla.org/es/docs/Web/API/Storage',
      title: 'MDN Web Docs // Storage API Specification',
      domain: 'developer.mozilla.org'
    },
    filter: {
      query: '',
      scope: 'current', // 'current' or 'all'
      selectedTag: null
    }
  };

  // --- DOM ELEMENTS ---
  const elements = {
    // Header Telemetry
    hudTotalCount: document.getElementById('hudTotalCount'),
    hudStorageSize: document.getElementById('hudStorageSize'),
    
    // Scanner
    activeTargetBanner: document.getElementById('activeTargetBanner'),
    activeDomainLabel: document.getElementById('activeDomainLabel'),
    activeUrlText: document.getElementById('activeUrlText'),
    btnCopyActiveUrl: document.getElementById('btnCopyActiveUrl'),

    // Nav tabs
    tabBtns: document.querySelectorAll('.hud-tab-btn'),
    panels: document.querySelectorAll('.hud-panel'),
    tabVaultCount: document.getElementById('tabVaultCount'),

    // Form
    formQuickNote: document.getElementById('formQuickNote'),
    inputContent: document.getElementById('inputContent'),
    inputNote: document.getElementById('inputNote'),
    inputTags: document.getElementById('inputTags'),
    btnGrabSelection: document.getElementById('btnGrabSelection'),
    quickTagBtns: document.querySelectorAll('.quick-tag-btn'),
    btnSaveRecord: document.getElementById('btnSaveRecord'),

    // Vault
    searchFilterInput: document.getElementById('searchFilterInput'),
    btnClearSearch: document.getElementById('btnClearSearch'),
    btnScopeThisPage: document.getElementById('btnScopeThisPage'),
    btnScopeAll: document.getElementById('btnScopeAll'),
    countThisPage: document.getElementById('countThisPage'),
    countAll: document.getElementById('countAll'),
    activeTagPillsBar: document.getElementById('activeTagPillsBar'),
    vaultCardsContainer: document.getElementById('vaultCardsContainer'),
    vaultEmptyState: document.getElementById('vaultEmptyState'),

    // Telemetry Panel
    diagTotalNodes: document.getElementById('diagTotalNodes'),
    diagTotalDomains: document.getElementById('diagTotalDomains'),
    diagStorageBytes: document.getElementById('diagStorageBytes'),
    diagStorageStatus: document.getElementById('diagStorageStatus'),
    diagDomainsList: document.getElementById('diagDomainsList'),
    btnExportMarkdown: document.getElementById('btnExportMarkdown'),
    btnExportJSON: document.getElementById('btnExportJSON'),
    fileImportJSON: document.getElementById('fileImportJSON'),
    btnPurgeAll: document.getElementById('btnPurgeAll'),

    // Toast
    hudToast: document.getElementById('hudToast'),
    hudToastMsg: document.getElementById('hudToastMsg')
  };

  // --- INITIALIZATION ---
  document.addEventListener('DOMContentLoaded', async () => {
    setupTabNavigation();
    setupEventHandlers();
    await detectActiveTab();
    await loadStorageRecords();
    renderAll();
  });

  // --- TAB NAVIGATION ---
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
        }
      });
    });
  }

  // --- EVENT HANDLERS ---
  function setupEventHandlers() {
    // Quick copy active URL
    elements.btnCopyActiveUrl.addEventListener('click', () => {
      copyToClipboard(state.activeTab.url, 'URL COPIADA AL PORTAPAPELES');
    });

    elements.activeUrlText.addEventListener('click', () => {
      copyToClipboard(state.activeTab.url, 'URL COPIADA AL PORTAPAPELES');
    });

    // Form submit
    elements.formQuickNote.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleSaveManualNote();
    });

    // Quick grab selection
    elements.btnGrabSelection.addEventListener('click', handleGrabSelection);

    // Quick tag pills on form
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

    // Search and Filters
    elements.searchFilterInput.addEventListener('input', (e) => {
      state.filter.query = e.target.value.trim().toLowerCase();
      renderVault();
    });

    elements.btnClearSearch.addEventListener('click', () => {
      elements.searchFilterInput.value = '';
      state.filter.query = '';
      renderVault();
    });

    // Scope toggle
    elements.btnScopeThisPage.addEventListener('click', () => {
      setVaultScope('current');
    });

    elements.btnScopeAll.addEventListener('click', () => {
      setVaultScope('all');
    });

    // Telemetry Actions
    elements.btnExportMarkdown.addEventListener('click', exportToMarkdown);
    elements.btnExportJSON.addEventListener('click', exportToJSON);
    elements.fileImportJSON.addEventListener('change', handleImportJSON);
    elements.btnPurgeAll.addEventListener('click', handlePurgeAll);
  }

  function setVaultScope(scope) {
    state.filter.scope = scope;
    if (scope === 'current') {
      elements.btnScopeThisPage.classList.add('active');
      elements.btnScopeAll.classList.remove('active');
    } else {
      elements.btnScopeAll.classList.add('active');
      elements.btnScopeThisPage.classList.remove('active');
    }
    renderVault();
  }

  // --- ACTIVE TAB DETECTION ---
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
      console.warn('[CYBERCLIP] Fallback to simulated tab context:', err);
    }

    // Render active target banner
    elements.activeDomainLabel.textContent = `HOST: ${state.activeTab.domain.toUpperCase()}`;
    elements.activeUrlText.textContent = state.activeTab.url;
    elements.activeUrlText.title = `${state.activeTab.title} — ${state.activeTab.url}`;
  }

  // --- STORAGE INTEGRATION (Manifest V3 + Fallback) ---
  async function loadStorageRecords() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const result = await chrome.storage.local.get([STORAGE_KEY]);
        if (Array.isArray(result[STORAGE_KEY])) {
          state.records = result[STORAGE_KEY];
        } else {
          // If first launch, load initial seed demo
          state.records = getDemoSeedData();
          await chrome.storage.local.set({ [STORAGE_KEY]: state.records });
        }
      } else {
        // Fallback to localStorage for browser testing
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          state.records = JSON.parse(stored);
        } else {
          state.records = getDemoSeedData();
          localStorage.setItem(STORAGE_KEY, JSON.stringify(state.records));
        }
      }
    } catch (err) {
      console.error('[CYBERCLIP // STORAGE ERROR]', err);
      state.records = getDemoSeedData();
    }
  }

  async function persistRecords() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({ [STORAGE_KEY]: state.records });
        // Notify background to update badge
        chrome.runtime.sendMessage({ action: 'UPDATE_BADGE' }).catch(() => {});
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.records));
      }
    } catch (err) {
      console.error('[CYBERCLIP // PERSIST ERROR]', err);
    }
    renderAll();
  }

  // --- SAVE ACTIONS ---
  async function handleSaveManualNote() {
    const content = elements.inputContent.value.trim();
    const note = elements.inputNote.value.trim();
    const tagsRaw = elements.inputTags.value.trim();

    if (!content && !note) {
      showToast('⚠️ INGRESA AL MENOS UN FRAGMENTO O NOTA');
      elements.inputContent.focus();
      return;
    }

    const tagsList = tagsRaw
      ? tagsRaw.split(',').map(t => t.trim().toUpperCase()).filter(Boolean)
      : ['NOTA'];

    const newRecord = {
      id: `manual_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: content ? 'SNIPPET' : 'NOTE',
      title: state.activeTab.title,
      url: state.activeTab.url,
      domain: state.activeTab.domain,
      content: content || '(Sin fragmento de texto)',
      note: note,
      tags: tagsList,
      timestamp: Date.now(),
      formattedDate: formatTechDate(new Date())
    };

    // Prepend
    state.records.unshift(newRecord);
    await persistRecords();

    // Reset Form
    elements.inputContent.value = '';
    elements.inputNote.value = '';
    elements.inputTags.value = '';

    showToast('⚡ FRAGMENTO REGISTRADO CON ÉXITO');

    // Switch to Vault tab to view it
    setTimeout(() => {
      document.getElementById('tabBtnVault').click();
    }, 400);
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

      // Fallback: check clipboard
      if (navigator.clipboard && navigator.clipboard.readText) {
        try {
          const text = await navigator.clipboard.readText();
          if (text) {
            elements.inputContent.value = text;
            showToast('📋 PORTAPAPELES IMPORTADO AL FORMULARIO');
            return;
          }
        } catch (e) {
          // Ignore
        }
      }

      showToast('⚠️ NO HAY TEXTO SELECCIONADO');
    } catch (err) {
      showToast('⚠️ USA EL CLIC DERECHO EN LA PÁGINA');
    }
  }

  // --- VAULT RENDERING & FILTERING ---
  function renderVault() {
    const filtered = getFilteredRecords();
    elements.vaultCardsContainer.innerHTML = '';

    // Update counts
    const pageClips = state.records.filter(r => isSameUrl(r.url, state.activeTab.url));
    elements.countThisPage.textContent = pageClips.length;
    elements.countAll.textContent = state.records.length;

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
        if (!isSameUrl(item.url, state.activeTab.url)) {
          return false;
        }
      }

      // Tag filter
      if (state.filter.selectedTag) {
        if (!item.tags || !item.tags.includes(state.filter.selectedTag)) {
          return false;
        }
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

    const typeClass = record.type || 'SNIPPET';

    // Build tags markup
    const tagsHtml = (record.tags || [])
      .map(t => `<span class="card-tag-item">#${escapeHtml(t)}</span>`)
      .join('');

    card.innerHTML = `
      <div class="card-topbar">
        <span class="card-badge-type ${typeClass}">${escapeHtml(typeClass)}</span>
        <span class="card-meta-date">${escapeHtml(record.formattedDate || '')}</span>
      </div>

      <div class="card-origin">
        <span class="origin-bracket">▶</span>
        <a href="${escapeHtml(record.url)}" target="_blank" title="${escapeHtml(record.url)}">
          ${escapeHtml(record.title || record.domain || 'ORIGEN DESCONOCIDO')}
        </a>
      </div>

      <div class="card-content-body">${escapeHtml(record.content || '')}</div>

      ${record.note ? `<div class="card-user-note">// ${escapeHtml(record.note)}</div>` : ''}

      ${tagsHtml ? `<div class="card-tags-list">${tagsHtml}</div>` : ''}

      <div class="card-actions-bar">
        <button type="button" class="card-btn btn-copy" title="Copiar fragmento al portapapeles">[COPIAR]</button>
        <button type="button" class="card-btn btn-open" title="Abrir URL original en pestaña">[IR A URL]</button>
        <button type="button" class="card-btn btn-md" title="Descargar como archivo Markdown">[MD]</button>
        <button type="button" class="card-btn btn-delete" title="Eliminar fragmento permanentemente">[BORRAR]</button>
      </div>
    `;

    // Actions
    card.querySelector('.btn-copy').addEventListener('click', () => {
      const textToCopy = record.content + (record.note ? `\n\nNota: ${record.note}` : '');
      copyToClipboard(textToCopy, 'FRAGMENTO COPIADO');
    });

    card.querySelector('.btn-open').addEventListener('click', () => {
      if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
        chrome.tabs.create({ url: record.url });
      } else {
        window.open(record.url, '_blank');
      }
    });

    card.querySelector('.btn-md').addEventListener('click', () => {
      exportSingleToMarkdown(record);
    });

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

    // "Todos los tags" chip
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

  // --- TELEMETRY DASHBOARD ---
  async function renderTelemetry() {
    const total = state.records.length;
    elements.diagTotalNodes.textContent = String(total).padStart(2, '0');

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
        bytesUsed = await chrome.storage.local.getBytesInUse([STORAGE_KEY]);
      } catch (e) {
        bytesUsed = new Blob([JSON.stringify(state.records)]).size;
      }
    } else {
      bytesUsed = new Blob([JSON.stringify(state.records)]).size;
    }

    const kbUsed = (bytesUsed / 1024).toFixed(2);
    elements.diagStorageBytes.textContent = kbUsed;
    elements.hudStorageSize.textContent = `${kbUsed} KB`;

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

  // --- EXPORT & IMPORT MODULES ---
  function exportToMarkdown() {
    if (state.records.length === 0) {
      showToast('⚠️ EL BANCO ESTÁ VACÍO');
      return;
    }

    let md = `# CYBERCLIP // EXPORTACIÓN DE FRAGMENTOS Y NOTAS\n`;
    md += `> Generado el: ${new Date().toLocaleString()} | Total registros: ${state.records.length}\n\n`;
    md += `---\n\n`;

    state.records.forEach((r, idx) => {
      md += `### [${idx + 1}] ${r.title || r.domain}\n\n`;
      md += `- **Tipo:** \`${r.type}\`\n`;
      md += `- **URL:** [${r.url}](${r.url})\n`;
      md += `- **Dominio:** \`${r.domain}\`\n`;
      md += `- **Fecha Registro:** \`${r.formattedDate}\`\n`;
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
    let md = `# ${r.title || 'CYBERCLIP FRAGMENTO'}\n\n`;
    md += `- **URL:** [${r.url}](${r.url})\n`;
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
      version: '1.0.0',
      client: 'CYBERCLIP_HUD_EXTENSION',
      exportedAt: new Date().toISOString(),
      totalRecords: state.records.length,
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

        // Merge without duplicates by ID
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
              tags: Array.isArray(item.tags) ? item.tags : ['IMPORTADO'],
              timestamp: item.timestamp || Date.now(),
              formattedDate: item.formattedDate || formatTechDate(new Date())
            });
            existingIds.add(item.id);
            addedCount++;
          }
        });

        await persistRecords();
        showToast(`📂 ${addedCount} FRAGMENTOS IMPORTADOS`);
        event.target.value = '';
      } catch (err) {
        showToast('⚠️ ERROR AL PROCESAR EL JSON');
      }
    };
    reader.readAsText(file);
  }

  async function handlePurgeAll() {
    if (state.records.length === 0) {
      showToast('⚠️ EL BANCO YA ESTÁ VACÍO');
      return;
    }

    const confirmPurge = confirm('¿CONFIRMAR PURGA COMPLETA? Esta acción eliminará permanentemente todos los fragmentos guardados en chrome.storage.');
    if (!confirmPurge) return;

    state.records = [];
    await persistRecords();
    showToast('⚠️ BANCO DE DATOS PURGADO AL 100%');
    renderAll();
  }

  // --- GENERAL RENDER & HELPERS ---
  function renderAll() {
    elements.hudTotalCount.textContent = String(state.records.length).padStart(2, '0');
    elements.tabVaultCount.textContent = String(state.records.length);
    renderVault();
    renderTelemetry();
  }

  function copyToClipboard(text, successMsg) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      showToast(successMsg || 'COPIADO AL PORTAPAPELES');
    }).catch(() => {
      // Fallback
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
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const min = pad(d.getMinutes());
    const ss = pad(d.getSeconds());
    return `${yyyy}.${mm}.${dd} // ${hh}:${min}:${ss}`;
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
        tags: ['DOCS', 'CHROME_API', 'STORAGE'],
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
        tags: ['DEV', 'MANIFEST_V3', 'SERVICE_WORKER'],
        timestamp: now.getTime() - 1000 * 60 * 60 * 2,
        formattedDate: formatTechDate(new Date(now.getTime() - 1000 * 60 * 60 * 2))
      }
    ];
  }

})();
