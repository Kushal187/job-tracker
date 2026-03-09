(function () {
  const PROD_API_BASE_URL = 'https://kushal-job-tracker.vercel.app';
  const manifest = chrome.runtime.getManifest();
  const isStoreBuild = Boolean(manifest.update_url);

  const sessionBtn = document.getElementById('sessionBtn');
  const sessionLabel = document.getElementById('sessionLabel');
  const authForm = document.getElementById('authForm');
  const authEmailInput = document.getElementById('authEmail');
  const authPasswordInput = document.getElementById('authPassword');
  const signInBtn = document.getElementById('signInBtn');
  const signOutBtn = document.getElementById('signOutBtn');
  const authStatus = document.getElementById('authStatus');
  const authHint = document.getElementById('authHint');
  const authMsg = document.getElementById('authMsg');
  const sessionMeta = document.getElementById('sessionMeta');
  const statusTitle = document.getElementById('statusTitle');
  const statusText = document.getElementById('statusText');
  const statusActionBtn = document.getElementById('statusActionBtn');
  const formEl = document.getElementById('captureForm');
  const autofillBtn = document.getElementById('autofillBtn');
  const submitBtn = document.getElementById('submitBtn');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsPanel = document.getElementById('settingsPanel');
  const connectionCopy = document.getElementById('connectionCopy');
  const connectionField = document.getElementById('connectionField');
  const connectionValue = document.getElementById('connectionValue');
  const connectionHelper = document.getElementById('connectionHelper');
  const themeBtn = document.getElementById('themeBtn');
  const errorMsg = document.getElementById('errorMsg');

  const companyInput = document.getElementById('company');
  const jobTitleInput = document.getElementById('jobTitle');
  const jobUrlInput = document.getElementById('jobUrl');
  const statusInput = document.getElementById('status');
  const apiBaseUrlInput = document.getElementById('apiBaseUrl');
  const DRAFT_STORAGE_KEY = 'captureDraft';
  const SESSION_STORAGE_KEY = 'supabaseSession';

  const sunIcon = themeBtn.querySelector('.sun');
  const moonIcon = themeBtn.querySelector('.moon');

  function setAuthMessage(msg, isError = false) {
    authMsg.textContent = msg || '';
    authMsg.dataset.state = msg ? (isError ? 'error' : 'success') : '';
  }

  function setError(msg) {
    errorMsg.textContent = msg || '';
  }

  function setElementVisible(element, visible) {
    element.hidden = !visible;
    element.classList.toggle('visually-hidden', !visible);
  }

  function normalizeBaseUrl(value) {
    return normalizeText(value).replace(/\/+$/, '');
  }

  async function resolveApiBaseUrl() {
    if (isStoreBuild) {
      return PROD_API_BASE_URL;
    }

    const stored = await chrome.storage.sync.get(['apiBaseUrl']);
    return normalizeBaseUrl(stored.apiBaseUrl || PROD_API_BASE_URL);
  }

  function getSessionDisplayLabel(session) {
    const email = normalizeText(session?.userEmail);
    if (!email) return 'Connected';

    const localPart = email.split('@')[0] || email;
    return localPart.length <= 12 ? localPart : `${localPart.slice(0, 11)}...`;
  }

  function formatSessionExpiry(session) {
    if (!session?.expiresAt) return '';

    return new Date(session.expiresAt * 1000).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
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

  function openSettingsPanel() {
    settingsPanel.classList.add('is-open');
    settingsPanel.setAttribute('aria-hidden', 'false');
  }

  async function loadSettings() {
    const resolvedApiBaseUrl = await resolveApiBaseUrl();
    apiBaseUrlInput.value = resolvedApiBaseUrl;

    if (isStoreBuild) {
      connectionCopy.textContent = 'This store build is locked to the official Applyr app.';
      connectionValue.textContent = PROD_API_BASE_URL;
      setElementVisible(connectionField, false);
      setElementVisible(connectionValue, true);
      setElementVisible(connectionHelper, false);
      setElementVisible(saveSettingsBtn, false);
      return;
    }

    connectionCopy.textContent = 'Choose which app this extension talks to.';
    setElementVisible(connectionField, true);
    setElementVisible(connectionValue, false);
    setElementVisible(connectionHelper, true);
    setElementVisible(saveSettingsBtn, true);
  }

  async function saveSettings() {
    if (isStoreBuild) {
      apiBaseUrlInput.value = PROD_API_BASE_URL;
      setAuthMessage('This build is locked to the official Applyr app.');
      return;
    }

    const previousApiBaseUrl = normalizeBaseUrl(
      (await chrome.storage.sync.get(['apiBaseUrl'])).apiBaseUrl || ''
    );
    const nextApiBaseUrl = normalizeBaseUrl(apiBaseUrlInput.value);
    apiBaseUrlInput.value = nextApiBaseUrl;

    await chrome.storage.sync.set({ apiBaseUrl: nextApiBaseUrl });

    if (nextApiBaseUrl !== previousApiBaseUrl) {
      await clearSession();
      authPasswordInput.value = '';
      setAuthMessage(nextApiBaseUrl ? 'Settings saved. Sign in again.' : 'API Base URL cleared.');
    } else {
      setAuthMessage('Settings saved.');
    }

    setError('');
    updateAuthUi(await getStoredSession());
  }

  function normalizeText(v) {
    return typeof v === 'string' ? v.trim() : '';
  }

  function getSessionExpiresAt(sessionLike) {
    const expiresAt = Number(sessionLike?.expires_at ?? sessionLike?.expiresAt);
    if (Number.isFinite(expiresAt) && expiresAt > 0) return expiresAt;

    const expiresIn = Number(sessionLike?.expires_in);
    if (Number.isFinite(expiresIn) && expiresIn > 0) {
      return Math.floor(Date.now() / 1000) + expiresIn;
    }

    return 0;
  }

  function toStoredSession(sessionLike) {
    const accessToken = normalizeText(sessionLike?.access_token ?? sessionLike?.accessToken);
    const refreshToken = normalizeText(sessionLike?.refresh_token ?? sessionLike?.refreshToken);
    const expiresAt = getSessionExpiresAt(sessionLike);

    if (!accessToken || !refreshToken || !expiresAt) {
      return null;
    }

    return {
      accessToken,
      refreshToken,
      expiresAt,
      userEmail: normalizeText(sessionLike?.user?.email ?? sessionLike?.userEmail),
      userId: normalizeText(sessionLike?.user?.id ?? sessionLike?.userId)
    };
  }

  async function getStoredSession() {
    const stored = await chrome.storage.local.get([SESSION_STORAGE_KEY]);
    return toStoredSession(stored[SESSION_STORAGE_KEY]);
  }

  async function saveSession(sessionLike) {
    const session = toStoredSession(sessionLike);
    if (!session) {
      throw new Error('Invalid session received from auth service.');
    }

    await chrome.storage.local.set({
      [SESSION_STORAGE_KEY]: session
    });

    return session;
  }

  async function clearSession() {
    await chrome.storage.local.remove(SESSION_STORAGE_KEY);
  }

  function isSessionExpired(session) {
    return !session || session.expiresAt <= Math.floor(Date.now() / 1000) + 60;
  }

  function updateAuthUi(session) {
    const apiBaseUrl = normalizeBaseUrl(apiBaseUrlInput.value);
    const signedIn = Boolean(session?.accessToken);
    const expiresLabel = formatSessionExpiry(session);

    authEmailInput.disabled = !apiBaseUrl;
    authPasswordInput.disabled = !apiBaseUrl;
    signInBtn.disabled = !apiBaseUrl;
    submitBtn.disabled = !signedIn;

    if (!apiBaseUrl) {
      sessionBtn.dataset.state = 'setup';
      sessionLabel.textContent = 'Setup';
      sessionBtn.title = 'Open settings';
      setElementVisible(authForm, false);
      setElementVisible(signOutBtn, false);
      setElementVisible(statusActionBtn, true);
      statusActionBtn.textContent = 'Set Up';
      authStatus.textContent = 'Connect the extension to your app first.';
      authHint.textContent = 'Open Settings and save your local or deployed app URL.';
      sessionMeta.textContent = '';
      statusTitle.textContent = 'Setup required';
      statusText.textContent = 'Add your app URL in Settings before you can sign in and save applications.';
      return;
    }

    if (signedIn) {
      const label = getSessionDisplayLabel(session);
      sessionBtn.dataset.state = 'connected';
      sessionLabel.textContent = label;
      sessionBtn.title = session.userEmail || 'Connected';
      setElementVisible(authForm, false);
      setElementVisible(signOutBtn, true);
      setElementVisible(statusActionBtn, false);
      authStatus.textContent = `Saving as ${session.userEmail || 'current user'}`;
      authHint.textContent = 'Captures go straight to the same dashboard account.';
      sessionMeta.textContent = expiresLabel
        ? `Session refreshes automatically. Current access token expires around ${expiresLabel}.`
        : 'Session refreshes automatically while your refresh token stays valid.';
      statusTitle.textContent = 'Ready to capture';
      statusText.textContent = 'Autofill this page or type details manually, then save.';
      return;
    }

    sessionBtn.dataset.state = 'signin';
    sessionLabel.textContent = 'Sign in';
    sessionBtn.title = 'Open settings';
    setElementVisible(authForm, true);
    setElementVisible(signOutBtn, false);
    setElementVisible(statusActionBtn, true);
    statusActionBtn.textContent = 'Sign In';
    authStatus.textContent = 'Sign in to start capturing.';
    authHint.textContent = 'Use the same email and password as the dashboard.';
    sessionMeta.textContent = 'You should only need to sign in again if the refresh token is revoked or the app origin changes.';
    statusTitle.textContent = 'Sign in required';
    statusText.textContent = 'Open Settings, sign in once, and the popup will stay focused on capture after that.';
  }

  async function readJson(response) {
    try {
      return await response.json();
    } catch {
      return {};
    }
  }

  async function getExtensionConfig() {
    const apiBaseUrl = await resolveApiBaseUrl();

    if (!apiBaseUrl) {
      throw new Error('Save API Base URL first in Settings.');
    }

    let response;
    try {
      response = await fetch(`${apiBaseUrl}/api/extension/config`, {
        cache: 'no-store'
      });
    } catch {
      throw new Error(`Could not reach ${apiBaseUrl}. Check API Base URL and confirm the app is running.`);
    }

    const body = await readJson(response);

    if (!response.ok) {
      throw new Error(body.details || body.error || 'Unable to load extension config.');
    }

    return {
      apiBaseUrl,
      appBaseUrl: normalizeBaseUrl(body.appBaseUrl || apiBaseUrl),
      supabaseUrl: normalizeBaseUrl(body.supabaseUrl),
      supabaseAnonKey: normalizeText(body.supabaseAnonKey)
    };
  }

  async function refreshSession(session) {
    const config = await getExtensionConfig();
    let response;
    try {
      response = await fetch(`${config.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: config.supabaseAnonKey
        },
        body: JSON.stringify({
          refresh_token: session.refreshToken
        })
      });
    } catch {
      throw new Error('Network error while refreshing session.');
    }
    const body = await readJson(response);

    if (!response.ok) {
      throw new Error(body.msg || body.error_description || body.error || 'Session refresh failed.');
    }

    return saveSession(body);
  }

  async function getValidSession() {
    const session = await getStoredSession();
    if (!session) {
      updateAuthUi(null);
      return null;
    }

    if (!isSessionExpired(session)) {
      updateAuthUi(session);
      return session;
    }

    try {
      const refreshed = await refreshSession(session);
      updateAuthUi(refreshed);
      return refreshed;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Session refresh failed.';
      const isRevokedSession =
        /invalid|expired|revoked|refresh token|jwt/i.test(message);

      if (isRevokedSession) {
        await clearSession();
        updateAuthUi(null);
        setAuthMessage('Session expired. Sign in again.', true);
        return null;
      }

      updateAuthUi(session);
      setAuthMessage('Could not refresh the session right now. Try again in a moment.', true);
      return null;
    }
  }

  async function initializeSession() {
    setAuthMessage('');
    updateAuthUi(await getStoredSession());
    await getValidSession();
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

  async function signIn(event) {
    event.preventDefault();
    setError('');
    setAuthMessage('');

    const email = normalizeText(authEmailInput.value);
    const password = authPasswordInput.value;

    if (!email || !password) {
      setAuthMessage('Email and password are required.', true);
      return;
    }

    signInBtn.disabled = true;

    try {
      const config = await getExtensionConfig();
      const response = await fetch(`${config.supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: config.supabaseAnonKey
        },
        body: JSON.stringify({
          email,
          password
        })
      });
      const body = await readJson(response);

      if (!response.ok) {
        throw new Error(body.msg || body.error_description || body.error || 'Sign-in failed.');
      }

      const session = await saveSession(body);
      authPasswordInput.value = '';
      updateAuthUi(session);
      setAuthMessage('Signed in.');
    } catch (error) {
      await clearSession();
      updateAuthUi(null);
      setAuthMessage(error instanceof Error ? error.message : 'Sign-in failed.', true);
    } finally {
      signInBtn.disabled = false;
    }
  }

  async function signOut() {
    await clearSession();
    authPasswordInput.value = '';
    updateAuthUi(null);
    setAuthMessage('Signed out.');
    openSettingsPanel();
    authEmailInput.focus();
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
    } catch {
      setError('Unable to read page.');
    }
  }

  async function submitApplication(e) {
    e.preventDefault();
    setError('');
    const session = await getValidSession();
    if (!session?.accessToken) {
      setError('Sign in to save applications.');
      return;
    }

    const { apiBaseUrl } = await getExtensionConfig();

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
          Authorization: `Bearer ${session.accessToken}`,
          'Content-Type': 'application/json',
          'x-idempotency-key': crypto.randomUUID()
        },
        body: JSON.stringify(payload)
      });
      const body = await readJson(res);
      if (res.status === 401 || res.status === 403) {
        await clearSession();
        updateAuthUi(null);
        setAuthMessage('Session expired. Sign in again.', true);
        throw new Error('Session expired. Sign in again.');
      }
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

  sessionBtn.addEventListener('click', () => {
    openSettingsPanel();
    if (!normalizeBaseUrl(apiBaseUrlInput.value)) {
      apiBaseUrlInput.focus();
      return;
    }
    if (signOutBtn.hidden) {
      authEmailInput.focus();
    }
  });
  statusActionBtn.addEventListener('click', () => {
    openSettingsPanel();
    if (!normalizeBaseUrl(apiBaseUrlInput.value)) {
      apiBaseUrlInput.focus();
      return;
    }
    authEmailInput.focus();
  });
  authForm.addEventListener('submit', signIn);
  signOutBtn.addEventListener('click', signOut);
  saveSettingsBtn.addEventListener('click', saveSettings);
  autofillBtn.addEventListener('click', autofillFromCurrentPage);
  formEl.addEventListener('submit', submitApplication);
  for (const input of [companyInput, jobTitleInput, statusInput, jobUrlInput]) {
    input.addEventListener('input', saveDraft);
    input.addEventListener('change', saveDraft);
  }

  async function initializePopup() {
    await loadTheme();
    await loadSettings();
    await loadDraft();
    await initializeSession();
  }

  initializePopup().catch((error) => {
    setAuthMessage(error instanceof Error ? error.message : 'Failed to initialize extension.', true);
  });
})();
