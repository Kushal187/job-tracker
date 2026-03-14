'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

/* ── types ───────────────────────────────────────────────────────────── */

const FACT_TYPES = ['experience', 'project', 'education', 'skill', 'award', 'summary', 'other'] as const;
type FactType = (typeof FACT_TYPES)[number];

/* Structured data stored in source_section as JSON */
type ExperienceFields = { company: string; title: string; location: string; startDate: string; endDate: string; current: boolean; description: string };
type ProjectFields = { name: string; technologies: string; date: string; description: string };
type EducationFields = { school: string; degree: string; field: string; startDate: string; endDate: string; gpa: string; details: string };
type SkillFields = { category: string; skills: string };
type AwardFields = { title: string; issuer: string; date: string; description: string };

type StructuredFields = ExperienceFields | ProjectFields | EducationFields | SkillFields | AwardFields | null;

type Fact = {
  fact_type: FactType;
  source_section: string;
  raw_text: string;
  normalized_keywords: string[];
  priority: number;
  active: boolean;
  _fields?: StructuredFields;
  _collapsed?: boolean;
};

type Profile = {
  id: number;
  name: string;
  location: string;
  headline: string;
  facts: Fact[];
  resume_tex: string;
  updated_at: string;
};

/* ── helpers ─────────────────────────────────────────────────────────── */

const RESUME_API_URL =
  typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_RESUME_API_URL || 'http://localhost:8000').replace(/\/+$/, '')
    : '';

const supabase = getSupabaseBrowserClient();

function defaultExperience(): ExperienceFields {
  return { company: '', title: '', location: '', startDate: '', endDate: '', current: false, description: '' };
}
function defaultProject(): ProjectFields {
  return { name: '', technologies: '', date: '', description: '' };
}
function defaultEducation(): EducationFields {
  return { school: '', degree: '', field: '', startDate: '', endDate: '', gpa: '', details: '' };
}
function defaultSkill(): SkillFields {
  return { category: '', skills: '' };
}
function defaultAward(): AwardFields {
  return { title: '', issuer: '', date: '', description: '' };
}

/* Convert YYYY-MM to "Mon YYYY" for display in raw_text */
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function monthValueToDisplay(v: string): string {
  if (!v) return '';
  const m = v.match(/^(\d{4})-(\d{2})$/);
  if (m) return `${MONTH_NAMES[parseInt(m[2], 10) - 1]} ${m[1]}`;
  return v; // already in display format or freetext
}

/* Convert "Mon YYYY" back to YYYY-MM for <input type="month"> */
function displayToMonthValue(v: string): string {
  if (!v) return '';
  if (/^\d{4}-\d{2}$/.test(v)) return v; // already YYYY-MM
  const m = v.match(/^(\w+)\s+(\d{4})$/);
  if (m) {
    const idx = MONTH_NAMES.indexOf(m[1]);
    if (idx >= 0) return `${m[2]}-${String(idx + 1).padStart(2, '0')}`;
  }
  return ''; // can't parse, reset
}

/* Auto-bullet: prefix each non-empty line with "• " for raw_text */
function bulletize(text: string): string {
  if (!text.trim()) return '';
  return text.split('\n').filter(l => l.trim()).map(l => {
    const trimmed = l.replace(/^[\s•\-\*]+/, '').trim();
    return trimmed ? `• ${trimmed}` : '';
  }).filter(Boolean).join('\n');
}

function defaultFieldsFor(type: FactType): StructuredFields {
  switch (type) {
    case 'experience': return defaultExperience();
    case 'project': return defaultProject();
    case 'education': return defaultEducation();
    case 'skill': return defaultSkill();
    case 'award': return defaultAward();
    default: return null;
  }
}

function emptyFact(type: FactType): Fact {
  return { fact_type: type, source_section: '', raw_text: '', normalized_keywords: [], priority: 50, active: true, _fields: defaultFieldsFor(type), _collapsed: false };
}

/* Compose raw_text from structured fields so the AI can read it */
function composeRawText(type: FactType, fields: StructuredFields, fallback: string): string {
  if (!fields) return fallback;
  switch (type) {
    case 'experience': {
      const f = fields as ExperienceFields;
      const header = [f.title, f.company, f.location].filter(Boolean).join(' | ');
      const sd = monthValueToDisplay(f.startDate);
      const ed = f.current ? 'Present' : monthValueToDisplay(f.endDate);
      const dates = [sd, ed].filter(Boolean).join(' – ');
      return [header, dates, bulletize(f.description)].filter(Boolean).join('\n');
    }
    case 'project': {
      const f = fields as ProjectFields;
      const header = [f.name, f.technologies].filter(Boolean).join(' | ');
      const date = monthValueToDisplay(f.date);
      return [header, date, bulletize(f.description)].filter(Boolean).join('\n');
    }
    case 'education': {
      const f = fields as EducationFields;
      const degree = [f.degree, f.field].filter(Boolean).join(' in ');
      const header = [f.school, degree].filter(Boolean).join(' | ');
      const sd = monthValueToDisplay(f.startDate);
      const ed = monthValueToDisplay(f.endDate);
      const dates = [sd, ed].filter(Boolean).join(' – ');
      const gpa = f.gpa ? `GPA: ${f.gpa}` : '';
      return [header, dates, gpa, f.details].filter(Boolean).join('\n');
    }
    case 'skill': {
      const f = fields as SkillFields;
      return f.category ? `${f.category}: ${f.skills}` : f.skills;
    }
    case 'award': {
      const f = fields as AwardFields;
      const header = [f.title, f.issuer, f.date].filter(Boolean).join(' | ');
      return [header, f.description].filter(Boolean).join('\n');
    }
    default:
      return fallback;
  }
}

/* Try to parse source_section JSON back into structured fields */
function parseFields(type: FactType, sourceSection: string): StructuredFields {
  if (!sourceSection) return null;
  try {
    const parsed = JSON.parse(sourceSection);
    if (typeof parsed === 'object' && parsed !== null) return parsed;
  } catch { /* not JSON, ignore */ }
  return null;
}

/* Hydrate _fields on facts loaded from API, converting dates to YYYY-MM */
function hydrateFact(fact: Fact): Fact {
  const fields = parseFields(fact.fact_type, fact.source_section) ?? defaultFieldsFor(fact.fact_type);
  if (fields && 'startDate' in fields) {
    (fields as any).startDate = displayToMonthValue((fields as any).startDate) || (fields as any).startDate;
    if ('endDate' in fields) (fields as any).endDate = displayToMonthValue((fields as any).endDate) || (fields as any).endDate;
  }
  if (fields && 'date' in fields && fact.fact_type === 'project') {
    (fields as any).date = displayToMonthValue((fields as any).date) || (fields as any).date;
  }
  return { ...fact, _fields: fields, _collapsed: true };
}

/* Prepare fact for API (strip client-only fields, compose raw_text) */
function serializeFact(fact: Fact): Omit<Fact, '_fields' | '_collapsed'> {
  const raw = fact._fields ? composeRawText(fact.fact_type, fact._fields, fact.raw_text) : fact.raw_text;
  const src = fact._fields ? JSON.stringify(fact._fields) : fact.source_section;
  return {
    fact_type: fact.fact_type,
    source_section: src,
    raw_text: raw || ' ', // min 2 chars on backend, but space prevents empty
    normalized_keywords: fact.normalized_keywords,
    priority: fact.priority,
    active: fact.active,
  };
}

/* ── section config ──────────────────────────────────────────────────── */

const SECTIONS: { type: FactType; label: string; singular: string }[] = [
  { type: 'experience', label: 'Experience', singular: 'Experience' },
  { type: 'project', label: 'Projects', singular: 'Project' },
  { type: 'education', label: 'Education', singular: 'Education' },
  { type: 'skill', label: 'Skills', singular: 'Skill Category' },
  { type: 'award', label: 'Awards & Certifications', singular: 'Award' },
  { type: 'summary', label: 'Professional Summary', singular: 'Summary' },
  { type: 'other', label: 'Other', singular: 'Item' },
];

/* ── styles ──────────────────────────────────────────────────────────── */

const s: Record<string, React.CSSProperties> = {
  shell: { maxWidth: 900, margin: '0 auto', padding: '24px 16px', minHeight: '100vh' },
  topBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', rowGap: 12, minHeight: 56, borderBottom: '1px solid var(--border-subtle)', marginBottom: 24, paddingBottom: 12 },
  topBarLeft: { display: 'flex', alignItems: 'center', gap: 8 },
  topBarTitle: { fontSize: 18, fontWeight: 600, margin: 0, letterSpacing: '-0.01em' },
  topBarRight: { display: 'flex', alignItems: 'center', gap: 12 },
  btnSecondary: { height: 32, padding: '0 10px', display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)', fontSize: 13, fontWeight: 500, textDecoration: 'none', cursor: 'pointer' },
  btnPrimary: { height: 34, padding: '0 14px', display: 'flex', alignItems: 'center', gap: 6, border: 'none', borderRadius: 6, background: 'var(--accent)', color: 'white', fontSize: 13, fontWeight: 500, cursor: 'pointer' },
  btnDanger: { height: 28, padding: '0 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'none', color: 'var(--danger)', fontSize: 12, cursor: 'pointer' },
  btnSmall: { height: 28, padding: '0 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)', fontSize: 12, fontWeight: 500, cursor: 'pointer' },
  card: { border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)', padding: 16, marginBottom: 20 },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { margin: 0, fontSize: 15, fontWeight: 600 },
  sectionCount: { fontSize: 12, color: 'var(--text-secondary)', fontWeight: 400, marginLeft: 6 },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 },
  fieldGroupInline: { display: 'flex', flexDirection: 'column', gap: 4 },
  label: { fontSize: 11, fontWeight: 500, textTransform: 'uppercase' as const, letterSpacing: '0.05em', color: 'var(--text-secondary)' },
  input: { width: '100%', height: 36, padding: '0 10px', fontSize: 13, border: '1px solid var(--input-border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box' as const },
  textarea: { width: '100%', minHeight: 72, padding: '8px 10px', fontSize: 13, border: '1px solid var(--input-border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', resize: 'vertical' as const, fontFamily: 'inherit', lineHeight: 1.5, boxSizing: 'border-box' as const },
  itemCard: { border: '1px solid var(--border-subtle)', borderRadius: 10, background: 'var(--bg)', padding: 14, marginBottom: 10 },
  itemHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' as const },
  itemTitle: { fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: 0 },
  itemSubtitle: { fontSize: 12, color: 'var(--text-secondary)', margin: 0 },
  itemBody: { marginTop: 12 },
  itemFooter: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border-subtle)' },
  checkboxRow: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 },
  btnSave: { height: 28, padding: '0 12px', border: 'none', borderRadius: 6, background: 'var(--accent)', color: 'white', fontSize: 12, fontWeight: 500, cursor: 'pointer' },
  helperText: { fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 },
  error: { margin: '0 0 12px', padding: '10px 14px', borderRadius: 8, background: 'rgba(220,38,38,0.08)', color: 'var(--danger)', fontSize: 13, fontWeight: 600 },
  success: { margin: '0 0 12px', padding: '10px 14px', borderRadius: 8, background: 'rgba(4,120,87,0.08)', color: '#047857', fontSize: 13, fontWeight: 600 },
  uploadRow: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' as const },
  loading: { minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg)', color: 'var(--text)', fontSize: 15 },
  chevron: { fontSize: 12, color: 'var(--text-secondary)', transition: 'transform 0.15s', flexShrink: 0 },
};

/* ── sub-components ──────────────────────────────────────────────────── */

function ExperienceForm({ fields, onChange }: { fields: ExperienceFields; onChange: (f: ExperienceFields) => void }) {
  const set = (patch: Partial<ExperienceFields>) => onChange({ ...fields, ...patch });
  return (
    <>
      <div style={s.grid2}>
        <div style={s.fieldGroupInline}>
          <label style={s.label}>Job Title</label>
          <input style={s.input} value={fields.title} onChange={e => set({ title: e.target.value })} placeholder="Software Engineer" />
        </div>
        <div style={s.fieldGroupInline}>
          <label style={s.label}>Company</label>
          <input style={s.input} value={fields.company} onChange={e => set({ company: e.target.value })} placeholder="Google" />
        </div>
      </div>
      <div style={{ ...s.grid3, marginTop: 10 }}>
        <div style={s.fieldGroupInline}>
          <label style={s.label}>Location</label>
          <input style={s.input} value={fields.location} onChange={e => set({ location: e.target.value })} placeholder="Mountain View, CA" />
        </div>
        <div style={s.fieldGroupInline}>
          <label style={s.label}>Start Date</label>
          <input type="month" style={s.input} value={fields.startDate} onChange={e => set({ startDate: e.target.value })} />
        </div>
        <div style={s.fieldGroupInline}>
          <label style={s.label}>End Date</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {fields.current ? (
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', height: 36, display: 'flex', alignItems: 'center' }}>Present</span>
            ) : (
              <input type="month" style={s.input} value={fields.endDate} onChange={e => set({ endDate: e.target.value })} />
            )}
            <label style={{ ...s.checkboxRow, whiteSpace: 'nowrap', fontSize: 12 }}>
              <input type="checkbox" checked={fields.current} onChange={e => set({ current: e.target.checked, endDate: '' })} />
              Current
            </label>
          </div>
        </div>
      </div>
      <div style={{ ...s.fieldGroup, marginTop: 10 }}>
        <label style={s.label}>Description (one point per line)</label>
        <textarea style={{ ...s.textarea, minHeight: 90 }} value={fields.description} onChange={e => set({ description: e.target.value })} placeholder={"Designed and implemented microservices architecture\nReduced API latency by 40% through caching strategies\nMentored 3 junior engineers on best practices"} />
      </div>
    </>
  );
}

function ProjectForm({ fields, onChange }: { fields: ProjectFields; onChange: (f: ProjectFields) => void }) {
  const set = (patch: Partial<ProjectFields>) => onChange({ ...fields, ...patch });
  return (
    <>
      <div style={s.grid2}>
        <div style={s.fieldGroupInline}>
          <label style={s.label}>Project Name</label>
          <input style={s.input} value={fields.name} onChange={e => set({ name: e.target.value })} placeholder="Job Tracker App" />
        </div>
        <div style={s.fieldGroupInline}>
          <label style={s.label}>Technologies</label>
          <input style={s.input} value={fields.technologies} onChange={e => set({ technologies: e.target.value })} placeholder="Next.js, Supabase, TypeScript" />
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        <div style={s.fieldGroupInline}>
          <label style={s.label}>Date</label>
          <input type="month" style={{ ...s.input, maxWidth: 200 }} value={fields.date} onChange={e => set({ date: e.target.value })} />
        </div>
      </div>
      <div style={{ ...s.fieldGroup, marginTop: 10 }}>
        <label style={s.label}>Description (one point per line)</label>
        <textarea style={{ ...s.textarea, minHeight: 90 }} value={fields.description} onChange={e => set({ description: e.target.value })} placeholder="Built a full-stack web app with Next.js and Supabase&#10;Implemented real-time notifications using WebSockets&#10;Deployed to Vercel with CI/CD pipeline" />
      </div>
    </>
  );
}

function EducationForm({ fields, onChange }: { fields: EducationFields; onChange: (f: EducationFields) => void }) {
  const set = (patch: Partial<EducationFields>) => onChange({ ...fields, ...patch });
  return (
    <>
      <div style={s.grid2}>
        <div style={s.fieldGroupInline}>
          <label style={s.label}>School</label>
          <input style={s.input} value={fields.school} onChange={e => set({ school: e.target.value })} placeholder="Massachusetts Institute of Technology" />
        </div>
        <div style={s.fieldGroupInline}>
          <label style={s.label}>Degree</label>
          <input style={s.input} value={fields.degree} onChange={e => set({ degree: e.target.value })} placeholder="Bachelor of Science" />
        </div>
      </div>
      <div style={{ ...s.grid3, marginTop: 10 }}>
        <div style={s.fieldGroupInline}>
          <label style={s.label}>Field of Study</label>
          <input style={s.input} value={fields.field} onChange={e => set({ field: e.target.value })} placeholder="Computer Science" />
        </div>
        <div style={s.fieldGroupInline}>
          <label style={s.label}>Start Date</label>
          <input type="month" style={s.input} value={fields.startDate} onChange={e => set({ startDate: e.target.value })} />
        </div>
        <div style={s.fieldGroupInline}>
          <label style={s.label}>End Date</label>
          <input type="month" style={s.input} value={fields.endDate} onChange={e => set({ endDate: e.target.value })} />
        </div>
      </div>
      <div style={{ ...s.grid2, marginTop: 10 }}>
        <div style={s.fieldGroupInline}>
          <label style={s.label}>GPA (optional)</label>
          <input style={s.input} value={fields.gpa} onChange={e => set({ gpa: e.target.value })} placeholder="3.8/4.0" />
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        <div style={s.fieldGroupInline}>
          <label style={s.label}>Additional Details (coursework, honors, etc.)</label>
          <textarea style={s.textarea} value={fields.details} onChange={e => set({ details: e.target.value })} placeholder="Relevant coursework: Algorithms, Distributed Systems, Machine Learning..." rows={2} />
        </div>
      </div>
    </>
  );
}

function SkillForm({ fields, onChange }: { fields: SkillFields; onChange: (f: SkillFields) => void }) {
  const set = (patch: Partial<SkillFields>) => onChange({ ...fields, ...patch });
  return (
    <div style={s.grid2}>
      <div style={s.fieldGroupInline}>
        <label style={s.label}>Category</label>
        <input style={s.input} value={fields.category} onChange={e => set({ category: e.target.value })} placeholder="Languages, Frameworks, Tools, etc." />
      </div>
      <div style={s.fieldGroupInline}>
        <label style={s.label}>Skills (comma-separated)</label>
        <input style={s.input} value={fields.skills} onChange={e => set({ skills: e.target.value })} placeholder="Python, TypeScript, React, AWS..." />
      </div>
    </div>
  );
}

function AwardForm({ fields, onChange }: { fields: AwardFields; onChange: (f: AwardFields) => void }) {
  const set = (patch: Partial<AwardFields>) => onChange({ ...fields, ...patch });
  return (
    <>
      <div style={s.grid3}>
        <div style={s.fieldGroupInline}>
          <label style={s.label}>Title</label>
          <input style={s.input} value={fields.title} onChange={e => set({ title: e.target.value })} placeholder="Dean's List" />
        </div>
        <div style={s.fieldGroupInline}>
          <label style={s.label}>Issuer</label>
          <input style={s.input} value={fields.issuer} onChange={e => set({ issuer: e.target.value })} placeholder="MIT" />
        </div>
        <div style={s.fieldGroupInline}>
          <label style={s.label}>Date</label>
          <input style={s.input} value={fields.date} onChange={e => set({ date: e.target.value })} placeholder="2024" />
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        <div style={s.fieldGroupInline}>
          <label style={s.label}>Description (optional)</label>
          <textarea style={s.textarea} value={fields.description} onChange={e => set({ description: e.target.value })} placeholder="Additional details..." rows={2} />
        </div>
      </div>
    </>
  );
}

/* Summary label for collapsed items */
function itemSummary(type: FactType, fields: StructuredFields, rawText: string): { title: string; subtitle: string } {
  if (!fields) return { title: rawText.slice(0, 60) || 'New item', subtitle: '' };
  switch (type) {
    case 'experience': {
      const f = fields as ExperienceFields;
      const sd = monthValueToDisplay(f.startDate);
      const ed = f.current ? 'Present' : monthValueToDisplay(f.endDate);
      const dates = [sd, ed].filter(Boolean).join(' – ');
      return { title: f.title || 'New Experience', subtitle: [f.company, dates].filter(Boolean).join(' · ') };
    }
    case 'project': {
      const f = fields as ProjectFields;
      return { title: f.name || 'New Project', subtitle: [f.technologies, monthValueToDisplay(f.date)].filter(Boolean).join(' · ') };
    }
    case 'education': {
      const f = fields as EducationFields;
      const deg = [f.degree, f.field].filter(Boolean).join(' in ');
      return { title: f.school || 'New Education', subtitle: [deg, f.gpa ? `GPA: ${f.gpa}` : ''].filter(Boolean).join(' · ') };
    }
    case 'skill': {
      const f = fields as SkillFields;
      return { title: f.category || 'Skills', subtitle: f.skills.slice(0, 80) };
    }
    case 'award': {
      const f = fields as AwardFields;
      return { title: f.title || 'New Award', subtitle: [f.issuer, f.date].filter(Boolean).join(' · ') };
    }
    default:
      return { title: rawText.slice(0, 60) || 'New item', subtitle: '' };
  }
}

/* ── main component ──────────────────────────────────────────────────── */

export function ProfileManager() {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [headline, setHeadline] = useState('');
  const [facts, setFacts] = useState<Fact[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [hasTexTemplate, setHasTexTemplate] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getToken = useCallback(async (): Promise<string | null> => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }, []);

  const fetchProfile = useCallback(async () => {
    const token = await getToken();
    if (!token) { window.location.href = '/'; return; }
    try {
      const res = await fetch(`${RESUME_API_URL}/api/profile`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 404) { setProfile(null); setReady(true); return; }
      if (!res.ok) throw new Error('Failed to fetch profile');
      const body = await res.json();
      const p: Profile = body.profile;
      setProfile(p);
      setName(p.name);
      setLocation(p.location);
      setHeadline(p.headline);
      setFacts(p.facts.map(hydrateFact));
      setHasTexTemplate(!!p.resume_tex);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setReady(true);
    }
  }, [getToken]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  async function handleSave() {
    setErrorMessage('');
    setSuccessMessage('');
    setSaving(true);
    const token = await getToken();
    if (!token) { window.location.href = '/'; return; }
    try {
      const payload = {
        ...(profile?.id ? { profile_id: profile.id } : {}),
        name,
        location,
        headline,
        facts: facts.map(serializeFact),
      };
      const res = await fetch(`${RESUME_API_URL}/api/profile/upsert`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || body.detail || 'Save failed');
      }
      const body = await res.json();
      setProfile(body.profile);
      setFacts(body.profile.facts.map(hydrateFact));
      setSuccessMessage('Profile saved');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleUploadTex(file: File) {
    if (!profile?.id) { setErrorMessage('Save your profile first before uploading a template.'); return; }
    setUploading(true);
    setErrorMessage('');
    setSuccessMessage('');
    const token = await getToken();
    if (!token) return;
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${RESUME_API_URL}/api/profile/upload-tex?profile_id=${profile.id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Upload failed');
      }
      setHasTexTemplate(true);
      setSuccessMessage('Template uploaded');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  function updateFact(index: number, patch: Partial<Fact>) {
    setFacts(prev => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  function updateFactFields(index: number, newFields: StructuredFields) {
    setFacts(prev => prev.map((f, i) => (i === index ? { ...f, _fields: newFields } : f)));
  }

  function removeFact(index: number) {
    setFacts(prev => prev.filter((_, i) => i !== index));
  }

  function addFact(type: FactType) {
    setFacts(prev => [...prev, emptyFact(type)]);
  }

  function toggleCollapse(index: number) {
    setFacts(prev => prev.map((f, i) => (i === index ? { ...f, _collapsed: !f._collapsed } : f)));
  }

  /* Filtered facts per section */
  function factsOfType(type: FactType) {
    return facts.map((f, i) => ({ fact: f, index: i })).filter(({ fact }) => fact.fact_type === type);
  }

  if (!ready) return <div style={s.loading}>Loading profile...</div>;

  return (
    <div style={s.shell}>
      {/* ── Top Bar ─────────────────────────────────── */}
      <header style={s.topBar}>
        <div style={s.topBarLeft}>
          <h1 style={s.topBarTitle}>Resume Profile</h1>
        </div>
        <div style={s.topBarRight}>
          <a href="/" style={s.btnSecondary}>Back to Dashboard</a>
          <button type="button" style={s.btnPrimary} onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </header>

      {errorMessage && <div style={s.error}>{errorMessage}</div>}
      {successMessage && <div style={s.success}>{successMessage}</div>}

      {/* ── Personal Info ──────────────────────────── */}
      <div style={s.card}>
        <h2 style={{ ...s.sectionTitle, marginBottom: 14 }}>Personal Info</h2>
        <div style={s.grid3}>
          <div style={s.fieldGroupInline}>
            <label style={s.label}>Full Name *</label>
            <input style={s.input} value={name} onChange={e => setName(e.target.value)} placeholder="John Doe" />
          </div>
          <div style={s.fieldGroupInline}>
            <label style={s.label}>Location</label>
            <input style={s.input} value={location} onChange={e => setLocation(e.target.value)} placeholder="Boston, MA" />
          </div>
          <div style={s.fieldGroupInline}>
            <label style={s.label}>Headline</label>
            <input style={s.input} value={headline} onChange={e => setHeadline(e.target.value)} placeholder="Software Engineer | CS @ MIT" maxLength={180} />
          </div>
        </div>
      </div>

      {/* ── Sections ───────────────────────────────── */}
      {SECTIONS.map(({ type, label, singular }) => {
        const items = factsOfType(type);
        const isTextOnly = type === 'summary' || type === 'other';

        return (
          <div key={type} style={s.card}>
            <div style={s.sectionHeader}>
              <h2 style={s.sectionTitle}>
                {label}
                {items.length > 0 && <span style={s.sectionCount}>({items.length})</span>}
              </h2>
              <button type="button" style={s.btnSmall} onClick={() => addFact(type)}>
                + Add {singular}
              </button>
            </div>

            {items.length === 0 && (
              <p style={s.helperText}>
                No {label.toLowerCase()} added yet. Click &quot;+ Add {singular}&quot; to get started.
              </p>
            )}

            {items.map(({ fact, index }) => {
              const summary = itemSummary(type, fact._fields ?? null, fact.raw_text);
              const collapsed = fact._collapsed;

              return (
                <div key={index} style={s.itemCard}>
                  {/* Collapsed header */}
                  <div style={s.itemHeader} onClick={() => toggleCollapse(index)}>
                    <div>
                      <p style={s.itemTitle}>{summary.title}</p>
                      {summary.subtitle && <p style={s.itemSubtitle}>{summary.subtitle}</p>}
                    </div>
                    <span style={{ ...s.chevron, transform: collapsed ? 'rotate(0deg)' : 'rotate(90deg)' }}>&#9654;</span>
                  </div>

                  {/* Expanded body */}
                  {!collapsed && (
                    <div style={s.itemBody}>
                      {/* Type-specific form */}
                      {type === 'experience' && fact._fields && (
                        <ExperienceForm fields={fact._fields as ExperienceFields} onChange={f => updateFactFields(index, f)} />
                      )}
                      {type === 'project' && fact._fields && (
                        <ProjectForm fields={fact._fields as ProjectFields} onChange={f => updateFactFields(index, f)} />
                      )}
                      {type === 'education' && fact._fields && (
                        <EducationForm fields={fact._fields as EducationFields} onChange={f => updateFactFields(index, f)} />
                      )}
                      {type === 'skill' && fact._fields && (
                        <SkillForm fields={fact._fields as SkillFields} onChange={f => updateFactFields(index, f)} />
                      )}
                      {type === 'award' && fact._fields && (
                        <AwardForm fields={fact._fields as AwardFields} onChange={f => updateFactFields(index, f)} />
                      )}
                      {isTextOnly && (
                        <div style={s.fieldGroup}>
                          <label style={s.label}>{type === 'summary' ? 'Professional Summary' : 'Description'}</label>
                          <textarea
                            style={{ ...s.textarea, minHeight: type === 'summary' ? 100 : 72 }}
                            value={fact.raw_text}
                            onChange={e => updateFact(index, { raw_text: e.target.value })}
                            placeholder={type === 'summary' ? 'Write a brief professional summary highlighting your key strengths...' : 'Describe this item...'}
                            maxLength={1200}
                          />
                        </div>
                      )}

                      {/* Footer controls */}
                      <div style={s.itemFooter}>
                        <button type="button" style={s.btnDanger} onClick={() => removeFact(index)}>Remove</button>
                        <button type="button" style={s.btnSave} onClick={handleSave} disabled={saving}>
                          {saving ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

      {/* ── LaTeX Template ─────────────────────────── */}
      <div style={s.card}>
        <h2 style={{ ...s.sectionTitle, marginBottom: 8 }}>LaTeX Template</h2>
        <p style={{ ...s.helperText, marginBottom: 12 }}>
          Upload your own .tex resume template. The AI will inject tailored content into it for each job.
        </p>
        <div style={s.uploadRow}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".tex"
            style={{ display: 'none' }}
            onChange={e => { const file = e.target.files?.[0]; if (file) handleUploadTex(file); }}
          />
          <button type="button" style={s.btnSecondary} onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? 'Uploading...' : 'Upload .tex'}
          </button>
          {hasTexTemplate ? (
            <span style={{ fontSize: 12, color: '#047857', fontWeight: 600 }}>Custom template uploaded</span>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>No template uploaded (default will be used)</span>
          )}
        </div>
      </div>

      {/* Bottom save button for long pages */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingBottom: 40 }}>
        <button type="button" style={s.btnPrimary} onClick={handleSave} disabled={saving || !name.trim()}>
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </div>
    </div>
  );
}
