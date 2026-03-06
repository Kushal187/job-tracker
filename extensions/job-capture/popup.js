const statusEl = document.getElementById('statusMessage');
const formEl = document.getElementById('captureForm');
const autofillBtn = document.getElementById('autofillBtn');
const submitBtn = document.getElementById('submitBtn');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');

const companyInput = document.getElementById('company');
const jobTitleInput = document.getElementById('jobTitle');
const jobUrlInput = document.getElementById('jobUrl');
const statusInput = document.getElementById('status');

const apiBaseUrlInput = document.getElementById('apiBaseUrl');

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.className = `status ${isError ? 'error' : 'ok'}`;
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

async function loadSettings() {
  const stored = await chrome.storage.sync.get(['apiBaseUrl']);
  apiBaseUrlInput.value = stored.apiBaseUrl || '';
}

async function saveSettings() {
  await chrome.storage.sync.set({
    apiBaseUrl: normalizeText(apiBaseUrlInput.value)
  });

  setStatus('Settings saved.');
}

async function autofillFromCurrentPage() {
  setStatus('Reading current page...');
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || !tab.id || !tab.url) {
    setStatus('Unable to read active tab.', true);
    return;
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const text = (value) => (typeof value === 'string' ? value.trim() : '');
      const meta = (name) => {
        const direct = document.querySelector(`meta[name="${name}"]`);
        if (direct && direct.content) return text(direct.content);
        const property = document.querySelector(`meta[property="${name}"]`);
        return property && property.content ? text(property.content) : '';
      };

      const host = location.hostname;
      const title = text(document.title);
      const ogTitle = meta('og:title');
      const ogSiteName = meta('og:site_name');

      const queryText = (selectors) => {
        for (const selector of selectors) {
          const node = document.querySelector(selector);
          const candidate = text(node ? node.textContent : '');
          if (candidate) return candidate;
        }
        return '';
      };

      let company = '';
      let jobTitle = '';

      if (host.includes('linkedin.com')) {
        company = queryText([
          '.job-details-jobs-unified-top-card__company-name a',
          '.topcard__org-name-link',
          '.jobs-unified-top-card__company-name'
        ]);
        jobTitle = queryText([
          '.job-details-jobs-unified-top-card__job-title h1',
          '.top-card-layout__title',
          '.jobs-unified-top-card__job-title'
        ]);
      }

      if (host.includes('greenhouse.io')) {
        company = queryText(['#header .company-name', '.company-name']) || ogSiteName;
        jobTitle = queryText(['#content h1', '.app-title']);
      }

      if (host.includes('lever.co')) {
        company = queryText(['.main-header-logo img[alt]']) || ogSiteName;
        if (!company) {
          const headerLogo = document.querySelector('.main-header-logo img');
          company = text(headerLogo ? headerLogo.getAttribute('alt') : '');
        }
        jobTitle = queryText(['.posting-headline h2', '.posting-headline h1']);
      }

      if (!jobTitle) {
        const splitTitle = (ogTitle || title).split('|')[0];
        jobTitle = text(splitTitle);
      }

      if (!company) {
        const splitTitle = (ogTitle || title).split('|');
        company = splitTitle.length > 1 ? text(splitTitle[1]) : '';
      }

      return {
        company,
        jobTitle,
        jobUrl: location.href
      };
    }
  });

  const extracted = results && results[0] && results[0].result ? results[0].result : null;

  if (!extracted) {
    setStatus('No data extracted. Fill manually.', true);
    return;
  }

  companyInput.value = normalizeText(extracted.company);
  jobTitleInput.value = normalizeText(extracted.jobTitle);
  jobUrlInput.value = normalizeText(extracted.jobUrl || tab.url);

  if (!jobUrlInput.value) {
    jobUrlInput.value = tab.url;
  }

  setStatus('Autofill complete. Review and submit.');
}

async function submitApplication(event) {
  event.preventDefault();
  const settings = await chrome.storage.sync.get(['apiBaseUrl']);

  const apiBaseUrl = normalizeText(settings.apiBaseUrl || '');

  if (!apiBaseUrl) {
    setStatus('Save API Base URL first in Settings.', true);
    return;
  }

  const payload = {
    company: normalizeText(companyInput.value),
    jobTitle: normalizeText(jobTitleInput.value),
    status: normalizeText(statusInput.value),
    jobUrl: normalizeText(jobUrlInput.value)
  };

  if (!payload.company || !payload.jobTitle || !payload.status || !payload.jobUrl) {
    setStatus('All fields are required.', true);
    return;
  }

  submitBtn.disabled = true;
  setStatus('Saving application...');

  try {
    const headers = {
      'Content-Type': 'application/json',
      'x-idempotency-key': crypto.randomUUID()
    };

    const response = await fetch(`${apiBaseUrl}/api/applications`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    const body = await response.json();

    if (!response.ok) {
      throw new Error(body.details || body.error || 'Request failed');
    }

    setStatus('Saved successfully.');
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Unknown error', true);
  } finally {
    submitBtn.disabled = false;
  }
}

saveSettingsBtn.addEventListener('click', saveSettings);
autofillBtn.addEventListener('click', autofillFromCurrentPage);
formEl.addEventListener('submit', submitApplication);

loadSettings();
