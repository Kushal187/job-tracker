import { Dashboard } from './components/dashboard';

export default function HomePage() {
  return (
    <main>
      <h1>Job Tracker</h1>
      <p className="subtitle">Dashboard + auto Google Sheets backup</p>
      <Dashboard />
    </main>
  );
}
