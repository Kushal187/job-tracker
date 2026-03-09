const styles: Record<string, React.CSSProperties> = {
  shell: {
    minHeight: '100vh',
    background:
      'radial-gradient(circle at top left, rgba(180, 83, 9, 0.12), transparent 24%), radial-gradient(circle at bottom right, rgba(153, 27, 27, 0.1), transparent 22%), linear-gradient(180deg, #f8f4ed 0%, #efe3d4 100%)',
    color: 'var(--text)'
  },
  frame: {
    maxWidth: 900,
    margin: '0 auto',
    padding: '40px 20px 72px'
  },
  card: {
    background: 'rgba(255,255,255,0.88)',
    border: '1px solid var(--border)',
    borderRadius: 24,
    padding: 28,
    boxShadow: '0 24px 60px rgba(77, 52, 34, 0.08)'
  },
  eyebrow: {
    margin: 0,
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    color: 'var(--text-secondary)'
  },
  title: {
    margin: '10px 0 12px',
    fontSize: 'clamp(2rem, 5vw, 3rem)',
    lineHeight: 1,
    letterSpacing: '-0.04em'
  },
  intro: {
    margin: 0,
    fontSize: 16,
    lineHeight: 1.7,
    color: 'var(--text-secondary)'
  },
  section: {
    marginTop: 28
  },
  sectionTitle: {
    margin: '0 0 10px',
    fontSize: 18
  },
  text: {
    margin: 0,
    lineHeight: 1.75,
    color: 'var(--text-secondary)'
  },
  list: {
    margin: '10px 0 0',
    paddingLeft: 20,
    lineHeight: 1.8,
    color: 'var(--text-secondary)'
  },
  note: {
    marginTop: 28,
    fontSize: 13,
    color: 'var(--text-secondary)'
  }
};

export default function PrivacyPage() {
  return (
    <main style={styles.shell}>
      <div style={styles.frame}>
        <section style={styles.card}>
          <p style={styles.eyebrow}>Applyr</p>
          <h1 style={styles.title}>Privacy Policy</h1>
          <p style={styles.intro}>
            Applyr and Applyr Capture collect and use only the information needed to let you sign in,
            capture job application details, and save those details to your Applyr account.
          </p>

          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Data We Collect</h2>
            <p style={styles.text}>Depending on the feature you use, Applyr may collect:</p>
            <ul style={styles.list}>
              <li>Email address used to create and access your account</li>
              <li>Password entered during sign-in, which is sent to Supabase Auth for authentication</li>
              <li>Job application data you choose to save, such as company, role, status, and job URL</li>
              <li>Website content from the active job page only when you use the extension autofill feature</li>
              <li>Extension settings and local session data stored in Chrome storage</li>
            </ul>
          </section>

          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>How We Use Data</h2>
            <ul style={styles.list}>
              <li>Authenticate you and keep you signed in to your Applyr account</li>
              <li>Save and display your captured job applications in your dashboard</li>
              <li>Autofill capture fields from the active page when you request it</li>
              <li>Store extension preferences such as theme and connection state</li>
            </ul>
          </section>

          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>How Data Is Shared</h2>
            <p style={styles.text}>
              Applyr does not sell user data. Data is shared only with service providers required to
              operate the product, such as Supabase for authentication and database storage and, if you
              enable it, Google Sheets for your own export or sync workflow.
            </p>
          </section>

          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Extension-Specific Notes</h2>
            <p style={styles.text}>
              The Applyr Capture extension reads data from the active tab only when you open the popup
              and trigger autofill. It does not collect browsing history or monitor activity across tabs.
            </p>
          </section>

          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Contact</h2>
            <p style={styles.text}>
              For privacy questions, contact the Applyr operator through the support information listed
              on the product website or Chrome Web Store listing.
            </p>
          </section>

          <p style={styles.note}>Last updated: March 9, 2026</p>
        </section>
      </div>
    </main>
  );
}
