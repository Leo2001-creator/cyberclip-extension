/**
 * CYBERCLIP // CONTENT SCRIPT (content.js) v1.3.0
 * High-Tech Cyberpunk DOM Engine (Manifest V3)
 * Features:
 *  - Highlighting con soporte entre nodos, normalización de espacios y frases largas.
 *  - MutationObserver con debounce y soporte para SPAs (cambios de URL sin recarga).
 *  - Floating bar (borde amarillo eléctrico + fondo azul oscuro) y paleta configurable.
 *  - Bloqueo en dominios configurados en black/blocklist.
 *  - Comunicación 100% por mensajes a background.js (cero localStorage de la página).
 *  - Manejo silencioso de invalidación de contexto ("Extension context invalidated").
 */

(() => {
  'use strict';

  if (window.__CYBERCLIP_CONTENT_INJECTED__) return;
  window.__CYBERCLIP_CONTENT_INJECTED__ = true;

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
    isHostBlocked: () => false,
    hexToRgba: (hex, a) => `rgba(0, 240, 255, ${a})`
  };

  let settings = {
    masterEnabled: true,
    highlightEnabled: true,
    palette: S.DEFAULT_PALETTE,
    selectedColor: '#FCEE0A',
    selectedTag: 'IDEA',
    blockedSites: []
  };

  let activeFloatingBar = null;
  let activeTooltip = null;
  let currentSelectionText = '';
  let pageRecords = [];
  let mutationObserver = null;
  let lastObservedUrl = window.location.href;
  let rehighlightTimer = null;

  init();

  async function init() {
    await refreshSettings();
    if (isPageBlocked()) return;

    setupSelectionListener();
    setupTooltipListener();
    setupMessageListener();
    setupStorageChangeListener();
    setupSpaObserver();

    if (settings.masterEnabled !== false && settings.highlightEnabled) {
      await loadAndHighlight();
    }
  }

  function isPageBlocked() {
    return S.isHostBlocked(window.location.hostname, settings.blockedSites);
  }

  async function sendBg(msg) {
    try {
      if (!chrome.runtime || !chrome.runtime.id) return null;
      return await chrome.runtime.sendMessage(msg);
    } catch (e) {
      // "Extension context invalidated" al recargar o deshabilitar
      return null;
    }
  }

  async function refreshSettings() {
    const res = await sendBg({ action: 'GET_SETTINGS' });
    if (res && res.ok && res.settings) {
      settings = Object.assign({}, settings, res.settings);
    }
  }

  function setupStorageChangeListener() {
    if (!chrome.storage || !chrome.storage.onChanged) return;
    try {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;
        if (changes[S.SETTINGS_KEY]) {
          settings = Object.assign({}, settings, changes[S.SETTINGS_KEY].newValue || {});
          if (settings.masterEnabled === false || !settings.highlightEnabled || isPageBlocked()) {
            removeAllHighlights();
            removeFloatingBar();
          } else {
            loadAndHighlight();
          }
        }
        if (changes[S.STORAGE_KEY]) {
          if (settings.masterEnabled !== false && settings.highlightEnabled && !isPageBlocked()) {
            scheduleRehighlight(150);
          }
        }
      });
    } catch (e) {}
  }

  function setupSpaObserver() {
    // Detecta cambios de URL vía pushState / replaceState / popstate
    const handleUrlChange = () => {
      if (window.location.href !== lastObservedUrl) {
        lastObservedUrl = window.location.href;
        if (settings.masterEnabled !== false && settings.highlightEnabled && !isPageBlocked()) {
          loadAndHighlight();
        }
      }
    };
    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);

    // MutationObserver para contenido dinámico
    mutationObserver = new MutationObserver((mutations) => {
      if (settings.masterEnabled === false || !settings.highlightEnabled || isPageBlocked()) return;
      const relevant = mutations.some(m => {
        if (m.target && m.target.closest && (m.target.closest('.cyberclip-highlight') || m.target.closest('.cyberclip-floating-bar') || m.target.closest('.cyberclip-corner-toast'))) {
          return false;
        }
        return m.addedNodes.length > 0;
      });
      if (relevant) scheduleRehighlight(400);
    });

    if (document.body) {
      mutationObserver.observe(document.body, { childList: true, subtree: true });
    }
  }

  function scheduleRehighlight(delay) {
    clearTimeout(rehighlightTimer);
    rehighlightTimer = setTimeout(() => {
      loadAndHighlight();
    }, delay);
  }

  // =========================================================================
  // 1. FLOATING BAR
  // =========================================================================
  function setupSelectionListener() {
    let t = null;
    document.addEventListener('mouseup', (e) => {
      if (e.target && e.target.closest && (e.target.closest('.cyberclip-floating-bar') || e.target.closest('.cyberclip-floating-btn'))) return;
      clearTimeout(t);
      t = setTimeout(() => handleSelectionChange(e), 80);
    });

    document.addEventListener('mousedown', (e) => {
      if (e.target && e.target.closest && (e.target.closest('.cyberclip-floating-bar') || e.target.closest('.cyberclip-floating-btn'))) return;
      removeFloatingBar();
    });

    window.addEventListener('scroll', () => removeFloatingBar(), { passive: true });
  }

  function handleSelectionChange() {
    if (settings.masterEnabled === false || isPageBlocked()) {
      removeFloatingBar();
      return;
    }
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) { removeFloatingBar(); return; }

    const text = sel.toString().trim();
    if (text.length < 2) { removeFloatingBar(); return; }

    const anchor = sel.anchorNode ? sel.anchorNode.parentElement : null;
    if (anchor && (anchor.isContentEditable || ['INPUT', 'TEXTAREA'].includes(anchor.tagName))) {
      removeFloatingBar();
      return;
    }

    currentSelectionText = text;
    try {
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (rect && rect.width > 0 && rect.height > 0) {
        showFloatingBar(rect);
      }
    } catch (e) {
      removeFloatingBar();
    }
  }

  function showFloatingBar(rect) {
    removeFloatingBar();

    const bar = document.createElement('div');
    bar.className = 'cyberclip-floating-bar';
    bar.setAttribute('role', 'toolbar');
    bar.setAttribute('aria-label', 'CyberClip Quick Toolbar');

    const mainBtn = document.createElement('button');
    mainBtn.type = 'button';
    mainBtn.className = 'cyberclip-floating-main-btn';
    mainBtn.innerHTML = `<span>⚡</span> CLIP`;
    mainBtn.title = `Guardar fragmento (#${settings.selectedTag || 'IDEA'})`;

    const tagBadge = document.createElement('div');
    tagBadge.className = 'cyberclip-tag-badge';
    tagBadge.textContent = `#${settings.selectedTag || 'IDEA'}`;

    const swatches = document.createElement('div');
    swatches.className = 'cyberclip-color-swatches';

    const palette = (settings.palette && settings.palette.length === 6) ? settings.palette : S.DEFAULT_PALETTE;

    palette.forEach(slot => {
      const dot = document.createElement('button');
      dot.type = 'button';
      const c = S.safeColor(slot.color);
      dot.className = `cyberclip-color-dot ${c === settings.selectedColor ? 'active' : ''}`;
      dot.style.backgroundColor = c;
      dot.style.color = c;
      dot.setAttribute('data-color', c);
      dot.setAttribute('data-tag', slot.tag);
      dot.title = `#${slot.tag} (${slot.name || c})`;

      dot.addEventListener('mouseenter', () => {
        tagBadge.textContent = `#${slot.tag}`;
        tagBadge.style.color = c;
        tagBadge.style.borderColor = c;
      });

      dot.addEventListener('mouseleave', () => {
        tagBadge.textContent = `#${settings.selectedTag || 'IDEA'}`;
        tagBadge.style.color = settings.selectedColor || '#00F0FF';
        tagBadge.style.borderColor = 'rgba(0, 240, 255, 0.35)';
      });

      dot.addEventListener('click', async (evt) => {
        evt.preventDefault();
        evt.stopPropagation();
        settings.selectedColor = c;
        settings.selectedTag = slot.tag;
        await executeClipSave(currentSelectionText, c, slot.tag);
        removeFloatingBar();
      });

      swatches.appendChild(dot);
    });

    mainBtn.addEventListener('click', async (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      await executeClipSave(currentSelectionText, settings.selectedColor, settings.selectedTag);
      removeFloatingBar();
    });

    bar.appendChild(mainBtn);
    bar.appendChild(swatches);
    bar.appendChild(tagBadge);

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
  // 2. PERSISTENCE & TOASTS
  // =========================================================================
  async function executeClipSave(text, color, tag) {
    if (!text || isPageBlocked()) return;

    const chosenColor = S.safeColor(color || settings.selectedColor);
    const chosenTag = tag || settings.selectedTag || 'IDEA';
    const now = new Date();
    const url = window.location.href;
    const domain = window.location.hostname.replace(/^www\./, '');

    const record = {
      type: 'SNIPPET',
      title: document.title || domain,
      url, domain,
      content: text,
      note: `Capturado con selector HUD [#${chosenTag}].`,
      color: chosenColor,
      favorite: false,
      tags: [chosenTag, 'QUICK_CLIP', domain.replace(/\./g, '_')],
      timestamp: now.getTime(),
      formattedDate: S.formatTechDate(now)
    };

    const res = await sendBg({ action: 'SAVE_CLIP', record });
    if (!res) {
      showCornerToast('ERROR // SIN CONEXIÓN CON BACKGROUND', '', '#FF003C');
      return;
    }
    if (res.ok) {
      showCornerToast(`CYBERCLIP // #${chosenTag} REGISTRADO`, text, chosenColor);
      if (settings.highlightEnabled) {
        highlightPhrase(text, res.record || record);
      }
    } else if (res.error === 'DUPLICATE') {
      showCornerToast('⚡ FRAGMENTO YA REGISTRADO EN ESTA PÁGINA', text, '#FFA500');
    } else if (res.error === 'QUOTA_EXCEEDED') {
      showCornerToast('⛔ LÍMITE DE 100 MB ALCANZADO', 'Purga registros en el HUD para liberar espacio.', '#FF003C');
    } else if (res.error === 'BLOCKED') {
      showCornerToast('ESTE SITIO ESTÁ EN LA LISTA DE BLOQUEADOS', '', '#FFA500');
    } else {
      showCornerToast('ERROR AL GUARDAR REGISTRO', text.slice(0, 30), '#FF003C');
    }
  }

  function showCornerToast(title, preview, accentColor) {
    const existing = document.querySelector('.cyberclip-corner-toast');
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

    const color = S.safeColor(accentColor);
    const toast = document.createElement('div');
    toast.className = 'cyberclip-corner-toast';
    toast.style.borderLeftColor = color;
    toast.style.boxShadow = `0 0 25px ${S.hexToRgba(color, 0.45)}, 0 10px 30px rgba(0,0,0,0.85)`;

    toast.innerHTML = `
      <div class="cyberclip-toast-glyph" style="color:${color};filter:drop-shadow(0 0 6px ${color});">⚡</div>
      <div class="cyberclip-toast-msg">
        <span class="cyberclip-toast-title" style="color:${color}">${S.escapeHtml(title)}</span>
        ${preview ? `<span class="cyberclip-toast-detail">"${S.escapeHtml(preview.slice(0, 60))}${preview.length > 60 ? '...' : ''}"</span>` : ''}
      </div>
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
      if (toast && toast.parentNode) {
        toast.style.transition = 'opacity 300ms ease, transform 300ms ease';
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(15px)';
        setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 320);
      }
    }, 2800);
  }

  // =========================================================================
  // 3. HIGHLIGHTER MULTI-NODO ROBUSTO
  // =========================================================================
  async function loadAndHighlight() {
    if (settings.masterEnabled === false || !settings.highlightEnabled || isPageBlocked()) {
      removeAllHighlights();
      return;
    }
    const res = await sendBg({ action: 'GET_PAGE_RECORDS', url: window.location.href });
    if (!res || !res.ok) return;
    pageRecords = Array.isArray(res.records) ? res.records : [];
    removeAllHighlights();
    pageRecords.forEach(rec => {
      if (rec.content && rec.content.trim().length >= 3) {
        highlightPhrase(rec.content.trim(), rec);
      }
    });
  }

  function removeAllHighlights() {
    const list = document.querySelectorAll('.cyberclip-highlight');
    list.forEach(span => {
      const parent = span.parentNode;
      if (parent) {
        while (span.firstChild) parent.insertBefore(span.firstChild, span);
        parent.removeChild(span);
        parent.normalize();
      }
    });
  }

  /**
   * Resalta una frase aunque cruce múltiples nodos de texto y normaliza espacios.
   */
  function highlightPhrase(phrase, record) {
    if (!document.body) return;
    const cleanTarget = phrase.replace(/\s+/g, ' ').slice(0, 4000);
    if (cleanTarget.length < 3) return;

    // Recolectar nodos de texto visibles
    const textNodes = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
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

    let node;
    let combinedText = '';
    const nodeMap = []; // { node, start, end } en combinedText
    while ((node = walker.nextNode())) {
      const val = node.nodeValue;
      if (!val) continue;
      const start = combinedText.length;
      combinedText += val;
      nodeMap.push({ node, start, end: combinedText.length });
    }

    // Búsqueda insensible a mayúsculas y tolerante a whitespace múltiple
    const regexPattern = escapeRegExp(cleanTarget).replace(/\s+/g, '\\s+');
    let regex;
    try {
      regex = new RegExp(regexPattern, 'gi');
    } catch (e) {
      return;
    }

    const match = regex.exec(combinedText);
    if (!match) return;

    const matchStart = match.index;
    const matchEnd = match.index + match[0].length;

    // Encontrar los nodos que cubren este rango
    const affected = nodeMap.filter(m => m.end > matchStart && m.start < matchEnd);
    if (affected.length === 0) return;

    const clipColor = S.safeColor(record.color);

    affected.forEach(entry => {
      const nodeStart = entry.start;
      const cur = entry.node;
      const parent = cur.parentNode;
      if (!parent) return;

      const relStart = Math.max(0, matchStart - nodeStart);
      const relEnd = Math.min(cur.nodeValue.length, matchEnd - nodeStart);
      if (relStart >= relEnd) return;

      const text = cur.nodeValue;
      const before = text.slice(0, relStart);
      const mid = text.slice(relStart, relEnd);
      const after = text.slice(relEnd);

      const span = document.createElement('span');
      span.className = 'cyberclip-highlight';
      span.textContent = mid;
      span.style.setProperty('--clip-color', clipColor);
      span.style.setProperty('--clip-bg', S.hexToRgba(clipColor, 0.22));
      span.style.setProperty('--clip-glow', S.hexToRgba(clipColor, 0.45));
      span.style.setProperty('--clip-bg-hover', S.hexToRgba(clipColor, 0.38));
      span.style.setProperty('--clip-glow-hover', S.hexToRgba(clipColor, 0.75));

      span.setAttribute('data-clip-id', record.id || '');
      span.setAttribute('data-clip-note', record.note || '');
      span.setAttribute('data-clip-color', clipColor);
      span.setAttribute('data-clip-date', record.formattedDate || '');
      span.setAttribute('data-clip-tags', (record.tags || []).join(', '));
      span.setAttribute('data-clip-fav', record.favorite ? '1' : '0');

      const frag = document.createDocumentFragment();
      if (before) frag.appendChild(document.createTextNode(before));
      frag.appendChild(span);
      if (after) frag.appendChild(document.createTextNode(after));

      parent.replaceChild(frag, cur);
    });
  }

  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // =========================================================================
  // 4. TOOLTIP
  // =========================================================================
  function setupTooltipListener() {
    document.addEventListener('mouseover', (e) => {
      const target = e.target.closest('.cyberclip-highlight');
      if (!target) return;
      const note = target.getAttribute('data-clip-note') || 'Fragmento indexado';
      const date = target.getAttribute('data-clip-date') || '';
      const color = S.safeColor(target.getAttribute('data-clip-color'));
      const tags = (target.getAttribute('data-clip-tags') || '').split(',').map(s => s.trim()).filter(Boolean);
      const isFav = target.getAttribute('data-clip-fav') === '1';
      showHudTooltip(target, { note, date, color, tags, isFav });
    });

    document.addEventListener('mouseout', (e) => {
      if (e.target.closest('.cyberclip-highlight')) removeHudTooltip();
    });
  }

  function showHudTooltip(targetElem, data) {
    removeHudTooltip();
    const tooltip = document.createElement('div');
    tooltip.className = 'cyberclip-hud-tooltip';
    tooltip.style.borderLeftColor = data.color;

    const tagsHtml = (data.tags || [])
      .map(t => `<span class="cyberclip-tooltip-tag" style="border-color:${data.color};color:${data.color}">#${S.escapeHtml(t)}</span>`)
      .join('');

    tooltip.innerHTML = `
      <div class="cyberclip-tooltip-header">
        <span style="color:${data.color}">⚡ CYBERCLIP // DATAPACK ${data.isFav ? '<span style="color:#FCEE0A">★</span>' : ''}</span>
        <span class="cyberclip-tooltip-date">${S.escapeHtml(data.date)}</span>
      </div>
      <div class="cyberclip-tooltip-note">${S.escapeHtml(data.note)}</div>
      ${tagsHtml ? `<div class="cyberclip-tooltip-tags">${tagsHtml}</div>` : ''}
    `;

    document.body.appendChild(tooltip);
    activeTooltip = tooltip;

    const rect = targetElem.getBoundingClientRect();
    const tr = tooltip.getBoundingClientRect();
    let top = rect.top + window.scrollY - tr.height - 8;
    let left = rect.left + window.scrollX;
    if (top < window.scrollY + 10) top = rect.bottom + window.scrollY + 8;
    if (left + tr.width > window.innerWidth - 10) left = window.innerWidth - tr.width - 15;
    tooltip.style.top = `${Math.max(10, top)}px`;
    tooltip.style.left = `${Math.max(10, left)}px`;
  }

  function removeHudTooltip() {
    if (activeTooltip && activeTooltip.parentNode) activeTooltip.parentNode.removeChild(activeTooltip);
    activeTooltip = null;
  }

  // =========================================================================
  // 5. MESSAGE LISTENER
  // =========================================================================
  function setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'CLIP_CURRENT_SELECTION') {
        if (settings.masterEnabled === false) {
          showCornerToast('CYBERCLIP // EN STANDBY', 'Activa la extensión para capturar', '#FF003C');
          sendResponse({ status: 'DISABLED' });
          return true;
        }
        if (isPageBlocked()) {
          showCornerToast('ESTE SITIO ESTÁ BLOQUEADO', '', '#FFA500');
          sendResponse({ status: 'BLOCKED' });
          return true;
        }
        const sel = window.getSelection();
        const text = sel ? sel.toString().trim() : '';
        if (text) {
          executeClipSave(text, settings.selectedColor, settings.selectedTag);
          sendResponse({ status: 'OK', text });
        } else {
          showCornerToast('CYBERCLIP // SIN SELECCIÓN', 'Resalta texto antes de pulsar Alt+C', '#FFA500');
          sendResponse({ status: 'NO_SELECTION' });
        }
      } else if (request.action === 'REHIGHLIGHT') {
        loadAndHighlight();
        sendResponse({ status: 'OK' });
      }
      return true;
    });
  }

})();
