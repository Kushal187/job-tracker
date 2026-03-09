'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Dashboard } from './dashboard';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

const supabase = getSupabaseBrowserClient();

const styles: Record<string, React.CSSProperties> = {
  shell: {
    minHeight: '100vh',
    background:
      'radial-gradient(circle at top left, rgba(180, 83, 9, 0.18), transparent 24%), radial-gradient(circle at bottom right, rgba(153, 27, 27, 0.12), transparent 22%), linear-gradient(180deg, #f8f4ed 0%, #efe3d4 100%)',
    color: '#1f1a17'
  },
  frame: {
    maxWidth: 1180,
    margin: '0 auto',
    minHeight: '100vh',
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.15fr) minmax(320px, 430px)',
    gap: 28,
    alignItems: 'center',
    padding: '40px 16px'
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
    background: 'rgba(255, 255, 255, 0.76)',
    border: '1px solid rgba(31, 26, 23, 0.08)',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const
  },
  headline: {
    fontSize: 'clamp(2.8rem, 7vw, 5.7rem)',
    lineHeight: 0.94,
    letterSpacing: '-0.055em',
    margin: '18px 0 16px'
  },
  subhead: {
    maxWidth: 650,
    fontSize: 18,
    lineHeight: 1.7,
    color: 'rgba(31, 26, 23, 0.76)',
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
    border: '1px solid rgba(31, 26, 23, 0.08)',
    boxShadow: '0 18px 45px rgba(77, 52, 34, 0.08)'
  },
  valueLabel: {
    fontSize: 12,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    color: 'rgba(31, 26, 23, 0.56)',
    marginBottom: 8
  },
  valueText: {
    fontSize: 17,
    fontWeight: 600,
    lineHeight: 1.35
  },
  detailRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 16
  },
  detailCard: {
    padding: 18,
    borderRadius: 18,
    background: 'rgba(255, 255, 255, 0.52)',
    border: '1px solid rgba(31, 26, 23, 0.06)'
  },
  detailTitle: {
    margin: '0 0 8px',
    fontSize: 13,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: 'rgba(31, 26, 23, 0.56)'
  },
  detailText: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.65,
    color: 'rgba(31, 26, 23, 0.72)'
  },
  authCard: {
    background: 'rgba(255, 255, 255, 0.9)',
    border: '1px solid rgba(31, 26, 23, 0.08)',
    borderRadius: 28,
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
    border: '1px solid rgba(31, 26, 23, 0.12)',
    background: 'rgba(255, 255, 255, 0.88)',
    color: '#1f1a17',
    fontSize: 14,
    fontWeight: 700
  },
  authTabActive: {
    background: '#b45309',
    borderColor: '#b45309',
    color: '#fff8f4'
  },
  cardTitle: {
    fontSize: 28,
    margin: 0
  },
  cardText: {
    color: 'rgba(31, 26, 23, 0.72)',
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
    fontWeight: 600
  },
  input: {
    width: '100%',
    height: 46,
    padding: '0 14px',
    borderRadius: 14,
    border: '1px solid rgba(31, 26, 23, 0.12)',
    background: 'rgba(255, 255, 255, 0.92)',
    fontSize: 15,
    color: '#1f1a17'
  },
  primaryBtn: {
    height: 48,
    border: 'none',
    borderRadius: 14,
    background: '#991b1b',
    color: '#fff8f4',
    fontSize: 15,
    fontWeight: 700
  },
  note: {
    marginTop: 16,
    fontSize: 12,
    lineHeight: 1.7,
    color: 'rgba(31, 26, 23, 0.6)'
  },
  error: {
    margin: 0,
    color: '#b91c1c',
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
    background: '#f7f4ef',
    color: '#1f1a17',
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

  return (
    <main style={styles.shell}>
      <div style={styles.frame}>
        <section style={styles.hero}>
          <div style={styles.eyebrow}>Private job search workspace</div>
          <h1 style={styles.headline}>
            Organize your job search.
            <br />
            Track progress clearly.
            <br />
            Keep your data yours.
          </h1>
          <p style={styles.subhead}>
            Keep applications, status changes, and links in one private dashboard, with optional Google Sheets sync
            when you want a personal backup.
          </p>

          <div style={styles.valueGrid}>
            <div style={styles.valueCard}>
              <div style={styles.valueLabel}>Per-user privacy</div>
              <div style={styles.valueText}>Your dashboard and settings stay scoped to your account.</div>
            </div>
            <div style={styles.valueCard}>
              <div style={styles.valueLabel}>Flexible backup</div>
              <div style={styles.valueText}>Work entirely in the app, or connect a sheet for your own export copy.</div>
            </div>
            <div style={styles.valueCard}>
              <div style={styles.valueLabel}>Fast flow</div>
              <div style={styles.valueText}>Update statuses, edit entries, and filter your list without breaking flow.</div>
            </div>
          </div>

          <div style={styles.detailRow}>
            <div style={styles.detailCard}>
              <h3 style={styles.detailTitle}>How it works</h3>
              <p style={styles.detailText}>
                Create an account, start with a clean dashboard, add applications, and optionally turn on Google Sheets
                sync whenever you need it.
              </p>
            </div>
            <div style={styles.detailCard}>
              <h3 style={styles.detailTitle}>What you get</h3>
              <p style={styles.detailText}>
                A simple system for tracking applications, keeping links together, and reviewing progress without
                managing everything manually in a spreadsheet.
              </p>
            </div>
          </div>
        </section>

        <section style={styles.authCard}>
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

          <h2 style={styles.cardTitle}>{mode === 'signIn' ? 'Welcome back' : 'Create your account'}</h2>
          <p style={styles.cardText}>
            {mode === 'signIn'
              ? 'Use your Supabase email and password to open your private dashboard.'
              : 'Create a new account with email and password. If email confirmation is enabled, we will tell you to check your inbox.'}
          </p>

          <form style={styles.form} onSubmit={mode === 'signIn' ? handleSignIn : handleSignUp}>
            <label style={styles.label} htmlFor="auth-email">
              Email
              <input
                id="auth-email"
                type="email"
                autoComplete="email"
                style={styles.input}
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
                style={styles.input}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            {errorMessage ? <p style={styles.error}>{errorMessage}</p> : null}
            {successMessage ? <p style={styles.success}>{successMessage}</p> : null}
            <button type="submit" style={styles.primaryBtn} disabled={isSubmitting}>
              {isSubmitting
                ? mode === 'signIn'
                  ? 'Signing in...'
                  : 'Creating account...'
                : mode === 'signIn'
                  ? 'Open dashboard'
                  : 'Create account'}
            </button>
          </form>

          <p style={styles.note}>
            Every account starts with a clean list. Google Sheets sync is optional and configured inside the dashboard
            after signup.
          </p>
        </section>
      </div>
    </main>
  );
}
