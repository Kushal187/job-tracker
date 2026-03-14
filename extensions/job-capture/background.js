/* Background service worker — handles cross-origin API fetches for content script */

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'FETCH_JSON') {
    fetch(message.url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }
});
