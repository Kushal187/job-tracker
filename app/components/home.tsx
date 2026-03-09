'use client';

import Image from 'next/image';
import { FormEvent, useEffect, useState } from 'react';
import { Dashboard } from './dashboard';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

const supabase = getSupabaseBrowserClient();

const styles: Record<string, React.CSSProperties> = {
  shell: {
    minHeight: '100vh',
    background:
      'radial-gradient(circle at top left, rgba(180, 83, 9, 0.18), transparent 24%), radial-gradient(circle at bottom right, rgba(153, 27, 27, 0.12), transparent 22%), linear-gradient(180deg, #f8f4ed 0%, #efe3d4 100%)',
    color: 'var(--text)'
  },
  brandBar: {
    maxWidth: 1180,
    margin: '0 auto',
    padding: '18px 20px 0',
    display: 'flex',
    alignItems: 'center',
    gap: 12
  },
  brandMark: {
    width: 42,
    height: 42,
    flexShrink: 0,
    display: 'block'
  },
  brandText: {
    display: 'grid',
    gap: 2
  },
  brandName: {
    margin: 0,
    fontSize: 20,
    fontWeight: 800,
    letterSpacing: '-0.04em',
    color: 'var(--text)'
  },
  brandTagline: {
    margin: 0,
    fontSize: 11,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    color: 'var(--text-secondary)'
  },
  frame: {
    maxWidth: 1180,
    margin: '0 auto',
    minHeight: '100vh',
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.15fr) minmax(320px, 430px)',
    gap: 32,
    alignItems: 'center',
    padding: '40px 20px'
  },
  hero: {
    padding: '24px 0'
  },
  eyebrow: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    borderRadius: 999,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: 'var(--text-secondary)'
  },
  headline: {
    fontSize: 'clamp(2.8rem, 7vw, 5.7rem)',
    lineHeight: 0.94,
    letterSpacing: '-0.055em',
    margin: '18px 0 16px',
    color: 'var(--text)'
  },
  subhead: {
    maxWidth: 650,
    fontSize: 18,
    lineHeight: 1.7,
    color: 'var(--text-secondary)',
    marginBottom: 28
  },
  valueGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 14,
    marginBottom: 16
  },
  valueCard: {
    padding: 18,
    borderRadius: 22,
    background: 'rgba(255, 255, 255, 0.76)',
    border: '1px solid var(--border)',
    boxShadow: '0 18px 45px rgba(77, 52, 34, 0.08)'
  },
  valueLabel: {
    fontSize: 12,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    color: 'var(--text-secondary)',
    marginBottom: 8
  },
  valueText: {
    fontSize: 17,
    fontWeight: 600,
    lineHeight: 1.35,
    color: 'var(--text)'
  },
  detailRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 16
  },
  detailCard: {
    padding: 18,
    borderRadius: 18,
    background: 'rgba(255, 255, 255, 0.56)',
    border: '1px solid var(--border)'
  },
  detailTitle: {
    margin: '0 0 8px',
    fontSize: 13,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: 'var(--text-secondary)'
  },
  detailText: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.65,
    color: 'var(--text-secondary)'
  },
  authCard: {
    background: 'rgba(255, 255, 255, 0.92)',
    border: '1px solid var(--border)',
    borderRadius: 24,
    padding: 28,
    boxShadow: '0 25px 60px rgba(77, 52, 34, 0.12)',
    backdropFilter: 'blur(16px)'
  },
  authTabs: {
    display: 'flex',
    gap: 8,
    marginBottom: 18
  },
  authTab: {
    flex: 1,
    height: 42,
    borderRadius: 14,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text)',
    fontSize: 14,
    fontWeight: 700
  },
  authTabActive: {
    background: 'var(--accent)',
    borderColor: 'var(--accent)',
    color: '#ffffff'
  },
  cardTitle: {
    fontSize: 28,
    margin: 0,
    color: 'var(--text)'
  },
  cardText: {
    color: 'var(--text-secondary)',
    lineHeight: 1.6,
    margin: '10px 0 20px'
  },
  form: {
    display: 'grid',
    gap: 14
  },
  label: {
    display: 'grid',
    gap: 6,
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text)'
  },
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
    fontWeight: 700
  },
  note: {
    marginTop: 16,
    fontSize: 12,
    lineHeight: 1.7,
    color: 'var(--text-secondary)'
  },
  error: {
    margin: 0,
    color: 'var(--danger)',
    fontSize: 13,
    fontWeight: 600
  },
  success: {
    margin: 0,
    color: '#166534',
    fontSize: 13,
    fontWeight: 600,
    lineHeight: 1.6
  },
  loading: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: 15
  }
};

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
    function updateViewportWidth() {
      setViewportWidth(window.innerWidth);
    }

    updateViewportWidth();
    window.addEventListener('resize', updateViewportWidth);

    return () => {
      window.removeEventListener('resize', updateViewportWidth);
    };
  }, []);

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      setErrorMessage(error.message);
    }

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
      options: {
        emailRedirectTo: process.env.NEXT_PUBLIC_APP_URL
      }
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
    return <div style={styles.loading}>Loading your workspace...</div>;
  }

  if (userEmail) {
    return <Dashboard onSignOut={handleSignOut} userEmail={userEmail} />;
  }

  const isTablet = viewportWidth !== null && viewportWidth <= 980;
  const isMobile = viewportWidth !== null && viewportWidth <= 640;

  const brandBarStyle = {
    ...styles.brandBar,
    ...(isTablet ? { padding: '16px 16px 0' } : {})
  };
  const brandMarkStyle = {
    ...styles.brandMark,
    ...(isMobile ? { width: 38, height: 38 } : {})
  };
  const brandNameStyle = {
    ...styles.brandName,
    ...(isMobile ? { fontSize: 18 } : {})
  };
  const brandTaglineStyle = {
    ...styles.brandTagline,
    ...(isMobile ? { fontSize: 10 } : {})
  };
  const frameStyle = {
    ...styles.frame,
    ...(isTablet
      ? {
          minHeight: 'auto',
          gridTemplateColumns: '1fr',
          gap: isMobile ? 20 : 24,
          padding: isMobile ? '20px 16px 40px' : '28px 20px 48px'
        }
      : {})
  };
  const heroStyle = {
    ...styles.hero,
    ...(isTablet ? { padding: 0 } : {})
  };
  const eyebrowStyle = {
    ...styles.eyebrow,
    ...(isMobile
      ? {
          padding: '7px 10px',
          fontSize: 11
        }
      : {})
  };
  const headlineStyle = {
    ...styles.headline,
    ...(isTablet ? { fontSize: 'clamp(2.5rem, 9vw, 4.5rem)' } : {}),
    ...(isMobile
      ? {
          fontSize: 'clamp(2.35rem, 11vw, 3.25rem)',
          lineHeight: 0.98,
          margin: '16px 0 14px'
        }
      : {})
  };
  const subheadStyle = {
    ...styles.subhead,
    ...(isMobile
      ? {
          fontSize: 16,
          lineHeight: 1.6,
          marginBottom: 20
        }
      : isTablet
        ? {
            marginBottom: 24
          }
        : {})
  };
  const valueGridStyle = {
    ...styles.valueGrid,
    ...(isTablet ? { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' } : {}),
    ...(isMobile
      ? {
          gridTemplateColumns: '1fr',
          gap: 12,
          marginBottom: 12
        }
      : {})
  };
  const valueCardStyle = {
    ...styles.valueCard,
    ...(isMobile ? { padding: 16, borderRadius: 18 } : {})
  };
  const valueTextStyle = {
    ...styles.valueText,
    ...(isMobile ? { fontSize: 16 } : {})
  };
  const detailRowStyle = {
    ...styles.detailRow,
    ...(isTablet ? { gridTemplateColumns: '1fr', gap: 12 } : {})
  };
  const detailCardStyle = {
    ...styles.detailCard,
    ...(isMobile ? { padding: 16 } : {})
  };
  const authCardStyle = {
    ...styles.authCard,
    ...(isTablet
      ? {
          width: '100%',
          maxWidth: 560,
          margin: '0 auto'
        }
      : {}),
    ...(isMobile
      ? {
          maxWidth: '100%',
          padding: 20,
          borderRadius: 20
        }
      : {})
  };
  const cardTitleStyle = {
    ...styles.cardTitle,
    ...(isMobile ? { fontSize: 26 } : {})
  };
  const cardTextStyle = {
    ...styles.cardText,
    ...(isMobile ? { margin: '10px 0 18px' } : {})
  };
  const inputStyle = {
    ...styles.input,
    ...(isMobile ? { height: 44 } : {})
  };
  const primaryBtnStyle = {
    ...styles.primaryBtn,
    ...(isMobile ? { height: 46 } : {})
  };
  const noteStyle = {
    ...styles.note,
    ...(isMobile ? { marginTop: 14 } : {})
  };

  return (
    <main style={styles.shell}>
      <div style={brandBarStyle}>
        <Image src="/applyr-icon.svg" alt="Applyr logo" width={42} height={42} style={brandMarkStyle} />
        <div style={styles.brandText}>
          <p style={brandNameStyle}>Applyr</p>
          <p style={brandTaglineStyle}>Private job search workspace</p>
        </div>
      </div>
      <div style={frameStyle}>
        <section style={heroStyle}>
          <div style={eyebrowStyle}>Private job search workspace</div>
          <h1 style={headlineStyle}>
            {isMobile ? (
              'Organize your job search. Track progress clearly. Keep your data yours.'
            ) : (
              <>
                Organize your job search.
                <br />
                Track progress clearly.
                <br />
                Keep your data yours.
              </>
            )}
          </h1>
          <p style={subheadStyle}>
            Keep applications, status changes, and links in one private dashboard, with optional Google Sheets sync
            when you want a personal backup.
          </p>

          <div style={valueGridStyle}>
            <div style={valueCardStyle}>
              <div style={styles.valueLabel}>Per-user privacy</div>
              <div style={valueTextStyle}>Your dashboard and settings stay scoped to your account.</div>
            </div>
            <div style={valueCardStyle}>
              <div style={styles.valueLabel}>Flexible backup</div>
              <div style={valueTextStyle}>Work entirely in the app, or connect a sheet for your own export copy.</div>
            </div>
            <div style={valueCardStyle}>
              <div style={styles.valueLabel}>Fast flow</div>
              <div style={valueTextStyle}>Update statuses, edit entries, and filter your list without breaking flow.</div>
            </div>
          </div>

          <div style={detailRowStyle}>
            <div style={detailCardStyle}>
              <h3 style={styles.detailTitle}>How it works</h3>
              <p style={styles.detailText}>
                Create an account, start with a clean dashboard, add applications, and optionally turn on Google Sheets
                sync whenever you need it.
              </p>
            </div>
            <div style={detailCardStyle}>
              <h3 style={styles.detailTitle}>What you get</h3>
              <p style={styles.detailText}>
                A simple system for tracking applications, keeping links together, and reviewing progress without
                managing everything manually in a spreadsheet.
              </p>
            </div>
          </div>
        </section>

        <section style={authCardStyle}>
          <div style={styles.authTabs}>
            <button
              type="button"
              style={{
                ...styles.authTab,
                ...(mode === 'signIn' ? styles.authTabActive : {})
              }}
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
              style={{
                ...styles.authTab,
                ...(mode === 'signUp' ? styles.authTabActive : {})
              }}
              onClick={() => {
                setMode('signUp');
                setErrorMessage('');
                setSuccessMessage('');
              }}
            >
              Create account
            </button>
          </div>

          <h2 style={cardTitleStyle}>{mode === 'signIn' ? 'Welcome back' : 'Create your account'}</h2>
          <p style={cardTextStyle}>
            {mode === 'signIn'
              ? 'Sign in with your email and password to open your Applyr workspace.'
              : 'Create a new account with email and password. If email confirmation is enabled, we will tell you to check your inbox.'}
          </p>

          <form style={styles.form} onSubmit={mode === 'signIn' ? handleSignIn : handleSignUp}>
            <label style={styles.label} htmlFor="auth-email">
              Email
              <input
                id="auth-email"
                type="email"
                autoComplete="email"
                style={inputStyle}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label style={styles.label} htmlFor="auth-password">
              Password
              <input
                id="auth-password"
                type="password"
                autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
                style={inputStyle}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            {errorMessage ? <p style={styles.error}>{errorMessage}</p> : null}
            {successMessage ? <p style={styles.success}>{successMessage}</p> : null}
            <button type="submit" style={primaryBtnStyle} disabled={isSubmitting}>
              {isSubmitting
                ? mode === 'signIn'
                  ? 'Signing in...'
                  : 'Creating account...'
                : mode === 'signIn'
                  ? 'Open dashboard'
                  : 'Create account'}
            </button>
          </form>

          <p style={noteStyle}>
            Every account starts with a clean list. Google Sheets sync is optional and configured inside the dashboard
            after signup.
          </p>
        </section>
      </div>
    </main>
  );
}
