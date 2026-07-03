/* Applyr Capture — in-page floating widget ("ticker").
 *
 * On career sites this injects a slim Applyr logo tab pinned to the right edge
 * of the page. Clicking it expands the capture panel, which is the existing
 * popup UI (popup.html) loaded in an iframe at the extension origin — so auth,
 * save, resume-tailor, and PDF download all keep working unchanged. Page
 * scraping is delegated to content.js (self.ApplyrCapture) over a postMessage
 * bridge.
 *
 * Runs in the same content_scripts entry as content.js (shared isolated-world
 * scope), top frame only.
 *
 * Known limitation: a site whose CSP frame-src excludes chrome-extension: can
 * block the panel iframe. The priority career sites allow it in practice; a
 * Shadow-DOM-rendered fallback panel is possible later. */
(function () {
  if (self.__applyrWidgetLoaded) return;
  self.__applyrWidgetLoaded = true;

  // Widget only belongs on the top-level document.
  if (window.top !== window) return;

  const EXT_ORIGIN = chrome.runtime.getURL('').replace(/\/$/, '');
  const PANEL_URL = chrome.runtime.getURL('popup.html') + '?embedded=1';
  const LOGO_URL = chrome.runtime.getURL('logo.svg');
  const DISMISS_KEY = 'widgetDismissedHosts';
  const HOST = location.hostname;

  // ── Career-site detection ──────────────────────────────────────────────────
  const CAREER_HOST_RE =
    /(^|\.)(myworkdayjobs\.com|workday\.com|greenhouse\.io|lever\.co|ashbyhq\.com|smartrecruiters\.com|jobvite\.com|icims\.com|workable\.com|bamboohr\.com|taleo\.net|successfactors\.com|eightfold\.ai|rippling\.com|dover\.com|wellfound\.com|builtin\.com|dice\.com|ziprecruiter\.com|jobs\.apple\.com)$/i;

  function isCareerSite() {
    const host = location.hostname;
    const path = location.pathname;

    if (CAREER_HOST_RE.test(host)) return true;
    if (host.endsWith('careers.google.com')) return true;
    if (host.includes('linkedin.com') && /\/jobs?\b/.test(path)) return true;
    if (host.includes('indeed.com') && /(viewjob|\/jobs|\/job\/)/i.test(path + location.search)) return true;
    if (host.includes('glassdoor.') && /job/i.test(path)) return true;

    const api = self.ApplyrCapture;
    if (api) {
      try {
        if (api.detectGreenhouseJobId && api.detectGreenhouseJobId()) return true;
        if (api.detectLeverCompanyAndId && api.detectLeverCompanyAndId()) return true;
        if (api.hasJobPostingLd && api.hasJobPostingLd()) return true;
      } catch { /* detection is best-effort */ }
    }
    return false;
  }

  // ── Per-host dismissal ──────────────────────────────────────────────────────
  async function isDismissed() {
    const data = await chrome.storage.local.get(DISMISS_KEY);
    return Boolean((data[DISMISS_KEY] || {})[HOST]);
  }

  async function setDismissed() {
    const data = await chrome.storage.local.get(DISMISS_KEY);
    const map = data[DISMISS_KEY] || {};
    map[HOST] = true;
    await chrome.storage.local.set({ [DISMISS_KEY]: map });
  }

  // ── Widget UI (Shadow DOM) ──────────────────────────────────────────────────
  const TEMPLATE = `
    <style>
      :host { all: initial; }
      .tab {
        position: fixed;
        right: 0;
        top: 50%;
        transform: translateY(-50%);
        width: 44px;
        height: 52px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        margin: 0;
        border: none;
        border-radius: 12px 0 0 12px;
        background: #fffaf5;
        box-shadow: 0 2px 14px rgba(0, 0, 0, 0.20);
        cursor: pointer;
        transition: transform 140ms ease, box-shadow 140ms ease;
        z-index: 2147483647;
      }
      .tab:hover {
        transform: translateY(-50%) translateX(-3px);
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.28);
      }
      .tab img {
        width: 30px;
        height: 30px;
        display: block;
        border-radius: 7px;
        pointer-events: none;
      }
      .dismiss {
        position: absolute;
        top: -7px;
        left: -7px;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: #6e6258;
        color: #fff;
        font: 600 13px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        display: none;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
      }
      .dismiss:hover { background: #991b1b; }
      .tab:hover .dismiss { display: flex; }

      .panel-wrap {
        display: none;
        position: fixed;
        right: 16px;
        top: 50%;
        transform: translateY(-50%);
        width: 384px;
        height: min(600px, calc(100vh - 32px));
        border-radius: 14px;
        overflow: hidden;
        box-shadow: 0 16px 56px rgba(0, 0, 0, 0.30);
        background: #f7f1e8;
        z-index: 2147483647;
      }
      .panel-frame {
        width: 100%;
        height: 100%;
        border: 0;
        display: block;
        color-scheme: normal;
        background: transparent;
      }

      :host(.expanded) .tab { display: none; }
      :host(.expanded) .panel-wrap { display: block; }
    </style>
    <button class="tab" type="button" aria-label="Open Applyr" title="Open Applyr">
      <img src="${LOGO_URL}" alt="Applyr" />
      <span class="dismiss" role="button" aria-label="Hide Applyr on this site" title="Hide on this site">&times;</span>
    </button>
    <div class="panel-wrap"></div>
  `;

  let host = null;
  let shadow = null;
  let panelWrap = null;
  let iframe = null;
  let mounted = false;
  let expanded = false;
  let attachObserver = null;

  function buildHost() {
    host = document.createElement('div');
    host.id = 'applyr-widget-root';
    host.style.cssText =
      'position: fixed; top: 0; left: 0; width: 0; height: 0; margin: 0; padding: 0; z-index: 2147483647;';
    shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = TEMPLATE;

    panelWrap = shadow.querySelector('.panel-wrap');
    const tab = shadow.querySelector('.tab');
    const dismissBtn = shadow.querySelector('.dismiss');

    tab.addEventListener('click', (event) => {
      if (event.target.closest('.dismiss')) return;
      expand();
    });
    dismissBtn.addEventListener('click', async (event) => {
      event.stopPropagation();
      await setDismissed();
      unmount();
    });
  }

  // Re-parent the host if it has detached. React/Next.js career boards (e.g. the
  // newer job-boards.greenhouse.io) hydrate <html>/<body> and reconcile away
  // foreign children they didn't render, which would otherwise remove the
  // launcher moments after it first appears. We attach into <body> (less churn
  // than <html>) and keep re-attaching if it's yanked.
  function attach() {
    const parent = document.body || document.documentElement;
    if (parent && host && host.parentNode !== parent) parent.appendChild(host);
  }

  function mount() {
    if (!host) buildHost();
    attach();
    mounted = true;

    if (!attachObserver) {
      attachObserver = new MutationObserver(() => {
        if (mounted && host && !host.isConnected) attach();
      });
      // Watch <body> for our node being removed, and <html> for <body> itself
      // being swapped out. childList only (no subtree) keeps this cheap.
      attachObserver.observe(document.documentElement, { childList: true });
      if (document.body) attachObserver.observe(document.body, { childList: true });
    }
  }

  function unmount() {
    if (!mounted && !host) return;
    mounted = false;
    expanded = false;
    if (attachObserver) {
      attachObserver.disconnect();
      attachObserver = null;
    }
    if (host && host.parentNode) host.parentNode.removeChild(host);
    host = shadow = panelWrap = iframe = null;
  }

  function expand() {
    if (!mounted) return;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.className = 'panel-frame';
      iframe.src = PANEL_URL;
      iframe.setAttribute('title', 'Applyr');
      panelWrap.appendChild(iframe);
    }
    expanded = true;
    host.classList.add('expanded');
  }

  function collapse() {
    if (!mounted) return;
    expanded = false;
    host.classList.remove('expanded');
  }

  // ── postMessage bridge (parent side) ────────────────────────────────────────
  // The embedded panel (popup.js) asks us to scrape the page or collapse. We
  // answer with self.ApplyrCapture, which content.js populated. Only page-scraped
  // data and UI commands cross this bridge — never auth tokens.
  window.addEventListener('message', (event) => {
    if (event.origin !== EXT_ORIGIN) return;
    const data = event.data;
    if (!data || data.source !== 'applyr-panel') return;
    if (!iframe || event.source !== iframe.contentWindow) return;

    if (data.type === 'COLLAPSE') return collapse();
    if (data.type === 'READY') return;
    if (data.type === 'REQUEST') return handleRequest(data);
  });

  async function handleRequest(data) {
    const respond = (ok, result, error) => {
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage(
          { source: 'applyr-content', type: 'RESPONSE', id: data.id, ok, data: result, error },
          EXT_ORIGIN
        );
      }
    };
    try {
      const api = self.ApplyrCapture || {};
      if (data.action === 'PAGE_INFO') {
        return respond(true, { url: location.href, title: document.title });
      }
      if (data.action === 'EXTRACT_FIELDS') {
        return respond(true, api.extractApplicationFields ? api.extractApplicationFields() : null);
      }
      if (data.action === 'CAPTURE_JD') {
        const payload = await api.captureJobPage();
        return respond(true, payload);
      }
      respond(false, null, 'Unknown action: ' + data.action);
    } catch (error) {
      respond(false, null, String((error && error.message) || error));
    }
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────
  async function evaluate() {
    if (isCareerSite()) {
      if (!(await isDismissed())) mount();
    } else if (mounted && !expanded) {
      // SPA navigated off a job posting — retract the tab.
      unmount();
    }
  }

  function start() {
    evaluate();
    // Re-check for late-rendered SPA content / JSON-LD injected after load.
    setTimeout(evaluate, 1500);
    setTimeout(evaluate, 3500);

    // SPA route-change detection: content scripts can't intercept the page's
    // history.pushState from their isolated world, so poll the URL.
    let lastUrl = location.href;
    window.addEventListener('popstate', () => setTimeout(evaluate, 500));
    setInterval(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        setTimeout(evaluate, 600);
      }
    }, 1200);
  }

  start();
})();
