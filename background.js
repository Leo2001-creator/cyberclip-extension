/**
 * CYBERCLIP // Service Worker (background.js) v1.3.0
 * Architecture: Manifest V3 Background Worker
 * Handles Storage engine (single-writer), Context Menus, Keyboard Shortcuts (Alt+C, Alt+V, Alt+N)
 * and Offscreen clipboard bridge.
 */

importScripts('lib/shared.js', 'lib/store.js');

const S = globalThis.CyberClipShared;
const store = globalThis.CyberClipStore.createStore(chrome.storage.local);

const CONTEXT_MENU_SELECTION = 'cyberclip_capture_selection';
const CONTEXT_MENU_PAGE = 'cyberclip_capture_page';

// 1. Lifecycle
chrome.runtime.onInstalled.addListener(async () => {
  try {
    await store.migrate();
    await syncPowerState();
    console.log('[CYBERCLIP // BACKGROUND] v1.3.0 initialized & migrated');
  } catch (e) {
    console.error('[CYBERCLIP // BACKGROUND] Init error:', e);
  }
});

chrome.runtime.onStartup.addListener(async () => {
  await syncPowerState();
});

async function syncPowerState() {
  const settings = await store.getSettings();
  if (settings.masterEnabled === false) {
    chrome.contextMenus.removeAll();
    chrome.action.setBadgeText({ text: 'OFF' });
    chrome.action.setBadgeBackgroundColor({ color: '#FF003C' });
    chrome.action.setBadgeTextColor({ color: '#FFFFFF' });
  } else {
    setupContextMenus();
    await updateBadgeCounter();
  }
}

function setupContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_SELECTION,
      title: '⚡ Capturar fragmento a CyberClip',
      contexts: ['selection']
    });
    chrome.contextMenus.create({
      id: CONTEXT_MENU_PAGE,
      title: '💾 Indexar esta URL en CyberClip',
      contexts: ['page']
    });
  });
}

// 2. Context Menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab || !tab.url) return;
  const settings = await store.getSettings();
  if (settings.masterEnabled === false) return;
  if (S.isHostBlocked(tab.url, settings.blockedSites)) return;

  const url = tab.url;
  const title = tab.title || S.extractDomain(url);
  const domain = S.extractDomain(url);
  const now = new Date();

  if (info.menuItemId === CONTEXT_MENU_SELECTION && info.selectionText) {
    const slot = (settings.palette && settings.palette[0]) || S.DEFAULT_PALETTE[0];
    const rec = {
      type: 'SNIPPET',
      title, url, domain,
      content: info.selectionText.trim(),
      note: '',
      color: slot.color,
      favorite: false,
      tags: [slot.tag, 'SELECCIÓN', domain.replace(/\./g, '_')],
      timestamp: now.getTime(),
      formattedDate: S.formatTechDate(now)
    };
    const res = await store.add(rec);
    if (res.ok) {
      triggerBadgeAlert('+1', '#00F0FF');
      setTimeout(updateBadgeCounter, 1800);
    } else if (res.error === 'QUOTA_EXCEEDED') {
      triggerBadgeAlert('FULL', '#FF003C');
    }
  } else if (info.menuItemId === CONTEXT_MENU_PAGE) {
    const rec = {
      type: 'URL_REF',
      title, url, domain,
      content: `URL Marcada para inspección: ${title}`,
      note: 'Página indexada mediante menú contextual.',
      color: '#00F0FF',
      favorite: false,
      tags: ['URL', 'RESEARCH', domain.replace(/\./g, '_')],
      timestamp: now.getTime(),
      formattedDate: S.formatTechDate(now)
    };
    const res = await store.add(rec);
    if (res.ok) {
      triggerBadgeAlert('URL', '#FCEE0A');
      setTimeout(updateBadgeCounter, 1800);
    }
  }
});

// 3. Badge
function triggerBadgeAlert(text, color) {
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });
  chrome.action.setBadgeTextColor({ color: '#08090C' });
}

async function updateBadgeCounter(countOverride) {
  try {
    const settings = await store.getSettings();
    if (settings.masterEnabled === false) {
      chrome.action.setBadgeText({ text: 'OFF' });
      chrome.action.setBadgeBackgroundColor({ color: '#FF003C' });
      chrome.action.setBadgeTextColor({ color: '#FFFFFF' });
      return;
    }
    let count = countOverride;
    if (count === undefined) {
      const list = await store.getAll();
      count = list.length;
    }
    if (count > 0) {
      chrome.action.setBadgeText({ text: String(count) });
      chrome.action.setBadgeBackgroundColor({ color: '#12151D' });
      chrome.action.setBadgeTextColor({ color: '#00F0FF' });
    } else {
      chrome.action.setBadgeText({ text: '' });
    }
  } catch (e) {}
}

// 4. Message Router (centralizado para popup, content script y offscreen)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const handler = async () => {
    switch (request.action) {
      case 'GET_SETTINGS':
        return { ok: true, settings: await store.getSettings() };

      case 'SAVE_SETTINGS': {
        const next = await store.saveSettings(request.patch || {});
        await syncPowerState();
        return { ok: true, settings: next };
      }

      case 'MASTER_POWER_TOGGLED': {
        await store.saveSettings({ masterEnabled: !!request.enabled });
        await syncPowerState();
        return { ok: true };
      }

      case 'SAVE_CLIP': {
        const settings = await store.getSettings();
        if (settings.masterEnabled === false) return { ok: false, error: 'STANDBY' };
        if (request.record && request.record.url && S.isHostBlocked(request.record.url, settings.blockedSites)) {
          return { ok: false, error: 'BLOCKED' };
        }
        const res = await store.add(request.record);
        if (res.ok) {
          triggerBadgeAlert('+1', '#00F0FF');
          setTimeout(updateBadgeCounter, 1800);
        } else if (res.error === 'QUOTA_EXCEEDED') {
          triggerBadgeAlert('FULL', '#FF003C');
        }
        return res;
      }

      case 'UPDATE_RECORD':
        return await store.update(request.id, request.patch);

      case 'DELETE_RECORDS':
        return await store.remove(request.ids);

      case 'RESTORE_RECORDS':
        return await store.restore(request.records);

      case 'PURGE':
        return await store.purge(request.includeFavorites === true);

      case 'IMPORT_MANY':
        return await store.importMany(request.items);

      case 'GET_USAGE':
        return await store.usage();

      case 'GET_PAGE_RECORDS': {
        const all = await store.getAll();
        const norm = S.normalizePageUrl(request.url);
        return { ok: true, records: all.filter(r => S.normalizePageUrl(r.url) === norm) };
      }

      case 'GET_ALL_RECORDS':
        return { ok: true, records: await store.getAll() };

      case 'UPDATE_BADGE':
        await updateBadgeCounter();
        return { ok: true };

      case 'COPY_TEXT':
        return await copyViaOffscreen(request.text || '');

      default:
        return { ok: false, error: 'UNKNOWN_ACTION' };
    }
  };

  handler()
    .then(res => sendResponse(res))
    .catch(err => sendResponse({ ok: false, error: String(err && err.message) }));
  return true; // Asíncrono
});

// 5. Watch storage changes to keep badge/menus in sync
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local') {
    if (changes[S.SETTINGS_KEY]) {
      syncPowerState();
    }
    if (changes[S.STORAGE_KEY]) {
      updateBadgeCounter();
    }
  }
});

// 6. Offscreen clipboard bridge (Service Worker -> Offscreen)
async function copyViaOffscreen(text) {
  try {
    const existing = await chrome.offscreen.hasDocument();
    if (!existing) {
      await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['CLIPBOARD'],
        justification: 'CYBERCLIP requiere copiar el último fragmento capturado al portapapeles con Alt+V'
      });
    }
    const res = await chrome.runtime.sendMessage({ action: 'OFFSCREEN_COPY', text });
    return { ok: res && res.ok };
  } catch (e) {
    return { ok: false, error: String(e && e.message) };
  }
}

// 7. Global Keyboard Shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  const settings = await store.getSettings();
  if (settings.masterEnabled === false) return;

  if (command === 'clip_selection') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id || !tab.url) return;
    if (S.isHostBlocked(tab.url, settings.blockedSites)) return;

    chrome.tabs.sendMessage(tab.id, { action: 'CLIP_CURRENT_SELECTION' }, (response) => {
      if (chrome.runtime.lastError) {
        // Fallback: extraer via scripting si el content script aún no escuchaba
        captureSelectionFallback(tab, settings);
      } else if (response && response.status === 'OK') {
        triggerBadgeAlert('+1', '#00F0FF');
        setTimeout(updateBadgeCounter, 1800);
      }
    });
  } else if (command === 'copy_last_clip') {
    const list = await store.getAll();
    if (!list || list.length === 0) {
      triggerBadgeAlert('EMPTY', '#FFA500');
      setTimeout(updateBadgeCounter, 1800);
      return;
    }
    const last = list[0];
    const text = last.content + (last.note ? `\n\nNota: ${last.note}` : '');
    const res = await copyViaOffscreen(text);
    if (res.ok) {
      triggerBadgeAlert('COPIED', '#00FF66');
      setTimeout(updateBadgeCounter, 1800);
    }
  }
});

async function captureSelectionFallback(tab, settings) {
  try {
    const [inj] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection().toString()
    });
    const text = inj && inj.result ? inj.result.trim() : '';
    if (!text) return;
    const slot = (settings.palette && settings.palette[0]) || S.DEFAULT_PALETTE[0];
    const rec = {
      type: 'SNIPPET',
      title: tab.title || S.extractDomain(tab.url),
      url: tab.url,
      domain: S.extractDomain(tab.url),
      content: text,
      note: 'Capturado mediante atajo global Alt+C.',
      color: slot.color,
      favorite: false,
      tags: [slot.tag, 'ATAJO_ALT_C'],
      timestamp: Date.now(),
      formattedDate: S.formatTechDate(new Date())
    };
    const res = await store.add(rec);
    if (res.ok) {
      triggerBadgeAlert('+1', '#00F0FF');
      setTimeout(updateBadgeCounter, 1800);
    }
  } catch (e) {}
}
