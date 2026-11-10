/**
 * CYBERCLIP // CONTENT SCRIPT (content.js)
 * High-Tech Cyberpunk DOM Engine v1.2.0 (Manifest V3)
 * Features:
 *  1. Floating Quick-Action Bar with Electric Yellow border (#FCEE0A) and Dark Blue fill (#0b101d)
 *  2. Configurable 6-color palette linked to dynamic tags (e.g. #IDEA, #RESEARCH, #DEV, #BUG, #LECTURA, #DOCS)
 *  3. Dynamic Neon Highlighting in the exact assigned color with glow & underline
 *  4. Highlighting toggle (active/inactive based on settings)
 *  5. Holographic HUD Tooltip & Corner Toasts
 *  6. Keyboard shortcut handler (Alt+C) & runtime messages
 */

(() => {
  'use strict';

  // Prevent multiple injection
  if (window.__CYBERCLIP_CONTENT_INJECTED__) return;
  window.__CYBERCLIP_CONTENT_INJECTED__ = true;

  const STORAGE_KEY = 'cyberclip_records';
  const SETTINGS_KEY = 'cyberclip_settings';

  const DEFAULT_PALETTE = [
    { id: 'c1', color: '#FCEE0A', tag: 'IDEA', name: 'Amarillo Neón' },
    { id: 'c2', color: '#00F0FF', tag: 'RESEARCH', name: 'Cian Eléctrico' },
    { id: 'c3', color: '#00FF66', tag: 'DEV', name: 'Verde Neón' },
    { id: 'c4', color: '#FF007F', tag: 'BUG', name: 'Magenta Neón' },
    { id: 'c5', color: '#FFA500', tag: 'LECTURA', name: 'Naranja Ámbar' },
    { id: 'c6', color: '#0070FF', tag: 'DOCS', name: 'Azul Eléctrico' }
  ];

  let settings = {
    palette: DEFAULT_PALETTE,
    highlightEnabled: true,
    selectedColor: '#FCEE0A',
    selectedTag: 'IDEA'
  };

  let activeFloatingBar = null;
  let activeTooltip = null;
  let currentSelectionText = '';
  let currentSelectionRange = null;
  let pageRecords = [];

  // Initialize engine
  init();

  async function init() {
    await loadSettings();
    setupSelectionListener();
    if (settings.highlightEnabled) {
      await loadAndHighlightPageRecords();
    }
    setupTooltipListener();
    setupMessageListener();
    setupStorageChangeListener();
  }

  // =========================================================================
  // 1. SETTINGS & CONFIGURATION
  // =========================================================================
  async function loadSettings() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const data = await chrome.storage.local.get([SETTINGS_KEY]);
        if (data[SETTINGS_KEY]) {
          settings = Object.assign({}, settings, data[SETTINGS_KEY]);
          if (!Array.isArray(settings.palette) || settings.palette.length === 0) {
            settings.palette = DEFAULT_PALETTE;
          }
        }
      } else {
        const stored = localStorage.getItem(SETTINGS_KEY);
        if (stored) {
          settings = Object.assign({}, settings, JSON.parse(stored));
        }
      }
    } catch (e) {
      console.warn('[CYBERCLIP // CONTENT] Using default settings:', e);
    }
  }

  function setupStorageChangeListener() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local') {
          if (changes[SETTINGS_KEY]) {
            const newSettings = changes[SETTINGS_KEY].newValue || {};
            const prevHighlight = settings.highlightEnabled;
            settings = Object.assign({}, settings, newSettings);
            
            if (prevHighlight !== settings.highlightEnabled) {
              if (settings.highlightEnabled) {
                loadAndHighlightPageRecords();
              } else {
                removeAllHighlights();
              }
            }
          }
          if (changes[STORAGE_KEY]) {
            if (settings.highlightEnabled) {
              loadAndHighlightPageRecords();
            }
          }
        }
      });
    }
  }

  function removeAllHighlights() {
    const highlights = document.querySelectorAll('.cyberclip-highlight');
    highlights.forEach(span => {
      const parent = span.parentNode;
      if (parent) {
        while (span.firstChild) {
          parent.insertBefore(span.firstChild, span);
        }
        parent.removeChild(span);
        parent.normalize();
      }
    });
  }

  // =========================================================================
  // 2. FLOATING BAR (YELLOW BORDER + DARK BLUE FILL + COLOR PALETTE)
  // =========================================================================
  function setupSelectionListener() {
    let debounceTimer = null;

    document.addEventListener('mouseup', (e) => {
      if (e.target && e.target.closest && (e.target.closest('.cyberclip-floating-bar') || e.target.closest('.cyberclip-floating-btn'))) {
        return;
      }

      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        handleSelectionChange(e);
      }, 80);
    });

    document.addEventListener('mousedown', (e) => {
      if (e.target && e.target.closest && (e.target.closest('.cyberclip-floating-bar') || e.target.closest('.cyberclip-floating-btn'))) {
        return;
      }
      removeFloatingBar();
    });

    window.addEventListener('scroll', () => {
      removeFloatingBar();
    }, { passive: true });
  }

  function handleSelectionChange(e) {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      removeFloatingBar();
      return;
    }

    const text = sel.toString().trim();
    if (text.length < 2) {
      removeFloatingBar();
      return;
    }

    const anchorElem = sel.anchorNode ? sel.anchorNode.parentElement : null;
    if (anchorElem && (anchorElem.isContentEditable || ['INPUT', 'TEXTAREA'].includes(anchorElem.tagName))) {
      removeFloatingBar();
      return;
    }

    currentSelectionText = text;
    try {
      currentSelectionRange = sel.getRangeAt(0).cloneRange();
      const rect = currentSelectionRange.getBoundingClientRect();
      if (rect && rect.width > 0 && rect.height > 0) {
        showFloatingBar(rect);
      }
    } catch (err) {
      removeFloatingBar();
    }
  }

  function showFloatingBar(rect) {
    removeFloatingBar();

    const bar = document.createElement('div');
    bar.className = 'cyberclip-floating-bar';
    bar.setAttribute('role', 'toolbar');
    bar.setAttribute('aria-label', 'CyberClip Quick Toolbar');

    // Main action button [⚡ CLIP]
    const mainBtn = document.createElement('button');
    mainBtn.type = 'button';
    mainBtn.className = 'cyberclip-floating-main-btn';
    mainBtn.innerHTML = `<span>⚡</span> CLIP`;
    mainBtn.title = `Guardar fragmento con etiqueta #${settings.selectedTag || 'IDEA'}`;

    // Tag preview badge
    const tagBadge = document.createElement('div');
    tagBadge.className = 'cyberclip-tag-badge';
    tagBadge.textContent = `#${settings.selectedTag || 'IDEA'}`;

    // Color Swatches container
    const swatchesContainer = document.createElement('div');
    swatchesContainer.className = 'cyberclip-color-swatches';

    const palette = (settings.palette && settings.palette.length > 0) ? settings.palette : DEFAULT_PALETTE;

    palette.forEach(slot => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = `cyberclip-color-dot ${slot.color === settings.selectedColor ? 'active' : ''}`;
      dot.style.backgroundColor = slot.color;
      dot.style.color = slot.color;
      dot.setAttribute('data-color', slot.color);
      dot.setAttribute('data-tag', slot.tag);
      dot.title = `Guardar con #${slot.tag} (${slot.name || slot.color})`;

      // Hover updates tag badge preview
      dot.addEventListener('mouseenter', () => {
        tagBadge.textContent = `#${slot.tag}`;
        tagBadge.style.color = slot.color;
        tagBadge.style.borderColor = slot.color;
      });

      dot.addEventListener('mouseleave', () => {
        tagBadge.textContent = `#${settings.selectedTag || 'IDEA'}`;
        tagBadge.style.color = settings.selectedColor || '#00F0FF';
        tagBadge.style.borderColor = 'rgba(0, 240, 255, 0.35)';
      });

      // Click directly saves with this color & tag!
      dot.addEventListener('click', async (evt) => {
        evt.preventDefault();
        evt.stopPropagation();
        settings.selectedColor = slot.color;
        settings.selectedTag = slot.tag;
        await executeClipSave(currentSelectionText, slot.color, slot.tag);
        removeFloatingBar();
      });

      swatchesContainer.appendChild(dot);
    });

    mainBtn.addEventListener('click', async (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      const chosenColor = settings.selectedColor || palette[0].color;
      const chosenTag = settings.selectedTag || palette[0].tag;
      await executeClipSave(currentSelectionText, chosenColor, chosenTag);
      removeFloatingBar();
    });

    bar.appendChild(mainBtn);
    bar.appendChild(swatchesContainer);
    bar.appendChild(tagBadge);

    // Position above selection
    const top = rect.top + window.scrollY - 38;
    const left = Math.max(10, rect.left + window.scrollX + (rect.width / 2) - 130);

    bar.style.top = `${Math.max(10, top)}px`;
    bar.style.left = `${Math.max(10, left)}px`;

    document.body.appendChild(bar);
    activeFloatingBar = bar;
  }

  function removeFloatingBar() {
    if (activeFloatingBar && activeFloatingBar.parentNode) {
      activeFloatingBar.parentNode.removeChild(activeFloatingBar);
    }
    activeFloatingBar = null;
  }

  // =========================================================================
  // 3. PERSISTENCE & CLIP CREATION (COLOR + TAG + FAVORITE FALSE)
  // =========================================================================
  async function executeClipSave(text, color, tag) {
    if (!text) return;

    const chosenColor = color || settings.selectedColor || '#FCEE0A';
    const chosenTag = tag || settings.selectedTag || 'IDEA';
    const now = new Date();
    const url = window.location.href;
    const title = document.title || window.location.hostname;
    const domain = window.location.hostname.replace(/^www\./, '');

    const record = {
      id: `clip_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type: 'SNIPPET',
      title: title,
      url: url,
      domain: domain,
      content: text,
      note: `Capturado con selector HUD [#${chosenTag}].`,
      color: chosenColor,
      favorite: false,
      tags: [chosenTag, 'QUICK_CLIP', domain.replace(/\./g, '_')],
      timestamp: now.getTime(),
      formattedDate: formatTechDate(now)
    };

    try {
      // Validar límite estricto de 100 MB (104.857.600 bytes)
      const MAX_STORAGE_BYTES = 100 * 1024 * 1024;
      let bytesInUse = 0;
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local && chrome.storage.local.getBytesInUse) {
        try {
          bytesInUse = await chrome.storage.local.getBytesInUse(null);
        } catch (e) {
          bytesInUse = 0;
        }
      }

      const recordSize = new Blob([JSON.stringify(record)]).size;
      if (bytesInUse + recordSize > MAX_STORAGE_BYTES) {
        showCornerToast('⛔ LÍMITE DE 100 MB ALCANZADO', 'Purga registros en el HUD para liberar espacio.', '#FF003C');
        return;
      }

      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const data = await chrome.storage.local.get([STORAGE_KEY]);
        const list = Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
        list.unshift(record);
        await chrome.storage.local.set({ [STORAGE_KEY]: list });
        
        chrome.runtime.sendMessage({ action: 'UPDATE_BADGE' }).catch(() => {});
      } else {
        const stored = localStorage.getItem(STORAGE_KEY);
        const list = stored ? JSON.parse(stored) : [];
        list.unshift(record);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      }

      showCornerToast(`CYBERCLIP // #${chosenTag} REGISTRADO`, text, chosenColor);
      
      // If highlights are enabled, highlight node in DOM
      if (settings.highlightEnabled) {
        pageRecords.unshift(record);
        applyDomHighlights([record]);
      }
    } catch (err) {
      console.error('[CYBERCLIP // CONTENT] Error saving clip:', err);
      showCornerToast('ERROR AL GUARDAR DATAPACK', text.slice(0, 30), '#FF003C');
    }
  }

  // =========================================================================
  // 4. DYNAMIC NEON HIGHLIGHTER (IN ASSIGNED COLOR)
  // =========================================================================
  async function loadAndHighlightPageRecords() {
    if (!settings.highlightEnabled) return;

    try {
      let records = [];
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const data = await chrome.storage.local.get([STORAGE_KEY]);
        records = Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
      } else {
        const stored = localStorage.getItem(STORAGE_KEY);
        records = stored ? JSON.parse(stored) : [];
      }

      const currentUrl = window.location.href;
      const currentPath = window.location.origin + window.location.pathname;

      pageRecords = records.filter(r => {
        if (!r.url) return false;
        try {
          const rPath = new URL(r.url).origin + new URL(r.url).pathname;
          return rPath === currentPath || r.url === currentUrl;
        } catch (e) {
          return r.url === currentUrl;
        }
      });

      if (pageRecords.length > 0) {
        applyDomHighlights(pageRecords);
      }
    } catch (err) {
      console.warn('[CYBERCLIP // CONTENT] Error loading page highlights:', err);
    }
  }

  function applyDomHighlights(recordsToHighlight) {
    if (!document.body || !settings.highlightEnabled) return;

    recordsToHighlight.forEach(record => {
      if (!record.content || record.content.trim().length < 3) return;
      highlightTextInBody(record.content.trim(), record);
    });
  }

  function highlightTextInBody(phrase, record) {
    const safePhrase = phrase.length > 100 ? phrase.substring(0, 90) : phrase;
    const lowerPhrase = safePhrase.toLowerCase();
    const clipColor = record.color || '#00F0FF';

    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          if (!node.nodeValue || !node.nodeValue.toLowerCase().includes(lowerPhrase)) {
            return NodeFilter.FILTER_REJECT;
          }
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const tag = parent.tagName.toUpperCase();
          if (['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'NOSCRIPT', 'SVG'].includes(tag)) {
            return NodeFilter.FILTER_REJECT;
          }
          if (parent.closest('.cyberclip-highlight') || parent.closest('.cyberclip-floating-bar') || parent.closest('.cyberclip-corner-toast')) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const nodesToReplace = [];
    while (walker.nextNode()) {
      nodesToReplace.push(walker.currentNode);
    }

    nodesToReplace.forEach(textNode => {
      const parent = textNode.parentNode;
      if (!parent) return;

      const content = textNode.nodeValue;
      const index = content.toLowerCase().indexOf(lowerPhrase);
      if (index === -1) return;

      const before = content.substring(0, index);
      const match = content.substring(index, index + safePhrase.length);
      const after = content.substring(index + safePhrase.length);

      const span = document.createElement('span');
      span.className = 'cyberclip-highlight';
      span.textContent = match;

      // Assign dynamic CSS variables according to clip's specific color
      span.style.setProperty('--clip-color', clipColor);
      span.style.setProperty('--clip-bg', hexToRgba(clipColor, 0.22));
      span.style.setProperty('--clip-glow', hexToRgba(clipColor, 0.45));
      span.style.setProperty('--clip-bg-hover', hexToRgba(clipColor, 0.38));
      span.style.setProperty('--clip-glow-hover', hexToRgba(clipColor, 0.75));

      span.setAttribute('data-clip-id', record.id);
      span.setAttribute('data-clip-note', record.note || '');
      span.setAttribute('data-clip-color', clipColor);
      span.setAttribute('data-clip-date', record.formattedDate || '');
      span.setAttribute('data-clip-tags', (record.tags || []).join(', '));
      span.setAttribute('data-clip-fav', record.favorite ? '1' : '0');

      const frag = document.createDocumentFragment();
      if (before) frag.appendChild(document.createTextNode(before));
      frag.appendChild(span);
      if (after) frag.appendChild(document.createTextNode(after));

      parent.replaceChild(frag, textNode);
    });
  }

  // =========================================================================
  // 5. HOLOGRAPHIC HUD TOOLTIP
  // =========================================================================
  function setupTooltipListener() {
    document.addEventListener('mouseover', (e) => {
      const target = e.target.closest('.cyberclip-highlight');
      if (!target) return;

      const note = target.getAttribute('data-clip-note') || 'Fragmento indexado a esta URL';
      const date = target.getAttribute('data-clip-date') || '';
      const color = target.getAttribute('data-clip-color') || '#00F0FF';
      const tags = (target.getAttribute('data-clip-tags') || '').split(',').map(s => s.trim()).filter(Boolean);
      const isFav = target.getAttribute('data-clip-fav') === '1';

      showHudTooltip(target, { note, date, color, tags, isFav });
    });

    document.addEventListener('mouseout', (e) => {
      const target = e.target.closest('.cyberclip-highlight');
      if (target) {
        removeHudTooltip();
      }
    });
  }

  function showHudTooltip(targetElem, data) {
    removeHudTooltip();

    const tooltip = document.createElement('div');
    tooltip.className = 'cyberclip-hud-tooltip';
    tooltip.style.borderLeftColor = data.color;

    const tagsHtml = (data.tags || [])
      .map(t => `<span class="cyberclip-tooltip-tag" style="border-color:${data.color};color:${data.color}">#${escapeHtml(t)}</span>`)
      .join('');

    tooltip.innerHTML = `
      <div class="cyberclip-tooltip-header">
        <span style="color:${data.color}">⚡ CYBERCLIP // DATAPACK ${data.isFav ? '<span style="color:#FCEE0A">★</span>' : ''}</span>
        <span class="cyberclip-tooltip-date">${escapeHtml(data.date)}</span>
      </div>
      <div class="cyberclip-tooltip-note">${escapeHtml(data.note)}</div>
      ${tagsHtml ? `<div class="cyberclip-tooltip-tags">${tagsHtml}</div>` : ''}
    `;

    document.body.appendChild(tooltip);
    activeTooltip = tooltip;

    const rect = targetElem.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    let top = rect.top + window.scrollY - tooltipRect.height - 8;
    let left = rect.left + window.scrollX;

    if (top < window.scrollY + 10) {
      top = rect.bottom + window.scrollY + 8;
    }

    if (left + tooltipRect.width > window.innerWidth - 10) {
      left = window.innerWidth - tooltipRect.width - 15;
    }

    tooltip.style.top = `${Math.max(10, top)}px`;
    tooltip.style.left = `${Math.max(10, left)}px`;
  }

  function removeHudTooltip() {
    if (activeTooltip && activeTooltip.parentNode) {
      activeTooltip.parentNode.removeChild(activeTooltip);
    }
    activeTooltip = null;
  }

  // =========================================================================
  // 6. IN-PAGE HUD CORNER TOAST
  // =========================================================================
  function showCornerToast(title, preview, accentColor) {
    const existing = document.querySelector('.cyberclip-corner-toast');
    if (existing && existing.parentNode) {
      existing.parentNode.removeChild(existing);
    }

    const color = accentColor || '#FCEE0A';
    const toast = document.createElement('div');
    toast.className = 'cyberclip-corner-toast';
    toast.style.borderLeftColor = color;
    toast.style.boxShadow = `0 0 25px ${hexToRgba(color, 0.45)}, 0 10px 30px rgba(0,0,0,0.85)`;

    toast.innerHTML = `
      <div class="cyberclip-toast-glyph" style="color:${color};filter:drop-shadow(0 0 6px ${color});">⚡</div>
      <div class="cyberclip-toast-msg">
        <span class="cyberclip-toast-title" style="color:${color}">${escapeHtml(title)}</span>
        <span class="cyberclip-toast-detail">"${escapeHtml(preview.substring(0, 50))}${preview.length > 50 ? '...' : ''}"</span>
      </div>
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
      if (toast && toast.parentNode) {
        toast.style.transition = 'opacity 300ms ease, transform 300ms ease';
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(15px)';
        setTimeout(() => {
          if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 320);
      }
    }, 2800);
  }

  // =========================================================================
  // 7. MESSAGE LISTENER
  // =========================================================================
  function setupMessageListener() {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'CLIP_CURRENT_SELECTION') {
          const sel = window.getSelection();
          const text = sel ? sel.toString().trim() : '';
          if (text) {
            executeClipSave(text, settings.selectedColor, settings.selectedTag);
            sendResponse({ status: 'OK', text });
          } else {
            showCornerToast('CYBERCLIP // SIN SELECCIÓN', 'Resalta texto antes de pulsar el atajo', '#FFA500');
            sendResponse({ status: 'NO_SELECTION' });
          }
        }
        return true;
      });
    }
  }

  // =========================================================================
  // 8. HELPERS
  // =========================================================================
  function hexToRgba(hex, alpha) {
    if (!hex || typeof hex !== 'string') return `rgba(0, 240, 255, ${alpha})`;
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    if (c.length !== 6) return `rgba(0, 240, 255, ${alpha})`;
    const num = parseInt(c, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function formatTechDate(d) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}.${pad(d.getMonth()+1)}.${pad(d.getDate())} // ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
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

})();
