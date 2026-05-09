'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

type JobProfile = {
  id: string;
  label: string;
  description: string;
};

type Job = {
  id: number;
  company_name: string;
  ats_system: string | null;
  job_title: string;
  job_location: string | null;
  job_url: string;
  department: string | null;
  first_seen_at: string | null;
  posted_date: string | null;
  priority_score: number;
  h1b_approvals: number;
  source: string | null;
  experience_years: number | null;
};

type JobsResponse = {
  jobs: Job[];
  available_profiles: JobProfile[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
};

type StatsResponse = {
  total_jobs: number;
  companies_with_jobs: number;
  new_24h: number;
  new_48h: number;
  total_sponsors: number;
};

type CompanyOption = {
  id: number;
  company_name: string;
  job_count: number;
};

type Freshness = '' | '24h' | '48h';

type SortKey =
  | 'posted_desc'
  | 'posted_asc'
  | 'company_asc'
  | 'company_desc'
  | 'title_asc'
  | 'title_desc'
  | 'priority_desc';

type ApplyState = 'idle' | 'pending' | 'tracked' | 'error';

const PER_PAGE = 50;
const HIDDEN_KEY = 'applyr-hidden-jobs:v1';

const QUICK_SEARCHES = [
  'Software Engineer I',
  'Software Engineer',
  'New Grad',
  'Data Engineer',
  'Product Manager',
  'ML Engineer',
  'Full Stack',
  'DevOps',
  'Platform Engineer'
] as const;

const FALLBACK_PROFILES: JobProfile[] = [
  {
    id: 'new_grad_swe_plus',
    label: 'New Grad SWE+',
    description: 'Software engineer, backend, full stack, AI/ML, FDE.'
  },
  { id: 'backend_fullstack', label: 'Backend / Full Stack', description: '' },
  { id: 'ai_ml', label: 'AI / ML', description: '' },
  { id: 'forward_deployed', label: 'Forward Deployed', description: '' }
];

const EXPERIENCE_LABELS: Record<string, string> = {
  '0': 'Entry level (0 yrs)',
  '1': '≤ 1 year',
  '2': '≤ 2 years',
  '3': '≤ 3 years'
};

const SORT_LABELS: Record<SortKey, string> = {
  posted_desc: 'Newest first',
  posted_asc: 'Oldest first',
  priority_desc: 'Most H1B approvals',
  company_asc: 'Company (A-Z)',
  company_desc: 'Company (Z-A)',
  title_asc: 'Title (A-Z)',
  title_desc: 'Title (Z-A)'
};

const styles: Record<string, React.CSSProperties> = {
  shell: { maxWidth: 1100, margin: '0 auto', padding: '24px 16px', minHeight: '100vh' },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    rowGap: 12,
    minHeight: 56,
    borderBottom: '1px solid var(--border-subtle)',
    marginBottom: 24
  },
  topBarLeft: { display: 'flex', alignItems: 'center', gap: 8 },
  topBarIcon: { width: 26, height: 26, flexShrink: 0, display: 'block' },
  topBarTitle: { fontSize: 16, fontWeight: 600, margin: 0, letterSpacing: '-0.01em' },
  topBarBadge: { fontSize: 13, color: 'var(--text-secondary)', fontWeight: 400 },
  topBarRight: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  btnSecondary: {
    height: 32,
    padding: '0 10px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    border: '1px solid var(--border)',
    borderRadius: 6,
    background: 'var(--surface)',
    color: 'var(--text)',
    fontSize: 13,
    fontWeight: 500,
    textDecoration: 'none',
    cursor: 'pointer'
  },
  statsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    margin: '8px 0 20px'
  },
  statPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 14px',
    borderRadius: 9999,
    fontSize: 13,
    background: 'var(--table-header-bg)',
    color: 'var(--text-secondary)'
  },
  statPillNum: { fontWeight: 600, color: 'var(--text)' },
  statPill24: {
    background: 'rgba(29, 78, 216, 0.12)',
    color: 'var(--status-interview-bg)'
  },
  statPill48: {
    background: 'rgba(217, 119, 6, 0.16)',
    color: '#b45309'
  },
  statPillSponsors: {
    background: 'rgba(4, 120, 87, 0.14)',
    color: 'var(--status-accepted-bg)'
  },
  statDotPulse: {
    display: 'inline-block',
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: 'currentColor',
    animation: 'applyr-pulse 1.6s ease-in-out infinite'
  },
  statDot: {
    display: 'inline-block',
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: 'currentColor'
  },
  searchWrap: { display: 'flex', justifyContent: 'center', marginBottom: 18 },
  searchInput: {
    width: '100%',
    maxWidth: 720,
    height: 42,
    padding: '0 14px',
    fontSize: 14,
    border: '1px solid var(--input-border)',
    borderRadius: 8,
    background: 'var(--surface)',
    color: 'var(--text)'
  },
  sectionLabel: {
    textAlign: 'center' as const,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.18em',
    color: 'var(--text-tertiary)',
    textTransform: 'uppercase' as const,
    marginBottom: 8,
    marginTop: 4
  },
  chipRow: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16
  },
  profileChip: {
    height: 34,
    padding: '0 16px',
    display: 'inline-flex',
    alignItems: 'center',
    border: '1px solid var(--border)',
    borderRadius: 9999,
    background: 'var(--surface)',
    color: 'var(--text-secondary)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer'
  },
  profileChipPrimary: {
    border: '1px solid var(--accent)',
    color: 'var(--accent)',
    background: 'var(--accent-muted)'
  },
  profileChipActive: {
    border: '1px solid var(--accent)',
    background: 'var(--accent)',
    color: 'white'
  },
  tagChip: {
    height: 28,
    padding: '0 12px',
    display: 'inline-flex',
    alignItems: 'center',
    border: '1px solid var(--border)',
    borderRadius: 9999,
    background: 'var(--surface)',
    color: 'var(--text-secondary)',
    fontSize: 12,
    cursor: 'pointer'
  },
  tagChipActive: {
    border: '1px solid var(--text)',
    background: 'var(--text)',
    color: 'var(--surface)'
  },
  filterBar: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8
  },
  selectInput: {
    height: 36,
    padding: '0 36px 0 12px',
    fontSize: 13,
    border: '1px solid var(--input-border)',
    borderRadius: 8,
    background: 'var(--surface)',
    color: 'var(--text)',
    appearance: 'none' as const,
    minWidth: 140
  },
  toggleBtn: {
    height: 36,
    padding: '0 14px',
    border: '1px solid var(--border)',
    borderRadius: 8,
    background: 'var(--surface)',
    color: 'var(--text-secondary)',
    fontSize: 13,
    cursor: 'pointer'
  },
  toggleBtnActive: {
    border: '1px solid var(--text)',
    background: 'var(--text)',
    color: 'var(--surface)'
  },
  subRow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14
  },
  resultCount: {
    marginLeft: 'auto',
    fontSize: 12,
    color: 'var(--text-tertiary)'
  },
  activeRow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    padding: '10px 0',
    borderTop: '1px solid var(--border-subtle)',
    borderBottom: '1px solid var(--border-subtle)',
    marginBottom: 16
  },
  activeLabel: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.12em',
    color: 'var(--text-tertiary)',
    textTransform: 'uppercase' as const,
    marginRight: 4
  },
  activeChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    borderRadius: 9999,
    background: 'var(--table-header-bg)',
    color: 'var(--text-secondary)',
    fontSize: 12,
    border: '1px solid var(--border-subtle)'
  },
  activeChipX: {
    cursor: 'pointer',
    color: 'var(--text-tertiary)',
    fontSize: 14,
    lineHeight: 1,
    background: 'none',
    border: 'none',
    padding: 0
  },
  clearAll: {
    marginLeft: 'auto',
    background: 'none',
    border: 'none',
    color: 'var(--accent)',
    fontSize: 12,
    cursor: 'pointer',
    padding: 0
  },
  cardList: { display: 'flex', flexDirection: 'column', gap: 12 },
  card: {
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: 16,
    background: 'var(--surface)',
    transition: 'border-color 120ms ease'
  },
  cardNew: {
    borderLeft: '3px solid var(--status-interview-bg)'
  },
  cardRecent: {
    borderLeft: '3px solid var(--status-oa-bg)'
  },
  cardHidden: {
    opacity: 0.55
  },
  cardRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap'
  },
  cardLeft: { flex: '1 1 320px', minWidth: 0 },
  cardRight: {
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 8
  },
  cardTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap'
  },
  cardTitle: { margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text)' },
  freshBadgeNew: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    borderRadius: 9999,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.08em',
    background: 'var(--status-interview-bg)',
    color: 'var(--status-interview-text)'
  },
  freshBadge48: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    borderRadius: 9999,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.08em',
    background: 'var(--status-oa-bg)',
    color: 'var(--status-oa-text)'
  },
  cardCompanyRow: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4
  },
  cardCompany: {
    fontSize: 13,
    color: 'var(--accent)',
    textDecoration: 'none',
    fontWeight: 500
  },
  pillH1b: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    borderRadius: 9999,
    fontSize: 11,
    fontWeight: 500,
    background: 'rgba(4, 120, 87, 0.14)',
    color: 'var(--status-accepted-bg)'
  },
  pillSource: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    borderRadius: 9999,
    fontSize: 11,
    background: 'var(--table-header-bg)',
    color: 'var(--text-tertiary)'
  },
  cardMeta: {
    display: 'flex',
    flexWrap: 'wrap',
    columnGap: 14,
    rowGap: 4,
    fontSize: 12,
    color: 'var(--text-secondary)',
    marginTop: 8
  },
  cardBadgeRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10
  },
  badgeApplied: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 10px',
    borderRadius: 9999,
    fontSize: 11,
    fontWeight: 500,
    background: 'rgba(29, 78, 216, 0.14)',
    color: 'var(--status-interview-bg)'
  },
  badgeSaved: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 10px',
    borderRadius: 9999,
    fontSize: 11,
    fontWeight: 500,
    background: 'rgba(4, 120, 87, 0.14)',
    color: 'var(--status-accepted-bg)'
  },
  primaryBtnRow: {
    display: 'flex',
    gap: 8
  },
  applyBtn: {
    height: 34,
    padding: '0 18px',
    border: 'none',
    borderRadius: 8,
    background: 'var(--accent)',
    color: 'white',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4
  },
  viewBtn: {
    height: 34,
    padding: '0 18px',
    border: '1px solid var(--accent)',
    borderRadius: 8,
    background: 'var(--surface)',
    color: 'var(--accent)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4
  },
  applyBtnTracked: {
    background: 'var(--status-accepted-bg)',
    color: 'var(--status-accepted-text)',
    cursor: 'default'
  },
  applyBtnError: {
    background: 'var(--surface)',
    color: 'var(--danger)',
    border: '1px solid rgba(220,38,38,0.35)'
  },
  pillToggleRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'flex-end'
  },
  pillToggle: {
    height: 24,
    padding: '0 10px',
    border: '1px solid var(--border)',
    borderRadius: 9999,
    background: 'var(--surface)',
    color: 'var(--text-secondary)',
    fontSize: 11,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    textDecoration: 'none',
    lineHeight: 1
  },
  pillToggleApplied: {
    border: '1px solid var(--status-interview-bg)',
    background: 'var(--status-interview-bg)',
    color: 'var(--status-interview-text)'
  },
  pillToggleSaved: {
    border: '1px solid var(--status-accepted-bg)',
    background: 'var(--status-accepted-bg)',
    color: 'var(--status-accepted-text)'
  },
  pillToggleHidden: {
    border: '1px solid var(--text-secondary)',
    background: 'var(--text-secondary)',
    color: 'var(--surface)'
  },
  pagination: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    marginTop: 18,
    fontSize: 12,
    color: 'var(--text-secondary)'
  },
  paginationBtn: {
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: 6,
    color: 'var(--text-secondary)',
    fontSize: 12,
    cursor: 'pointer',
    padding: '6px 12px'
  },
  emptyState: {
    textAlign: 'center' as const,
    padding: 40,
    color: 'var(--text-secondary)',
    fontSize: 13,
    border: '1px dashed var(--border)',
    borderRadius: 10,
    background: 'var(--table-header-bg)'
  },
  configWarning: {
    border: '1px solid var(--border)',
    borderRadius: 8,
    background: 'var(--table-header-bg)',
    padding: '14px 16px',
    fontSize: 13,
    color: 'var(--text-secondary)',
    marginBottom: 16
  }
};

function hoursSince(input: string | null): number | null {
  if (!input) return null;
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  return (Date.now() - date.getTime()) / (1000 * 60 * 60);
}

function formatPosted(input: string | null): { relative: string; full: string } {
  if (!input) return { relative: '—', full: '' };
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return { relative: '—', full: '' };

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const post = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const days = Math.round((today - post) / 86400000);

  let relative: string;
  if (days === 0) relative = 'Today';
  else if (days === 1) relative = 'Yesterday';
  else if (days < 7) relative = `${days}d ago`;
  else if (days < 30) relative = `${Math.floor(days / 7)}w ago`;
  else relative = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const full = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  return { relative, full };
}

function getFreshness(input: string | null): 'new' | 'recent' | null {
  const h = hoursSince(input);
  if (h === null) return null;
  if (h <= 24) return 'new';
  if (h <= 48) return 'recent';
  return null;
}

function loadIdMap(key: string): Record<number, true> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<number, true>) : {};
  } catch {
    return {};
  }
}

function persistIdMap(key: string, value: Record<number, true>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

function openInNewTab(url: string) {
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function H1bJobs() {
  const supabase = getSupabaseBrowserClient();

  // Filters
  const [profile, setProfile] = useState<string>('new_grad_swe_plus');
  const [profiles, setProfiles] = useState<JobProfile[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [freshness, setFreshness] = useState<Freshness>('');
  const [company, setCompany] = useState('');
  const [maxExperience, setMaxExperience] = useState('');
  const [sort, setSort] = useState<SortKey>('posted_desc');
  const [page, setPage] = useState(1);

  // View toggles
  const [hideSeen, setHideSeen] = useState(true);

  // Data
  const [data, setData] = useState<JobsResponse | null>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Per-job state
  const [applyState, setApplyState] = useState<Record<number, ApplyState>>({});
  const [applyError, setApplyError] = useState<Record<number, string>>({});
  const [hidden, setHidden] = useState<Record<number, true>>({});

  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    setHidden(loadIdMap(HIDDEN_KEY));
  }, []);

  useEffect(() => {
    const stored = (typeof window !== 'undefined'
      ? localStorage.getItem('job-tracker-theme')
      : null) as 'light' | 'dark' | null;
    if (stored) setTheme(stored);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : '');
    localStorage.setItem('job-tracker-theme', theme);
  }, [theme]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reset to page 1 on filter change
  useEffect(() => {
    setPage(1);
  }, [profile, search, freshness, company, maxExperience, sort]);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (profile) params.set('profile', profile);
      if (search) params.set('search', search);
      if (freshness) params.set('freshness', freshness);
      if (company) params.set('company', company);
      if (maxExperience !== '') params.set('max_experience', maxExperience);
      params.set('sort', sort);
      params.set('page', String(page));
      params.set('per_page', String(PER_PAGE));

      const res = await fetch(`/api/jobs?${params.toString()}`, { cache: 'no-store' });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || body.details || 'Failed to load jobs');
      }
      setData(body as JobsResponse);
      if ((body as JobsResponse).available_profiles?.length) {
        setProfiles((body as JobsResponse).available_profiles);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [profile, search, freshness, company, maxExperience, sort, page]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Stats + companies fetched once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/jobs/stats');
        if (!res.ok) return;
        const body = (await res.json()) as StatsResponse;
        if (!cancelled) setStats(body);
      } catch {
        // non-fatal
      }
    })();
    (async () => {
      try {
        const res = await fetch('/api/jobs/companies');
        if (!res.ok) return;
        const body = await res.json();
        if (!cancelled && Array.isArray(body.companies)) {
          setCompanies(body.companies as CompanyOption[]);
        }
      } catch {
        // non-fatal
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const totalPages = data?.total_pages ?? 1;
  const total = data?.total ?? 0;
  const rawJobs = useMemo(() => data?.jobs ?? [], [data]);

  const visibleJobs = useMemo(
    () =>
      rawJobs.filter((job) => {
        if (hideSeen && hidden[job.id]) return false;
        return true;
      }),
    [rawJobs, hidden, hideSeen]
  );

  const profileChips = useMemo(() => {
    const known = profiles.length ? profiles : FALLBACK_PROFILES;
    return [{ id: '', label: 'All roles', description: 'No role filter' } as JobProfile, ...known];
  }, [profiles]);

  const profileLabel = useMemo(() => {
    const found = profileChips.find((p) => p.id === profile);
    return found?.label ?? profile;
  }, [profileChips, profile]);

  const handleHide = useCallback((jobId: number) => {
    setHidden((prev) => {
      const next = { ...prev };
      if (next[jobId]) delete next[jobId];
      else next[jobId] = true;
      persistIdMap(HIDDEN_KEY, next);
      return next;
    });
  }, []);

  const handleApply = useCallback(
    async (job: Job) => {
      setApplyState((prev) => ({ ...prev, [job.id]: 'pending' }));
      setApplyError((prev) => {
        if (!(job.id in prev)) return prev;
        const next = { ...prev };
        delete next[job.id];
        return next;
      });

      openInNewTab(job.job_url);

      try {
        const {
          data: { session },
          error: sessionError
        } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session?.access_token) {
          throw new Error('Sign in to track applications.');
        }

        const res = await fetch('/api/applications', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
            'x-idempotency-key': `h1b-${job.id}`
          },
          body: JSON.stringify({
            company: job.company_name,
            jobTitle: job.job_title,
            status: 'Applied',
            jobUrl: job.job_url
          })
        });

        const body = await res.json();
        if (!res.ok && res.status !== 502) {
          throw new Error(body.details || body.error || 'Failed to track application');
        }

        setApplyState((prev) => ({ ...prev, [job.id]: 'tracked' }));
        setHidden((prev) => {
          if (prev[job.id]) return prev;
          const next = { ...prev, [job.id]: true as const };
          persistIdMap(HIDDEN_KEY, next);
          return next;
        });
      } catch (err) {
        setApplyState((prev) => ({ ...prev, [job.id]: 'error' }));
        setApplyError((prev) => ({
          ...prev,
          [job.id]: err instanceof Error ? err.message : 'Unknown error'
        }));
      }
    },
    [supabase]
  );

  const clearAllFilters = useCallback(() => {
    setProfile('');
    setSearch('');
    setSearchInput('');
    setFreshness('');
    setCompany('');
    setMaxExperience('');
  }, []);

  const activeChips: { key: string; label: string; clear: () => void }[] = [];
  if (profile) {
    activeChips.push({
      key: 'profile',
      label: `Profile: ${profileLabel}`,
      clear: () => setProfile('')
    });
  }
  if (search) {
    activeChips.push({
      key: 'search',
      label: `Search: ${search}`,
      clear: () => {
        setSearch('');
        setSearchInput('');
      }
    });
  }
  if (freshness) {
    activeChips.push({
      key: 'freshness',
      label: freshness === '24h' ? 'Past 24 hours' : 'Past 48 hours',
      clear: () => setFreshness('')
    });
  }
  if (company) {
    activeChips.push({ key: 'company', label: `Company: ${company}`, clear: () => setCompany('') });
  }
  if (maxExperience !== '') {
    activeChips.push({
      key: 'experience',
      label: `Experience: ${EXPERIENCE_LABELS[maxExperience] ?? maxExperience}`,
      clear: () => setMaxExperience('')
    });
  }
  const startIdx = total === 0 ? 0 : (page - 1) * PER_PAGE + 1;
  const endIdx = Math.min(page * PER_PAGE, total);
  const visibleCount = visibleJobs.length;

  return (
    <div style={styles.shell}>
      <style jsx global>{`
        @keyframes applyr-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
      <header style={styles.topBar}>
        <div style={styles.topBarLeft}>
          <Image src="/applyr-icon.svg" alt="Applyr logo" width={26} height={26} style={styles.topBarIcon} />
          <h1 style={styles.topBarTitle}>H1B Jobs</h1>
          <span style={styles.topBarBadge}>({total.toLocaleString()})</span>
        </div>
        <div style={styles.topBarRight}>
          <Link href="/" style={styles.btnSecondary}>
            ← Dashboard
          </Link>
          <button
            type="button"
            style={styles.btnSecondary}
            onClick={() => fetchJobs()}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            type="button"
            style={styles.btnSecondary}
            onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
            aria-label="Toggle theme"
          >
            {theme === 'light' ? '☾' : '☀'}
          </button>
        </div>
      </header>

      {/* Stats pills */}
      {stats && (
        <div style={styles.statsRow}>
          <span style={styles.statPill}>
            <span style={styles.statPillNum}>{stats.total_jobs.toLocaleString()}</span>
            jobs
            <span style={{ color: 'var(--text-tertiary)', margin: '0 4px' }}>·</span>
            <span style={styles.statPillNum}>{stats.companies_with_jobs.toLocaleString()}</span>
            companies
          </span>
          {stats.new_24h > 0 && (
            <button
              type="button"
              style={{
                ...styles.statPill,
                ...styles.statPill24,
                cursor: 'pointer',
                border: 'none'
              }}
              onClick={() => setFreshness('24h')}
              title="Filter to past 24 hours"
            >
              <span style={styles.statDotPulse} />
              <span style={{ ...styles.statPillNum, color: 'inherit' }}>{stats.new_24h}</span>
              new today
            </button>
          )}
          {stats.new_48h > stats.new_24h && (
            <button
              type="button"
              style={{
                ...styles.statPill,
                ...styles.statPill48,
                cursor: 'pointer',
                border: 'none'
              }}
              onClick={() => setFreshness('48h')}
              title="Filter to past 48 hours"
            >
              <span style={styles.statDot} />
              <span style={{ ...styles.statPillNum, color: 'inherit' }}>{stats.new_48h}</span>
              in 48h
            </button>
          )}
          <span style={{ ...styles.statPill, ...styles.statPillSponsors }}>
            <span style={{ ...styles.statPillNum, color: 'inherit' }}>
              {stats.total_sponsors.toLocaleString()}
            </span>
            H1B sponsors
          </span>
        </div>
      )}

      {/* Search */}
      <div style={styles.searchWrap}>
        <input
          type="text"
          placeholder="Search jobs or companies..."
          style={styles.searchInput}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
      </div>

      {/* Profiles */}
      <div style={styles.sectionLabel}>Profiles</div>
      <div style={styles.chipRow}>
        {profileChips.map((p) => {
          const active = profile === p.id;
          const isPrimary = p.id === 'new_grad_swe_plus';
          const chipStyle = active
            ? { ...styles.profileChip, ...styles.profileChipActive }
            : isPrimary
              ? { ...styles.profileChip, ...styles.profileChipPrimary }
              : styles.profileChip;
          return (
            <button
              key={p.id || 'all'}
              type="button"
              title={p.description}
              style={chipStyle}
              onClick={() => setProfile(p.id)}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Quick searches */}
      <div style={styles.sectionLabel}>Quick Searches</div>
      <div style={styles.chipRow}>
        {QUICK_SEARCHES.map((q) => {
          const active = searchInput === q;
          return (
            <button
              key={q}
              type="button"
              style={{ ...styles.tagChip, ...(active ? styles.tagChipActive : null) }}
              onClick={() => setSearchInput(active ? '' : q)}
            >
              {q}
            </button>
          );
        })}
      </div>

      {/* Filter bar */}
      <div style={styles.filterBar}>
        <select
          aria-label="Freshness"
          style={styles.selectInput}
          value={freshness}
          onChange={(e) => setFreshness(e.target.value as Freshness)}
        >
          <option value="">All time</option>
          <option value="24h">Last 24 hours</option>
          <option value="48h">Last 48 hours</option>
        </select>
        <select
          aria-label="Company"
          style={styles.selectInput}
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        >
          <option value="">All companies</option>
          {companies.map((c) => (
            <option key={c.id} value={c.company_name}>
              {c.company_name}
              {c.job_count ? ` (${c.job_count})` : ''}
            </option>
          ))}
        </select>
        <select
          aria-label="Sort"
          style={styles.selectInput}
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
        >
          {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
            <option key={k} value={k}>
              {SORT_LABELS[k]}
            </option>
          ))}
        </select>
        <select
          aria-label="Max experience"
          style={styles.selectInput}
          value={maxExperience}
          onChange={(e) => setMaxExperience(e.target.value)}
        >
          <option value="">Any experience</option>
          {Object.keys(EXPERIENCE_LABELS).map((k) => (
            <option key={k} value={k}>
              {EXPERIENCE_LABELS[k]}
            </option>
          ))}
        </select>
      </div>

      <div style={styles.subRow}>
        <button
          type="button"
          style={{ ...styles.toggleBtn, ...(hideSeen ? styles.toggleBtnActive : null) }}
          onClick={() => setHideSeen((v) => !v)}
        >
          Hide seen
        </button>
        <span style={styles.resultCount}>
          {total.toLocaleString()} results · {visibleCount}/{Math.min(PER_PAGE, total)} shown on page
          {total > 0 && ` (${startIdx}–${endIdx})`}
        </span>
      </div>

      {(activeChips.length > 0 || hideSeen) && (
        <div style={styles.activeRow}>
          <span style={styles.activeLabel}>Active</span>
          {activeChips.map((chip) => (
            <span key={chip.key} style={styles.activeChip}>
              {chip.label}
              <button
                type="button"
                aria-label={`Clear ${chip.label}`}
                style={styles.activeChipX}
                onClick={chip.clear}
              >
                ×
              </button>
            </span>
          ))}
          {hideSeen && (
            <span style={styles.activeChip}>
              Hide seen
              <button
                type="button"
                aria-label="Clear hide seen"
                style={styles.activeChipX}
                onClick={() => setHideSeen(false)}
              >
                ×
              </button>
            </span>
          )}
          {(activeChips.length > 0 || hideSeen) && (
            <button type="button" style={styles.clearAll} onClick={clearAllFilters}>
              Clear all
            </button>
          )}
        </div>
      )}

      {error && (
        <div style={styles.configWarning}>
          {error}
          {error.includes('not configured') && (
            <>
              <br />
              Set <code>H1B_API_BASE_URL</code> in your env to point at the FastAPI service.
            </>
          )}
        </div>
      )}

      {/* Job cards */}
      {loading ? (
        <div style={styles.emptyState}>Loading jobs...</div>
      ) : visibleJobs.length === 0 ? (
        <div style={styles.emptyState}>
          {error
            ? 'Could not load jobs.'
            : rawJobs.length > 0
              ? 'All jobs on this page are filtered out. Try toggling Hide seen, Show applied, or clear filters.'
              : 'No jobs match these filters.'}
        </div>
      ) : (
        <div style={styles.cardList}>
          {visibleJobs.map((job) => {
            const state = applyState[job.id] ?? 'idle';
            const isHidden = Boolean(hidden[job.id]);
            const fresh = getFreshness(job.posted_date || job.first_seen_at);
            const posted = formatPosted(job.posted_date || job.first_seen_at);
            const cardStyle: React.CSSProperties = {
              ...styles.card,
              ...(fresh === 'new' ? styles.cardNew : null),
              ...(fresh === 'recent' ? styles.cardRecent : null),
              ...(isHidden ? styles.cardHidden : null)
            };
            return (
              <div key={job.id} style={cardStyle}>
                <div style={styles.cardRow}>
                  <div style={styles.cardLeft}>
                    <div style={styles.cardTitleRow}>
                      <h3 style={styles.cardTitle}>{job.job_title}</h3>
                      {fresh === 'new' && <span style={styles.freshBadgeNew}>NEW</span>}
                      {fresh === 'recent' && <span style={styles.freshBadge48}>48H</span>}
                    </div>
                    <div style={styles.cardCompanyRow}>
                      <a
                        href={job.job_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={styles.cardCompany}
                      >
                        {job.company_name}
                      </a>
                      {job.h1b_approvals > 0 && (
                        <span style={styles.pillH1b}>{job.h1b_approvals.toLocaleString()} H1B</span>
                      )}
                      {job.source && (
                        <span style={styles.pillSource}>
                          {job.source === 'both'
                            ? 'H1B + SEC'
                            : job.source === 'h1b_only'
                              ? 'H1B'
                              : 'SEC'}
                        </span>
                      )}
                    </div>
                    <div style={styles.cardMeta}>
                      {job.job_location && <span>{job.job_location}</span>}
                      {job.department && <span>{job.department}</span>}
                      <span title={posted.full}>
                        {posted.relative}
                        {posted.full ? ` · ${posted.full}` : ''}
                      </span>
                    </div>
                  </div>
                  <div style={styles.cardRight}>
                    <div style={styles.primaryBtnRow}>
                      <a
                        href={job.job_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={styles.viewBtn}
                      >
                        View
                      </a>
                      <button
                        type="button"
                        onClick={() => handleApply(job)}
                        disabled={state === 'pending' || state === 'tracked'}
                        title={state === 'error' ? applyError[job.id] : undefined}
                        style={{
                          ...styles.applyBtn,
                          ...(state === 'tracked' ? styles.applyBtnTracked : null),
                          ...(state === 'error' ? styles.applyBtnError : null)
                        }}
                      >
                        {state === 'tracked'
                          ? '✓ Tracked'
                          : state === 'pending'
                            ? 'Applying...'
                            : state === 'error'
                              ? 'Retry'
                              : 'Apply'}
                      </button>
                    </div>
                    <div style={styles.pillToggleRow}>
                      <button
                        type="button"
                        style={{
                          ...styles.pillToggle,
                          ...(isHidden ? styles.pillToggleHidden : null)
                        }}
                        onClick={() => handleHide(job.id)}
                      >
                        {isHidden ? 'Hidden' : 'Hide'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {visibleJobs.length > 0 && (
        <div style={styles.pagination}>
          <button
            type="button"
            style={styles.paginationBtn}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
          >
            ← Prev
          </button>
          <span>
            Page {Math.min(page, totalPages)} of {totalPages}
          </span>
          <button
            type="button"
            style={styles.paginationBtn}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || loading}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
