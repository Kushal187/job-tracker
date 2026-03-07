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
  const DRAFT_STORAGE_KEY = 'captureDraft';

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

  async function saveDraft() {
    await chrome.storage.local.set({
      [DRAFT_STORAGE_KEY]: {
        company: normalizeText(companyInput.value),
        jobTitle: normalizeText(jobTitleInput.value),
        status: normalizeText(statusInput.value),
        jobUrl: normalizeText(jobUrlInput.value)
      }
    });
  }

  async function loadDraft() {
    const stored = await chrome.storage.local.get([DRAFT_STORAGE_KEY]);
    const draft = stored[DRAFT_STORAGE_KEY];
    if (!draft || typeof draft !== 'object') return;
    companyInput.value = normalizeText(draft.company);
    jobTitleInput.value = normalizeText(draft.jobTitle);
    statusInput.value = normalizeText(draft.status) || statusInput.value;
    jobUrlInput.value = normalizeText(draft.jobUrl);
  }

  async function clearDraft() {
    await chrome.storage.local.remove(DRAFT_STORAGE_KEY);
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
          const cleanText = (value) =>
            typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
          const meta = (...names) => {
            for (const name of names) {
              const byName = document.querySelector(`meta[name="${name}"]`);
              if (byName?.content) return cleanText(byName.content);
              const byProperty = document.querySelector(`meta[property="${name}"]`);
              if (byProperty?.content) return cleanText(byProperty.content);
            }
            return '';
          };
          const readNodeValue = (node) => {
            if (!node) return '';
            return cleanText(
              node.textContent ||
                node.getAttribute?.('content') ||
                node.getAttribute?.('value') ||
                node.getAttribute?.('alt') ||
                node.getAttribute?.('aria-label') ||
                node.getAttribute?.('title') ||
                ''
            );
          };
          const BAD_TITLE_PATTERNS = [
            /^home$/i,
            /^candidate home$/i,
            /^job alerts?$/i,
            /^settings$/i,
            /^sign in$/i,
            /^search jobs?$/i,
            /^careers?$/i,
            /^jobs?$/i,
            /^about us$/i,
            /^privacy$/i
          ];
          const BAD_COMPANY_PATTERNS = [
            /^home$/i,
            /^candidate home$/i,
            /^job alerts?$/i,
            /^settings$/i,
            /^sign in$/i,
            /^read more$/i,
            /^about us$/i,
            /^privacy$/i,
            /^search jobs?$/i
          ];
          const looksBadTitle = (value) => {
            const text = cleanText(value);
            return !text || BAD_TITLE_PATTERNS.some((pattern) => pattern.test(text));
          };
          const cleanCompanyName = (value) =>
            cleanText(value)
              .replace(/\b(careers?|jobs?)\b$/i, '')
              .replace(/\s+[|:-]\s*$/, '')
              .trim();
          const looksBadCompany = (value) => {
            const text = cleanCompanyName(value);
            return (
              !text ||
              BAD_COMPANY_PATTERNS.some((pattern) => pattern.test(text)) ||
              /^https?:\/\//i.test(text) ||
              text.length > 80
            );
          };
          const pickFirst = (selectors, isInvalid) => {
            for (const selector of selectors) {
              const node = document.querySelector(selector);
              const value = readNodeValue(node);
              if (value && !isInvalid(value)) return value;
            }
            return '';
          };
          const splitCandidates = (value) =>
            cleanText(value)
              .split(/\s+[|•:-]\s+|\s+@\s+|\s+at\s+/i)
              .map(cleanText)
              .filter(Boolean);
          const parseStructuredData = () => {
            const seen = new Set();
            const queue = [];
            const push = (value) => {
              if (!value || typeof value !== 'object' || seen.has(value)) return;
              seen.add(value);
              queue.push(value);
            };
            for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
              try {
                push(JSON.parse(script.textContent || 'null'));
              } catch {}
            }
            while (queue.length) {
              const current = queue.shift();
              if (Array.isArray(current)) {
                current.forEach(push);
                continue;
              }
              const type = current?.['@type'];
              const types = Array.isArray(type) ? type : [type];
              if (types.some((item) => String(item).toLowerCase() === 'jobposting')) {
                const jobTitle = cleanText(current.title || current.name || current.jobTitle);
                const org = current.hiringOrganization || current.organization || current.employer;
                const company = cleanText(
                  typeof org === 'string' ? org : org?.name || org?.legalName || ''
                );
                if (jobTitle || company) return { jobTitle, company };
              }
              Object.values(current).forEach(push);
            }
            return { jobTitle: '', company: '' };
          };
          const host = location.hostname;
          const pageTitle = cleanText(document.title);
          const metaTitle = meta('og:title', 'twitter:title');
          const siteName = meta(
            'og:site_name',
            'twitter:site',
            'application-name',
            'apple-mobile-web-app-title'
          );
          const fromStructuredData = parseStructuredData();
          let company = cleanCompanyName(fromStructuredData.company);
          let jobTitle = fromStructuredData.jobTitle;

          if (host.includes('linkedin.com')) {
            company =
              company ||
              pickFirst(
                [
                  '.job-details-jobs-unified-top-card__company-name a',
                  '.topcard__org-name-link',
                  '.jobs-unified-top-card__company-name'
                ],
                looksBadCompany
              );
            jobTitle =
              jobTitle ||
              pickFirst(
                [
                  '.job-details-jobs-unified-top-card__job-title h1',
                  '.top-card-layout__title',
                  '.jobs-unified-top-card__job-title'
                ],
                looksBadTitle
              );
          }

          if (host.includes('greenhouse.io')) {
            company =
              company ||
              pickFirst(['#header .company-name', '.company-name'], looksBadCompany) ||
              cleanCompanyName(siteName);
            jobTitle =
              jobTitle || pickFirst(['#content h1', '.app-title'], looksBadTitle);
          }

          if (host.includes('lever.co')) {
            company =
              company ||
              pickFirst(['.main-header-logo img', '.main-header-logo'], looksBadCompany) ||
              cleanCompanyName(siteName);
            jobTitle =
              jobTitle ||
              pickFirst(['.posting-headline h2', '.posting-headline h1'], looksBadTitle);
          }

          if (host.includes('myworkdayjobs.com') || host.includes('workday.com')) {
            company =
              company ||
              pickFirst(
                [
                  '[data-automation-id="companyName"]',
                  '[data-automation-id="company-name"]',
                  'header img[alt]',
                  'header a',
                  'nav img[alt]'
                ],
                looksBadCompany
              ) ||
              cleanCompanyName(siteName);
            jobTitle =
              jobTitle ||
              pickFirst(
                [
                  '[data-automation-id="jobPostingHeader"]',
                  'main h1',
                  '[role="main"] h1',
                  'article h1'
                ],
                looksBadTitle
              );
          }

          if (!jobTitle) {
            jobTitle = pickFirst(
              [
                '[data-automation-id="jobPostingHeader"]',
                'main h1',
                '[role="main"] h1',
                'article h1',
                'h1',
                'main h2',
                '[role="main"] h2'
              ],
              looksBadTitle
            );
          }

          if (!company) {
            company =
              pickFirst(
                [
                  '[data-automation-id="companyName"]',
                  '[data-automation-id="company-name"]',
                  '[data-testid*="company"]',
                  '[class*="company"] a',
                  '[class*="company"]',
                  '[id*="company"]',
                  'header img[alt]',
                  'header a',
                  'nav img[alt]'
                ],
                looksBadCompany
              ) || cleanCompanyName(siteName);
          }

          const titleParts = splitCandidates(metaTitle || pageTitle);
          const firstTitlePart = titleParts[0] || '';
          if (!jobTitle && firstTitlePart && !looksBadTitle(firstTitlePart)) {
            jobTitle = firstTitlePart;
          }
          if (!company) {
            company =
              cleanCompanyName(
                titleParts.find(
                  (part) =>
                    cleanText(part).toLowerCase() !== cleanText(jobTitle).toLowerCase() &&
                    !looksBadCompany(part)
                ) || ''
              ) || cleanCompanyName(siteName);
          }

          return {
            company: cleanCompanyName(company),
            jobTitle: cleanText(jobTitle),
            jobUrl: location.href
          };
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
      await saveDraft();
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
      await clearDraft();
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
  for (const input of [companyInput, jobTitleInput, statusInput, jobUrlInput]) {
    input.addEventListener('input', saveDraft);
    input.addEventListener('change', saveDraft);
  }

  loadTheme();
  loadSettings();
  loadDraft();
})();
