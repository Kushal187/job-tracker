(function () {
  const PROD_API_BASE_URL = 'https://useapplyr.vercel.app';
  const manifest = chrome.runtime.getManifest();
  const isStoreBuild = Boolean(manifest.update_url);

  // ── Page-access bridge ──────────────────────────────────────────────────────
  // The capture UI needs three things from the page it's capturing: basic info
  // (url/title), autofill fields, and the job description. In the toolbar popup
  // these come from chrome.tabs/chrome.scripting against the active tab. When the
  // SAME UI runs embedded inside the in-page floating widget (an iframe on the
  // page), there is no "active tab" to target — instead we postMessage the parent
  // content script, which owns the page DOM. EMBEDDED selects the implementation.
  // Both routes ultimately run the shared scrapers in content.js.
  const EMBEDDED =
    window.parent !== window ||
    new URLSearchParams(location.search).has('embedded');

  function sendTab(tabId, message) {
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) resolve(null);
        else resolve(response);
      });
    });
  }

  // Ping the content script; inject it on-demand if the page loaded before the
  // extension (mirrors the pattern captureJD already used), then send.
  async function messageActiveTab(message) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('Unable to read active tab.');
    const ping = await sendTab(tab.id, { type: 'PING' });
    if (!ping) {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    }
    return sendTab(tab.id, message);
  }

  const popupBridge = {
    async getPageInfo() {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      return { url: tab?.url || '', title: tab?.title || '' };
    },
    async extractFields() {
      const resp = await messageActiveTab({ type: 'EXTRACT_FIELDS' });
      if (!resp?.ok) throw new Error(resp?.error || 'Could not read the page.');
      return resp.fields;
    },
    async captureJd() {
      const resp = await messageActiveTab({ type: 'CAPTURE_JD' });
      if (!resp?.ok) throw new Error(resp?.error || 'Failed to capture JD from page');
      return resp.payload;
    }
  };

  function makeEmbeddedBridge() {
    let seq = 0;
    const pending = new Map();
    window.addEventListener('message', (event) => {
      if (event.source !== window.parent) return;
      const d = event.data;
      if (!d || d.source !== 'applyr-content' || d.type !== 'RESPONSE') return;
      const entry = pending.get(d.id);
      if (!entry) return;
      pending.delete(d.id);
      if (d.ok) entry.resolve(d.data);
      else entry.reject(new Error(d.error || 'Page bridge error'));
    });
    function request(action) {
      const id = ++seq;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        window.parent.postMessage({ source: 'applyr-panel', type: 'REQUEST', id, action }, '*');
        setTimeout(() => {
          if (pending.has(id)) {
            pending.delete(id);
            reject(new Error('The page did not respond.'));
          }
        }, 15000);
      });
    }
    return {
      getPageInfo: () => request('PAGE_INFO'),
      extractFields: () => request('EXTRACT_FIELDS'),
      captureJd: () => request('CAPTURE_JD')
    };
  }

  const pageBridge = EMBEDDED ? makeEmbeddedBridge() : popupBridge;

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
  const collapseBtn = document.getElementById('collapseBtn');
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
      supabaseAnonKey: normalizeText(body.supabaseAnonKey),
      resumeApiUrl: normalizeBaseUrl(body.resumeApiUrl || '')
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
    try {
      const extracted = await pageBridge.extractFields();
      if (!extracted) {
        setError('No data extracted. Fill manually.');
        return;
      }
      companyInput.value = normalizeText(extracted.company);
      jobTitleInput.value = normalizeText(extracted.jobTitle);
      jobUrlInput.value = normalizeText(extracted.jobUrl);
      await saveDraft();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to read page.');
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
      companyInput.value = '';
      jobTitleInput.value = '';
      jobUrlInput.value = '';
      statusInput.value = 'Applied';
      setTimeout(() => {
        submitBtn.classList.remove('is-success');
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      submitBtn.disabled = false;
    }
  }

  // ── Resume Tailor ──────────────────────────────────────────────────────

  const captureJdBtn = document.getElementById('captureJdBtn');
  const jdTextarea = document.getElementById('jdTextarea');
  const generateBtn = document.getElementById('generateBtn');
  const generateLabel = document.getElementById('generateLabel');
  const downloadPdfBtn = document.getElementById('downloadPdfBtn');
  const tailorMsg = document.getElementById('tailorMsg');

  let lastGenerationResult = null;
  let cachedProfileId = null;

  // Enable generate button when user edits/pastes JD text
  jdTextarea.addEventListener('input', () => {
    generateBtn.disabled = !jdTextarea.value.trim();
  });

  function setTailorMsg(msg, state = '') {
    tailorMsg.textContent = msg || '';
    tailorMsg.dataset.state = msg ? state : '';
  }

  async function captureJD() {
    captureJdBtn.disabled = true;
    setTailorMsg('Capturing job description...', '');
    try {
      const payload = await pageBridge.captureJd();

      jdTextarea.value = payload?.jd_text || '';
      generateBtn.disabled = !jdTextarea.value.trim();

      if (payload?.warnings?.length) {
        setTailorMsg(payload.warnings[0], '');
      } else {
        setTailorMsg(`Captured ${jdTextarea.value.length} chars`, 'success');
      }
    } catch (err) {
      setTailorMsg(err.message || 'Capture failed', 'error');
    } finally {
      captureJdBtn.disabled = false;
    }
  }

  async function generateResume() {
    const session = await getValidSession();
    if (!session) {
      setTailorMsg('Sign in first to generate resumes.', 'error');
      return;
    }

    const jdText = jdTextarea.value.trim();
    if (!jdText || jdText.length < 20) {
      setTailorMsg('Capture a job description first (min 20 chars).', 'error');
      return;
    }

    generateBtn.disabled = true;
    downloadPdfBtn.style.display = 'none';
    generateLabel.textContent = 'Generating...';
    setTailorMsg('Sending to AI pipeline (this may take 20-30s)...', '');

    try {
      const config = await getExtensionConfig();
      const resumeApiUrl = config.resumeApiUrl;
      if (!resumeApiUrl) {
        throw new Error('Resume API URL not configured. Check your app settings.');
      }

      // Auto-fetch profile ID if not cached
      if (!cachedProfileId) {
        const profileRes = await fetch(`${resumeApiUrl}/api/profile`, {
          headers: { Authorization: `Bearer ${session.accessToken}` }
        });
        if (profileRes.status === 404) {
          throw new Error('No resume profile found. Create one in the Applyr dashboard under Resume Profile.');
        }
        if (!profileRes.ok) throw new Error('Failed to fetch profile');
        const profileBody = await profileRes.json();
        cachedProfileId = profileBody.profile.id;
        await chrome.storage.local.set({ resumeProfileId: cachedProfileId });
      }

      const pageInfo = await pageBridge.getPageInfo().catch(() => ({ url: '', title: '' }));

      const res = await fetch(`${resumeApiUrl}/api/resume/generate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jd_text: jdText,
          jd_url: pageInfo.url || '',
          page_title: pageInfo.title || '',
          profile_id: cachedProfileId,
          strictness: 'balanced',
          return_pdf_base64: true
        })
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Generation failed (${res.status})`);
      }

      const body = await res.json();
      lastGenerationResult = body.result;

      const coverage = Math.round((lastGenerationResult.keyword_coverage || 0) * 100);
      const warnings = lastGenerationResult.warnings || [];
      let msg = `Done! Keyword coverage: ${coverage}%`;
      if (warnings.length) msg += ` | ${warnings.length} warning(s)`;
      msg += ` | ${lastGenerationResult.duration_ms}ms`;
      setTailorMsg(msg, 'success');

      if (lastGenerationResult.pdf_base64) {
        downloadPdfBtn.style.display = 'block';
      }
    } catch (err) {
      setTailorMsg(err.message || 'Generation failed', 'error');
    } finally {
      generateBtn.disabled = !jdTextarea.value.trim();
      generateLabel.textContent = 'Generate Tailored Resume';
    }
  }

  function downloadPdf() {
    if (!lastGenerationResult?.pdf_base64) return;
    const byteChars = atob(lastGenerationResult.pdf_base64);
    const byteArray = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteArray[i] = byteChars.charCodeAt(i);
    }
    const blob = new Blob([byteArray], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    chrome.downloads.download({
      url,
      filename: lastGenerationResult.filename || 'tailored-resume.pdf',
      saveAs: true
    });
  }

  // Load cached profile ID
  chrome.storage.local.get('resumeProfileId', (data) => {
    if (data.resumeProfileId) cachedProfileId = data.resumeProfileId;
  });

  captureJdBtn.addEventListener('click', captureJD);
  generateBtn.addEventListener('click', generateResume);
  downloadPdfBtn.addEventListener('click', downloadPdf);

  // ── Event Listeners ──────────────────────────────────────────────────────

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

  // When the UI is embedded in the in-page floating widget, reveal the collapse
  // control, let it fill the iframe, and tell the parent content script we're
  // ready. Popup mode leaves all of this untouched.
  function setupEmbeddedMode() {
    if (!EMBEDDED) return;
    document.documentElement.classList.add('embedded');
    document.body.classList.add('embedded');

    if (collapseBtn) {
      setElementVisible(collapseBtn, true);
      collapseBtn.addEventListener('click', () => {
        window.parent.postMessage({ source: 'applyr-panel', type: 'COLLAPSE' }, '*');
      });
    }

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        window.parent.postMessage({ source: 'applyr-panel', type: 'COLLAPSE' }, '*');
      }
    });

    window.parent.postMessage({ source: 'applyr-panel', type: 'READY' }, '*');
  }

  async function initializePopup() {
    setupEmbeddedMode();
    await loadTheme();
    await loadSettings();
    await loadDraft();
    await initializeSession();
  }

  initializePopup().catch((error) => {
    setAuthMessage(error instanceof Error ? error.message : 'Failed to initialize extension.', true);
  });
})();
