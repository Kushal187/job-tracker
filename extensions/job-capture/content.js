/* Job description extraction content script — ported from resume-tailor */

function cleanText(text) {
  return (text || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function elementText(selector) {
  const el = document.querySelector(selector);
  return el ? cleanText(el.innerText || el.textContent || '') : '';
}

const END_MARKERS = [
  'apply for this job',
  'submit application',
  'submit your application',
  'create a job alert',
  'voluntary self-identification',
  'equal employment opportunity',
  'form cc-305',
  'omb control number',
  'public burden statement',
  'privacy notice',
  'our privacy practices',
  'autofill with',
  'first name*',
  'resume/cv*',
  'attach\nattach',
  'accepted file types',
  'indicates a required field',
];

const CONTAINER_SELECTORS = [
  'main',
  'article',
  '[role="main"]',
  '#content',
  '#app_body',
  '.content-wrapper',
  '.posting',
  '[data-testid="job-posting"]',
  '[data-automation-id="jobPostingDescription"]',
  '.job-description',
  '.job-post',
  '.job-details',
  '#job-content',
];

function trimAfterEndMarker(text) {
  const lower = text.toLowerCase();
  let cutIdx = text.length;
  for (const marker of END_MARKERS) {
    const idx = lower.indexOf(marker);
    if (idx !== -1 && idx < cutIdx) {
      cutIdx = idx;
    }
  }
  return text.slice(0, cutIdx).trim();
}

function findMainContainer() {
  for (const sel of CONTAINER_SELECTORS) {
    const el = document.querySelector(sel);
    if (el) return el;
  }
  return document.body;
}

function findGreenhouseBoardTokens() {
  const tokens = new Set();

  const iframes = document.querySelectorAll('iframe[src]');
  for (const iframe of iframes) {
    const src = iframe.src || '';
    const boardMatch = src.match(/greenhouse\.io\/(\w+)/);
    if (boardMatch && boardMatch[1] !== 'embed') tokens.add(boardMatch[1]);
    const forMatch = src.match(/for=(\w+)/);
    if (forMatch && src.includes('greenhouse.io')) tokens.add(forMatch[1]);
  }

  const html = document.documentElement.innerHTML;
  const ghUrlPattern = /greenhouse\.io\/(?:embed\/job_board\?for=|embed\/job_app\?.*?for=)(\w+)/g;
  let m;
  while ((m = ghUrlPattern.exec(html)) !== null) tokens.add(m[1]);

  const boardPathPattern = /(?:boards|job-boards)\.greenhouse\.io\/(\w+)/g;
  while ((m = boardPathPattern.exec(html)) !== null) {
    if (m[1] !== 'embed') tokens.add(m[1]);
  }

  const scriptSrcs = document.querySelectorAll('script[src*="greenhouse"]');
  for (const script of scriptSrcs) {
    const sm = (script.src || '').match(/for=(\w+)/);
    if (sm) tokens.add(sm[1]);
  }

  return [...tokens];
}

function detectGreenhouseJobId() {
  const url = window.location.href;

  const directMatch = url.match(/(?:job-boards|boards)\.greenhouse\.io\/(\w+)\/jobs\/(\d+)/);
  if (directMatch) return { boards: [directMatch[1]], jobId: directMatch[2] };

  const ghParam = new URLSearchParams(window.location.search).get('gh_jid');
  const jobId = ghParam || url.match(/gh_jid=(\d+)/)?.[1];

  if (jobId) {
    const tokens = findGreenhouseBoardTokens();
    if (tokens.length > 0) return { boards: tokens, jobId };

    const host = window.location.hostname.replace(/^www\./, '');
    const boardGuess = host.split('.')[0].replace(/[^a-z0-9]/gi, '');
    if (boardGuess) return { boards: [boardGuess], jobId };
  }

  const iframes = document.querySelectorAll('iframe[src]');
  for (const iframe of iframes) {
    const src = iframe.src || '';
    const im = src.match(/greenhouse\.io\/(\w+)\/jobs\/(\d+)/);
    if (im) return { boards: [im[1]], jobId: im[2] };
    const embedMatch = src.match(/greenhouse\.io\/embed\/job_app\?.*?for=(\w+).*?token=(\d+)/);
    if (embedMatch) return { boards: [embedMatch[1]], jobId: embedMatch[2] };
  }

  return null;
}

function detectLeverCompanyAndId() {
  const url = window.location.href;
  const directMatch = url.match(/jobs\.lever\.co\/([^/]+)\/([0-9a-f-]{36})/);
  if (directMatch) return { company: directMatch[1], postingId: directMatch[2] };

  const iframes = document.querySelectorAll('iframe[src]');
  for (const iframe of iframes) {
    const src = iframe.src || '';
    const m = src.match(/jobs\.lever\.co\/([^/]+)\/([0-9a-f-]{36})/);
    if (m) return { company: m[1], postingId: m[2] };
  }

  return null;
}

function htmlToPlainText(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const body = doc.body;

  const blocks = new Set([
    'P','DIV','H1','H2','H3','H4','H5','H6',
    'LI','TR','BR','HR','BLOCKQUOTE','SECTION','ARTICLE','HEADER','FOOTER',
  ]);

  function walk(node) {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const parts = [];
    for (const child of node.childNodes) parts.push(walk(child));
    let inner = parts.join('');
    if (blocks.has(node.tagName)) inner = '\n' + inner + '\n';
    return inner;
  }

  let text = walk(body);
  text = text.replace(/<[^>]*>/g, ' ');
  return cleanText(text);
}

function bgFetch(url) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'FETCH_JSON', url }, (resp) => {
      if (chrome.runtime.lastError || !resp?.ok) resolve(null);
      else resolve(resp.data);
    });
  });
}

async function fetchGreenhouseJD(boards, jobId) {
  for (const board of boards) {
    const data = await bgFetch(
      `https://boards-api.greenhouse.io/v1/boards/${board}/jobs/${jobId}?content=true`
    );
    if (!data) continue;
    const parts = [data.title || ''];
    if (data.location?.name) parts.push(data.location.name);
    if (data.content) parts.push(htmlToPlainText(data.content));
    return { text: parts.join('\n\n'), title: data.title || '' };
  }
  return null;
}

async function fetchLeverJD(company, postingId) {
  const data = await bgFetch(
    `https://api.lever.co/v0/postings/${company}/${postingId}`
  );
  if (!data) return null;
  const parts = [data.text || ''];
  if (data.categories?.location) parts.push(data.categories.location);
  if (data.descriptionPlain) parts.push(data.descriptionPlain);
  if (data.lists) {
    for (const list of data.lists) {
      if (list.text) parts.push(list.text);
      if (list.content) parts.push(htmlToPlainText(list.content));
    }
  }
  if (data.additional) parts.push(htmlToPlainText(data.additional));
  return { text: parts.join('\n\n'), title: data.text || '' };
}

function tryIframeContent() {
  const iframes = document.querySelectorAll('iframe');
  for (const iframe of iframes) {
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) continue;
      const text = cleanText(doc.body?.innerText || '');
      if (text.length > 400) return text;
    } catch {
      // Cross-origin — can't access, skip
    }
  }
  return null;
}

async function captureJobPage() {
  const title = cleanText(document.title || '');
  const roleTitle =
    elementText('h1') ||
    elementText('[data-testid*="title"]') ||
    elementText('h2') ||
    title;

  const companyHint =
    elementText('[data-testid*="company"]') ||
    elementText('[class*="company"]') ||
    cleanText(
      document.querySelector('meta[property="og:site_name"]')?.getAttribute('content') ||
      ''
    );

  const mainContainer = findMainContainer();
  const rawText = cleanText(mainContainer?.innerText || '');

  const trimmed = trimAfterEndMarker(rawText);
  let jdText = trimmed.length >= 200 ? trimmed : rawText;

  const warnings = [];
  if (mainContainer === document.body) {
    warnings.push('Used document.body fallback — extraction may include extra content.');
  }

  if (jdText.length < 400) {
    const gh = detectGreenhouseJobId();
    if (gh) {
      try {
        const result = await fetchGreenhouseJD(gh.boards, gh.jobId);
        if (result && result.text.length > jdText.length) {
          jdText = result.text;
          warnings.push('Fetched JD from Greenhouse API (embedded iframe detected).');
        }
      } catch { /* API call failed, continue with what we have */ }
    }

    if (jdText.length < 400) {
      const lever = detectLeverCompanyAndId();
      if (lever) {
        try {
          const result = await fetchLeverJD(lever.company, lever.postingId);
          if (result && result.text.length > jdText.length) {
            jdText = result.text;
            warnings.push('Fetched JD from Lever API (embedded iframe detected).');
          }
        } catch { /* API call failed, continue with what we have */ }
      }
    }

    if (jdText.length < 400) {
      const iframeText = tryIframeContent();
      if (iframeText && iframeText.length > jdText.length) {
        const iframeTrimmed = trimAfterEndMarker(iframeText);
        jdText = iframeTrimmed.length >= 200 ? iframeTrimmed : iframeText;
        warnings.push('Extracted JD from same-origin iframe.');
      }
    }
  }

  if (jdText.length < 400) {
    warnings.push('Low-confidence extraction: detected less than 400 characters.');
  }

  return {
    jd_text: jdText,
    jd_url: window.location.href,
    page_title: title,
    role_title: roleTitle,
    company_hint: companyHint,
    extracted_at: new Date().toISOString(),
    warnings,
  };
}

/* Autofill field extraction — company / job title / url.
 * Ported verbatim from the inline scraper that popup.js used to hand to
 * chrome.scripting.executeScript, so both the toolbar popup (via the
 * EXTRACT_FIELDS message) and the in-page panel (via the widget bridge) share
 * one source of truth. Runs in the content-script isolated world: full DOM
 * access, no page JS — identical to the old executeScript behavior. */
function extractApplicationFields() {
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
    // innerText first: textContent concatenates block children with no
    // separator, which glues distinct lines together ("Amazon10001+ employees").
    // It's '' for hidden/detached nodes and undefined for <meta>, so the
    // textContent/attribute chain below still covers those.
    return cleanText(
      node.innerText ||
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
    /^privacy$/i,
    /^(apply|application|login|register|dashboard|profile)$/i,
    /^(404|error|not found|page not found)$/i,
    /^(loading|please wait|redirecting)$/i,
    /^\d+\s*(results?|jobs?|openings?)$/i,
    /^(next|previous|back|page \d+)$/i,
    /^use ai to/i,
    /^(show match|tailor my|create.*(cover|resume)|help me|people you|reach out)/i,
    /^(premium|messaging|notifications|my network)$/i,
    // LinkedIn / job-board feed headings, not the posting itself
    /^jobs? (based on|for you|you (may|might) be interested in|picked for you)/i,
    /^(more|similar|recommended|recent|saved|suggested) jobs?\b/i,
    /^people also viewed$/i,
    /^\d+\+?\s*results?\b/i,
    /\bjobs? in\b.*\b(united states|remote)\b/i
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
    /^search jobs?$/i,
    /^(apply now|view (all )?jobs|see more|learn more|follow)$/i,
    /^(menu|navigation|header|footer|sidebar)$/i,
    // Workday's logo carries alt=" careers home" — a nav label, not an employer
    /^careers?\s+home$/i,
    /^(logo|banner|image|icon)$/i,
    /^skip to\b/i,
    /^\d+$/
  ];
  const looksBadTitle = (value) => {
    const text = cleanText(value);
    return !text || BAD_TITLE_PATTERNS.some((pattern) => pattern.test(text));
  };
  const cleanCompanyName = (value) => {
    let text = cleanText(value);
    text = text.replace(/\s*[-–—|]\s*(careers?|jobs?|hiring|openings?|open roles|open positions)\s*$/i, '');
    text = text.replace(/\b(careers?|jobs?)\s*$/i, '');
    text = text.replace(/\s*(logo|icon|image|banner)s?\s*$/i, '');
    text = text.replace(/^(job|position|role|opening)\s+(at|@)\s+/i, '');
    // "CAREERS AT NVIDIA" (Workday's header title), "Life at Stripe", etc.
    text = text.replace(/^(careers?|jobs?|work|life|working)\s+(at|@|with)\s+/i, '');
    text = text.replace(/\s*[-–—]\s*[A-Z][a-zA-Z\s]+,\s*[A-Z]{2}\s*$/, '');
    text = text.replace(/\s+[|:–—-]\s*$/, '');
    text = text.replace(/^["']+|["']+$/g, '');
    return text.replace(/\s+/g, ' ').trim();
  };
  const looksBadCompany = (value) => {
    const text = cleanCompanyName(value);
    return (
      !text ||
      BAD_COMPANY_PATTERNS.some((pattern) => pattern.test(text)) ||
      /^https?:\/\//i.test(text) ||
      // A company *card* rather than a company name — social proof counts mean we
      // scraped a hover card or sidebar module, not the posting's employer.
      /\b\d[\d,]*\+?\s*(employees|followers|connections|alumni|employee)\b/i.test(text) ||
      /\b(connections?|alumni|school alumni) work here\b/i.test(text) ||
      text.length > 80
    );
  };
  const pickNode = (root, selectors) => {
    if (!root) return null;
    for (const selector of selectors) {
      const node = root.querySelector(selector);
      if (node) return node;
    }
    return null;
  };
  const pickWithin = (root, selectors, isInvalid) => {
    if (!root) return '';
    for (const selector of selectors) {
      const node = root.querySelector(selector);
      const value = readNodeValue(node);
      if (value && !isInvalid(value)) return value;
    }
    return '';
  };
  const pickFirst = (selectors, isInvalid) => pickWithin(document, selectors, isInvalid);
  const splitCandidates = (value) =>
    cleanText(value)
      .split(/\s+[|•:-]\s+|\s+@\s+|\s+at\s+/i)
      .map(cleanText)
      .filter(Boolean);
  // <script> content is raw text, so entities inside ld+json are never decoded
  // by the parser — Workday and others emit "Assurance &amp; Governance", which
  // would otherwise be saved verbatim. A textarea decodes without parsing tags.
  const decodeEntities = (value) => {
    if (!value || !/&(#\d+|#x[0-9a-fA-F]+|[a-zA-Z]+);/.test(value)) return value;
    const holder = document.createElement('textarea');
    holder.innerHTML = value;
    return holder.value;
  };
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
        const jobTitle = cleanText(decodeEntities(current.title || current.name || current.jobTitle));
        const org = current.hiringOrganization || current.organization || current.employer;
        const company = cleanText(
          decodeEntities(typeof org === 'string' ? org : org?.name || org?.legalName || '')
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
  let jobUrl = location.href;

  if (host.includes('linkedin.com')) {
    // /jobs/search and /jobs/collections are two-pane: the results list, the
    // "promoted"/sidebar modules and the open posting all live in one document.
    // An unscoped querySelector therefore hits whichever job card or company
    // hover-card comes first in DOM order, not the one the user is reading — so
    // resolve the open posting's pane first and scope every lookup to it.
    const currentJobId =
      new URLSearchParams(location.search).get('currentJobId') ||
      location.pathname.match(/\/jobs\/view\/(\d+)/)?.[1] ||
      '';

    const detailPane =
      document.querySelector('.jobs-search__job-details--container') ||
      document.querySelector('.jobs-search__job-details') ||
      document.querySelector('.jobs-details__main-content') ||
      document.querySelector('.jobs-details') ||
      document.querySelector('.job-view-layout') ||
      document.querySelector('[class*="jobs-search__job-details"]');

    const twoPane = Boolean(detailPane) && !/\/jobs\/view\//.test(location.pathname);

    const topCard =
      pickNode(detailPane, [
        '.job-details-jobs-unified-top-card__container--two-pane',
        '[class*="jobs-unified-top-card"]',
        '[class*="top-card-layout"]'
      ]) || detailPane;

    const scope = topCard || detailPane;

    const paneTitle = pickWithin(
      scope,
      [
        '.job-details-jobs-unified-top-card__job-title h1',
        '.job-details-jobs-unified-top-card__job-title',
        '.jobs-unified-top-card__job-title',
        '.top-card-layout__title',
        'h1.t-24',
        'h1'
      ],
      looksBadTitle
    );
    const paneCompany = pickWithin(
      scope,
      [
        '.job-details-jobs-unified-top-card__company-name a',
        '.job-details-jobs-unified-top-card__company-name',
        '.jobs-unified-top-card__company-name',
        '.topcard__org-name-link',
        '[data-tracking-control-name="public_jobs_topcard-org-name"]',
        '.artdeco-entity-lockup__subtitle',
        'a[href*="/company/"]'
      ],
      looksBadCompany
    );

    // On a two-pane page the pane is authoritative: any JSON-LD in the document
    // describes the search results, not the posting that's currently open.
    if (twoPane) {
      jobTitle = paneTitle || jobTitle;
      company = cleanCompanyName(paneCompany) || company;
    } else {
      jobTitle = jobTitle || paneTitle;
      company = company || cleanCompanyName(paneCompany);
    }

    // The Save/Apply control is labelled "Save <title> at <company>" and lives
    // inside the pane — a reliable backstop when LinkedIn reshuffles class names.
    if (!jobTitle || !company) {
      const fromActionLabel = (() => {
        const nodes = (scope || document).querySelectorAll('[aria-label]');
        for (const node of nodes) {
          const label = cleanText(node.getAttribute('aria-label'));
          const match = label.match(
            /^(?:save|unsave|apply to|easy apply to)\s+(.+?)\s+at\s+(.+?)\.?$/i
          );
          if (match) return { title: cleanText(match[1]), company: cleanText(match[2]) };
        }
        return null;
      })();
      if (fromActionLabel) {
        if (!jobTitle && !looksBadTitle(fromActionLabel.title)) jobTitle = fromActionLabel.title;
        if (!company && !looksBadCompany(fromActionLabel.company)) {
          company = cleanCompanyName(fromActionLabel.company);
        }
      }
    }

    // Standalone posting pages title as "Job Title | Company Name | LinkedIn".
    // Search pages title as the *query*, so only trust this off the two-pane view.
    if (!twoPane) {
      const liParts = (metaTitle || pageTitle).split(/\s*\|\s*/);
      if (liParts.length >= 3 && liParts[liParts.length - 1].trim().toLowerCase() === 'linkedin') {
        jobTitle = jobTitle || cleanText(liParts[0]);
        company = company || cleanCompanyName(liParts[1]);
      }
    }

    // Record the posting's own permalink rather than the disposable search URL,
    // which carries the query/filters and stops pointing at this job.
    if (currentJobId) jobUrl = `https://www.linkedin.com/jobs/view/${currentJobId}/`;
  }

  if (host.includes('indeed.com')) {
    company =
      company ||
      pickFirst(
        [
          '[data-testid="inlineHeader-companyName"] a',
          '[data-testid="inlineHeader-companyName"]',
          '[data-company-name]',
          '.jobsearch-InlineCompanyRating a',
          '.jobsearch-InlineCompanyRating div'
        ],
        looksBadCompany
      );
    jobTitle =
      jobTitle ||
      pickFirst(
        [
          '[data-testid="jobsearch-JobInfoHeader-title"]',
          '.jobsearch-JobInfoHeader-title',
          'h1.icl-u-xs-mb--xs',
          'h1'
        ],
        looksBadTitle
      );
  }

  if (host.includes('greenhouse.io')) {
    const ghLogoAlt = (() => {
      const img = document.querySelector('#header img[alt], .logo img[alt], header img[alt]');
      if (!img) return '';
      return cleanText(img.getAttribute('alt') || '')
        .replace(/\s*(logo|icon|image|banner)s?\s*$/i, '')
        .trim();
    })();
    const ghUrlCompany = (() => {
      try {
        const { hostname, pathname } = new URL(location.href);
        // boards.greenhouse.io/{company}/jobs/...
        if (hostname === 'boards.greenhouse.io') {
          const match = pathname.match(/^\/([^/]+)/);
          if (match) return match[1].replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        }
        // {company}.greenhouse.io/...
        const sub = hostname.replace(/\.greenhouse\.io$/, '');
        if (sub && sub !== 'boards' && sub !== 'www') {
          return sub.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        }
      } catch {}
      return '';
    })();
    company =
      company ||
      pickFirst(['#header .company-name', '.company-name'], looksBadCompany) ||
      (ghLogoAlt && !looksBadCompany(ghLogoAlt) ? ghLogoAlt : '') ||
      (ghUrlCompany && !looksBadCompany(ghUrlCompany) ? ghUrlCompany : '') ||
      cleanCompanyName(siteName);
    jobTitle =
      jobTitle || pickFirst(['#content h1', '.app-title'], looksBadTitle);
  }

  if (host.includes('lever.co')) {
    const leverUrlCompany = (() => {
      try {
        const match = new URL(location.href).pathname.match(/^\/([^/]+)/);
        if (match) return match[1].replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      } catch {}
      return '';
    })();
    company =
      company ||
      pickFirst(['.main-header-logo img', '.main-header-logo'], looksBadCompany) ||
      (leverUrlCompany && !looksBadCompany(leverUrlCompany) ? leverUrlCompany : '') ||
      cleanCompanyName(siteName);
    jobTitle =
      jobTitle ||
      pickFirst(['.posting-headline h2', '.posting-headline h1'], looksBadTitle);
  }

  const isIcims = host.includes('icims.com');

  // Strips the careers/jobs boilerplate that wraps a tenant slug so only the
  // brand token is left: "careers-amd" -> "amd", "amd-careers" -> "amd".
  const stripCareersAffixes = (slug) =>
    slug
      .replace(/^(careers?|jobs?|work|talent|apply|recruit(ing|ment)?)[-_.]+/i, '')
      .replace(/[-_.]+(careers?|jobs?|work|talent|apply|recruit(ing|ment)?)$/i, '')
      .trim();

  /* Brand-name helpers, shared by the Workday and iCIMS branches below.
   * Career-site hosts encode the employer as a URL slug and rarely expose it
   * as text, so these turn a slug into the brand as the company writes it. */
  const titleize = (slug) =>
    slug
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      // Leave existing capitalisation alone (IBM, NVIDIA); only fix all-lower.
      .replace(/\b[a-z]+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1));

  const normalizeBrand = (value) =>
    value.replace(/['’]s\b/gi, '').replace(/[^a-z0-9]/gi, '').toLowerCase();

  const wordmarkFor = (slug) => {
    const target = normalizeBrand(slug);
    if (target.length < 3) return '';
    // The brand shows up in the posting prose ("At AMD, our mission…") or in the
    // site header, even when no element is tagged with it. Each source is read
    // and separated individually: concatenating raw textContent would run
    // adjacent elements together ("AMDCareers") and hide the wordmark.
    const parts = [meta('og:description', 'description'), cleanText(document.title)];
    const marks = document.querySelectorAll(
      'h1, h2, header img[alt], [class*="logo" i] img[alt], [class*="logo" i], a[href="/"], [data-automation-id="jobPostingDescription"]'
    );
    for (const node of Array.from(marks).slice(0, 60)) parts.push(readNodeValue(node));
    const body = document.body;
    parts.push(cleanText(body?.innerText || ''));
    const haystack = parts.filter(Boolean).join(' \n ').slice(0, 30000);
    const phrases = /[A-Z][\w&.'’-]*(?:[  ][A-Z][\w&.'’-]*){0,3}/g;
    let match;
    while ((match = phrases.exec(haystack)) !== null) {
      const words = match[0].trim().split(/[\s ]+/);
      // Longest-first: "State Street Alpha" should still yield "State Street".
      for (let size = words.length; size >= 1; size -= 1) {
        const candidate = words.slice(0, size).join(' ');
        if (normalizeBrand(candidate) === target) {
          // The phrase may have swept up sentence punctuation ("State Street.").
          return candidate.replace(/['’]s$/i, '').replace(/[.,;:!?]+$/, '');
        }
      }
    }
    return '';
  };

  if (isIcims) {
    // iCIMS portals expose neither ld+json nor a company element, and the only
    // <h1> is the site wordmark ("AMD Careers") — which the generic fallback
    // would otherwise take as the job title. Everything usable is in <title>,
    // formatted "{Job Title} in {City, State} | Careers at {site name}".
    const icimsTitleParts = cleanText(document.title).split(/\s*\|\s*/);
    const icimsLead = icimsTitleParts[0] || '';

    if (!jobTitle) {
      // Drop a trailing " in <location>" only when the tail really looks like a
      // place — a comma ("in Santa Clara, California") or a region code
      // ("in US-CA-Santa Clara") — so "Engineer in Test" survives intact.
      const withoutLocation = icimsLead.replace(
        /\s+in\s+[A-Z][^|]*?(?:,\s*[A-Z][^|]*|(?:-[A-Za-z][^|]*){1,})$/,
        ''
      );
      const candidate = cleanText(withoutLocation) || icimsLead;
      if (candidate && !looksBadTitle(candidate)) jobTitle = candidate;
    }

    if (!company) {
      // "Careers at <site name>" is unreliable — AMD's instance has the location
      // code wired into that token ("Careers at US,CA,Santa Clara"). The
      // subdomain is the dependable signal: careers-amd.icims.com -> amd -> AMD.
      const slug = stripCareersAffixes(location.hostname.split('.')[0] || '');
      const fromSlug = slug ? wordmarkFor(slug) || titleize(slug) : '';
      if (fromSlug && !looksBadCompany(fromSlug)) company = cleanCompanyName(fromSlug);
    }
  }

  // Tenants routinely front Workday on their own domain (careers.example.com),
  // so match on Workday's markup as well as the hostname.
  const isWorkday =
    host.includes('myworkdayjobs.com') ||
    host.includes('workday.com') ||
    Boolean(document.querySelector('[data-automation-id="jobPostingPage"], [data-automation-id="jobPostingHeader"]'));

  if (isWorkday) {
    // Workday's ld+json hiringOrganization is the *supervisory org* — a payroll
    // entity like "2100 NVIDIA USA" or "0001 Chevron Corp", not the employer
    // brand — so it must not win here. og:site_name is absent and the logo's alt
    // is the nav label " careers home", leaving three usable sources, best first.
    // 1. Header title — "CAREERS AT NVIDIA"; cleanCompanyName drops the prefix.
    const wdHeaderTitle = cleanCompanyName(
      pickFirst(['[data-automation-id="headerTitle"]', '[data-automation-id="logoLink"]'], () => false)
    );

    // 2. The tenant subdomain. Always present on *.myworkdayjobs.com and always
    //    the brand — but flattened to one lowercase token ("statestreet"). Recover
    //    the real wordmark by scanning the posting for a capitalised phrase whose
    //    letters match the slug *exactly*: "State Street" for statestreet, "NVIDIA"
    //    for nvidia. Exact comparison only, so this can never invent a name.
    const wdTenant = (() => {
      const sub = location.hostname.split('.')[0];
      if (!sub || sub === 'www' || /^wd\d+$/i.test(sub)) return '';
      return sub;
    })();
    const wdBrand = wdTenant ? wordmarkFor(wdTenant) || titleize(wdTenant) : '';

    // 3. The career-site id in the logo's src (/NVIDIAExternalCareerSite/assets/logo)
    //    or in the URL path, minus its boilerplate suffix. Only useful on custom
    //    domains — plenty of tenants name the site something generic.
    const GENERIC_SITE_SLUGS =
      /^(global|jobs?|careers?|external|search|home|main|corporate|campus|professional|experienced|students?|university|all|default|primary|site|us|usa|emea|apac)$/i;
    const wdSiteCompany = (() => {
      const logo = document.querySelector('[data-automation-id="logo"], img[src*="/assets/logo"]');
      const src = logo?.getAttribute('src') || '';
      const fromLogo = src.match(/\/([^/]+)\/assets\/logo/)?.[1] || '';
      const fromPath = location.pathname.match(/^\/(?:[a-z]{2}-[A-Z]{2}\/)?([^/]+)/)?.[1] || '';
      const slug = fromLogo || fromPath;
      if (!slug) return '';
      const trimmed = slug.replace(
        /[-_ ]*(external)?[-_ ]*(career|job)s?[-_ ]*(site|page|portal)?[-_ ]*$/i,
        ''
      );
      // Generic site ids ("External_Career_Site", "Global", "jobs") carry no
      // brand — yield to the next source rather than handing back boilerplate.
      if (!trimmed || GENERIC_SITE_SLUGS.test(trimmed)) return '';
      return titleize(trimmed);
    })();

    // Last resort, for Workday on a custom domain where there's no tenant slug:
    // salvage the brand from the supervisory-org string by dropping its leading
    // cost-centre code and trailing region token. Ranked below the tenant because
    // the entity is often a subsidiary ("9487 Noble Energy EG Ltd." for Chevron).
    const wdLegalName = (() => {
      let text = cleanText(fromStructuredData.company);
      if (!text) return '';
      text = text.replace(/^[A-Z]{0,3}[-_ ]?\d{2,6}[\s:.-]+/i, '');
      text = text.replace(/[\s,]+(usa|u\.s\.a?\.?|uk|emea|apac|latam|global|int'?l|international)\.?$/i, '');
      return cleanCompanyName(text);
    })();

    const wdCandidates = [wdHeaderTitle, wdBrand, wdSiteCompany, wdLegalName, cleanCompanyName(siteName)];
    // Overrides rather than defers to `company`: on Workday the structured-data
    // value it already holds is the payroll entity, which is the thing we're fixing.
    company = wdCandidates.find((value) => value && !looksBadCompany(value)) || company;

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

  const ROLE_KEYWORDS = /\b(engineer|developer|manager|analyst|designer|scientist|director|intern|associate|consultant|coordinator|specialist|lead|head|vp|chief|officer|architect|devops|sre|qa|frontend|backend|fullstack|full.stack|software|data|product|program|project|marketing|sales|recruiter|accountant|researcher|technician|administrator|executive|advisor|strategist|writer|editor)\b/i;
  const looksLikeJobTitle = (text) => ROLE_KEYWORDS.test(text);

  const titleParts = splitCandidates(metaTitle || pageTitle);
  if (!jobTitle) {
    const rolePart = titleParts.find((p) => looksLikeJobTitle(p) && !looksBadTitle(p));
    jobTitle = rolePart || (titleParts[0] && !looksBadTitle(titleParts[0]) ? titleParts[0] : '');
  }
  if (!company) {
    company =
      cleanCompanyName(
        titleParts.find(
          (part) =>
            cleanText(part).toLowerCase() !== cleanText(jobTitle).toLowerCase() &&
            !looksLikeJobTitle(part) &&
            !looksBadCompany(part)
        ) || ''
      ) ||
      cleanCompanyName(
        titleParts.find(
          (part) =>
            cleanText(part).toLowerCase() !== cleanText(jobTitle).toLowerCase() &&
            !looksBadCompany(part)
        ) || ''
      ) ||
      cleanCompanyName(siteName);
  }

  return {
    company: cleanCompanyName(company),
    jobTitle: cleanText(jobTitle),
    jobUrl
  };
}

/* Lightweight "is this a job posting?" signal used by the widget's career-site
 * detection. Scans JSON-LD for an @type of JobPosting without doing the full
 * field extraction above. */
function hasJobPostingLd() {
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
    if (types.some((item) => String(item).toLowerCase() === 'jobposting')) return true;
    Object.values(current).forEach(push);
  }
  return false;
}

/* Shared surface for sibling content scripts (widget.js) running in the same
 * isolated world, and the reference used by the popup's page-access bridge. */
self.ApplyrCapture = {
  captureJobPage,
  extractApplicationFields,
  hasJobPostingLd,
  detectGreenhouseJobId,
  detectLeverCompanyAndId
};

/* Guard against double-registration when popup.js re-injects content.js
 * on-demand (chrome.scripting.executeScript) on a page where it already ran. */
if (!self.__applyrCaptureListener) {
  self.__applyrCaptureListener = true;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message) return;

    if (message.type === 'PING') {
      sendResponse(true);
      return false;
    }

    if (message.type === 'EXTRACT_FIELDS') {
      try {
        sendResponse({ ok: true, fields: extractApplicationFields() });
      } catch (error) {
        sendResponse({ ok: false, error: String(error) });
      }
      return false;
    }

    if (message.type !== 'CAPTURE_JD') return;

    captureJobPage()
      .then((payload) => sendResponse({ ok: true, payload }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));

    return true;
  });
}
