'use client';

import Image from 'next/image';
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';
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

type UserSettings = {
  googleSheetId: string | null;
  googleSheetTab: string;
  googleSheetSyncEnabled: boolean;
  sheetsAvailable: boolean;
  serviceAccountEmail: string | null;
};

type SortKey =
  | 'sheet_desc'
  | 'sheet_asc'
  | 'applied_desc'
  | 'applied_asc'
  | 'company_asc'
  | 'company_desc';

type FetchApplicationsOptions = {
  showLoading?: boolean;
};

const PAGE_SIZE_OPTIONS = [25, 50, 100];

const initialCreateState = {
  company: '',
  jobTitle: '',
  status: 'Applied' as ApplicationStatus,
  jobUrl: ''
};

const initialSettingsForm = {
  googleSheetId: '',
  googleSheetTab: 'Applications',
  googleSheetSyncEnabled: false
};

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
    padding: '24px 16px',
    minHeight: '100vh'
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    rowGap: 12,
    minHeight: 56,
    padding: '0 0',
    borderBottom: '1px solid var(--border-subtle)',
    marginBottom: 24
  },
  topBarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 8
  },
  topBarIcon: {
    width: 26,
    height: 26,
    flexShrink: 0,
    display: 'block'
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
  sessionPill: {
    display: 'inline-flex',
    alignItems: 'center',
    height: 32,
    padding: '0 12px',
    borderRadius: 9999,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    fontSize: 12,
    color: 'var(--text-secondary)',
    maxWidth: 220,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const
  },
  topBarRight: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 12
  },
  btnSecondary: {
    height: 32,
    padding: '0 10px',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    border: '1px solid var(--border)',
    borderRadius: 6,
    background: 'var(--surface)',
    color: 'var(--text)',
    fontSize: 13,
    fontWeight: 500
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
  settingsCard: {
    border: '1px solid var(--border)',
    borderRadius: 12,
    background: 'var(--surface)',
    padding: 14,
    marginBottom: 18
  },
  settingsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12
  },
  settingsTitle: {
    margin: 0,
    fontSize: 15,
    fontWeight: 600
  },
  settingsMeta: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 10px',
    borderRadius: 9999,
    fontSize: 12,
    background: 'var(--table-header-bg)',
    color: 'var(--text-secondary)'
  },
  settingsToggle: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    height: 34,
    padding: '0 12px',
    borderRadius: 9999,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text)',
    fontSize: 13,
    fontWeight: 600
  },
  settingsHeaderActions: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 10
  },
  settingsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 14,
    marginBottom: 12
  },
  helperText: {
    fontSize: 12,
    color: 'var(--text-secondary)',
    lineHeight: 1.6,
    margin: 0
  },
  checkboxRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    minHeight: 36,
    fontSize: 13
  },
  settingsActions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14
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
    gap: 4,
    flex: '1 1 160px',
    minWidth: 0
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
    width: '100%',
    height: 36,
    padding: '0 10px',
    fontSize: 13,
    border: '1px solid var(--input-border)',
    borderRadius: 8,
    background: 'var(--surface)',
    color: 'var(--text)',
    minWidth: 0
  },
  filterSelect: {
    width: '100%',
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
    overflowX: 'auto',
    overflowY: 'hidden',
    WebkitOverflowScrolling: 'touch'
  },
  table: {
    width: '100%',
    minWidth: 760,
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
    flexWrap: 'wrap',
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
    flexWrap: 'wrap',
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
  emptyActions: {
    display: 'flex',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16
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
    maxWidth: 'calc(100vw - 24px)',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    padding: 20
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
    flexWrap: 'wrap',
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

export function Dashboard({
  onSignOut,
  userEmail
}: {
  onSignOut?: () => Promise<void> | void;
  userEmail?: string | null;
} = {}) {
  const supabase = getSupabaseBrowserClient();
  const [applications, setApplications] = useState<Application[]>([]);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [settingsForm, setSettingsForm] = useState(initialSettingsForm);
  const [createForm, setCreateForm] = useState(initialCreateState);
  const [editForm, setEditForm] = useState<Application | null>(null);
  const [filters, setFilters] = useState<FilterState>({ status: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
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

  const handleUnauthorized = useCallback(async (message = 'Your session expired. Sign in again.') => {
    setApplications([]);
    setErrorMessage(message);
    await onSignOut?.();
  }, [onSignOut]);

  const authFetch = useCallback(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const {
      data: { session },
      error
    } = await supabase.auth.getSession();

    if (error) {
      throw error;
    }

    if (!session?.access_token) {
      throw new Error('Please sign in to continue.');
    }

    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${session.access_token}`);

    return fetch(input, {
      ...init,
      headers
    });
  }, [supabase]);

  const fetchSettings = useCallback(async () => {
    setSettingsLoading(true);
    try {
      const res = await authFetch('/api/user-settings', {
        cache: 'no-store'
      });
      const body = await res.json();
      if (res.status === 401 || res.status === 403) {
        await handleUnauthorized(body.error || 'Please sign in to continue.');
        return;
      }
      if (!res.ok) throw new Error(body.details || body.error || 'Failed to fetch settings');

      setSettings(body.settings);
      setSettingsForm({
        googleSheetId: body.settings.googleSheetId || '',
        googleSheetTab: body.settings.googleSheetTab,
        googleSheetSyncEnabled: body.settings.googleSheetSyncEnabled
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message === 'Please sign in to continue.') {
        await handleUnauthorized(message);
        return;
      }
      setErrorMessage(message);
    } finally {
      setSettingsLoading(false);
    }
  }, [authFetch, handleUnauthorized]);

  const fetchApplications = useCallback(async ({ showLoading = true }: FetchApplicationsOptions = {}) => {
    if (showLoading) setLoading(true);
    setErrorMessage('');
    try {
      const res = await authFetch(`/api/applications${buildQuery(filters)}`, {
        cache: 'no-store'
      });
      const body = await res.json();
      if (res.status === 401 || res.status === 403) {
        await handleUnauthorized(body.error || 'Please sign in to continue.');
        return;
      }
      if (!res.ok) throw new Error(body.details || body.error || 'Failed to fetch');
      setApplications(body.applications || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message === 'Please sign in to continue.') {
        await handleUnauthorized(message);
        return;
      }
      setErrorMessage(message);
      setApplications([]);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [authFetch, filters, handleUnauthorized]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

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
    const timer = window.setTimeout(() => setStatusMessage(''), 2500);
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
  const hasConnectedSheet = Boolean(settings?.googleSheetId && settings.googleSheetSyncEnabled);
  const isFirstRun = !loading && applications.length === 0 && !hasActiveFilters;

  async function handleSaveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resetMessages();
    setSettingsSaving(true);

    try {
      const res = await authFetch('/api/user-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          googleSheetId: settingsForm.googleSheetId.trim(),
          googleSheetTab: settingsForm.googleSheetTab.trim(),
          googleSheetSyncEnabled: settingsForm.googleSheetSyncEnabled
        })
      });
      const body = await res.json();
      if (res.status === 401 || res.status === 403) {
        await handleUnauthorized(body.error || 'Please sign in to continue.');
        return;
      }
      if (!res.ok) throw new Error(body.details || body.error || 'Failed to save settings');

      setSettings(body.settings);
      setSettingsForm({
        googleSheetId: body.settings.googleSheetId || '',
        googleSheetTab: body.settings.googleSheetTab,
        googleSheetSyncEnabled: body.settings.googleSheetSyncEnabled
      });
      setStatusMessage(
        body.requiresFullSync
          ? 'Settings saved. Run Sync all to rebuild sheet mappings in the new sheet.'
          : 'Settings saved.'
      );
      await fetchApplications({ showLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message === 'Please sign in to continue.') {
        await handleUnauthorized(message);
        return;
      }
      setErrorMessage(message);
    } finally {
      setSettingsSaving(false);
    }
  }

  async function handleDisconnectSheet() {
    resetMessages();
    setSettingsSaving(true);

    try {
      const res = await authFetch('/api/user-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          googleSheetId: '',
          googleSheetSyncEnabled: false
        })
      });
      const body = await res.json();
      if (res.status === 401 || res.status === 403) {
        await handleUnauthorized(body.error || 'Please sign in to continue.');
        return;
      }
      if (!res.ok) throw new Error(body.details || body.error || 'Failed to disconnect sheet');

      setSettings(body.settings);
      setSettingsForm({
        googleSheetId: '',
        googleSheetTab: body.settings.googleSheetTab,
        googleSheetSyncEnabled: false
      });
      setStatusMessage('Google Sheets sync disconnected.');
      await fetchApplications({ showLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message === 'Please sign in to continue.') {
        await handleUnauthorized(message);
        return;
      }
      setErrorMessage(message);
    } finally {
      setSettingsSaving(false);
    }
  }

  async function handleSyncAll() {
    resetMessages();
    setSyncingAll(true);

    try {
      const res = await authFetch('/api/user-settings/sync', {
        method: 'POST'
      });
      const body = await res.json();
      if (res.status === 401 || res.status === 403) {
        await handleUnauthorized(body.error || 'Please sign in to continue.');
        return;
      }
      if (!res.ok) throw new Error(body.details || body.error || 'Failed to sync applications');

      setStatusMessage(`${body.syncedCount} application${body.syncedCount === 1 ? '' : 's'} synced to Google Sheets.`);
      await fetchApplications({ showLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message === 'Please sign in to continue.') {
        await handleUnauthorized(message);
        return;
      }
      setErrorMessage(message);
    } finally {
      setSyncingAll(false);
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    resetMessages();
    try {
      const res = await authFetch('/api/applications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-idempotency-key': crypto.randomUUID()
        },
        body: JSON.stringify(createForm)
      });
      const body = await res.json();
      if (res.status === 401 || res.status === 403) {
        await handleUnauthorized(body.error || 'Please sign in to continue.');
        return;
      }
      if (!res.ok) throw new Error(body.details || body.error || 'Failed to create');
      setCreateForm(initialCreateState);
      setStatusMessage(hasConnectedSheet ? 'Application created and synced to your sheet.' : 'Application created.');
      setAddOpen(false);
      await fetchApplications({ showLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message === 'Please sign in to continue.') {
        await handleUnauthorized(message);
        return;
      }
      setErrorMessage(message);
    }
  }

  async function handleEdit(e: FormEvent) {
    e.preventDefault();
    if (!editForm) return;
    resetMessages();
    setSavingIds((p) => ({ ...p, [editForm.id]: true }));
    try {
      const res = await authFetch(`/api/applications/${editForm.id}`, {
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
      if (res.status === 401 || res.status === 403) {
        await handleUnauthorized(body.error || 'Please sign in to continue.');
        return;
      }
      if (!res.ok) throw new Error(body.details || body.error || 'Failed to update');
      setStatusMessage(hasConnectedSheet ? 'Application updated and synced to your sheet.' : 'Application updated.');
      setEditForm(null);
      await fetchApplications({ showLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message === 'Please sign in to continue.') {
        await handleUnauthorized(message);
        return;
      }
      setErrorMessage(message);
    } finally {
      setSavingIds((p) => ({ ...p, [editForm.id]: false }));
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this application? This removes it from the dashboard and your connected sheet.')) return;
    resetMessages();
    setDeletingIds((p) => ({ ...p, [id]: true }));
    try {
      const res = await authFetch(`/api/applications/${id}`, { method: 'DELETE' });
      const body = await res.json();
      if (res.status === 401 || res.status === 403) {
        await handleUnauthorized(body.error || 'Please sign in to continue.');
        return;
      }
      if (!res.ok) throw new Error(body.details || body.error || 'Failed to delete');
      setStatusMessage('Application deleted.');
      await fetchApplications({ showLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message === 'Please sign in to continue.') {
        await handleUnauthorized(message);
        return;
      }
      setErrorMessage(message);
    } finally {
      setDeletingIds((p) => ({ ...p, [id]: false }));
    }
  }

  function clearFilters() {
    setFilters({ status: '' });
    setSearchTerm('');
  }

  async function handleStatusChange(id: string, status: ApplicationStatus) {
    const previousApplication = applications.find((app) => app.id === id);
    if (!previousApplication || previousApplication.status === status) return;

    resetMessages();
    setSavingIds((p) => ({ ...p, [id]: true }));
    setApplications((current) =>
      current.map((app) =>
        app.id === id
          ? {
              ...app,
              status
            }
          : app
      )
    );
    try {
      const res = await authFetch(`/api/applications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const body = await res.json();
      if (res.status === 401 || res.status === 403) {
        await handleUnauthorized(body.error || 'Please sign in to continue.');
        return;
      }
      if (!res.ok) throw new Error(body.details || body.error || 'Failed to update status');
      if (body.application) {
        setApplications((current) =>
          current.map((app) => (app.id === id ? body.application : app))
        );
      }
    } catch (err) {
      setApplications((current) =>
        current.map((app) => (app.id === id ? previousApplication : app))
      );
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message === 'Please sign in to continue.') {
        await handleUnauthorized(message);
        return;
      }
      setErrorMessage(message);
    } finally {
      setSavingIds((p) => ({ ...p, [id]: false }));
    }
  }

  return (
    <div style={styles.shell}>
      <header style={styles.topBar}>
        <div style={styles.topBarLeft}>
          <Image src="/applyr-icon.svg" alt="Applyr logo" width={26} height={26} style={styles.topBarIcon} />
          <h1 style={styles.topBarTitle}>Applyr</h1>
          <span style={styles.topBarBadge}>({total})</span>
        </div>
        <div style={styles.topBarRight}>
          {userEmail ? (
            <span style={styles.sessionPill} title={userEmail}>
              {userEmail}
            </span>
          ) : null}
          <a href="/profile" style={styles.btnSecondary}>
            Resume Profile
          </a>
          <button
            type="button"
            style={styles.btnSecondary}
            onClick={() => fetchApplications()}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            type="button"
            style={styles.btnSecondary}
            onClick={() => onSignOut?.()}
          >
            Sign out
          </button>
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

      <section style={styles.settingsCard}>
        <div style={styles.settingsHeader}>
          <h2 style={styles.settingsTitle}>Google Sheets Sync</h2>
          <div style={styles.settingsHeaderActions}>
            <span style={styles.settingsMeta}>
              {settingsLoading
                ? 'Loading settings...'
                : hasConnectedSheet
                  ? 'Sync enabled'
                  : 'Database only'}
            </span>
            <button
              type="button"
              style={styles.settingsToggle}
              onClick={() => setSettingsOpen((current) => !current)}
              aria-expanded={settingsOpen}
            >
              {settingsOpen ? 'Hide settings' : 'Show settings'}
              <span aria-hidden="true">{settingsOpen ? '−' : '+'}</span>
            </button>
          </div>
        </div>

        {settingsOpen && (
          <form onSubmit={handleSaveSettings} style={{ marginTop: 14 }}>
            <div style={styles.settingsGrid}>
              <div style={styles.formField}>
                <label style={styles.formLabel} htmlFor="sheet-id">Google Sheet ID</label>
                <input
                  id="sheet-id"
                  style={styles.formInput}
                  value={settingsForm.googleSheetId}
                  onChange={(e) => setSettingsForm((current) => ({ ...current, googleSheetId: e.target.value }))}
                  placeholder="Paste the spreadsheet ID"
                  disabled={settingsLoading || settingsSaving || !settings?.sheetsAvailable}
                />
                <p style={styles.helperText}>
                  {settings?.serviceAccountEmail
                    ? `Share your sheet with ${settings.serviceAccountEmail} and give it Editor access.`
                    : 'Google Sheets sync is unavailable until GOOGLE_SERVICE_ACCOUNT_JSON is configured on the server.'}
                </p>
              </div>

              <div style={styles.formField}>
                <label style={styles.formLabel} htmlFor="sheet-tab">Sheet tab</label>
                <input
                  id="sheet-tab"
                  style={styles.formInput}
                  value={settingsForm.googleSheetTab}
                  onChange={(e) => setSettingsForm((current) => ({ ...current, googleSheetTab: e.target.value }))}
                  placeholder="Applications"
                  disabled={settingsLoading || settingsSaving || !settings?.sheetsAvailable}
                />
                <p style={styles.helperText}>
                  Changing the sheet or tab clears row mappings until you run a full sync.
                </p>
              </div>

              <div style={styles.formField}>
                <label style={styles.formLabel}>Sync mode</label>
                <label style={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={settingsForm.googleSheetSyncEnabled}
                    onChange={(e) => setSettingsForm((current) => ({ ...current, googleSheetSyncEnabled: e.target.checked }))}
                    disabled={settingsLoading || settingsSaving || !settings?.sheetsAvailable}
                  />
                  Enable automatic sync on create, update, and delete
                </label>
                <p style={styles.helperText}>
                  Leave this off if you want to store data only in the dashboard.
                </p>
              </div>
            </div>

            <div style={styles.settingsActions}>
              <button
                type="submit"
                className="btn-primary"
                style={styles.btnPrimary}
                disabled={settingsLoading || settingsSaving}
              >
                {settingsSaving ? 'Saving...' : 'Save settings'}
              </button>
              <button
                type="button"
                style={styles.btnSecondary}
                onClick={() => void handleSyncAll()}
                disabled={syncingAll || !settings?.googleSheetId || !settings?.sheetsAvailable}
              >
                {syncingAll ? 'Syncing...' : 'Sync all'}
              </button>
              <button
                type="button"
                style={styles.btnSecondary}
                onClick={() => void handleDisconnectSheet()}
                disabled={settingsSaving || !settings?.googleSheetId}
              >
                Disconnect
              </button>
            </div>
          </form>
        )}
      </section>

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
            style={styles.filterInput}
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
                  {isFirstRun ? (
                    <>
                      Your dashboard is empty.
                      <br />
                      Add your first application, then connect Google Sheets later if you want an external copy.
                      <div style={styles.emptyActions}>
                        <button
                          type="button"
                          className="btn-primary"
                          style={styles.btnPrimary}
                          onClick={() => setAddOpen(true)}
                        >
                          Add first application
                        </button>
                        <button type="button" style={styles.btnSecondary} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                          Review sync settings
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      No applications match your filters.
                      <br />
                      <button type="button" style={styles.clearBtn} onClick={clearFilters}>
                        Clear filters
                      </button>
                    </>
                  )}
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
