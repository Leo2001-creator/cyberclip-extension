/**
 * CYBERCLIP // Service Worker (background.js)
 * Architecture: Manifest V3 Background Worker
 * Handles Context Menus, Selection Capture, and chrome.storage.local persistence
 */

const STORAGE_KEY = 'cyberclip_records';
const CONTEXT_MENU_SELECTION = 'cyberclip_capture_selection';
const CONTEXT_MENU_PAGE = 'cyberclip_capture_page';

// 1. Lifecycle: Setup Context Menus on install and startup
chrome.runtime.onInstalled.addListener(() => {
  setupContextMenus();
  updateBadgeCounter();
  console.log('[CYBERCLIP // BACKGROUND] Service Worker Initialized (Manifest V3)');
});

chrome.runtime.onStartup.addListener(() => {
  updateBadgeCounter();
});

function setupContextMenus() {
  chrome.contextMenus.removeAll(() => {
    // Selection menu item
    chrome.contextMenus.create({
      id: CONTEXT_MENU_SELECTION,
      title: '⚡ Capturar fragmento a CyberClip',
      contexts: ['selection']
    });

    // Page menu item
    chrome.contextMenus.create({
      id: CONTEXT_MENU_PAGE,
      title: '💾 Indexar esta URL en CyberClip',
      contexts: ['page']
    });
  });
}

// 2. Handle Context Menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab || !tab.url) return;

  const url = tab.url;
  const title = tab.title || extractDomain(url);
  const domain = extractDomain(url);
  const now = new Date();

  if (info.menuItemId === CONTEXT_MENU_SELECTION && info.selectionText) {
    // Fetch settings to get default color and tag if available
    let clipColor = '#FCEE0A';
    let clipTag = 'IDEA';
    try {
      const settingsData = await chrome.storage.local.get(['cyberclip_settings']);
      if (settingsData.cyberclip_settings && settingsData.cyberclip_settings.palette && settingsData.cyberclip_settings.palette[0]) {
        clipColor = settingsData.cyberclip_settings.palette[0].color || clipColor;
        clipTag = settingsData.cyberclip_settings.palette[0].tag || clipTag;
      }
    } catch (e) {}

    const newRecord = {
      id: `clip_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type: 'SNIPPET',
      title: title,
      url: url,
      domain: domain,
      content: info.selectionText.trim(),
      note: '',
      color: clipColor,
      favorite: false,
      tags: [clipTag, 'SELECCIÓN', domain.replace(/\./g, '_')],
      timestamp: now.getTime(),
      formattedDate: formatTechDate(now)
    };

    await saveRecord(newRecord);
    triggerBadgeAlert('+1', '#00F0FF'); // Electric Cyan
  } else if (info.menuItemId === CONTEXT_MENU_PAGE) {
    const newRecord = {
      id: `page_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type: 'URL_REF',
      title: title,
      url: url,
      domain: domain,
      content: `URL Marcada para inspección: ${title}`,
      note: 'Página indexada mediante menú contextual.',
      color: '#00F0FF',
      favorite: false,
      tags: ['URL', 'RESEARCH', domain.replace(/\./g, '_')],
      timestamp: now.getTime(),
      formattedDate: formatTechDate(now)
    };

    await saveRecord(newRecord);
    triggerBadgeAlert('URL', '#FCEE0A'); // Cyber Yellow
  }
});

// 3. Storage Persistence Helper (Límite estricto de 100 MB)
const MAX_STORAGE_BYTES = 100 * 1024 * 1024; // 100 MB exactos (104.857.600 bytes)

async function saveRecord(record) {
  try {
    const data = await chrome.storage.local.get([STORAGE_KEY]);
    const currentList = Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];

    // Validar límite estricto de 100 MB
    let bytesInUse = 0;
    if (chrome.storage.local.getBytesInUse) {
      try {
        bytesInUse = await chrome.storage.local.getBytesInUse(null);
      } catch (e) {
        bytesInUse = new Blob([JSON.stringify(currentList)]).size;
      }
    } else {
      bytesInUse = new Blob([JSON.stringify(currentList)]).size;
    }

    const recordSize = new Blob([JSON.stringify(record)]).size;
    if (bytesInUse + recordSize > MAX_STORAGE_BYTES) {
      console.warn('[CYBERCLIP // BLOQUEO] Límite estricto de 100 MB alcanzado. Clip no guardado.');
      triggerBadgeAlert('FULL', '#FF003C'); // Neon Crimson alert
      return false;
    }
    
    // Add to top of list
    const updatedList = [record, ...currentList];
    
    await chrome.storage.local.set({ [STORAGE_KEY]: updatedList });
    console.log('[CYBERCLIP] Record persistent in chrome.storage.local:', record.id);
    
    // Update badge with count after short delay
    setTimeout(() => {
      updateBadgeCounter(updatedList.length);
    }, 2000);
    return true;
  } catch (err) {
    console.error('[CYBERCLIP // ERROR] Error saving to storage:', err);
    return false;
  }
}

// 4. Badge Telemetry Indicators
function triggerBadgeAlert(text, color) {
  chrome.action.setBadgeText({ text: text });
  chrome.action.setBadgeBackgroundColor({ color: color });
  chrome.action.setBadgeTextColor({ color: '#08090C' });
}

async function updateBadgeCounter(countOverride) {
  try {
    let count = countOverride;
    if (count === undefined) {
      const data = await chrome.storage.local.get([STORAGE_KEY]);
      const list = Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
      count = list.length;
    }
    
    if (count > 0) {
      chrome.action.setBadgeText({ text: String(count) });
      chrome.action.setBadgeBackgroundColor({ color: '#12151D' });
      chrome.action.setBadgeTextColor({ color: '#00F0FF' });
    } else {
      chrome.action.setBadgeText({ text: '' });
    }
  } catch (e) {
    // In restricted context, ignore
  }
}

// 5. Utilities
function extractDomain(urlStr) {
  try {
    const parsed = new URL(urlStr);
    return parsed.hostname.replace(/^www\./, '');
  } catch (e) {
    return 'unknown_host';
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

// 6. Handle runtime messages from Popup
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.action === 'UPDATE_BADGE') {
    updateBadgeCounter();
    sendResponse({ status: 'OK' });
  } else if (request.action === 'MASTER_POWER_TOGGLED') {
    if (request.enabled) {
      setupContextMenus();
      updateBadgeCounter();
    } else {
      chrome.contextMenus.removeAll();
      chrome.action.setBadgeText({ text: 'OFF' });
      chrome.action.setBadgeBackgroundColor({ color: '#FF003C' });
      chrome.action.setBadgeTextColor({ color: '#FFFFFF' });
    }
    sendResponse({ status: 'OK' });
  }
  return true;
});

// 6.1 Listen to settings storage changes for master power
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes['cyberclip_settings']) {
    const newSettings = changes['cyberclip_settings'].newValue || {};
    if (newSettings.masterEnabled === false) {
      chrome.contextMenus.removeAll();
      chrome.action.setBadgeText({ text: 'OFF' });
      chrome.action.setBadgeBackgroundColor({ color: '#FF003C' });
      chrome.action.setBadgeTextColor({ color: '#FFFFFF' });
    } else if (newSettings.masterEnabled === true) {
      setupContextMenus();
      updateBadgeCounter();
    }
  }
});

// 7. Global Keyboard Shortcuts Listener
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'clip_selection') {
    try {
      const settingsData = await chrome.storage.local.get(['cyberclip_settings']);
      if (settingsData.cyberclip_settings && settingsData.cyberclip_settings.masterEnabled === false) {
        return; // No ejecutar atajo si la extensión está en modo Standby
      }

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id) {
        chrome.tabs.sendMessage(tab.id, { action: 'CLIP_CURRENT_SELECTION' }, (response) => {
          if (chrome.runtime.lastError) {
            console.warn('[CYBERCLIP // SHORTCUT] Notice:', chrome.runtime.lastError.message);
          } else if (response && response.status === 'OK') {
            triggerBadgeAlert('+1', '#00F0FF');
            setTimeout(() => updateBadgeCounter(), 2000);
          }
        });
      }
    } catch (e) {
      console.error('[CYBERCLIP // COMMAND ERROR]', e);
    }
  }
});

