'use client';

import Image from 'next/image';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { Dashboard } from './dashboard';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

const supabase = getSupabaseBrowserClient();

const EXTENSION_URL =
  'https://chromewebstore.google.com/detail/applyr-capture/kojjciphijmjfjnobnnnbnhdiopleaon';

/* ─── Scroll-reveal hook ──────────────────────────────── */
/* Noop hooks/helpers — animated demos handle their own animations */
function useInView() {
  const ref = useRef<any>(null);             // eslint-disable-line @typescript-eslint/no-explicit-any
  return { ref, visible: true };
}

function reveal(_visible: boolean, _delay = 0): React.CSSProperties {
  return {};
}

/* ─── Animated dashboard demo ────────────────────────── */
const DEMO_ROWS = [
  { company: 'Stripe', role: 'Frontend Engineer', status: 'Interview', date: 'Apr 2', bg: 'var(--status-interview-bg)', fg: 'var(--status-interview-text)' },
  { company: 'Vercel', role: 'Software Engineer', status: 'Applied', date: 'Apr 5', bg: 'var(--status-applied-bg)', fg: 'var(--status-applied-text)' },
  { company: 'Linear', role: 'Full Stack Dev', status: 'OA', date: 'Mar 28', bg: 'var(--status-oa-bg)', fg: 'var(--status-oa-text)' },
  { company: 'Notion', role: 'Product Engineer', status: 'Accepted', date: 'Mar 15', bg: 'var(--status-accepted-bg)', fg: 'var(--status-accepted-text)' },
  { company: 'Figma', role: 'Design Engineer', status: 'Reject', date: 'Mar 10', bg: 'var(--status-reject-bg)', fg: 'var(--status-reject-text)' }
];

const BONUS_ROW = { company: 'Airbnb', role: 'Senior Frontend Eng', status: 'Applied', date: 'Today', bg: 'var(--status-applied-bg)', fg: 'var(--status-applied-text)' };

/*
  Animation timeline (looping):
  Steps 0-4  : rows appear one by one            (500ms each)
  Step  5    : pause                              (1200ms)
  Step  6    : Vercel status Applied → Interview  (1400ms)
  Step  7    : pause                              (1200ms)
  Step  8    : Airbnb row slides in               (1000ms)
  Step  9    : pause then reset                   (2500ms)
*/
function AnimatedDashboardDemo({ isMobile }: { isMobile: boolean }) {
  const [step, setStep] = useState(0);
  const inView = useInView();

  useEffect(() => {
    const timings = [500, 450, 450, 450, 450, 1200, 1400, 1200, 1000, 2500];
    const timer = setTimeout(() => {
      setStep(s => (s >= 9 ? 0 : s + 1));
    }, timings[step] ?? 800);
    return () => clearTimeout(timer);
  }, [step]);

  const visibleCount = Math.min(step + 1, 5);
  const statusChanged = step >= 6;
  const showBonus = step >= 8;

  const rows = DEMO_ROWS.map((r, i) => {
    if (i === 1 && statusChanged) {
      return { ...r, status: 'Interview', bg: 'var(--status-interview-bg)', fg: 'var(--status-interview-text)' };
    }
    return r;
  });

  function renderRow(r: typeof DEMO_ROWS[0], i: number, isNew = false) {
    const visible = isNew ? showBonus : i < visibleCount;
    return (
      <tr
        key={r.company}
        style={{
          borderBottom: '1px solid var(--border-row)',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(12px)',
          transition: 'opacity 0.45s ease, transform 0.45s ease',
          background: isNew && showBonus ? 'rgba(153, 27, 27, 0.04)' : 'transparent'
        }}
      >
        <td style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--text)' }}>{r.company}</td>
        <td style={{ padding: '10px 16px', color: 'var(--text-secondary)' }}>{r.role}</td>
        <td style={{ padding: '10px 16px' }}>
          <span
            style={{
              display: 'inline-block',
              padding: '3px 10px',
              borderRadius: 99,
              fontSize: 11,
              fontWeight: 600,
              background: r.bg,
              color: r.fg,
              transition: 'background 0.5s, color 0.5s',
              boxShadow: (i === 1 && statusChanged) ? '0 0 0 2px rgba(29, 78, 216, 0.25)' : 'none'
            }}
          >
            {r.status}
          </span>
        </td>
        {!isMobile && (
          <td style={{ padding: '10px 16px', color: 'var(--text-tertiary)', fontSize: 12 }}>{r.date}</td>
        )}
      </tr>
    );
  }

  return (
    <div ref={inView.ref} style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border)', boxShadow: '0 32px 80px rgba(77, 52, 34, 0.14), 0 8px 24px rgba(77, 52, 34, 0.08)', background: 'var(--surface)', maxWidth: 780, margin: '0 auto' }}>
      {/* Title bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: 99, background: '#ef4444' }} />
          <div style={{ width: 12, height: 12, borderRadius: 99, background: '#eab308' }} />
          <div style={{ width: 12, height: 12, borderRadius: 99, background: '#22c55e' }} />
        </div>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)', background: 'var(--surface)', borderRadius: 6, padding: '4px 12px' }}>
          useapplyr.vercel.app
        </div>
      </div>

      {/* Dashboard toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '12px 14px' : '14px 20px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--accent)', display: 'grid', placeItems: 'center', color: '#fff', fontSize: 13, fontWeight: 700 }}>A</div>
          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>My Applications</span>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)', background: 'var(--bg)', padding: '2px 8px', borderRadius: 6 }}>
            {showBonus ? 6 : visibleCount}
          </span>
        </div>
        {!isMobile && (
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, color: 'var(--text-secondary)', background: 'var(--surface)' }}>Filter</div>
            <div style={{
              padding: '6px 14px', borderRadius: 8, background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 600,
              boxShadow: (step === 7) ? '0 0 0 3px rgba(153, 27, 27, 0.2)' : 'none',
              transition: 'box-shadow 0.3s'
            }}>+ Add</div>
          </div>
        )}
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: isMobile ? 12 : 13 }}>
          <thead>
            <tr style={{ background: 'var(--table-header-bg)', textAlign: 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '10px 16px', fontWeight: 600 }}>Company</th>
              <th style={{ padding: '10px 16px', fontWeight: 600 }}>Role</th>
              <th style={{ padding: '10px 16px', fontWeight: 600 }}>Status</th>
              {!isMobile && <th style={{ padding: '10px 16px', fontWeight: 600 }}>Applied</th>}
            </tr>
          </thead>
          <tbody>
            {showBonus && renderRow(BONUS_ROW, 5, true)}
            {rows.map((r, i) => renderRow(r, i))}
          </tbody>
        </table>
      </div>

      {/* Live indicator */}
      <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6, borderTop: '1px solid var(--border-row)' }}>
        <div style={{ width: 6, height: 6, borderRadius: 99, background: '#22c55e', animation: 'pulse 2s infinite' }} />
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Live demo</span>
      </div>
    </div>
  );
}

/* ─── Animated resume autotailor demo ────────────────── */
/*
  Animation timeline (looping):
  Step 0 : job description keywords appear        (800ms)
  Step 1 : keyword 1 highlights                   (600ms)
  Step 2 : keyword 2 highlights                   (600ms)
  Step 3 : keyword 3 highlights                   (600ms)
  Step 4 : arrow pulses, processing               (1200ms)
  Step 5 : resume line 1 highlights               (500ms)
  Step 6 : resume line 2 highlights               (500ms)
  Step 7 : resume line 3 highlights               (500ms)
  Step 8 : match score appears                    (1000ms)
  Step 9 : "Download PDF" glow                    (1200ms)
  Step 10: pause then reset                       (2500ms)
*/
function AnimatedResumeDemo({ isMobile }: { isMobile: boolean }) {
  const [step, setStep] = useState(0);
  const inView = useInView();

  useEffect(() => {
    const timings = [800, 600, 600, 600, 1200, 500, 500, 500, 1000, 1200, 2500];
    const timer = setTimeout(() => {
      setStep(s => (s >= 10 ? 0 : s + 1));
    }, timings[step] ?? 800);
    return () => clearTimeout(timer);
  }, [step]);

  const keywords = ['React', 'TypeScript', 'REST APIs'];
  const resumeLines = [
    { label: 'Skills', width: '70%' },
    { label: 'Experience', width: '85%' },
    { label: 'Projects', width: '60%' },
    { label: '', width: '75%' },
    { label: '', width: '50%' },
    { label: '', width: '80%' },
    { label: '', width: '65%' },
  ];

  const kwHighlighted = (i: number) => step >= i + 1 && step <= 10;
  const lineHighlighted = (i: number) => i < 3 && step >= i + 5;
  const showScore = step >= 8;
  const showDownload = step >= 9;
  const arrowActive = step >= 4 && step <= 7;

  const cardW = isMobile ? 140 : 180;
  const cardP = isMobile ? 14 : 20;

  const cardBase: React.CSSProperties = {
    width: cardW,
    padding: cardP,
    borderRadius: 12,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    boxShadow: '0 8px 24px rgba(77, 52, 34, 0.08)',
    flexShrink: 0,
    position: 'relative'
  };

  return (
    <div ref={inView.ref} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: isMobile ? 10 : 20, flexWrap: 'nowrap' }}>
      {/* Job description */}
      <div>
        <div style={cardBase}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 10 }}>Job Description</div>
          <div style={{ fontSize: 11, lineHeight: 1.6, color: 'var(--text-secondary)', marginBottom: 10 }}>
            We&apos;re looking for an engineer with expertise in:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {keywords.map((kw, i) => (
              <span key={kw} style={{
                display: 'inline-block',
                padding: '3px 8px',
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 600,
                background: kwHighlighted(i) ? 'rgba(153, 27, 27, 0.15)' : 'var(--bg)',
                color: kwHighlighted(i) ? 'var(--accent)' : 'var(--text-secondary)',
                border: kwHighlighted(i) ? '1px solid rgba(153, 27, 27, 0.3)' : '1px solid var(--border)',
                transition: 'all 0.4s ease',
                width: 'fit-content'
              }}>{kw}</span>
            ))}
          </div>
        </div>
        <p style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-tertiary)', marginTop: 8, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Job listing
        </p>
      </div>

      {/* Arrow */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, paddingTop: isMobile ? 50 : 60, flexShrink: 0 }}>
        <svg width={isMobile ? 24 : 36} height={isMobile ? 16 : 20} viewBox="0 0 36 20" fill="none" style={{
          opacity: arrowActive ? 1 : 0.35,
          transition: 'opacity 0.4s',
          filter: arrowActive ? 'drop-shadow(0 0 4px rgba(153, 27, 27, 0.3))' : 'none'
        }}>
          <path d="M2 10h28m0 0l-6-6m6 6l-6 6" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {arrowActive && (
          <span style={{ fontSize: 9, color: 'var(--accent)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', animation: 'pulse 1s infinite' }}>
            Tailoring
          </span>
        )}
      </div>

      {/* Tailored resume */}
      <div>
        <div style={{
          ...cardBase,
          border: showScore ? '2px solid var(--accent)' : '1px solid var(--border)',
          transition: 'border 0.4s'
        }}>
          {/* Match score badge */}
          {showScore && (
            <div style={{
              position: 'absolute',
              top: -10,
              right: -10,
              background: 'var(--accent)',
              color: '#fff',
              fontSize: 10,
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: 99,
              animation: 'fadeInUp 0.4s ease'
            }}>
              94% match
            </div>
          )}
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 12 }}>Tailored Resume</div>
          {resumeLines.map((line, i) => (
            <div key={i} style={{ marginBottom: i === 0 ? 10 : 5, display: 'flex', alignItems: 'center', gap: 6 }}>
              {line.label && (
                <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.04em', textTransform: 'uppercase', width: isMobile ? 40 : 52, flexShrink: 0 }}>
                  {line.label}
                </span>
              )}
              <div style={{
                height: i === 0 ? 8 : 6,
                borderRadius: 3,
                background: lineHighlighted(i) ? 'rgba(153, 27, 27, 0.3)' : 'var(--border)',
                width: line.label ? '100%' : line.width,
                marginLeft: line.label ? 0 : isMobile ? 46 : 58,
                transition: 'background 0.5s ease',
                boxShadow: lineHighlighted(i) ? '0 0 8px rgba(153, 27, 27, 0.15)' : 'none'
              }} />
            </div>
          ))}
          {/* Download button */}
          <div style={{
            marginTop: 12,
            padding: '5px 10px',
            borderRadius: 6,
            background: showDownload ? 'var(--accent)' : 'var(--bg)',
            color: showDownload ? '#fff' : 'var(--text-tertiary)',
            fontSize: 10,
            fontWeight: 700,
            textAlign: 'center',
            transition: 'all 0.4s ease',
            letterSpacing: '0.02em'
          }}>
            Download PDF
          </div>
        </div>
        <p style={{ textAlign: 'center', fontSize: 10, color: 'var(--accent)', marginTop: 8, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Ready to submit
        </p>
      </div>
    </div>
  );
}

/* ─── Animated extension capture demo ────────────────── */
/*
  Shows a fake job listing with the extension popup appearing and capturing.
  Step 0 : job listing visible                      (1000ms)
  Step 1 : extension icon pulses                    (800ms)
  Step 2 : popup slides in with empty fields        (800ms)
  Step 3 : company field fills                      (600ms)
  Step 4 : role field fills                         (600ms)
  Step 5 : URL field fills                          (600ms)
  Step 6 : checkmark + "Saved!" appears             (1200ms)
  Step 7 : pause then reset                         (2500ms)
*/
function AnimatedExtensionDemo({ isMobile }: { isMobile: boolean }) {
  const [step, setStep] = useState(0);
  const inView = useInView();

  useEffect(() => {
    const timings = [1000, 800, 800, 600, 600, 600, 1200, 2500];
    const timer = setTimeout(() => {
      setStep(s => (s >= 7 ? 0 : s + 1));
    }, timings[step] ?? 800);
    return () => clearTimeout(timer);
  }, [step]);

  const showPopup = step >= 2;
  const fields = [
    { label: 'Company', value: 'Spotify', fillStep: 3 },
    { label: 'Role', value: 'Senior Engineer', fillStep: 4 },
    { label: 'URL', value: 'spotify.com/careers/...', fillStep: 5 }
  ];
  const saved = step >= 6;
  const iconPulsing = step === 1;

  const w = isMobile ? 280 : 380;

  return (
    <div ref={inView.ref} style={{ maxWidth: w, margin: '0 auto', position: 'relative' }}>
      {/* Fake browser showing job listing */}
      <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface)', boxShadow: '0 16px 48px rgba(77, 52, 34, 0.1)' }}>
        {/* Browser chrome */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: 99, background: '#ef4444' }} />
            <div style={{ width: 10, height: 10, borderRadius: 99, background: '#eab308' }} />
            <div style={{ width: 10, height: 10, borderRadius: 99, background: '#22c55e' }} />
          </div>
          <div style={{ flex: 1, fontSize: 11, color: 'var(--text-tertiary)', background: 'var(--surface)', borderRadius: 5, padding: '3px 10px', textAlign: 'center' }}>
            spotify.com/careers/senior-engineer
          </div>
          {/* Extension icon */}
          <div style={{
            width: 24, height: 24, borderRadius: 6, background: iconPulsing ? 'var(--accent)' : 'var(--accent-muted)',
            display: 'grid', placeItems: 'center', transition: 'background 0.3s',
            boxShadow: iconPulsing ? '0 0 0 4px rgba(153, 27, 27, 0.2)' : 'none',
            animation: iconPulsing ? 'pulse 0.8s infinite' : 'none'
          }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: iconPulsing ? '#fff' : 'var(--accent)' }}>A</span>
          </div>
        </div>

        {/* Job listing content */}
        <div style={{ padding: isMobile ? 16 : 24 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Spotify Careers</div>
          <div style={{ fontSize: isMobile ? 17 : 20, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em', marginBottom: 8 }}>Senior Software Engineer</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            {['Remote', 'Full-time', '$180k-$240k'].map(tag => (
              <span key={tag} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 5, background: 'var(--bg)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>{tag}</span>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[85, 100, 70, 90].map((w, i) => (
              <div key={i} style={{ height: 6, borderRadius: 3, background: 'var(--border)', width: `${w}%` }} />
            ))}
          </div>
        </div>
      </div>

      {/* Extension popup overlay */}
      <div style={{
        position: 'absolute',
        top: 40,
        right: isMobile ? -4 : -20,
        width: isMobile ? 200 : 230,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: 16,
        boxShadow: '0 20px 50px rgba(77, 52, 34, 0.18)',
        opacity: showPopup ? 1 : 0,
        transform: showPopup ? 'translateY(0) scale(1)' : 'translateY(-8px) scale(0.95)',
        transition: 'opacity 0.35s ease, transform 0.35s ease',
        pointerEvents: 'none' as const,
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          <div style={{ width: 20, height: 20, borderRadius: 5, background: 'var(--accent)', display: 'grid', placeItems: 'center' }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#fff' }}>A</span>
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>Applyr Capture</span>
        </div>

        {fields.map((f) => (
          <div key={f.label} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 3 }}>{f.label}</div>
            <div style={{
              height: 28, borderRadius: 6, border: '1px solid var(--border)', padding: '0 8px',
              display: 'flex', alignItems: 'center', fontSize: 11, color: 'var(--text)',
              background: step >= f.fillStep ? 'rgba(153, 27, 27, 0.04)' : 'var(--surface)',
              transition: 'background 0.3s'
            }}>
              <span style={{
                opacity: step >= f.fillStep ? 1 : 0,
                transition: 'opacity 0.3s'
              }}>{f.value}</span>
            </div>
          </div>
        ))}

        {/* Save button / saved state */}
        <div style={{
          marginTop: 10, height: 30, borderRadius: 8,
          background: saved ? '#16a34a' : 'var(--accent)',
          color: '#fff', fontSize: 12, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          transition: 'background 0.4s'
        }}>
          {saved ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Saved!
            </>
          ) : 'Save to Applyr'}
        </div>
      </div>

      {/* Live indicator */}
      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <div style={{ width: 6, height: 6, borderRadius: 99, background: '#22c55e', animation: 'pulse 2s infinite' }} />
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Live demo</span>
      </div>
    </div>
  );
}

/* ─── Feature icon SVGs ──────────────────────────────── */
function IconGrid() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <rect x="3" y="3" width="9" height="9" rx="2.5" stroke="var(--accent)" strokeWidth="2" />
      <rect x="16" y="3" width="9" height="9" rx="2.5" stroke="var(--accent)" strokeWidth="2" />
      <rect x="3" y="16" width="9" height="9" rx="2.5" stroke="var(--accent)" strokeWidth="2" />
      <rect x="16" y="16" width="9" height="9" rx="2.5" stroke="var(--accent)" strokeWidth="2" />
    </svg>
  );
}

function IconDocument() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <path
        d="M7 4h10l6 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M17 4v6h6" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
      <path d="M9 15h10M9 19h6" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="20" cy="20" r="5" fill="var(--accent)" />
      <path d="M18.5 20l1 1 2-2.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconExtension() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <rect x="3" y="10" width="15" height="15" rx="3" stroke="var(--accent)" strokeWidth="2" />
      <path
        d="M18 15.5a4 4 0 110-8 4 4 0 010 8z"
        stroke="var(--accent)"
        strokeWidth="2"
      />
      <path d="M10 10V7a4 4 0 018 0" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconSheets() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <rect x="3" y="3" width="22" height="22" rx="3" stroke="var(--accent)" strokeWidth="2" />
      <line x1="3" y1="10" x2="25" y2="10" stroke="var(--accent)" strokeWidth="2" />
      <line x1="3" y1="17" x2="25" y2="17" stroke="var(--accent)" strokeWidth="2" />
      <line x1="12" y1="10" x2="12" y2="25" stroke="var(--accent)" strokeWidth="2" />
    </svg>
  );
}

function IconEmail() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <rect x="3" y="6" width="22" height="16" rx="3" stroke="var(--accent)" strokeWidth="2" />
      <path d="M3 9l11 7 11-7" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

function IconPrivacy() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <path
        d="M14 3l9 4v6c0 5.5-3.84 10.74-9 12-5.16-1.26-9-6.5-9-12V7l9-4z"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M10 14l3 3 5-6" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ─── Styles ─────────────────────────────────────────── */
const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background:
      'radial-gradient(circle at top left, rgba(180, 83, 9, 0.18), transparent 24%), radial-gradient(circle at bottom right, rgba(153, 27, 27, 0.12), transparent 22%), linear-gradient(180deg, #f8f4ed 0%, #efe3d4 100%)',
    color: 'var(--text)'
  },

  /* Navbar */
  nav: {
    position: 'sticky',
    top: 0,
    zIndex: 100,
    backdropFilter: 'blur(16px)',
    background: 'rgba(248, 244, 237, 0.85)',
    borderBottom: '1px solid rgba(230, 215, 198, 0.6)'
  },
  navInner: {
    maxWidth: 1180,
    margin: '0 auto',
    padding: '0 20px',
    height: 64,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  navBrand: {
    display: 'flex',
    alignItems: 'center',
    gap: 10
  },
  navName: {
    margin: 0,
    fontSize: 20,
    fontWeight: 800,
    letterSpacing: '-0.04em',
    color: 'var(--text)'
  },
  navLinks: {
    display: 'flex',
    alignItems: 'center',
    gap: 6
  },
  navLink: {
    padding: '7px 14px',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--text-secondary)',
    textDecoration: 'none',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    transition: 'color 0.2s, background 0.2s'
  },
  navCta: {
    padding: '8px 18px',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 700,
    color: '#fff',
    background: 'var(--accent)',
    border: 'none',
    cursor: 'pointer',
    transition: 'background 0.2s'
  },

  /* Section container */
  section: {
    maxWidth: 1180,
    margin: '0 auto',
    padding: '80px 20px'
  },
  sectionLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 14px',
    borderRadius: 999,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--text-secondary)',
    marginBottom: 16
  },
  sectionHeading: {
    fontSize: 'clamp(2rem, 4.5vw, 3.2rem)',
    lineHeight: 1.1,
    letterSpacing: '-0.04em',
    fontWeight: 800,
    margin: '0 0 16px',
    color: 'var(--text)'
  },
  sectionSub: {
    fontSize: 17,
    lineHeight: 1.7,
    color: 'var(--text-secondary)',
    maxWidth: 600,
    margin: '0 0 48px'
  },

  /* Hero */
  hero: {
    maxWidth: 1180,
    margin: '0 auto',
    padding: '80px 20px 60px',
    textAlign: 'center',
    minHeight: 'calc(100vh - 64px)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center'
  },
  heroHeadline: {
    fontSize: 'clamp(2.8rem, 7vw, 5.2rem)',
    lineHeight: 1,
    letterSpacing: '-0.05em',
    fontWeight: 800,
    margin: '20px 0 20px',
    color: 'var(--text)'
  },
  heroSub: {
    fontSize: 19,
    lineHeight: 1.7,
    color: 'var(--text-secondary)',
    maxWidth: 640,
    margin: '0 auto 36px'
  },
  heroCtas: {
    display: 'flex',
    justifyContent: 'center',
    gap: 12,
    flexWrap: 'wrap',
    marginBottom: 32
  },
  heroCtaPrimary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    height: 52,
    padding: '0 28px',
    borderRadius: 14,
    background: 'var(--accent)',
    color: '#fff',
    fontSize: 16,
    fontWeight: 700,
    border: 'none',
    cursor: 'pointer',
    textDecoration: 'none',
    transition: 'background 0.2s, transform 0.15s'
  },
  heroCtaSecondary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    height: 52,
    padding: '0 28px',
    borderRadius: 14,
    background: 'rgba(255,255,255,0.8)',
    color: 'var(--text)',
    fontSize: 16,
    fontWeight: 700,
    border: '1px solid var(--border)',
    cursor: 'pointer',
    textDecoration: 'none',
    transition: 'background 0.2s, transform 0.15s'
  },
  trustRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: 24,
    fontSize: 13,
    color: 'var(--text-tertiary)',
    fontWeight: 500
  },

  /* Features grid */
  featGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 16
  },
  featCard: {
    padding: 28,
    borderRadius: 22,
    background: 'rgba(255, 255, 255, 0.76)',
    border: '1px solid var(--border)',
    boxShadow: '0 12px 32px rgba(77, 52, 34, 0.06)',
    transition: 'transform 0.25s, box-shadow 0.25s'
  },
  featIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    background: 'var(--accent-muted)',
    display: 'grid',
    placeItems: 'center',
    marginBottom: 16
  },
  featTitle: {
    fontSize: 17,
    fontWeight: 700,
    color: 'var(--text)',
    marginBottom: 8
  },
  featText: {
    fontSize: 14,
    lineHeight: 1.65,
    color: 'var(--text-secondary)',
    margin: 0
  },
  featBadge: {
    display: 'inline-block',
    padding: '3px 8px',
    borderRadius: 6,
    background: 'var(--accent)',
    color: '#fff',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    marginLeft: 8,
    verticalAlign: 'middle'
  },

  /* Autotailor section */
  splitRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 48,
    alignItems: 'center'
  },
  stepsList: {
    display: 'grid',
    gap: 20,
    marginTop: 32
  },
  step: {
    display: 'flex',
    gap: 16,
    alignItems: 'flex-start'
  },
  stepNum: {
    width: 36,
    height: 36,
    borderRadius: 10,
    background: 'var(--accent)',
    color: '#fff',
    display: 'grid',
    placeItems: 'center',
    fontSize: 15,
    fontWeight: 700,
    flexShrink: 0
  },
  stepContent: {
    paddingTop: 6
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: 'var(--text)',
    marginBottom: 4
  },
  stepText: {
    fontSize: 14,
    lineHeight: 1.6,
    color: 'var(--text-secondary)',
    margin: 0
  },

  /* Extension section */
  extCard: {
    maxWidth: 800,
    margin: '0 auto',
    padding: 48,
    borderRadius: 28,
    background: 'rgba(255, 255, 255, 0.8)',
    border: '1px solid var(--border)',
    boxShadow: '0 24px 64px rgba(77, 52, 34, 0.1)',
    textAlign: 'center'
  },
  extSteps: {
    display: 'flex',
    justifyContent: 'center',
    gap: 32,
    margin: '36px 0',
    flexWrap: 'wrap'
  },
  extStep: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
    maxWidth: 160
  },
  extStepCircle: {
    width: 56,
    height: 56,
    borderRadius: 16,
    background: 'var(--accent-muted)',
    display: 'grid',
    placeItems: 'center',
    fontSize: 24
  },
  extStepLabel: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text)'
  },
  extStepDesc: {
    fontSize: 13,
    color: 'var(--text-secondary)',
    textAlign: 'center',
    lineHeight: 1.5,
    margin: 0
  },
  extBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 10,
    height: 52,
    padding: '0 32px',
    borderRadius: 14,
    background: 'var(--accent)',
    color: '#fff',
    fontSize: 16,
    fontWeight: 700,
    border: 'none',
    cursor: 'pointer',
    textDecoration: 'none',
    transition: 'background 0.2s'
  },

  /* Auth section */
  authWrap: {
    maxWidth: 480,
    margin: '0 auto'
  },
  authCard: {
    background: 'rgba(255, 255, 255, 0.92)',
    border: '1px solid var(--border)',
    borderRadius: 24,
    padding: 32,
    boxShadow: '0 25px 60px rgba(77, 52, 34, 0.12)',
    backdropFilter: 'blur(16px)'
  },
  authTabs: {
    display: 'flex',
    gap: 8,
    marginBottom: 20
  },
  authTab: {
    flex: 1,
    height: 42,
    borderRadius: 14,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text)',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer'
  },
  authTabActive: {
    background: 'var(--accent)',
    borderColor: 'var(--accent)',
    color: '#ffffff'
  },
  form: { display: 'grid', gap: 14 },
  label: { display: 'grid', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--text)' },
  input: {
    width: '100%',
    height: 46,
    padding: '0 14px',
    borderRadius: 14,
    border: '1px solid var(--input-border)',
    background: 'rgba(255, 255, 255, 0.92)',
    fontSize: 15,
    color: 'var(--text)'
  },
  primaryBtn: {
    height: 48,
    border: 'none',
    borderRadius: 14,
    background: 'var(--accent)',
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer'
  },
  error: { margin: 0, color: 'var(--danger)', fontSize: 13, fontWeight: 600 },
  success: { margin: 0, color: '#166534', fontSize: 13, fontWeight: 600, lineHeight: 1.6 },

  /* Footer */
  footer: {
    borderTop: '1px solid var(--border)',
    padding: '40px 20px',
    textAlign: 'center'
  },
  footerInner: {
    maxWidth: 1180,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16
  },
  footerLinks: {
    display: 'flex',
    gap: 24,
    fontSize: 13,
    color: 'var(--text-secondary)'
  },
  footerLink: {
    color: 'var(--text-secondary)',
    textDecoration: 'none'
  },
  footerCopy: {
    fontSize: 12,
    color: 'var(--text-tertiary)',
    margin: 0
  },

  /* Loading */
  loading: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: 15
  }
};

/* ─── Main component ─────────────────────────────────── */
export function Home() {
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [viewportWidth, setViewportWidth] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUserEmail(data.session?.user.email ?? null);
      setReady(true);
    });
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUserEmail(session?.user.email ?? null);
      setReady(true);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    function update() {
      setViewportWidth(window.innerWidth);
    }
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  /* Scroll reveal refs */
  const demoSection = useInView();
  const featSection = useInView();
  const tailorSection = useInView();
  const extSection = useInView();
  const authSection = useInView();

  /* Auth handlers */
  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setErrorMessage(error.message);
    setIsSubmitting(false);
  }

  async function handleSignUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: process.env.NEXT_PUBLIC_APP_URL }
    });
    if (error) {
      setErrorMessage(error.message);
      setIsSubmitting(false);
      return;
    }
    if (data.session) {
      setSuccessMessage('Account created. Opening your dashboard...');
    } else {
      setSuccessMessage(`Account created. Check ${email} for a confirmation email, then sign in.`);
      setMode('signIn');
      setPassword('');
    }
    setIsSubmitting(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setEmail('');
    setPassword('');
    setErrorMessage('');
    setSuccessMessage('');
  }

  if (!ready) {
    return <div style={s.loading}>Loading your workspace...</div>;
  }

  if (userEmail) {
    return <Dashboard onSignOut={handleSignOut} userEmail={userEmail} />;
  }

  const isMobile = viewportWidth !== null && viewportWidth <= 640;
  const isTablet = viewportWidth !== null && viewportWidth <= 980;

  const features = [
    {
      icon: <IconGrid />,
      title: 'Application Tracking',
      text: 'Add jobs, update statuses, filter by company or stage. Your full pipeline in one clean table.',
      badge: null
    },
    {
      icon: <IconDocument />,
      title: 'AI Resume Autotailor',
      text: 'Upload your base resume once. For every application, generate a tailored PDF matched to the job description in seconds.',
      badge: 'New'
    },
    {
      icon: <IconExtension />,
      title: 'Chrome Extension',
      text: 'Capture job listings from any site with one click. The extension pulls key details straight into your dashboard.',
      badge: null
    },
    {
      icon: <IconSheets />,
      title: 'Google Sheets Sync',
      text: 'Optionally sync your data to a Google Sheet for a personal backup you control.',
      badge: null
    },
    {
      icon: <IconEmail />,
      title: 'Cold Email Portal',
      text: 'Draft and send personalized outreach to recruiters and hiring managers directly from your workspace.',
      badge: null
    },
    {
      icon: <IconPrivacy />,
      title: 'Private by Default',
      text: 'Your data stays scoped to your account. No shared dashboards, no public profiles, no tracking.',
      badge: null
    }
  ];

  return (
    <main style={s.page}>
      {/* ───── Navbar ───── */}
      <nav style={s.nav}>
        <div
          style={{
            ...s.navInner,
            ...(isMobile ? { padding: '0 16px', height: 56 } : {})
          }}
        >
          <div style={s.navBrand}>
            <Image src="/applyr-icon.svg" alt="Applyr" width={36} height={36} />
            <p style={{ ...s.navName, ...(isMobile ? { fontSize: 18 } : {}) }}>Applyr</p>
          </div>
          {!isMobile && (
            <div style={s.navLinks}>
              <a href="#features" style={s.navLink}>
                Features
              </a>
              <a href="#demo" style={s.navLink}>
                Demo
              </a>
              <a href="#extension" style={s.navLink}>
                Extension
              </a>
            </div>
          )}
          <a href="#get-started" style={{ ...s.navCta, ...(isMobile ? { fontSize: 13, padding: '7px 14px' } : {}) }}>
            Get Started
          </a>
        </div>
      </nav>

      {/* ───── Hero ───── */}
      <section
        style={{
          ...s.hero,
          ...(isMobile ? { padding: '48px 16px 40px' } : isTablet ? { padding: '60px 20px 48px' } : {})
        }}
      >
        <h1
          style={{
            ...s.heroHeadline,
            ...(isMobile ? { fontSize: 'clamp(2.2rem, 10vw, 3rem)', margin: '16px 0 16px' } : {}),
            ...(isTablet && !isMobile ? { fontSize: 'clamp(2.5rem, 8vw, 4rem)' } : {})
          }}
        >
          Track applications.
          <br />
          Tailor resumes.
          <br />
          Land interviews.
        </h1>
        <p
          style={{
            ...s.heroSub,
            ...(isMobile ? { fontSize: 16, marginBottom: 28 } : {})
          }}
        >
          Keep your job search organized in one private dashboard. Autotailor your resume with AI for
          every application, capture jobs with a Chrome extension, and optionally sync to Google
          Sheets.
        </p>
        <div style={s.heroCtas}>
          <a href="#get-started" style={s.heroCtaPrimary}>
            Get Started Free
          </a>
          <a
            href={EXTENSION_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={s.heroCtaSecondary}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
              <circle cx="12" cy="12" r="4" fill="currentColor" />
            </svg>
            Add to Chrome
          </a>
        </div>
        <div
          style={{
            ...s.trustRow,
            ...(isMobile ? { gap: 16, fontSize: 12, flexWrap: 'wrap' } : {})
          }}
        >
          <span>Free to use</span>
          <span>No credit card</span>
          <span>Private by default</span>
        </div>
      </section>

      {/* ───── Demo Showcase ───── */}
      <section
        id="demo"
        ref={demoSection.ref}
        style={{
          ...s.section,
          ...(isMobile ? { padding: '48px 16px' } : {}),
          textAlign: 'center'
        }}
      >
        <div style={reveal(demoSection.visible)}>
          <div style={s.sectionLabel}>Product Preview</div>
          <h2
            style={{
              ...s.sectionHeading,
              ...(isMobile ? { fontSize: 'clamp(1.6rem, 8vw, 2.2rem)' } : {})
            }}
          >
            Everything you need in one dashboard
          </h2>
          <p style={{ ...s.sectionSub, margin: '0 auto 48px' }}>
            Track every application from first click to final offer. Filter, sort, and update
            statuses without breaking your flow.
          </p>
        </div>
        <div style={reveal(demoSection.visible, 0.15)}>
          <AnimatedDashboardDemo isMobile={isMobile} />
        </div>
      </section>

      {/* ───── Features Grid ───── */}
      <section
        id="features"
        ref={featSection.ref}
        style={{
          ...s.section,
          ...(isMobile ? { padding: '48px 16px' } : {})
        }}
      >
        <div style={{ textAlign: 'center', ...reveal(featSection.visible) }}>
          <div style={s.sectionLabel}>Features</div>
          <h2
            style={{
              ...s.sectionHeading,
              ...(isMobile ? { fontSize: 'clamp(1.6rem, 8vw, 2.2rem)' } : {})
            }}
          >
            Built for serious job seekers
          </h2>
          <p style={{ ...s.sectionSub, margin: '0 auto 48px' }}>
            Every tool you need to organize, optimize, and accelerate your job search.
          </p>
        </div>
        <div
          style={{
            ...s.featGrid,
            ...(isTablet ? { gridTemplateColumns: 'repeat(2, 1fr)' } : {}),
            ...(isMobile ? { gridTemplateColumns: '1fr', gap: 14 } : {})
          }}
        >
          {features.map((f, i) => (
            <div
              key={f.title}
              style={{
                ...s.featCard,
                ...reveal(featSection.visible, 0.06 * i),
                ...(isMobile ? { padding: 22, borderRadius: 18 } : {})
              }}
            >
              <div style={s.featIcon}>{f.icon}</div>
              <div style={s.featTitle}>
                {f.title}
                {f.badge && <span style={s.featBadge}>{f.badge}</span>}
              </div>
              <p style={s.featText}>{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ───── Resume Autotailor Section ───── */}
      <section
        ref={tailorSection.ref}
        style={{
          ...s.section,
          ...(isMobile ? { padding: '48px 16px' } : {}),
          background:
            'radial-gradient(circle at 30% 50%, rgba(153, 27, 27, 0.06), transparent 50%)'
        }}
      >
        <div
          style={{
            ...s.splitRow,
            ...(isTablet ? { gridTemplateColumns: '1fr', gap: 36, textAlign: 'center' } : {})
          }}
        >
          <div style={reveal(tailorSection.visible)}>
            <div style={s.sectionLabel}>AI-Powered</div>
            <h2
              style={{
                ...s.sectionHeading,
                ...(isMobile ? { fontSize: 'clamp(1.6rem, 8vw, 2.2rem)' } : {})
              }}
            >
              Tailored resumes
              <br />
              in seconds
            </h2>
            <p style={{ ...s.sectionSub, marginBottom: 0 }}>
              Stop manually editing your resume for every application. Upload once, and let AI
              generate a tailored PDF that matches each job description.
            </p>
            <div style={s.stepsList}>
              {[
                {
                  num: '1',
                  title: 'Upload your base resume',
                  text: 'Add your master resume once. It becomes your starting template.'
                },
                {
                  num: '2',
                  title: 'Auto-capture the job description',
                  text: 'The extension captures the JD for you — or paste it manually. Either way, the AI identifies what matters.'
                },
                {
                  num: '3',
                  title: 'Get a tailored PDF',
                  text: 'Download a resume rewritten to match that specific role, ready to submit in seconds.'
                }
              ].map((step, i) => (
                <div key={step.num} style={{ ...s.step, ...reveal(tailorSection.visible, 0.1 + i * 0.08) }}>
                  <div style={s.stepNum}>{step.num}</div>
                  <div style={s.stepContent}>
                    <div style={s.stepTitle}>{step.title}</div>
                    <p style={s.stepText}>{step.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div
            style={{
              ...reveal(tailorSection.visible, 0.2),
              ...(isTablet ? { display: 'flex', justifyContent: 'center' } : {})
            }}
          >
            <AnimatedResumeDemo isMobile={isMobile} />
          </div>
        </div>
      </section>

      {/* ───── Extension Section ───── */}
      <section
        id="extension"
        ref={extSection.ref}
        style={{
          ...s.section,
          ...(isMobile ? { padding: '48px 16px' } : {})
        }}
      >
        <div style={{ ...s.extCard, ...reveal(extSection.visible), ...(isMobile ? { padding: 24, borderRadius: 22 } : {}) }}>
          <div style={{ ...s.sectionLabel, marginBottom: 16 }}>Chrome Extension</div>
          <h2
            style={{
              ...s.sectionHeading,
              ...(isMobile ? { fontSize: 'clamp(1.5rem, 8vw, 2rem)' } : {})
            }}
          >
            Capture jobs from any site
          </h2>
          <p
            style={{
              fontSize: 16,
              lineHeight: 1.7,
              color: 'var(--text-secondary)',
              maxWidth: 500,
              margin: '0 auto'
            }}
          >
            Install the Applyr Capture extension and save job listings to your dashboard with a
            single click. No more copying and pasting URLs.
          </p>

          <div style={{ margin: '36px 0' }}>
            <AnimatedExtensionDemo isMobile={isMobile} />
          </div>

          <a
            href={EXTENSION_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={s.extBtn}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
              <circle cx="12" cy="12" r="4" fill="currentColor" />
            </svg>
            Add to Chrome — It&apos;s Free
          </a>
        </div>
      </section>

      {/* ───── Auth Section ───── */}
      <section
        id="get-started"
        ref={authSection.ref}
        style={{
          ...s.section,
          ...(isMobile ? { padding: '48px 16px 60px' } : {})
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 40, ...reveal(authSection.visible) }}>
          <div style={s.sectionLabel}>Get Started</div>
          <h2
            style={{
              ...s.sectionHeading,
              ...(isMobile ? { fontSize: 'clamp(1.6rem, 8vw, 2.2rem)' } : {})
            }}
          >
            Start tracking your applications
          </h2>
          <p style={{ ...s.sectionSub, margin: '0 auto' }}>
            Create a free account in seconds. No credit card required.
          </p>
        </div>

        <div
          style={{
            ...s.authWrap,
            ...reveal(authSection.visible, 0.1),
            ...(isMobile ? { maxWidth: '100%' } : {})
          }}
        >
          <div
            style={{
              ...s.authCard,
              ...(isMobile ? { padding: 22, borderRadius: 20 } : {})
            }}
          >
            <div style={s.authTabs}>
              <button
                type="button"
                style={{ ...s.authTab, ...(mode === 'signIn' ? s.authTabActive : {}) }}
                onClick={() => {
                  setMode('signIn');
                  setErrorMessage('');
                  setSuccessMessage('');
                }}
              >
                Sign in
              </button>
              <button
                type="button"
                style={{ ...s.authTab, ...(mode === 'signUp' ? s.authTabActive : {}) }}
                onClick={() => {
                  setMode('signUp');
                  setErrorMessage('');
                  setSuccessMessage('');
                }}
              >
                Create account
              </button>
            </div>

            <h3 style={{ fontSize: 24, margin: '0 0 8px', color: 'var(--text)' }}>
              {mode === 'signIn' ? 'Welcome back' : 'Create your account'}
            </h3>
            <p
              style={{
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
                margin: '0 0 20px',
                fontSize: 14
              }}
            >
              {mode === 'signIn'
                ? 'Sign in to open your Applyr workspace.'
                : 'Create a new account with email and password.'}
            </p>

            <form style={s.form} onSubmit={mode === 'signIn' ? handleSignIn : handleSignUp}>
              <label style={s.label} htmlFor="auth-email">
                Email
                <input
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  style={s.input}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
              <label style={s.label} htmlFor="auth-password">
                Password
                <input
                  id="auth-password"
                  type="password"
                  autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
                  style={s.input}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>
              {errorMessage && <p style={s.error}>{errorMessage}</p>}
              {successMessage && <p style={s.success}>{successMessage}</p>}
              <button type="submit" style={s.primaryBtn} disabled={isSubmitting}>
                {isSubmitting
                  ? mode === 'signIn'
                    ? 'Signing in...'
                    : 'Creating account...'
                  : mode === 'signIn'
                    ? 'Open dashboard'
                    : 'Create account'}
              </button>
            </form>

            <p
              style={{
                marginTop: 16,
                fontSize: 12,
                lineHeight: 1.7,
                color: 'var(--text-tertiary)',
                textAlign: 'center'
              }}
            >
              Google Sheets sync is optional and configured inside the dashboard after signup.
            </p>
          </div>
        </div>
      </section>

      {/* ───── Footer ───── */}
      <footer style={s.footer}>
        <div style={s.footerInner}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Image src="/applyr-icon.svg" alt="Applyr" width={28} height={28} />
            <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>Applyr</span>
          </div>
          <div style={s.footerLinks}>
            <a href="/privacy" style={s.footerLink}>
              Privacy
            </a>
            <a href={EXTENSION_URL} target="_blank" rel="noopener noreferrer" style={s.footerLink}>
              Chrome Extension
            </a>
            <a href="#features" style={s.footerLink}>
              Features
            </a>
          </div>
          <p style={s.footerCopy}>Applyr — Your private job search workspace.</p>
        </div>
      </footer>
    </main>
  );
}
