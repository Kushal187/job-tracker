'use client';

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { APPLICATION_STATUSES, type ApplicationStatus } from '@/lib/types';

type Application = {
  id: string;
  company: string;
  jobTitle: string;
  status: ApplicationStatus;
  jobUrl: string;
  appliedAt: string;
  updatedAt: string;
  sheetRowNumber: number | null;
};

type FilterState = {
  status: string;
};

type SortKey =
  | 'sheet_desc'
  | 'sheet_asc'
  | 'applied_desc'
  | 'applied_asc'
  | 'company_asc'
  | 'company_desc';

const PAGE_SIZE_OPTIONS = [25, 50, 100];

const initialCreateState = {
  company: '',
  jobTitle: '',
  status: 'Applied' as ApplicationStatus,
  jobUrl: ''
};

const MOCK_APPLICATIONS: Application[] = [
  { id: 'demo-1', company: 'Linear', jobTitle: 'Product Designer', status: 'Interview', jobUrl: 'https://jobs.linear.app/product-designer', appliedAt: '2026-02-24T13:05:00.000Z', updatedAt: '2026-02-24T13:05:00.000Z', sheetRowNumber: 102 },
  { id: 'demo-2', company: 'Notion', jobTitle: 'Growth Marketing Manager', status: 'Applied', jobUrl: 'https://www.notion.so/careers/growth-marketing-manager', appliedAt: '2026-02-22T15:32:00.000Z', updatedAt: '2026-02-22T15:32:00.000Z', sheetRowNumber: 103 },
  { id: 'demo-3', company: 'Stripe', jobTitle: 'Frontend Engineer, Dashboard', status: 'Reject', jobUrl: 'https://stripe.com/jobs/listing/frontend-engineer-dashboard', appliedAt: '2026-02-17T09:12:00.000Z', updatedAt: '2026-02-19T08:41:00.000Z', sheetRowNumber: 104 },
  { id: 'demo-4', company: 'Mercury', jobTitle: 'Senior Product Manager', status: 'Applied', jobUrl: 'https://mercury.com/jobs/senior-product-manager', appliedAt: '2026-02-15T20:07:00.000Z', updatedAt: '2026-02-15T20:07:00.000Z', sheetRowNumber: 105 },
  { id: 'demo-5', company: 'Ramp', jobTitle: 'Technical Program Manager', status: 'Interview', jobUrl: 'https://ramp.com/careers/technical-program-manager', appliedAt: '2026-02-11T14:30:00.000Z', updatedAt: '2026-02-18T11:22:00.000Z', sheetRowNumber: 106 },
  { id: 'demo-6', company: 'Vercel', jobTitle: 'Developer Relations Engineer', status: 'Accepted', jobUrl: 'https://vercel.com/careers/developer-relations-engineer', appliedAt: '2026-02-05T16:10:00.000Z', updatedAt: '2026-02-27T11:15:00.000Z', sheetRowNumber: 107 },
  { id: 'demo-7', company: 'Figma', jobTitle: 'Design Systems Engineer', status: 'Applied', jobUrl: 'https://www.figma.com/careers/design-systems-engineer', appliedAt: '2026-02-02T10:45:00.000Z', updatedAt: '2026-02-02T10:45:00.000Z', sheetRowNumber: 108 },
  { id: 'demo-8', company: 'OpenAI', jobTitle: 'Product Operations Lead', status: 'OA', jobUrl: 'https://openai.com/careers/product-operations-lead', appliedAt: '2026-01-31T11:05:00.000Z', updatedAt: '2026-02-03T08:32:00.000Z', sheetRowNumber: 109 },
  { id: 'demo-9', company: 'Anthropic', jobTitle: 'Operations Analyst', status: 'Applied', jobUrl: 'https://www.anthropic.com/careers/operations-analyst', appliedAt: '2026-01-28T18:22:00.000Z', updatedAt: '2026-01-28T18:22:00.000Z', sheetRowNumber: 110 },
  { id: 'demo-10', company: 'Airtable', jobTitle: 'Customer Success Manager', status: 'Interview', jobUrl: 'https://airtable.com/careers/customer-success-manager', appliedAt: '2026-01-24T12:15:00.000Z', updatedAt: '2026-02-01T10:45:00.000Z', sheetRowNumber: 111 },
  { id: 'demo-11', company: 'Figma', jobTitle: 'Staff Engineer', status: 'Reject', jobUrl: 'https://www.figma.com/careers/staff-engineer', appliedAt: '2026-01-20T09:00:00.000Z', updatedAt: '2026-01-25T14:20:00.000Z', sheetRowNumber: 112 },
  { id: 'demo-12', company: 'Plaid', jobTitle: 'Backend Engineer', status: 'Applied', jobUrl: 'https://plaid.com/careers/backend-engineer', appliedAt: '2026-01-18T11:30:00.000Z', updatedAt: '2026-01-18T11:30:00.000Z', sheetRowNumber: 113 },
  { id: 'demo-13', company: 'Retool', jobTitle: 'Solutions Engineer', status: 'Interview', jobUrl: 'https://retool.com/careers/solutions-engineer', appliedAt: '2026-01-15T16:45:00.000Z', updatedAt: '2026-01-22T10:00:00.000Z', sheetRowNumber: 114 },
  { id: 'demo-14', company: 'Loom', jobTitle: 'Product Designer', status: 'Accepted', jobUrl: 'https://loom.com/careers/product-designer', appliedAt: '2026-01-10T08:20:00.000Z', updatedAt: '2026-02-28T09:30:00.000Z', sheetRowNumber: 115 },
  { id: 'demo-15', company: 'Coda', jobTitle: 'Full Stack Engineer', status: 'OA', jobUrl: 'https://coda.io/careers/full-stack-engineer', appliedAt: '2026-01-05T14:00:00.000Z', updatedAt: '2026-01-12T11:15:00.000Z', sheetRowNumber: 116 }
];

function buildQuery(filters: FilterState) {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  const q = params.toString();
  return q ? `?${q}` : '';
}

function formatDate(input: string): string {
  return new Date(input).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function truncateUrl(input: string, max = 25): string {
  if (input.length <= max) return input;
  return input.slice(0, max - 3) + '...';
}

function statusBadgeStyle(status: ApplicationStatus): React.CSSProperties {
  const map: Record<ApplicationStatus, React.CSSProperties> = {
    Applied: { backgroundColor: 'var(--status-applied-bg)', color: 'var(--status-applied-text)' },
    Interview: { backgroundColor: 'var(--status-interview-bg)', color: 'var(--status-interview-text)' },
    Accepted: { backgroundColor: 'var(--status-accepted-bg)', color: 'var(--status-accepted-text)' },
    Reject: { backgroundColor: 'var(--status-reject-bg)', color: 'var(--status-reject-text)' },
    OA: { backgroundColor: 'var(--status-oa-bg)', color: 'var(--status-oa-text)' }
  };
  return map[status] || { backgroundColor: 'var(--status-reject-bg)', color: 'var(--status-reject-text)' };
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    maxWidth: 1200,
    margin: '0 auto',
    padding: 24,
    minHeight: '100vh'
  },
  topBar: {
    height: 56,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 0',
    borderBottom: '1px solid var(--border-subtle)',
    marginBottom: 24
  },
  topBarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 8
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: 600,
    margin: 0,
    letterSpacing: '-0.01em'
  },
  topBarBadge: {
    fontSize: 13,
    color: 'var(--text-secondary)',
    fontWeight: 400
  },
  topBarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 12
  },
  btnPrimary: {
    height: 32,
    padding: '0 12px',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    border: 'none',
    borderRadius: 6,
    background: 'var(--accent)',
    color: 'white',
    fontSize: 13,
    fontWeight: 500
  },
  iconBtn: {
    width: 32,
    height: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    background: 'none',
    color: 'var(--text-secondary)',
    borderRadius: 6,
    cursor: 'pointer'
  },
  statsRow: {
    fontSize: 13,
    color: 'var(--text-secondary)',
    marginBottom: 16
  },
  statsNum: {
    color: 'var(--text)',
    fontWeight: 500
  },
  filtersRow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    columnGap: 14,
    rowGap: 12,
    marginBottom: 14
  },
  filterGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: 500,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    color: 'var(--text-secondary)',
    marginBottom: 4
  },
  filterInput: {
    height: 36,
    padding: '0 10px',
    fontSize: 13,
    border: '1px solid var(--input-border)',
    borderRadius: 8,
    background: 'var(--surface)',
    color: 'var(--text)',
    minWidth: 120
  },
  filterSelect: {
    height: 36,
    padding: '0 36px 0 10px',
    fontSize: 13,
    border: '1px solid var(--input-border)',
    borderRadius: 8,
    backgroundColor: 'var(--surface)',
    backgroundImage:
      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 14 14' fill='none'%3E%3Cpath d='M3.5 5.25L7 8.75L10.5 5.25' stroke='%236B7280' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 10px center',
    color: 'var(--text)',
    minWidth: 120,
    appearance: 'none' as const
  },
  clearBtn: {
    height: 36,
    padding: '0 12px',
    border: '1px solid var(--border)',
    borderRadius: 8,
    background: 'var(--surface)',
    color: 'var(--text-secondary)',
    fontSize: 13,
    cursor: 'pointer'
  },
  statusMessage: {
    fontSize: 13,
    color: 'var(--status-accepted-bg)',
    fontWeight: 600,
    marginBottom: 8
  },
  tableWrap: {
    border: '1px solid var(--border)',
    borderRadius: 6,
    background: 'var(--surface)',
    overflow: 'hidden'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    tableLayout: 'fixed'
  },
  th: {
    padding: '10px 12px',
    textAlign: 'left',
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    color: 'var(--text-secondary)',
    background: 'var(--table-header-bg)',
    borderBottom: '1px solid var(--border-subtle)',
    position: 'sticky',
    top: 0,
    zIndex: 1
  },
  td: {
    padding: '10px 12px',
    fontSize: 13,
    borderBottom: '1px solid var(--border-row)',
    verticalAlign: 'middle',
    height: 44
  },
  tdMuted: {
    color: 'var(--text-secondary)',
    fontSize: 12
  },
  rowHover: {
    background: 'var(--table-row-hover)'
  },
  statusSelect: {
    height: 28,
    minWidth: 116,
    padding: '0 30px 0 10px',
    fontSize: 12,
    borderRadius: 9999,
    border: '1px solid var(--input-border)',
    backgroundColor: 'var(--surface)',
    backgroundImage:
      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 14 14' fill='none'%3E%3Cpath d='M3.5 5.25L7 8.75L10.5 5.25' stroke='%23F3F4F6' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 10px center',
    appearance: 'none' as const
  },
  urlLink: {
    color: 'var(--accent)',
    textDecoration: 'none',
    fontSize: 12,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    maxWidth: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  actionsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8
  },
  actionBtn: {
    height: 28,
    padding: '0 8px',
    border: '1px solid var(--border)',
    borderRadius: 6,
    background: 'var(--surface)',
    color: 'var(--text)',
    fontSize: 12
  },
  actionBtnDanger: {
    border: '1px solid rgba(220, 38, 38, 0.35)',
    color: 'var(--danger)'
  },
  pagination: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
    padding: '12px 16px',
    borderTop: '1px solid var(--border-subtle)',
    fontSize: 12,
    color: 'var(--text-secondary)'
  },
  paginationBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: 12,
    cursor: 'pointer',
    padding: '4px 0'
  },
  emptyState: {
    textAlign: 'center' as const,
    padding: 48,
    color: 'var(--text-secondary)',
    fontSize: 13
  },
  skeleton: {
    height: 14,
    borderRadius: 4,
    background: 'var(--border-row)',
    animation: 'shimmer 1.5s ease-in-out infinite'
  },
  modalBackdrop: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100
  },
  modal: {
    width: 480,
    maxWidth: 'calc(100vw - 48px)',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    padding: 24
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: 600,
    margin: '0 0 20px'
  },
  formField: {
    marginBottom: 12
  },
  formLabel: {
    display: 'block',
    fontSize: 11,
    fontWeight: 500,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    color: 'var(--text-secondary)',
    marginBottom: 4
  },
  formInput: {
    width: '100%',
    height: 36,
    padding: '0 10px',
    fontSize: 13,
    border: '1px solid var(--input-border)',
    borderRadius: 6,
    background: 'var(--surface)',
    color: 'var(--text)'
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 24
  },
  btnCancel: {
    height: 36,
    padding: '0 12px',
    border: 'none',
    background: 'none',
    color: 'var(--text-secondary)',
    fontSize: 13,
    cursor: 'pointer'
  }
};

export function Dashboard() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [createForm, setCreateForm] = useState(initialCreateState);
  const [editForm, setEditForm] = useState<Application | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    status: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [usingMockData, setUsingMockData] = useState(false);
  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({});
  const [deletingIds, setDeletingIds] = useState<Record<string, boolean>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortBy, setSortBy] = useState<SortKey>('sheet_desc');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const companyInputRef = useRef<HTMLInputElement>(null);

  const resetMessages = useCallback(() => {
    setStatusMessage('');
    setErrorMessage('');
  }, []);

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const res = await fetch(`/api/applications${buildQuery(filters)}`, {
        cache: 'no-store'
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.details || body.error || 'Failed to fetch');
      setApplications(body.applications || []);
      setUsingMockData(false);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unknown error');
      setApplications(MOCK_APPLICATIONS);
      setUsingMockData(true);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  useEffect(() => {
    const stored = localStorage.getItem('job-tracker-theme') as 'light' | 'dark' | null;
    if (stored) setTheme(stored);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : '');
    localStorage.setItem('job-tracker-theme', theme);
  }, [theme]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;
        e.preventDefault();
        setAddOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (addOpen || editForm) {
      requestAnimationFrame(() => companyInputRef.current?.focus());
    }
  }, [addOpen, editForm]);

  useEffect(() => setPage(1), [filters, sortBy]);

  useEffect(() => {
    if (!statusMessage) return;
    const timer = window.setTimeout(() => setStatusMessage(''), 2000);
    return () => window.clearTimeout(timer);
  }, [statusMessage]);

  const filteredApplications = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    const source = applications.filter((a) => {
      if (filters.status && a.status !== filters.status) return false;
      if (!needle) return true;
      const haystack = `${a.company} ${a.jobTitle} ${a.jobUrl} ${a.status}`.toLowerCase();
      return haystack.includes(needle);
    });

    return [...source].sort((a, b) => {
      if (sortBy === 'company_asc') return a.company.localeCompare(b.company);
      if (sortBy === 'company_desc') return b.company.localeCompare(a.company);
      if (sortBy === 'applied_desc') return new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime();
      if (sortBy === 'applied_asc') return new Date(a.appliedAt).getTime() - new Date(b.appliedAt).getTime();

      const aRow = a.sheetRowNumber;
      const bRow = b.sheetRowNumber;
      if (aRow == null && bRow == null) {
        return new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime();
      }
      if (aRow == null) return 1;
      if (bRow == null) return -1;
      return sortBy === 'sheet_desc' ? bRow - aRow : aRow - bRow;
    });
  }, [applications, filters, searchTerm, sortBy]);

  const total = filteredApplications.length;
  const interviewCount = useMemo(
    () => filteredApplications.filter((a) => a.status === 'Interview').length,
    [filteredApplications]
  );
  const responseRate = useMemo(() => {
    if (!total) return 0;
    const responsive = filteredApplications.filter(
      (a) => a.status === 'Interview' || a.status === 'Accepted'
    ).length;
    return Math.round((responsive / total) * 100);
  }, [filteredApplications, total]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pagedApplications = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredApplications.slice(start, start + pageSize);
  }, [filteredApplications, page, pageSize]);

  const filteredEmpty = !loading && pagedApplications.length === 0;
  const hasActiveFilters = Boolean(filters.status || searchTerm.trim());

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    resetMessages();
    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-idempotency-key': crypto.randomUUID()
        },
        body: JSON.stringify(createForm)
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.details || body.error || 'Failed to create');
      setCreateForm(initialCreateState);
      setStatusMessage('Application created and synced to Google Sheets.');
      setAddOpen(false);
      await fetchApplications();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unknown error');
    }
  }

  async function handleEdit(e: FormEvent) {
    e.preventDefault();
    if (!editForm) return;
    resetMessages();
    setSavingIds((p) => ({ ...p, [editForm.id]: true }));
    try {
      const res = await fetch(`/api/applications/${editForm.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: editForm.company,
          jobTitle: editForm.jobTitle,
          status: editForm.status,
          jobUrl: editForm.jobUrl
        })
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.details || body.error || 'Failed to update');
      setStatusMessage('Application updated and synced to Google Sheets.');
      setEditForm(null);
      await fetchApplications();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSavingIds((p) => ({ ...p, [editForm.id]: false }));
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this application? This removes it from the dashboard and Google Sheets.')) return;
    resetMessages();
    setDeletingIds((p) => ({ ...p, [id]: true }));
    try {
      const res = await fetch(`/api/applications/${id}`, { method: 'DELETE' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.details || body.error || 'Failed to delete');
      setStatusMessage('Application deleted.');
      await fetchApplications();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setDeletingIds((p) => ({ ...p, [id]: false }));
    }
  }

  function clearFilters() {
    setFilters({ status: '' });
    setSearchTerm('');
  }

  async function handleStatusChange(id: string, status: ApplicationStatus) {
    resetMessages();
    setSavingIds((p) => ({ ...p, [id]: true }));
    try {
      const res = await fetch(`/api/applications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.details || body.error || 'Failed to update status');
      setStatusMessage(`Status updated to ${status}.`);
      await fetchApplications();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSavingIds((p) => ({ ...p, [id]: false }));
    }
  }

  return (
    <div style={styles.shell}>
      <header style={styles.topBar}>
        <div style={styles.topBarLeft}>
          <h1 style={styles.topBarTitle}>Job Tracker</h1>
          <span style={styles.topBarBadge}>({total})</span>
        </div>
        <div style={styles.topBarRight}>
          <button
            type="button"
            className="icon-btn"
            style={styles.iconBtn}
            onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
            aria-label="Toggle theme"
          >
            {theme === 'light' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
              </svg>
            )}
          </button>
          <button
            type="button"
            className="btn-primary"
            style={styles.btnPrimary}
            onClick={() => setAddOpen(true)}
          >
            <span>+</span>
            New Application
          </button>
        </div>
      </header>

      <p style={styles.statsRow}>
        <span style={styles.statsNum}>{total}</span> applied
        {' · '}
        <span style={styles.statsNum}>{interviewCount}</span> interviews
        {' · '}
        <span style={styles.statsNum}>{responseRate}%</span> response rate
      </p>

      <div style={styles.filtersRow}>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel} htmlFor="filterStatus">Status</label>
          <select
            id="filterStatus"
            style={styles.filterSelect}
            value={filters.status}
            onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}
          >
            <option value="">All statuses</option>
            {APPLICATION_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel} htmlFor="search">Search</label>
          <input
            id="search"
            type="text"
            style={{ ...styles.filterInput, minWidth: 280 }}
            value={searchTerm}
            placeholder="Company, role, URL..."
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel} htmlFor="pageSize">Rows</label>
          <select
            id="pageSize"
            style={styles.filterSelect}
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>{n} / page</option>
            ))}
          </select>
        </div>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel} htmlFor="sortBy">Sort</label>
          <select
            id="sortBy"
            style={styles.filterSelect}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
          >
            <option value="sheet_desc">Sheet row (newest first)</option>
            <option value="sheet_asc">Sheet row (oldest first)</option>
            <option value="applied_desc">Applied date (newest first)</option>
            <option value="applied_asc">Applied date (oldest first)</option>
            <option value="company_asc">Company (A-Z)</option>
            <option value="company_desc">Company (Z-A)</option>
          </select>
        </div>
        {hasActiveFilters && (
          <button type="button" style={styles.clearBtn} onClick={clearFilters}>
            Clear
          </button>
        )}
      </div>

      {statusMessage && <p style={styles.statusMessage}>{statusMessage}</p>}
      {errorMessage && <p style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 8 }}>{errorMessage}</p>}
      {usingMockData && <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>Using sample data (API unavailable)</p>}

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{ ...styles.th, width: '11%' }}>Applied</th>
              <th style={{ ...styles.th, width: '18%' }}>Company</th>
              <th style={{ ...styles.th, width: '20%' }}>Title</th>
              <th style={{ ...styles.th, width: '16%' }}>Status</th>
              <th style={{ ...styles.th, width: '19%' }}>Job URL</th>
              <th style={{ ...styles.th, width: '16%' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`sk-${i}`}>
                  <td style={styles.td}><span style={styles.skeleton} /></td>
                  <td style={styles.td}><span style={styles.skeleton} /></td>
                  <td style={styles.td}><span style={styles.skeleton} /></td>
                  <td style={styles.td}><span style={styles.skeleton} /></td>
                  <td style={styles.td}><span style={styles.skeleton} /></td>
                  <td style={styles.td}><span style={styles.skeleton} /></td>
                </tr>
              ))
            ) : filteredEmpty ? (
              <tr>
                <td colSpan={6} style={styles.emptyState}>
                  No applications match your filters.
                  <br />
                  <button type="button" style={styles.clearBtn} onClick={clearFilters}>
                    Clear filters
                  </button>
                </td>
              </tr>
            ) : (
              pagedApplications.map((app) => (
                <ApplicationRow
                  key={app.id}
                  app={app}
                  isSaving={Boolean(savingIds[app.id])}
                  isDeleting={Boolean(deletingIds[app.id])}
                  onStatusChange={(status) => handleStatusChange(app.id, status)}
                  onEdit={() => setEditForm({ ...app })}
                  onDelete={() => handleDelete(app.id)}
                />
              ))
            )}
          </tbody>
        </table>
        {!filteredEmpty && (
          <div style={styles.pagination}>
            <button
              type="button"
              style={styles.paginationBtn}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              ← Previous
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              style={styles.paginationBtn}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {addOpen && (
        <div
          style={styles.modalBackdrop}
          onClick={(e) => e.target === e.currentTarget && setAddOpen(false)}
        >
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>New Application</h2>
            <form onSubmit={handleCreate}>
              <div style={styles.formField}>
                <label style={styles.formLabel} htmlFor="new-company">Company</label>
                <input
                  ref={companyInputRef}
                  id="new-company"
                  style={styles.formInput}
                  value={createForm.company}
                  onChange={(e) => setCreateForm((p) => ({ ...p, company: e.target.value }))}
                  required
                />
              </div>
              <div style={styles.formField}>
                <label style={styles.formLabel} htmlFor="new-title">Job Title</label>
                <input
                  id="new-title"
                  style={styles.formInput}
                  value={createForm.jobTitle}
                  onChange={(e) => setCreateForm((p) => ({ ...p, jobTitle: e.target.value }))}
                  required
                />
              </div>
              <div style={styles.formField}>
                <label style={styles.formLabel} htmlFor="new-status">Status</label>
                <select
                  id="new-status"
                  style={styles.formInput}
                  value={createForm.status}
                  onChange={(e) => setCreateForm((p) => ({ ...p, status: e.target.value as ApplicationStatus }))}
                  required
                >
                  {APPLICATION_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div style={styles.formField}>
                <label style={styles.formLabel} htmlFor="new-url">Job URL</label>
                <input
                  id="new-url"
                  type="url"
                  style={styles.formInput}
                  value={createForm.jobUrl}
                  onChange={(e) => setCreateForm((p) => ({ ...p, jobUrl: e.target.value }))}
                  required
                />
              </div>
              <div style={styles.modalActions}>
                <button type="button" style={styles.btnCancel} onClick={() => setAddOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={styles.btnPrimary}>
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editForm && (
        <div
          style={styles.modalBackdrop}
          onClick={(e) => e.target === e.currentTarget && setEditForm(null)}
        >
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>Edit Application</h2>
            <form onSubmit={handleEdit}>
              <div style={styles.formField}>
                <label style={styles.formLabel} htmlFor="edit-company">Company</label>
                <input
                  ref={companyInputRef}
                  id="edit-company"
                  style={styles.formInput}
                  value={editForm.company}
                  onChange={(e) => setEditForm((p) => p ? { ...p, company: e.target.value } : null)}
                  required
                />
              </div>
              <div style={styles.formField}>
                <label style={styles.formLabel} htmlFor="edit-title">Job Title</label>
                <input
                  id="edit-title"
                  style={styles.formInput}
                  value={editForm.jobTitle}
                  onChange={(e) => setEditForm((p) => p ? { ...p, jobTitle: e.target.value } : null)}
                  required
                />
              </div>
              <div style={styles.formField}>
                <label style={styles.formLabel} htmlFor="edit-status">Status</label>
                <select
                  id="edit-status"
                  style={styles.formInput}
                  value={editForm.status}
                  onChange={(e) => setEditForm((p) => p ? { ...p, status: e.target.value as ApplicationStatus } : null)}
                  required
                >
                  {APPLICATION_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div style={styles.formField}>
                <label style={styles.formLabel} htmlFor="edit-url">Job URL</label>
                <input
                  id="edit-url"
                  type="url"
                  style={styles.formInput}
                  value={editForm.jobUrl}
                  onChange={(e) => setEditForm((p) => p ? { ...p, jobUrl: e.target.value } : null)}
                  required
                />
              </div>
              <div style={styles.modalActions}>
                <button type="button" style={styles.btnCancel} onClick={() => setEditForm(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={styles.btnPrimary} disabled={savingIds[editForm.id]}>
                  {savingIds[editForm.id] ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

function ApplicationRow({
  app,
  isSaving,
  isDeleting,
  onStatusChange,
  onEdit,
  onDelete
}: {
  app: Application;
  isSaving: boolean;
  isDeleting: boolean;
  onStatusChange: (status: ApplicationStatus) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const badgeStyle = statusBadgeStyle(app.status);

  return (
    <tr
      style={{
        background: 'transparent'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--table-row-hover)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
    >
      <td style={{ ...styles.td, ...styles.tdMuted }}>{formatDate(app.appliedAt)}</td>
      <td style={styles.td}>{app.company}</td>
      <td style={styles.td}>{app.jobTitle}</td>
      <td style={styles.td}>
        <select
          aria-label={`Change status for ${app.company}`}
          value={app.status}
          style={{ ...styles.statusSelect, backgroundColor: badgeStyle.backgroundColor, color: badgeStyle.color }}
          onChange={(e) => onStatusChange(e.target.value as ApplicationStatus)}
          disabled={isSaving || isDeleting}
        >
          {APPLICATION_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </td>
      <td style={styles.td}>
        <a
          href={app.jobUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={styles.urlLink}
          title={app.jobUrl}
        >
          {truncateUrl(app.jobUrl)}
          <span style={{ fontSize: 10 }}>↗</span>
        </a>
      </td>
      <td style={styles.td}>
        <div style={styles.actionsRow}>
          <button
            type="button"
            style={styles.actionBtn}
            onClick={onEdit}
            disabled={isSaving || isDeleting}
          >
            Edit
          </button>
          <button
            type="button"
            style={{ ...styles.actionBtn, ...styles.actionBtnDanger }}
            onClick={onDelete}
            disabled={isSaving || isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </td>
    </tr>
  );
}
