(function () {
  const formEl = document.getElementById('captureForm');
  const autofillBtn = document.getElementById('autofillBtn');
  const submitBtn = document.getElementById('submitBtn');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsPanel = document.getElementById('settingsPanel');
  const themeBtn = document.getElementById('themeBtn');
  const errorMsg = document.getElementById('errorMsg');

  const companyInput = document.getElementById('company');
  const jobTitleInput = document.getElementById('jobTitle');
  const jobUrlInput = document.getElementById('jobUrl');
  const statusInput = document.getElementById('status');
  const apiBaseUrlInput = document.getElementById('apiBaseUrl');

  const sunIcon = themeBtn.querySelector('.sun');
  const moonIcon = themeBtn.querySelector('.moon');

  function setError(msg) {
    errorMsg.textContent = msg || '';
  }

  function setTheme(isDark) {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : '');
    sunIcon.style.display = isDark ? 'none' : 'block';
    moonIcon.style.display = isDark ? 'block' : 'none';
  }

  async function loadTheme() {
    const { theme } = await chrome.storage.sync.get(['theme']);
    setTheme(theme === 'dark');
  }

  themeBtn.addEventListener('click', async () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const next = !isDark;
    setTheme(next);
    await chrome.storage.sync.set({ theme: next ? 'dark' : 'light' });
  });

  settingsBtn.addEventListener('click', () => {
    const open = settingsPanel.classList.toggle('is-open');
    settingsPanel.setAttribute('aria-hidden', !open);
  });

  async function loadSettings() {
    const stored = await chrome.storage.sync.get(['apiBaseUrl']);
    apiBaseUrlInput.value = (stored.apiBaseUrl || '').trim();
  }

  async function saveSettings() {
    await chrome.storage.sync.set({ apiBaseUrl: apiBaseUrlInput.value.trim() });
    setError('');
  }

  function normalizeText(v) {
    return typeof v === 'string' ? v.trim() : '';
  }

  async function autofillFromCurrentPage() {
    setError('');
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url) {
      setError('Unable to read active tab.');
      return;
    }
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const text = (v) => (typeof v === 'string' ? v.trim() : '');
          const meta = (name) => {
            const d = document.querySelector(`meta[name="${name}"]`);
            if (d?.content) return text(d.content);
            const p = document.querySelector(`meta[property="${name}"]`);
            return p?.content ? text(p.content) : '';
          };
          const host = location.hostname;
          const title = text(document.title);
          const ogTitle = meta('og:title');
          const ogSiteName = meta('og:site_name');
          const q = (sel) => {
            for (const s of sel) {
              const n = document.querySelector(s);
              const c = text(n?.textContent);
              if (c) return c;
            }
            return '';
          };
          let company = '',
            jobTitle = '';
          if (host.includes('linkedin.com')) {
            company = q([
              '.job-details-jobs-unified-top-card__company-name a',
              '.topcard__org-name-link',
              '.jobs-unified-top-card__company-name'
            ]);
            jobTitle = q([
              '.job-details-jobs-unified-top-card__job-title h1',
              '.top-card-layout__title',
              '.jobs-unified-top-card__job-title'
            ]);
          }
          if (host.includes('greenhouse.io')) {
            company = q(['#header .company-name', '.company-name']) || ogSiteName;
            jobTitle = q(['#content h1', '.app-title']);
          }
          if (host.includes('lever.co')) {
            company = q(['.main-header-logo img[alt]']) || ogSiteName;
            if (!company) {
              const img = document.querySelector('.main-header-logo img');
              company = text(img?.getAttribute('alt'));
            }
            jobTitle = q(['.posting-headline h2', '.posting-headline h1']);
          }
          if (!jobTitle) jobTitle = text((ogTitle || title).split('|')[0]);
          if (!company) company = text((ogTitle || title).split('|')[1] || '');
          return { company, jobTitle, jobUrl: location.href };
        }
      });
      const extracted = results?.[0]?.result;
      if (!extracted) {
        setError('No data extracted. Fill manually.');
        return;
      }
      companyInput.value = normalizeText(extracted.company);
      jobTitleInput.value = normalizeText(extracted.jobTitle);
      jobUrlInput.value = normalizeText(extracted.jobUrl || tab.url) || tab.url;
    } catch (e) {
      setError('Unable to read page.');
    }
  }

  async function submitApplication(e) {
    e.preventDefault();
    setError('');
    const apiBaseUrl = normalizeText(
      (await chrome.storage.sync.get(['apiBaseUrl'])).apiBaseUrl || ''
    );
    if (!apiBaseUrl) {
      setError('Save API Base URL first in Settings.');
      return;
    }
    const payload = {
      company: normalizeText(companyInput.value),
      jobTitle: normalizeText(jobTitleInput.value),
      status: normalizeText(statusInput.value),
      jobUrl: normalizeText(jobUrlInput.value)
    };
    if (
      !payload.company ||
      !payload.jobTitle ||
      !payload.status ||
      !payload.jobUrl
    ) {
      setError('All fields are required.');
      return;
    }
    submitBtn.disabled = true;
    try {
      const res = await fetch(`${apiBaseUrl}/api/applications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-idempotency-key': crypto.randomUUID()
        },
        body: JSON.stringify(payload)
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.details || body.error || 'Request failed');
      submitBtn.classList.add('is-success');
      setTimeout(() => {
        submitBtn.classList.remove('is-success');
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      submitBtn.disabled = false;
    }
  }

  saveSettingsBtn.addEventListener('click', saveSettings);
  autofillBtn.addEventListener('click', autofillFromCurrentPage);
  formEl.addEventListener('submit', submitApplication);

  loadTheme();
  loadSettings();
})();
