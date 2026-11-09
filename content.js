/**
 * CYBERCLIP // CONTENT SCRIPT (content.js)
 * High-Tech Cyberpunk DOM Engine (Manifest V3)
 * Features:
 *  1. Floating Quick-Action [⚡ CLIP] on text selection with 45° chamfered clip-path
 *  2. Neon Electric Cyan Highlighting for saved snippets on the current URL/domain
 *  3. Holographic HUD Tooltip with note and timestamp on hover
 *  4. In-Page HUD Corner Toast feedback
 *  5. Keyboard shortcut handler integration
 */

(() => {
  'use strict';

  // Prevent multiple injection
  if (window.__CYBERCLIP_CONTENT_INJECTED__) return;
  window.__CYBERCLIP_CONTENT_INJECTED__ = true;

  const STORAGE_KEY = 'cyberclip_records';
  let activeFloatingBtn = null;
  let activeTooltip = null;
  let currentSelectionText = '';
  let currentSelectionRange = null;
  let pageRecords = [];

  // Initialize
  init();

  async function init() {
    setupSelectionListener();
    await loadAndHighlightPageRecords();
    setupTooltipListener();
    setupMessageListener();
  }

  // =========================================================================
  // 1. FLOATING QUICK-ACTION BUTTON [⚡ CLIP]
  // =========================================================================
  function setupSelectionListener() {
    let debounceTimer = null;

    document.addEventListener('mouseup', (e) => {
      // If clicking on our own floating button, don't clear
      if (e.target && e.target.closest && e.target.closest('.cyberclip-floating-btn')) {
        return;
      }

      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        handleSelectionChange(e);
      }, 80);
    });

    document.addEventListener('mousedown', (e) => {
      if (e.target && e.target.closest && e.target.closest('.cyberclip-floating-btn')) {
        return;
      }
      removeFloatingButton();
    });

    // Handle scroll
    window.addEventListener('scroll', () => {
      removeFloatingButton();
    }, { passive: true });
  }

  function handleSelectionChange(e) {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      removeFloatingButton();
      return;
    }

    const text = sel.toString().trim();
    if (text.length < 2) {
      removeFloatingButton();
      return;
    }

    // Check if inside input or editable
    const anchorElem = sel.anchorNode ? sel.anchorNode.parentElement : null;
    if (anchorElem && (anchorElem.isContentEditable || ['INPUT', 'TEXTAREA'].includes(anchorElem.tagName))) {
      removeFloatingButton();
      return;
    }

    currentSelectionText = text;
    try {
      currentSelectionRange = sel.getRangeAt(0).cloneRange();
      const rect = currentSelectionRange.getBoundingClientRect();
      if (rect && rect.width > 0 && rect.height > 0) {
        showFloatingButton(rect);
      }
    } catch (err) {
      removeFloatingButton();
    }
  }

  function showFloatingButton(rect) {
    removeFloatingButton();

    const btn = document.createElement('button');
    btn.className = 'cyberclip-floating-btn';
    btn.innerHTML = `<span style="color:#00F0FF;font-weight:900;">⚡</span> CLIP`;
    btn.title = 'Guardar fragmento instantáneo en CyberClip';

    // Position above selection
    const top = rect.top + window.scrollY - 34;
    const left = Math.max(10, rect.left + window.scrollX + (rect.width / 2) - 40);

    btn.style.top = `${Math.max(10, top)}px`;
    btn.style.left = `${left}px`;

    btn.addEventListener('click', async (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      await executeClipSave(currentSelectionText);
      removeFloatingButton();
    });

    document.body.appendChild(btn);
    activeFloatingBtn = btn;
  }

  function removeFloatingButton() {
    if (activeFloatingBtn && activeFloatingBtn.parentNode) {
      activeFloatingBtn.parentNode.removeChild(activeFloatingBtn);
    }
    activeFloatingBtn = null;
  }

  // =========================================================================
  // 2. SAVING CLIP & PERSISTENCE
  // =========================================================================
  async function executeClipSave(text) {
    if (!text) return;

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
      note: 'Capturado con el botón flotante [⚡ CLIP].',
      tags: ['QUICK_CLIP', domain.replace(/\./g, '_')],
      timestamp: now.getTime(),
      formattedDate: formatTechDate(now)
    };

    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const data = await chrome.storage.local.get([STORAGE_KEY]);
        const list = Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
        list.unshift(record);
        await chrome.storage.local.set({ [STORAGE_KEY]: list });
        
        // Notify background
        chrome.runtime.sendMessage({ action: 'UPDATE_BADGE' }).catch(() => {});
      } else {
        // Fallback localStorage
        const stored = localStorage.getItem(STORAGE_KEY);
        const list = stored ? JSON.parse(stored) : [];
        list.unshift(record);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      }

      showCornerToast('CYBERCLIP // DATAPACK REGISTRADO', text);
      
      // Re-highlight DOM with new snippet
      pageRecords.unshift(record);
      applyDomHighlights([record]);
    } catch (err) {
      console.error('[CYBERCLIP // CONTENT] Error saving clip:', err);
      showCornerToast('ERROR AL GUARDAR DATAPACK', text.slice(0, 30));
    }
  }

  // =========================================================================
  // 3. NEON DOM HIGHLIGHTER
  // =========================================================================
  async function loadAndHighlightPageRecords() {
    try {
      let records = [];
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const data = await chrome.storage.local.get([STORAGE_KEY]);
        records = Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
      } else {
        const stored = localStorage.getItem(STORAGE_KEY);
        records = stored ? JSON.parse(stored) : [];
      }

      // Filter for this URL / domain
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
      console.warn('[CYBERCLIP // CONTENT] Error loading highlights:', err);
    }
  }

  function applyDomHighlights(recordsToHighlight) {
    if (!document.body) return;

    recordsToHighlight.forEach(record => {
      if (!record.content || record.content.trim().length < 4) return;
      
      // Use clean search phrase
      const phrase = record.content.trim();
      highlightTextInBody(phrase, record);
    });
  }

  function highlightTextInBody(phrase, record) {
    const safePhrase = phrase.length > 100 ? phrase.substring(0, 90) : phrase;
    const lowerPhrase = safePhrase.toLowerCase();

    // TreeWalker to traverse only text nodes
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
          if (parent.closest('.cyberclip-highlight') || parent.closest('.cyberclip-floating-btn') || parent.closest('.cyberclip-corner-toast')) {
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
      span.setAttribute('data-clip-id', record.id);
      span.setAttribute('data-clip-note', record.note || '');
      span.setAttribute('data-clip-date', record.formattedDate || '');
      span.setAttribute('data-clip-tags', (record.tags || []).join(', '));

      const frag = document.createDocumentFragment();
      if (before) frag.appendChild(document.createTextNode(before));
      frag.appendChild(span);
      if (after) frag.appendChild(document.createTextNode(after));

      parent.replaceChild(frag, textNode);
    });
  }

  // =========================================================================
  // 4. HOLOGRAPHIC HUD TOOLTIP
  // =========================================================================
  function setupTooltipListener() {
    document.addEventListener('mouseover', (e) => {
      const target = e.target.closest('.cyberclip-highlight');
      if (!target) return;

      const note = target.getAttribute('data-clip-note') || 'Fragmento indexado a esta URL';
      const date = target.getAttribute('data-clip-date') || '';
      const tags = (target.getAttribute('data-clip-tags') || '').split(',').filter(Boolean);

      showHudTooltip(target, { note, date, tags });
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

    const tagsHtml = (data.tags || [])
      .map(t => `<span class="cyberclip-tooltip-tag">#${escapeHtml(t.trim())}</span>`)
      .join('');

    tooltip.innerHTML = `
      <div class="cyberclip-tooltip-header">
        <span>⚡ CYBERCLIP // DATAPACK</span>
        <span class="cyberclip-tooltip-date">${escapeHtml(data.date)}</span>
      </div>
      <div class="cyberclip-tooltip-note">${escapeHtml(data.note)}</div>
      ${tagsHtml ? `<div class="cyberclip-tooltip-tags">${tagsHtml}</div>` : ''}
    `;

    document.body.appendChild(tooltip);
    activeTooltip = tooltip;

    // Position above target
    const rect = targetElem.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    let top = rect.top + window.scrollY - tooltipRect.height - 8;
    let left = rect.left + window.scrollX;

    if (top < window.scrollY + 10) {
      top = rect.bottom + window.scrollY + 8; // flip below
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
  // 5. IN-PAGE HUD CORNER TOAST
  // =========================================================================
  function showCornerToast(title, preview) {
    const existing = document.querySelector('.cyberclip-corner-toast');
    if (existing && existing.parentNode) {
      existing.parentNode.removeChild(existing);
    }

    const toast = document.createElement('div');
    toast.className = 'cyberclip-corner-toast';
    toast.innerHTML = `
      <div class="cyberclip-toast-glyph">⚡</div>
      <div class="cyberclip-toast-msg">
        <span class="cyberclip-toast-title">${escapeHtml(title)}</span>
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
  // 6. MESSAGE LISTENER (Commands & Service Worker)
  // =========================================================================
  function setupMessageListener() {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'CLIP_CURRENT_SELECTION') {
          const sel = window.getSelection();
          const text = sel ? sel.toString().trim() : '';
          if (text) {
            executeClipSave(text);
            sendResponse({ status: 'OK', text });
          } else {
            showCornerToast('CYBERCLIP // SIN SELECCIÓN', 'Resalta texto antes de pulsar el atajo');
            sendResponse({ status: 'NO_SELECTION' });
          }
        }
        return true;
      });
    }
  }

  // Helper
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
