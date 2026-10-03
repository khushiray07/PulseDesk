import { LoaderCircle } from 'lucide-react';
import { useAuth } from '../context/auth.js';

export default function SessionLoading() {
  const { waking } = useAuth();
  return <div className="auth-loading" role="status" aria-label="Session check" aria-live="polite" aria-atomic="true">
    <LoaderCircle className="spin" size={22} aria-hidden="true" />
    {waking ? <div><p>Starting PulseDesk…</p><p>The demo server is waking up. This may take up to a minute on free hosting.</p></div>
      : <span>Checking your session…</span>}
  </div>;
}
