'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
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
  dateFrom: string;
  dateTo: string;
};

const initialCreateState = {
  company: '',
  jobTitle: '',
  status: 'Applied' as ApplicationStatus,
  jobUrl: ''
};

function buildQuery(filters: FilterState) {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.set('dateTo', filters.dateTo);
  const query = params.toString();
  return query ? `?${query}` : '';
}

function formatDate(input: string): string {
  return new Date(input).toLocaleDateString();
}

export function Dashboard() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [createForm, setCreateForm] = useState(initialCreateState);
  const [filters, setFilters] = useState<FilterState>({
    status: '',
    dateFrom: '',
    dateTo: ''
  });
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({});

  const total = applications.length;

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');

    try {
      const response = await fetch(`/api/applications${buildQuery(filters)}`, {
        cache: 'no-store'
      });
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.details || body.error || 'Failed to fetch applications');
      }

      setApplications(body.applications || []);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const resetMessages = useCallback(() => {
    setStatusMessage('');
    setErrorMessage('');
  }, []);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    resetMessages();

    try {
      const response = await fetch('/api/applications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-idempotency-key': crypto.randomUUID()
        },
        body: JSON.stringify(createForm)
      });

      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.details || body.error || 'Failed to create application');
      }

      setCreateForm(initialCreateState);
      setStatusMessage('Application created and synced to Google Sheets.');
      await fetchApplications();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  const handleSaveRow = useCallback(async (id: string, payload: Partial<Application>) => {
    resetMessages();
    setSavingIds((prev) => ({ ...prev, [id]: true }));

    try {
      const response = await fetch(`/api/applications/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.details || body.error || 'Failed to update application');
      }

      setStatusMessage('Application updated and synced to Google Sheets.');
      await fetchApplications();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setSavingIds((prev) => ({ ...prev, [id]: false }));
    }
  }, [fetchApplications, resetMessages]);

  const rows = useMemo(
    () =>
      applications.map((app) => (
        <ApplicationRow
          key={`${app.id}-${app.updatedAt}`}
          app={app}
          isSaving={Boolean(savingIds[app.id])}
          onSave={handleSaveRow}
        />
      )),
    [applications, handleSaveRow, savingIds]
  );

  return (
    <>
      <section className="card">
        <h2>Add Application</h2>
        <form onSubmit={handleCreate} className="grid two">
          <div>
            <label htmlFor="company">Company</label>
            <input
              id="company"
              value={createForm.company}
              onChange={(event) =>
                setCreateForm((prev) => ({ ...prev, company: event.target.value }))
              }
              required
            />
          </div>
          <div>
            <label htmlFor="jobTitle">Job Title</label>
            <input
              id="jobTitle"
              value={createForm.jobTitle}
              onChange={(event) =>
                setCreateForm((prev) => ({ ...prev, jobTitle: event.target.value }))
              }
              required
            />
          </div>
          <div>
            <label htmlFor="status">Status</label>
            <select
              id="status"
              value={createForm.status}
              onChange={(event) =>
                setCreateForm((prev) => ({
                  ...prev,
                  status: event.target.value as ApplicationStatus
                }))
              }
              required
            >
              {APPLICATION_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="jobUrl">Job URL</label>
            <input
              id="jobUrl"
              type="url"
              value={createForm.jobUrl}
              onChange={(event) =>
                setCreateForm((prev) => ({ ...prev, jobUrl: event.target.value }))
              }
              required
            />
          </div>
          <div>
            <button type="submit">Save Application</button>
          </div>
        </form>
      </section>

      <section className="card">
        <h2>Applications ({total})</h2>
        <div className="grid four">
          <div>
            <label htmlFor="filterStatus">Status Filter</label>
            <select
              id="filterStatus"
              value={filters.status}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, status: event.target.value }))
              }
            >
              <option value="">All</option>
              {APPLICATION_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="dateFrom">Date From</label>
            <input
              id="dateFrom"
              type="date"
              value={filters.dateFrom}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, dateFrom: event.target.value }))
              }
            />
          </div>
          <div>
            <label htmlFor="dateTo">Date To</label>
            <input
              id="dateTo"
              type="date"
              value={filters.dateTo}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, dateTo: event.target.value }))
              }
            />
          </div>
          <div className="inline-actions" style={{ alignItems: 'flex-end' }}>
            <button type="button" className="secondary" onClick={fetchApplications}>
              Apply Filters
            </button>
          </div>
        </div>

        {statusMessage ? <p className="status-ok">{statusMessage}</p> : null}
        {errorMessage ? <p className="status-error">{errorMessage}</p> : null}

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Applied</th>
                <th>Company</th>
                <th>Title</th>
                <th>Status</th>
                <th>Job URL</th>
                <th>Sheet Row</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7}>Loading...</td>
                </tr>
              ) : rows.length > 0 ? (
                rows
              ) : (
                <tr>
                  <td colSpan={7}>No applications found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function ApplicationRow({
  app,
  onSave,
  isSaving
}: {
  app: Application;
  onSave: (id: string, payload: Partial<Application>) => Promise<void>;
  isSaving: boolean;
}) {
  const [draft, setDraft] = useState({
    company: app.company,
    jobTitle: app.jobTitle,
    status: app.status,
    jobUrl: app.jobUrl
  });

  const dirty =
    draft.company !== app.company ||
    draft.jobTitle !== app.jobTitle ||
    draft.status !== app.status ||
    draft.jobUrl !== app.jobUrl;

  return (
    <tr>
      <td>{formatDate(app.appliedAt)}</td>
      <td>
        <input
          value={draft.company}
          onChange={(event) => setDraft((prev) => ({ ...prev, company: event.target.value }))}
        />
      </td>
      <td>
        <input
          value={draft.jobTitle}
          onChange={(event) => setDraft((prev) => ({ ...prev, jobTitle: event.target.value }))}
        />
      </td>
      <td>
        <select
          value={draft.status}
          onChange={(event) =>
            setDraft((prev) => ({ ...prev, status: event.target.value as ApplicationStatus }))
          }
        >
          {APPLICATION_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </td>
      <td>
        <input
          type="url"
          value={draft.jobUrl}
          onChange={(event) => setDraft((prev) => ({ ...prev, jobUrl: event.target.value }))}
        />
      </td>
      <td>{app.sheetRowNumber ?? '-'}</td>
      <td>
        <button
          type="button"
          className="secondary"
          onClick={() => onSave(app.id, draft)}
          disabled={!dirty || isSaving}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </td>
    </tr>
  );
}
