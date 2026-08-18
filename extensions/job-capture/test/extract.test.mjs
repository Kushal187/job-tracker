/* Regression tests for extractApplicationFields().
 *
 * Fixtures under test/fixtures/ are REAL pages captured from the live sites
 * (scripts and styles stripped, ld+json kept). Cases built from inline HTML are
 * marked SYNTHETIC and exist to pin a specific parsing rule; they are weaker
 * evidence than a fixture, so anything a synthetic case asserts about a site's
 * markup should be replaced with a real capture when one is available.
 *
 * Run: node --test extensions/job-capture/test/
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { extractFrom, extractFromFixture } from './harness.mjs';

// ── Workday — real captures ─────────────────────────────────────────────────
// Workday's ld+json hiringOrganization is a payroll entity, not the employer,
// so each of these has a different wrong answer available to trip over.
const workday = [
  {
    name: 'NVIDIA (brand in header title)',
    fixture: 'workday-nvidia.html',
    url: 'https://nvidia.wd5.myworkdayjobs.com/en-US/NVIDIAExternalCareerSite/job/US-CA-Santa-Clara/Senior-Software-Engineer--SOC-Design-Methodology_JR2022268',
    company: 'NVIDIA',
    jobTitle: 'Senior Software Engineer, SOC Design Methodology',
    notPayrollEntity: '2100 NVIDIA USA'
  },
  {
    name: 'Salesforce (generic site slug External_Career_Site)',
    fixture: 'workday-salesforce.html',
    url: 'https://salesforce.wd12.myworkdayjobs.com/en-US/External_Career_Site/job/Indiana---Indianapolis/Manager--Accounting_JR355879',
    company: 'Salesforce',
    jobTitle: 'Manager, Accounting Quality Assurance & Governance',
    notPayrollEntity: '100 Salesforce, Inc.'
  },
  {
    name: 'Chevron (ld+json names a subsidiary)',
    fixture: 'workday-chevron.html',
    url: 'https://chevron.wd5.myworkdayjobs.com/en-US/jobs/job/Malabo-Equatorial-Guinea/Alen-Mechanical-Specialist-Lead_R000071225',
    company: 'Chevron',
    jobTitle: 'Alen Mechanical Specialist Lead',
    notPayrollEntity: '9487 Noble Energy EG Ltd. - EG Branch'
  },
  {
    name: 'State Street (empty header title, site slug "Global")',
    fixture: 'workday-statestreet.html',
    url: 'https://statestreet.wd1.myworkdayjobs.com/Global/job/Burlington-Massachusetts/Software-Engineer--CRD--New-Graduate_R-795953',
    company: 'State Street',
    jobTitle: 'Software Engineer, CRD- New Graduate',
    notPayrollEntity: '1704 Charles River Systems Inc MA'
  }
];

for (const c of workday) {
  test(`workday: ${c.name}`, () => {
    const got = extractFromFixture(c.fixture, c.url);
    assert.equal(got.company, c.company);
    assert.equal(got.jobTitle, c.jobTitle);
    assert.notEqual(got.company, c.notPayrollEntity);
  });
}

// ── iCIMS — real capture ────────────────────────────────────────────────────
test('icims: AMD (no ld+json; site-name token holds a location code)', () => {
  const got = extractFromFixture(
    'icims-amd.html',
    'https://careers-amd.icims.com/jobs/87926/gen-ai-software-development-engineer/job'
  );
  assert.equal(got.company, 'AMD');
  assert.equal(got.jobTitle, 'Gen AI Software Development Engineer');
  // The page's <title> ends "| Careers at US,CA,Santa Clara" and its only <h1>
  // is the site wordmark; neither may leak into the saved record.
  assert.notEqual(got.company, 'US,CA,Santa Clara');
  assert.notEqual(got.jobTitle, 'AMD Careers');
});

// ── iCIMS title parsing — SYNTHETIC ─────────────────────────────────────────
// Pins the " in <location>" strip: locations go, real titles containing " in "
// stay. Inline HTML because only <title> matters here.
const icimsTitles = [
  ['Gen AI Software Development Engineer in Santa Clara, California | Careers at X', 'Gen AI Software Development Engineer'],
  ['Staff Engineer in US-CA-Santa Clara | Careers at X', 'Staff Engineer'],
  ['Manager, Data Science in New York, NY | Careers at X', 'Manager, Data Science'],
  ['Analyst in Boston, Massachusetts', 'Analyst'],
  ['Backend Engineer | Careers at X', 'Backend Engineer'],
  // Must NOT be treated as a location suffix.
  ['Software Engineer in Test | Careers at X', 'Software Engineer in Test'],
  ['Nurse Practitioner in Training | Careers at X', 'Nurse Practitioner in Training']
];

for (const [title, want] of icimsTitles) {
  test(`icims title [SYNTHETIC]: ${title.slice(0, 52)}`, () => {
    const got = extractFrom(
      `<!doctype html><html><head><title>${title}</title></head><body><div>x</div></body></html>`,
      'https://careers-acme.icims.com/jobs/1/role/job'
    );
    assert.equal(got.jobTitle, want);
  });
}

test('icims [SYNTHETIC]: valid ld+json still outranks the fallbacks', () => {
  const html = `<!doctype html><html><head>
    <title>Wrong Title in Nowhere, XX | Careers at Bogus</title>
    <script type="application/ld+json">
    {"@type":"JobPosting","title":"Senior Platform Engineer","hiringOrganization":{"name":"Contoso Health"}}
    </script></head><body><h1>Contoso Careers</h1></body></html>`;
  const got = extractFrom(html, 'https://careers-contoso.icims.com/jobs/5/role/job');
  assert.equal(got.company, 'Contoso Health');
  assert.equal(got.jobTitle, 'Senior Platform Engineer');
});

// ── Greenhouse — SYNTHETIC ──────────────────────────────────────────────────
test('greenhouse [SYNTHETIC]: ld+json is trusted, legal suffix preserved', () => {
  const html = `<!doctype html><html><head><title>Acme Corp - Backend Engineer</title>
    <script type="application/ld+json">
    {"@type":"JobPosting","title":"Backend Engineer","hiringOrganization":{"name":"Acme Corp"}}
    </script></head><body><div id="content"><h1>Backend Engineer</h1></div></body></html>`;
  const got = extractFrom(html, 'https://boards.greenhouse.io/acme/jobs/9988');
  assert.equal(got.company, 'Acme Corp');
  assert.equal(got.jobTitle, 'Backend Engineer');
  assert.equal(got.jobUrl, 'https://boards.greenhouse.io/acme/jobs/9988');
});

// ── LinkedIn — SYNTHETIC (see note at top of file) ──────────────────────────
// A two-pane search page holds the results list, promoted sidebar modules and
// the open posting in one document, so each case plants the traps that an
// unscoped querySelector would hit first.
const LI_URL = 'https://www.linkedin.com/jobs/search/?currentJobId=4322&keywords=swe';

function twoPaneHtml({ topCardClass, companyMarkup, extraPaneHead = '' }) {
  return `<!doctype html><html><head>
    <title>(2) software engineer new grad jobs in United States | LinkedIn</title>
    <meta property="og:title" content="software engineer new grad jobs in United States | LinkedIn">
  </head><body><main>
    <h1>Jobs based on your preferences</h1>
    <aside><a href="/company/amazon/"><div>Amazon</div><div>10001+ employees</div><div>Greater Boston</div><div>61 connections</div></a></aside>
    <ul class="jobs-search-results__list">
      <li data-occludable-job-id="111"><a href="/jobs/view/111/">Software Engineer- CH- AXS</a>
        <div class="artdeco-entity-lockup__subtitle"><a href="/company/aeg/">AEG</a></div></li>
    </ul>
    <div class="jobs-search__job-details--container">
      ${extraPaneHead}
      <div class="${topCardClass}">
        ${companyMarkup}
        <h1 class="t-24 job-details-jobs-unified-top-card__job-title"><a href="/jobs/view/4322/">AI Engineer</a></h1>
        <button aria-label="Save AI Engineer at Shield Capital">Save</button>
      </div>
      <h2>Take the next step in your job search</h2>
      <article>About the job...</article>
    </div>
  </main></body></html>`;
}

const NAMED_COMPANY = `<div class="job-details-jobs-unified-top-card__company-name"><a href="/company/shield-capital/">Shield Capital</a></div>`;

test('linkedin [SYNTHETIC]: two-pane search page uses the open posting, not the sidebar', () => {
  const got = extractFrom(
    twoPaneHtml({
      topCardClass: 'job-details-jobs-unified-top-card__container--two-pane',
      companyMarkup: NAMED_COMPANY
    }),
    LI_URL
  );
  assert.equal(got.company, 'Shield Capital');
  assert.equal(got.jobTitle, 'AI Engineer');
  // The disposable search URL must be replaced by the posting's permalink.
  assert.equal(got.jobUrl, 'https://www.linkedin.com/jobs/view/4322/');
});

test('linkedin [SYNTHETIC]: survives renamed top-card classes via the Save aria-label', () => {
  const got = extractFrom(
    twoPaneHtml({ topCardClass: 'zz-renamed-card', companyMarkup: '<div class="zz-renamed-co">Shield Capital</div>' })
      .replace(/job-details-jobs-unified-top-card__job-title/g, 'zz-renamed-title')
      .replace(/class="t-24 /g, 'class="'),
    LI_URL
  );
  assert.equal(got.company, 'Shield Capital');
  assert.equal(got.jobTitle, 'AI Engineer');
});

// The reported failure: a company with no LinkedIn page ("Stealth Startup")
// renders a top card without the --container--two-pane class, and its logo <img>
// carries a class containing "jobs-unified-top-card". A substring selector then
// resolved the *image* as the scope, so every scoped lookup came back empty and
// the generic fallbacks took `main h2` and the logo's alt text.
test('linkedin [SYNTHETIC]: logo <img> must not be chosen as the top-card scope', () => {
  const got = extractFrom(
    twoPaneHtml({
      topCardClass: 'zz-card-variant',
      companyMarkup:
        `<img class="ivm-view-attr__img--centered jobs-unified-top-card__company-logo" alt="Company logo for, Stealth Startup.">` +
        `<div class="job-details-jobs-unified-top-card__company-name">Stealth Startup</div>`
    }),
    LI_URL
  );
  assert.equal(got.company, 'Stealth Startup');
  assert.equal(got.jobTitle, 'AI Engineer');
  assert.notEqual(got.jobTitle, 'Take the next step in your job search');
});

// REAL capture of linkedin.com/jobs/view/4452585509. This is the case that
// regressed at 4f7c90d: pane-scoped lookups replaced the document-level ones,
// and on a single posting there is no pane, so nothing was searched and the
// title fallback returned "LinkedIn" as the employer.
test('linkedin: real public /jobs/view/ page', () => {
  const got = extractFromFixture(
    'linkedin-public-jobview.html',
    'https://www.linkedin.com/jobs/view/4452585509/'
  );
  assert.equal(got.company, 'Stealth Startup');
  assert.equal(got.jobTitle, 'Software Engineer – New Grad [33457]');
  assert.notEqual(got.company, 'LinkedIn');
});

// Real page titles read "<Company> hiring <Title> in <Location> | LinkedIn".
// An earlier synthetic test asserted "<Title> | <Company> | LinkedIn", a format
// LinkedIn does not actually emit, so it validated nothing.
const liTitles = [
  ['Stealth Startup hiring Software Engineer – New Grad [33457] in San Francisco, CA | LinkedIn',
    'Stealth Startup', 'Software Engineer – New Grad [33457]'],
  ['Shield Capital hiring AI Engineer in Bellevue, WA | LinkedIn', 'Shield Capital', 'AI Engineer'],
  // Older/alternate shape must still parse.
  ['AI Engineer | Shield Capital | LinkedIn', 'Shield Capital', 'AI Engineer']
];

for (const [title, company, jobTitle] of liTitles) {
  test(`linkedin title [SYNTHETIC]: ${title.slice(0, 46)}`, () => {
    const got = extractFrom(
      `<!doctype html><html><head><title>${title}</title></head><body><main></main></body></html>`,
      'https://www.linkedin.com/jobs/view/4322/'
    );
    assert.equal(got.company, company);
    assert.equal(got.jobTitle, jobTitle);
  });
}

// ── Value hygiene ───────────────────────────────────────────────────────────
test('company is never a social-proof blob or an image label', () => {
  const bad = [
    'Amazon10001+ employees · Greater Boston61 connections',
    '2 school alumni work here',
    'careers home',
    'logo'
  ];
  for (const value of bad) {
    const html = `<!doctype html><html><head><title>Engineer</title></head>
      <body><main><h1>Engineer</h1><div class="company">${value}</div></main></body></html>`;
    const got = extractFrom(html, 'https://jobs.example.com/role');
    assert.notEqual(got.company, value, `leaked: ${value}`);
  }
});
