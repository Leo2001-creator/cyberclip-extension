/**
 * CYBERCLIP // Offscreen clipboard writer (Manifest V3)
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'OFFSCREEN_COPY') {
    const el = document.getElementById('clipText');
    el.value = request.text || '';
    el.select();
    const ok = document.execCommand('copy');
    sendResponse({ ok });
  }
  return true;
});
