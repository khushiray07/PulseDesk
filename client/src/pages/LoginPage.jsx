import { Navigate, useSearchParams } from 'react-router-dom';
import { Activity, ShieldCheck, LoaderCircle } from 'lucide-react';
import { useAuth } from '../context/auth.js';
import { errorMessage } from '../services/api.js';

export default function LoginPage() {
  const { user, loading, error, refresh } = useAuth();
  const [params] = useSearchParams();
  if (loading) return <div className="auth-loading" role="status"><LoaderCircle className="spin" size={22} /> Checking your session…</div>;
  if (user) return <Navigate to="/dashboard" replace />;
  const loginError = params.get('error');
  return <div className="login-page"><section className="login-card" aria-labelledby="login-heading">
    <span className="login-mark"><Activity size={30} /></span>
    <h1 id="login-heading">PulseDesk<span className="brand-dot">.</span></h1>
    <p className="login-subtitle">Support Command Center</p>
    {error ? <div className="form-alert" role="alert">{errorMessage(error)} <button className="button secondary" onClick={refresh}>Retry sign-in check</button></div> : <>
      {loginError && <p className="form-alert" role="alert">{loginError === 'unavailable' ? 'Google login is unavailable. Ask your administrator to check the OAuth configuration.' : 'Sign-in could not be completed. Please try again.'}</p>}
      <a className="button secondary google-login" href="/api/auth/google"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.89-1.74 2.98-4.31 2.98-7.36Z"/><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.59-4.13H3.06v2.59A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.41 13.91a6 6 0 0 1 0-3.82V7.5H3.06a10 10 0 0 0 0 9l3.35-2.59Z"/><path fill="#EA4335" d="M12 5.96c1.47 0 2.79.5 3.82 1.49l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.94 5.5l3.35 2.59C7.2 7.72 9.4 5.96 12 5.96Z"/></svg>Continue with Google</a>
    </>}
    <p className="login-note"><ShieldCheck size={16} /> Secure access for support agents</p>
  </section></div>;
}
