'use client';

import Image from 'next/image';
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

type Recruiter = {
  id: string;
  name: string;
  email: string;
  company: string;
  title: string;
  linkedinUrl: string;
  notes: string;
  createdAt: string;
};

type EmailLog = {
  id: string;
  recruiter_id: string;
  subject: string;
  body: string;
  status: string;
  sent_at: string;
  error_message: string | null;
  opened_at: string | null;
  open_count: number;
  recruiters: { name: string; email: string; company: string } | null;
};

type Tab = 'recruiters' | 'compose' | 'history' | 'settings';

const DEFAULT_SUBJECT = 'New Grad Software Engineer — Eager to Contribute at {{company}}';
const DEFAULT_BODY = `Hi {{firstName}},

I hope this message finds you well! My name is [Your Name], and I'm a recent graduate with a degree in Computer Science, actively looking for new grad / entry-level Software Engineering opportunities.

I've been following {{company}}'s work and I'm genuinely excited about the innovative products your team is building. I'd love the opportunity to contribute my skills in full-stack development, problem-solving, and building scalable systems.

A quick snapshot of what I bring:
- Strong foundation in data structures, algorithms, and system design
- Hands-on experience building production web applications (React, Next.js, Node.js, Python)
- A passion for clean code, shipping fast, and continuous learning

I'd welcome the chance to chat about any upcoming opportunities on your team. I've attached my resume for your reference. Would you have 15 minutes for a quick conversation?

Thank you for your time, and I look forward to hearing from you!

Best regards,
[Your Name]
[Your LinkedIn]
[Your Phone]`;

const supabase = getSupabaseBrowserClient();

function mapRecruiter(r: Record<string, unknown>): Recruiter {
  return {
    id: r.id as string,
    name: r.name as string,
    email: r.email as string,
    company: r.company as string,
    title: r.title as string,
    linkedinUrl: r.linkedin_url as string,
    notes: r.notes as string,
    createdAt: r.created_at as string
  };
}

function formatDate(input: string): string {
  return new Date(input).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function replacePlaceholders(text: string, recruiter: Recruiter): string {
  return text
    .replace(/\{\{name\}\}/g, recruiter.name)
    .replace(/\{\{firstName\}\}/g, recruiter.name.split(' ')[0])
    .replace(/\{\{email\}\}/g, recruiter.email)
    .replace(/\{\{company\}\}/g, recruiter.company)
    .replace(/\{\{title\}\}/g, recruiter.title);
}

/* ───────── Styles ───────── */
const s: Record<string, React.CSSProperties> = {
  shell: { maxWidth: 1200, margin: '0 auto', padding: '24px 16px', minHeight: '100vh' },
  topBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap',
    rowGap: 12, minHeight: 56, borderBottom: '1px solid var(--border-subtle)', marginBottom: 24
  },
  topBarLeft: { display: 'flex', alignItems: 'center', gap: 8 },
  topBarIcon: { width: 26, height: 26, flexShrink: 0, display: 'block' },
  topBarTitle: { fontSize: 16, fontWeight: 600, margin: 0, letterSpacing: '-0.01em' },
  topBarRight: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 12 },
  btnSecondary: {
    height: 32, padding: '0 10px', display: 'flex', alignItems: 'center', gap: 6,
    border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)',
    color: 'var(--text)', fontSize: 13, fontWeight: 500, textDecoration: 'none'
  },
  btnPrimary: {
    height: 32, padding: '0 12px', display: 'flex', alignItems: 'center', gap: 6,
    border: 'none', borderRadius: 6, background: 'var(--accent)', color: 'white',
    fontSize: 13, fontWeight: 500, cursor: 'pointer'
  },
  btnDanger: {
    height: 28, padding: '0 8px', border: '1px solid rgba(220,38,38,0.35)', borderRadius: 6,
    background: 'var(--surface)', color: 'var(--danger)', fontSize: 12, cursor: 'pointer'
  },
  tabs: { display: 'flex', gap: 4, marginBottom: 20 },
  tab: {
    height: 36, padding: '0 16px', borderRadius: 8,
    borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border)',
    background: 'var(--surface)', color: 'var(--text)', fontSize: 13, fontWeight: 500, cursor: 'pointer'
  },
  tabActive: { background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff' },
  card: {
    border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)',
    padding: 16, marginBottom: 16
  },
  sectionTitle: { margin: '0 0 12px', fontSize: 15, fontWeight: 600 },
  statsRow: { fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 },
  tableWrap: {
    border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)',
    overflowX: 'auto', overflowY: 'hidden'
  },
  table: { width: '100%', minWidth: 700, borderCollapse: 'collapse', tableLayout: 'fixed' },
  th: {
    padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600,
    textTransform: 'uppercase' as const, letterSpacing: '0.05em', color: 'var(--text-secondary)',
    background: 'var(--table-header-bg)', borderBottom: '1px solid var(--border-subtle)'
  },
  td: { padding: '10px 12px', fontSize: 13, borderBottom: '1px solid var(--border-row)', verticalAlign: 'middle', height: 44 },
  tdMuted: { color: 'var(--text-secondary)', fontSize: 12 },
  checkbox: { width: 16, height: 16, cursor: 'pointer' },
  formField: { marginBottom: 12 },
  formLabel: {
    display: 'block', fontSize: 11, fontWeight: 500, textTransform: 'uppercase' as const,
    letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: 4
  },
  formInput: {
    width: '100%', height: 36, padding: '0 10px', fontSize: 13,
    border: '1px solid var(--input-border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)'
  },
  formTextarea: {
    width: '100%', minHeight: 200, padding: 10, fontSize: 13, lineHeight: 1.6,
    border: '1px solid var(--input-border)', borderRadius: 6, background: 'var(--surface)',
    color: 'var(--text)', fontFamily: 'inherit', resize: 'vertical' as const
  },
  previewBox: {
    padding: 16, borderRadius: 8, border: '1px solid var(--border-subtle)',
    background: 'var(--bg)', fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap' as const,
    maxHeight: 400, overflowY: 'auto' as const
  },
  previewSubject: { fontWeight: 600, marginBottom: 8, fontSize: 14 },
  placeholderHint: {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px',
    borderRadius: 9999, fontSize: 11, background: 'var(--table-header-bg)', color: 'var(--text-secondary)',
    marginBottom: 12
  },
  statusBadge: {
    display: 'inline-block', padding: '2px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 600
  },
  sendConfirm: {
    padding: 16, borderRadius: 8, border: '2px solid var(--accent)',
    background: 'rgba(153,27,27,0.04)', marginTop: 16
  },
  modalBackdrop: {
    position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
  },
  modal: {
    width: 500, maxWidth: 'calc(100vw - 24px)', background: 'var(--surface)',
    border: '1px solid var(--border)', borderRadius: 6, padding: 20
  },
  modalTitle: { fontSize: 14, fontWeight: 600, margin: '0 0 16px' },
  modalActions: { display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8, marginTop: 20 },
  emptyState: { textAlign: 'center' as const, padding: 48, color: 'var(--text-secondary)', fontSize: 13 },
  error: { color: 'var(--danger)', fontSize: 13, fontWeight: 600, margin: '8px 0' },
  success: { color: '#047857', fontSize: 13, fontWeight: 600, margin: '8px 0' },
  fileInput: {
    width: '100%', height: 36, fontSize: 13, color: 'var(--text)'
  },
  urlLink: { color: 'var(--accent)', textDecoration: 'none', fontSize: 12 }
};

export function ColdEmailPortal() {
  const [ready, setReady] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('recruiters');

  // Recruiter state
  const [recruiters, setRecruiters] = useState<Recruiter[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editRecruiter, setEditRecruiter] = useState<Recruiter | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);

  // Template state
  type SavedTemplate = { id: string; name: string; subject: string; body: string };
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [templatesSaving, setTemplatesSaving] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editingTemplateName, setEditingTemplateName] = useState('');
  const [editingTemplateSubject, setEditingTemplateSubject] = useState('');
  const [editingTemplateBody, setEditingTemplateBody] = useState('');

  // Compose state
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [emailBody, setEmailBody] = useState(DEFAULT_BODY);
  const [showPreview, setShowPreview] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);

  // History state
  const [logs, setLogs] = useState<EmailLog[]>([]);

  // Resume attachment
  const [resumeFile, setResumeFile] = useState<File | null>(null);

  // Email config
  const [configGmailEmail, setConfigGmailEmail] = useState('');
  const [configAppPassword, setConfigAppPassword] = useState('');
  const [configHasPassword, setConfigHasPassword] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);

  // Shared
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const resumeInputRef = useRef<HTMLInputElement>(null);

  // ── Auth ──
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUserEmail(data.session?.user.email ?? null);
      setReady(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUserEmail(session?.user.email ?? null);
      setReady(true);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('job-tracker-theme') as 'light' | 'dark' | null;
    if (stored) setTheme(stored);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : '');
    localStorage.setItem('job-tracker-theme', theme);
  }, [theme]);

  // ── Auth fetch ──
  const authFetch = useCallback(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!session?.access_token) throw new Error('Please sign in to continue.');
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${session.access_token}`);
    return fetch(input, { ...init, headers });
  }, []);

  // ── Fetch recruiters ──
  const fetchRecruiters = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/recruiters');
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed to fetch recruiters');
      setRecruiters((body.recruiters || []).map(mapRecruiter));
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  // ── Fetch email config ──
  const fetchEmailConfig = useCallback(async () => {
    try {
      const res = await authFetch('/api/email-config');
      const body = await res.json();
      if (res.ok && body.config) {
        setConfigGmailEmail(body.config.gmailEmail || '');
        setConfigHasPassword(body.config.hasAppPassword || false);
      }
    } catch {
      // Silently fail
    }
  }, [authFetch]);

  // ── Fetch templates ──
  const fetchTemplates = useCallback(async () => {
    try {
      const res = await authFetch('/api/email-templates');
      const body = await res.json();
      if (res.ok && body.templates) {
        setTemplates(body.templates.map((t: Record<string, string>) => ({
          id: t.id, name: t.name, subject: t.subject, body: t.body
        })));
      }
    } catch {
      // Silently fail
    }
  }, [authFetch]);

  // ── Fetch email logs ──
  const fetchLogs = useCallback(async () => {
    try {
      const res = await authFetch('/api/email-logs');
      const body = await res.json();
      if (res.ok && body.logs) {
        setLogs(body.logs);
      }
    } catch {
      // Silently fail
    }
  }, [authFetch]);

  useEffect(() => {
    if (userEmail) {
      fetchRecruiters();
      fetchEmailConfig();
      fetchTemplates();
      fetchLogs();
    }
  }, [userEmail, fetchRecruiters, fetchEmailConfig, fetchTemplates, fetchLogs]);

  useEffect(() => {
    if (statusMessage) {
      const timer = window.setTimeout(() => setStatusMessage(''), 3000);
      return () => window.clearTimeout(timer);
    }
  }, [statusMessage]);

  // ── Selection ──
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredRecruiters.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRecruiters.map((r) => r.id)));
    }
  };

  const filteredRecruiters = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    if (!needle) return recruiters;
    return recruiters.filter(
      (r) =>
        r.name.toLowerCase().includes(needle) ||
        r.email.toLowerCase().includes(needle) ||
        r.company.toLowerCase().includes(needle)
    );
  }, [recruiters, searchTerm]);

  // ── Add recruiter ──
  const handleAddRecruiter = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setErrorMessage('');

    try {
      const res = await authFetch('/api/recruiters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fd.get('name'),
          email: fd.get('email'),
          company: fd.get('company'),
          linkedinUrl: fd.get('linkedinUrl')
        })
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed to add recruiter');
      setStatusMessage('Recruiter added');
      setAddModalOpen(false);
      fetchRecruiters();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  // ── Edit recruiter ──
  const handleEditRecruiter = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editRecruiter) return;
    const form = e.currentTarget;
    const fd = new FormData(form);
    setErrorMessage('');

    try {
      const res = await authFetch(`/api/recruiters/${editRecruiter.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fd.get('name'),
          email: fd.get('email'),
          company: fd.get('company'),
          linkedinUrl: fd.get('linkedinUrl')
        })
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed to update recruiter');
      setStatusMessage('Recruiter updated');
      setEditRecruiter(null);
      fetchRecruiters();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  // ── Delete recruiter ──
  const handleDeleteRecruiter = async (id: string) => {
    try {
      const res = await authFetch(`/api/recruiters/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || 'Failed to delete');
      }
      setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
      fetchRecruiters();
      setStatusMessage('Recruiter deleted');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  // ── CSV Import ──
  const handleFileImport = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    setErrorMessage('');
    setLoading(true);

    try {
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws);

      const importRecruiters = rows.map((row) => ({
        name: row['Name'] || row['name'] || '',
        email: row['Email'] || row['email'] || '',
        company: row['Company'] || row['company'] || '',
        linkedinUrl: row['LinkedIn'] || row['linkedin'] || row['LinkedIn URL'] || ''
      })).filter((r) => r.name && r.email);

      if (importRecruiters.length === 0) {
        throw new Error('No valid recruiters found in file. Ensure columns: Name, Email, Company');
      }

      // Fill in missing company names (spreadsheet has empty company for subsequent rows at same company)
      let lastCompany = '';
      for (const r of importRecruiters) {
        if (r.company) {
          lastCompany = r.company;
        } else {
          r.company = lastCompany;
        }
      }

      const res = await authFetch('/api/recruiters/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recruiters: importRecruiters })
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Import failed');

      setStatusMessage(`Imported ${body.imported} recruiters`);
      setImportModalOpen(false);
      fetchRecruiters();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  // ── Save template ──
  const handleSaveTemplate = async () => {
    if (!templateName.trim()) { setErrorMessage('Enter a template name'); return; }
    setTemplatesSaving(true);
    setErrorMessage('');
    try {
      if (activeTemplateId) {
        // Update existing
        const res = await authFetch(`/api/email-templates/${activeTemplateId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: templateName, subject, body: emailBody })
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Failed to update');
        setStatusMessage('Template updated');
      } else {
        // Create new
        const res = await authFetch('/api/email-templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: templateName, subject, body: emailBody })
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || 'Failed to save');
        setActiveTemplateId(body.template.id);
        setStatusMessage('Template saved');
      }
      setSaveTemplateOpen(false);
      fetchTemplates();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setTemplatesSaving(false);
    }
  };

  // ── Load template ──
  const handleLoadTemplate = (t: SavedTemplate) => {
    setSubject(t.subject);
    setEmailBody(t.body);
    setActiveTemplateId(t.id);
    setTemplateName(t.name);
    setStatusMessage(`Loaded "${t.name}"`);
  };

  // ── Delete template ──
  const handleDeleteTemplate = async (id: string) => {
    try {
      const res = await authFetch(`/api/email-templates/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to delete');
      if (activeTemplateId === id) { setActiveTemplateId(null); setTemplateName(''); }
      fetchTemplates();
      setStatusMessage('Template deleted');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  // ── Update template from settings ──
  const handleUpdateTemplateFromSettings = async () => {
    if (!editingTemplateId || !editingTemplateName.trim()) return;
    setTemplatesSaving(true);
    setErrorMessage('');
    try {
      const res = await authFetch(`/api/email-templates/${editingTemplateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingTemplateName, subject: editingTemplateSubject, body: editingTemplateBody })
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to update');
      setStatusMessage('Template updated');
      setEditingTemplateId(null);
      fetchTemplates();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setTemplatesSaving(false);
    }
  };

  // ── Save email config ──
  const handleSaveConfig = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage('');
    setConfigSaving(true);
    try {
      const res = await authFetch('/api/email-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gmailEmail: configGmailEmail, gmailAppPassword: configAppPassword })
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed to save');
      setStatusMessage('Email settings saved');
      setConfigHasPassword(true);
      setConfigAppPassword('');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setConfigSaving(false);
    }
  };

  // ── Send emails ──
  const handleSendEmails = async () => {
    if (selectedIds.size === 0) {
      setErrorMessage('Select at least one recruiter');
      return;
    }
    setSending(true);
    setErrorMessage('');

    try {
      const formData = new FormData();
      formData.append('recruiterIds', JSON.stringify(Array.from(selectedIds)));
      formData.append('subject', subject);
      formData.append('emailBody', emailBody);
      if (resumeFile) {
        formData.append('resume', resumeFile);
      }

      const res = await authFetch('/api/send-emails', {
        method: 'POST',
        body: formData
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed to send emails');

      setStatusMessage(`Sent: ${body.sent}, Failed: ${body.failed}`);
      setConfirmSend(false);
      setSelectedIds(new Set());
      fetchLogs();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSending(false);
    }
  };

  // ── Preview recruiter (first selected or first in list) ──
  const previewRecruiter = useMemo(() => {
    if (selectedIds.size > 0) {
      const firstId = Array.from(selectedIds)[0];
      return recruiters.find((r) => r.id === firstId) || recruiters[0];
    }
    return recruiters[0];
  }, [selectedIds, recruiters]);

  if (!ready) {
    return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg)', color: 'var(--text)', fontSize: 15 }}>Loading...</div>;
  }

  if (!userEmail) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg)', color: 'var(--text)' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 15, marginBottom: 16 }}>Sign in to access the Cold Email Portal</p>
          <a href="/" style={s.btnPrimary}>Go to Sign In</a>
        </div>
      </div>
    );
  }

  return (
    <div style={s.shell}>
      {/* ── Top Bar ── */}
      <header style={s.topBar}>
        <div style={s.topBarLeft}>
          <Image src="/applyr-icon.svg" alt="Applyr logo" width={26} height={26} style={s.topBarIcon} />
          <h1 style={s.topBarTitle}>Cold Email Portal</h1>
        </div>
        <div style={s.topBarRight}>
          <a href="/" style={s.btnSecondary}>Dashboard</a>
          <a href="/profile" style={s.btnSecondary}>Resume Profile</a>
          <button type="button" className="icon-btn" style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'none', color: 'var(--text-secondary)', borderRadius: 6, cursor: 'pointer' }} onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))} aria-label="Toggle theme">
            {theme === 'light' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></svg>
            )}
          </button>
        </div>
      </header>

      {/* ── Tabs ── */}
      <div style={s.tabs}>
        {(['recruiters', 'compose', 'history', 'settings'] as Tab[]).map((t) => (
          <button key={t} type="button" style={{ ...s.tab, ...(tab === t ? s.tabActive : {}) }} onClick={() => setTab(t)}>
            {t === 'recruiters' ? `Recruiters (${recruiters.length})` : t === 'compose' ? `Compose${selectedIds.size > 0 ? ` (${selectedIds.size} selected)` : ''}` : t === 'history' ? 'Send History' : 'Settings'}
          </button>
        ))}
      </div>

      {errorMessage && <p style={s.error}>{errorMessage}</p>}
      {statusMessage && <p style={s.success}>{statusMessage}</p>}

      {/* ═══════ RECRUITERS TAB ═══════ */}
      {tab === 'recruiters' && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <input
              type="text"
              placeholder="Search recruiters..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ ...s.formInput, flex: '1 1 200px', maxWidth: 320 }}
            />
            <button type="button" style={s.btnPrimary} onClick={() => setAddModalOpen(true)}>+ Add Recruiter</button>
            <button type="button" style={s.btnSecondary} onClick={() => setImportModalOpen(true)}>Import XLSX/CSV</button>
            {selectedIds.size > 0 && (
              <button type="button" style={s.btnPrimary} onClick={() => { setTab('compose'); }}>
                Compose Email ({selectedIds.size})
              </button>
            )}
          </div>

          <div style={s.statsRow}>
            <span style={{ fontWeight: 500, color: 'var(--text)' }}>{filteredRecruiters.length}</span> recruiter{filteredRecruiters.length !== 1 ? 's' : ''}
            {selectedIds.size > 0 && <> &middot; <span style={{ fontWeight: 500, color: 'var(--accent)' }}>{selectedIds.size} selected</span></>}
          </div>

          <div style={s.tableWrap}>
            <table style={s.table}>
              <colgroup>
                <col style={{ width: 40 }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '22%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: 110 }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={s.th}>
                    <input type="checkbox" style={s.checkbox} checked={filteredRecruiters.length > 0 && selectedIds.size === filteredRecruiters.length} onChange={toggleSelectAll} />
                  </th>
                  <th style={s.th}>Name</th>
                  <th style={s.th}>Email</th>
                  <th style={s.th}>Company</th>
                  <th style={s.th}>LinkedIn</th>
                  <th style={s.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecruiters.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={s.emptyState}>
                      {loading ? 'Loading recruiters...' : 'No recruiters yet. Add one or import from a file.'}
                    </td>
                  </tr>
                ) : (
                  filteredRecruiters.map((r) => (
                    <tr key={r.id} style={{ background: selectedIds.has(r.id) ? 'var(--accent-muted)' : undefined }}>
                      <td style={s.td}>
                        <input type="checkbox" style={s.checkbox} checked={selectedIds.has(r.id)} onChange={() => toggleSelect(r.id)} />
                      </td>
                      <td style={s.td}>{r.name}</td>
                      <td style={{ ...s.td, ...s.tdMuted }}>{r.email}</td>
                      <td style={s.td}>{r.company}</td>
                      <td style={s.td}>
                        {r.linkedinUrl ? (
                          <a href={r.linkedinUrl} target="_blank" rel="noopener noreferrer" style={s.urlLink}>
                            Profile
                          </a>
                        ) : (
                          <span style={s.tdMuted}>—</span>
                        )}
                      </td>
                      <td style={s.td}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button type="button" style={{ ...s.btnSecondary, height: 28, fontSize: 12 }} onClick={() => setEditRecruiter(r)}>Edit</button>
                          <button type="button" style={s.btnDanger} onClick={() => handleDeleteRecruiter(r.id)}>Del</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ═══════ COMPOSE TAB ═══════ */}
      {tab === 'compose' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: showPreview ? '1fr 1fr' : '1fr', gap: 20 }}>
            {/* Editor */}
            <div>
              <div style={s.card}>
                <h3 style={s.sectionTitle}>Email Template</h3>

                {/* Template picker */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <select
                    style={{ ...s.formInput, flex: '1 1 200px', maxWidth: 280 }}
                    value={activeTemplateId || ''}
                    onChange={(e) => {
                      const id = e.target.value;
                      if (!id) { setSubject(DEFAULT_SUBJECT); setEmailBody(DEFAULT_BODY); setActiveTemplateId(null); setTemplateName(''); return; }
                      const t = templates.find((t) => t.id === id);
                      if (t) handleLoadTemplate(t);
                    }}
                  >
                    <option value="">Default Template</option>
                    {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Manage templates in Settings</span>
                </div>

                <div style={s.placeholderHint}>
                  Placeholders: {'{{firstName}}'} {'{{name}}'} {'{{company}}'} {'{{title}}'} {'{{email}}'}
                </div>

                <div style={s.formField}>
                  <label style={s.formLabel}>Subject</label>
                  <input
                    type="text"
                    style={s.formInput}
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </div>

                <div style={s.formField}>
                  <label style={s.formLabel}>Body</label>
                  <textarea
                    style={s.formTextarea}
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button type="button" style={s.btnPrimary} onClick={() => { setTemplateName(''); setSaveTemplateOpen(true); }}>
                    Save as New Template
                  </button>
                  <button type="button" style={s.btnSecondary} onClick={() => setShowPreview(!showPreview)}>
                    {showPreview ? 'Hide Preview' : 'Show Preview'}
                  </button>
                </div>

                {/* Save new template inline */}
                {saveTemplateOpen && (
                  <div style={{ marginTop: 12, padding: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)' }}>
                    <div style={s.formField}>
                      <label style={s.formLabel}>Template Name</label>
                      <input
                        type="text"
                        style={s.formInput}
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        placeholder="e.g. New Grad Outreach"
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" style={s.btnPrimary} onClick={() => { setActiveTemplateId(null); handleSaveTemplate(); }} disabled={templatesSaving}>
                        {templatesSaving ? 'Saving...' : 'Save'}
                      </button>
                      <button type="button" style={s.btnSecondary} onClick={() => setSaveTemplateOpen(false)}>Cancel</button>
                    </div>
                  </div>
                )}

                {/* Resume attachment */}
                <div style={{ marginTop: 16, padding: '12px 0', borderTop: '1px solid var(--border-subtle)' }}>
                  <label style={s.formLabel}>Attach Resume (PDF)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                    <input
                      ref={resumeInputRef}
                      type="file"
                      accept=".pdf"
                      style={{ display: 'none' }}
                      onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                    />
                    <button type="button" style={s.btnSecondary} onClick={() => resumeInputRef.current?.click()}>
                      {resumeFile ? 'Change File' : 'Choose File'}
                    </button>
                    {resumeFile ? (
                      <span style={{ fontSize: 13, color: 'var(--text)' }}>
                        {resumeFile.name}
                        <button
                          type="button"
                          onClick={() => { setResumeFile(null); if (resumeInputRef.current) resumeInputRef.current.value = ''; }}
                          style={{ marginLeft: 8, background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 12 }}
                        >
                          Remove
                        </button>
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>No file attached</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Send section */}
              <div style={s.card}>
                <h3 style={s.sectionTitle}>Send</h3>
                {selectedIds.size === 0 ? (
                  <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                    Go to the Recruiters tab and select who you want to email, then come back here.
                  </p>
                ) : (
                  <>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 12px' }}>
                      Ready to send to <strong style={{ color: 'var(--text)' }}>{selectedIds.size}</strong> recruiter{selectedIds.size !== 1 ? 's' : ''}.
                    </p>
                    {!confirmSend ? (
                      <button type="button" style={s.btnPrimary} onClick={() => setConfirmSend(true)}>
                        Review &amp; Send
                      </button>
                    ) : (
                      <div style={s.sendConfirm}>
                        <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600 }}>Confirm Send</p>
                        <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-secondary)' }}>
                          This will send {selectedIds.size} personalized email{selectedIds.size !== 1 ? 's' : ''}. This action cannot be undone.
                        </p>
                        <div style={{ display: 'flex', gap: 10 }}>
                          <button type="button" style={s.btnPrimary} onClick={handleSendEmails} disabled={sending}>
                            {sending ? 'Sending...' : `Send ${selectedIds.size} Email${selectedIds.size !== 1 ? 's' : ''}`}
                          </button>
                          <button type="button" style={s.btnSecondary} onClick={() => setConfirmSend(false)}>Cancel</button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Preview pane */}
            {showPreview && previewRecruiter && (
              <div>
                <div style={s.card}>
                  <h3 style={s.sectionTitle}>Preview (to: {previewRecruiter.name})</h3>
                  <div style={s.previewBox}>
                    <div style={s.previewSubject}>
                      Subject: {replacePlaceholders(subject, previewRecruiter)}
                    </div>
                    <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', margin: '8px 0' }} />
                    {replacePlaceholders(emailBody, previewRecruiter)}
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══════ HISTORY TAB ═══════ */}
      {tab === 'history' && (
        <>
          <div style={s.statsRow}>
            <span style={{ fontWeight: 500, color: 'var(--text)' }}>{logs.length}</span> email{logs.length !== 1 ? 's' : ''} sent
            {' '}&middot;{' '}
            <span style={{ color: '#047857' }}>{logs.filter((l) => l.status === 'sent').length} delivered</span>
            {' '}&middot;{' '}
            <span style={{ color: '#1D4ED8' }}>{logs.filter((l) => l.opened_at).length} opened</span>
            {' '}&middot;{' '}
            <span style={{ color: 'var(--danger)' }}>{logs.filter((l) => l.status === 'failed').length} failed</span>
          </div>
          {logs.length === 0 ? (
            <div style={s.card}>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, textAlign: 'center', padding: 24 }}>
                No emails sent yet. Select recruiters and compose an email to get started.
              </p>
            </div>
          ) : (
            <div style={s.tableWrap}>
              <table style={{ ...s.table, minWidth: 650 }}>
                <colgroup>
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '20%' }} />
                  <col style={{ width: '30%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '10%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th style={s.th}>Recruiter</th>
                    <th style={s.th}>Email</th>
                    <th style={s.th}>Subject</th>
                    <th style={s.th}>Company</th>
                    <th style={s.th}>Sent At</th>
                    <th style={s.th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td style={s.td}>{log.recruiters?.name || '—'}</td>
                      <td style={{ ...s.td, ...s.tdMuted }}>{log.recruiters?.email || '—'}</td>
                      <td style={{ ...s.td, ...s.tdMuted }}>{log.subject.length > 50 ? log.subject.slice(0, 50) + '...' : log.subject}</td>
                      <td style={s.td}>{log.recruiters?.company || '—'}</td>
                      <td style={{ ...s.td, ...s.tdMuted }}>{formatDate(log.sent_at)}</td>
                      <td style={s.td}>
                        {log.opened_at ? (
                          <>
                            <span style={{ ...s.statusBadge, backgroundColor: '#1D4ED8', color: '#fff' }}>
                              Opened
                            </span>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                              {formatDate(log.opened_at)}{log.open_count > 1 ? ` (${log.open_count}x)` : ''}
                            </div>
                          </>
                        ) : (
                          <span style={{
                            ...s.statusBadge,
                            backgroundColor: log.status === 'sent' ? '#047857' : 'var(--danger)',
                            color: '#fff'
                          }}>
                            {log.status === 'sent' ? 'Delivered' : log.status}
                          </span>
                        )}
                        {log.error_message && (
                          <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 2 }} title={log.error_message}>
                            {log.error_message.length > 30 ? log.error_message.slice(0, 30) + '...' : log.error_message}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ═══════ SETTINGS TAB ═══════ */}
      {tab === 'settings' && (
        <>
          {/* Gmail config */}
          <div style={s.card}>
            <h3 style={s.sectionTitle}>Gmail Configuration</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 16px', lineHeight: 1.6 }}>
              Configure your Gmail credentials to send emails from your own account. You need a <strong>Gmail App Password</strong> (not your regular password).
              Go to Google Account &rarr; Security &rarr; 2-Step Verification &rarr; App Passwords to generate one.
            </p>
            <form onSubmit={handleSaveConfig}>
              <div style={s.formField}>
                <label style={s.formLabel}>Gmail Email</label>
                <input
                  type="email"
                  style={s.formInput}
                  value={configGmailEmail}
                  onChange={(e) => setConfigGmailEmail(e.target.value)}
                  placeholder="you@gmail.com"
                  required
                />
              </div>
              <div style={s.formField}>
                <label style={s.formLabel}>
                  App Password {configHasPassword && <span style={{ color: '#047857', fontWeight: 400, textTransform: 'none' as const }}>(saved — enter new to update)</span>}
                </label>
                <input
                  type="password"
                  style={s.formInput}
                  value={configAppPassword}
                  onChange={(e) => setConfigAppPassword(e.target.value)}
                  placeholder={configHasPassword ? '••••••••••••••••' : 'xxxx xxxx xxxx xxxx'}
                  required={!configHasPassword}
                />
              </div>
              <button type="submit" className="btn-primary" style={s.btnPrimary} disabled={configSaving}>
                {configSaving ? 'Saving...' : 'Save Email Settings'}
              </button>
            </form>
          </div>

          {/* Template management */}
          <div style={s.card}>
            <h3 style={s.sectionTitle}>Email Templates</h3>
            {templates.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                No saved templates yet. Go to the Compose tab and click &quot;Save as New Template&quot; to create one.
              </p>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {templates.map((t) => (
                  <div key={t.id} style={{ padding: 14, borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg)' }}>
                    {editingTemplateId === t.id ? (
                      <>
                        <div style={s.formField}>
                          <label style={s.formLabel}>Name</label>
                          <input style={s.formInput} value={editingTemplateName} onChange={(e) => setEditingTemplateName(e.target.value)} />
                        </div>
                        <div style={s.formField}>
                          <label style={s.formLabel}>Subject</label>
                          <input style={s.formInput} value={editingTemplateSubject} onChange={(e) => setEditingTemplateSubject(e.target.value)} />
                        </div>
                        <div style={s.formField}>
                          <label style={s.formLabel}>Body</label>
                          <textarea style={{ ...s.formTextarea, minHeight: 150 }} value={editingTemplateBody} onChange={(e) => setEditingTemplateBody(e.target.value)} />
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button type="button" style={s.btnPrimary} onClick={handleUpdateTemplateFromSettings} disabled={templatesSaving}>
                            {templatesSaving ? 'Saving...' : 'Save Changes'}
                          </button>
                          <button type="button" style={s.btnSecondary} onClick={() => setEditingTemplateId(null)}>Cancel</button>
                        </div>
                      </>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{t.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Subject: {t.subject.length > 60 ? t.subject.slice(0, 60) + '...' : t.subject}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            type="button"
                            style={{ ...s.btnSecondary, height: 28, fontSize: 12 }}
                            onClick={() => {
                              setEditingTemplateId(t.id);
                              setEditingTemplateName(t.name);
                              setEditingTemplateSubject(t.subject);
                              setEditingTemplateBody(t.body);
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            style={{ ...s.btnDanger }}
                            onClick={() => { if (window.confirm(`Delete "${t.name}"?`)) handleDeleteTemplate(t.id); }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══════ ADD RECRUITER MODAL ═══════ */}
      {addModalOpen && (
        <div style={s.modalBackdrop} onClick={() => setAddModalOpen(false)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={s.modalTitle}>Add Recruiter</h3>
            <form onSubmit={handleAddRecruiter}>
              <div style={s.formField}>
                <label style={s.formLabel}>Name *</label>
                <input name="name" required style={s.formInput} />
              </div>
              <div style={s.formField}>
                <label style={s.formLabel}>Email *</label>
                <input name="email" type="email" required style={s.formInput} />
              </div>
              <div style={s.formField}>
                <label style={s.formLabel}>Company</label>
                <input name="company" style={s.formInput} />
              </div>
              <div style={s.formField}>
                <label style={s.formLabel}>LinkedIn URL</label>
                <input name="linkedinUrl" style={s.formInput} />
              </div>
              <div style={s.modalActions}>
                <button type="button" style={{ ...s.btnSecondary, background: 'none', border: 'none', color: 'var(--text-secondary)' }} onClick={() => setAddModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary" style={s.btnPrimary}>Add</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════ EDIT RECRUITER MODAL ═══════ */}
      {editRecruiter && (
        <div style={s.modalBackdrop} onClick={() => setEditRecruiter(null)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={s.modalTitle}>Edit Recruiter</h3>
            <form onSubmit={handleEditRecruiter}>
              <div style={s.formField}>
                <label style={s.formLabel}>Name *</label>
                <input name="name" required style={s.formInput} defaultValue={editRecruiter.name} />
              </div>
              <div style={s.formField}>
                <label style={s.formLabel}>Email *</label>
                <input name="email" type="email" required style={s.formInput} defaultValue={editRecruiter.email} />
              </div>
              <div style={s.formField}>
                <label style={s.formLabel}>Company</label>
                <input name="company" style={s.formInput} defaultValue={editRecruiter.company} />
              </div>
              <div style={s.formField}>
                <label style={s.formLabel}>LinkedIn URL</label>
                <input name="linkedinUrl" style={s.formInput} defaultValue={editRecruiter.linkedinUrl} />
              </div>
              <div style={s.modalActions}>
                <button type="button" style={{ ...s.btnSecondary, background: 'none', border: 'none', color: 'var(--text-secondary)' }} onClick={() => setEditRecruiter(null)}>Cancel</button>
                <button type="submit" className="btn-primary" style={s.btnPrimary}>Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════ IMPORT MODAL ═══════ */}
      {importModalOpen && (
        <div style={s.modalBackdrop} onClick={() => setImportModalOpen(false)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={s.modalTitle}>Import Recruiters</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 16px', lineHeight: 1.6 }}>
              Upload an XLSX or CSV file with columns: <strong>Name</strong>, <strong>Email</strong>, <strong>Company</strong>, <strong>LinkedIn</strong>.
              Duplicates (same email) will be skipped.
            </p>
            <div style={s.formField}>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" style={s.fileInput} />
            </div>
            <div style={s.modalActions}>
              <button type="button" style={{ ...s.btnSecondary, background: 'none', border: 'none', color: 'var(--text-secondary)' }} onClick={() => setImportModalOpen(false)}>Cancel</button>
              <button type="button" className="btn-primary" style={s.btnPrimary} onClick={handleFileImport} disabled={loading}>
                {loading ? 'Importing...' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
