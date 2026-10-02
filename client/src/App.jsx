import { Navigate, Route, Routes, Link } from 'react-router-dom';
import { Activity, ArrowRight } from 'lucide-react';
import DashboardPage from './pages/DashboardPage.jsx';
import TicketDetailPage from './pages/TicketDetailPage.jsx';
import { ToastProvider } from './components/Toast.jsx';

import AuthProvider from './components/AuthProvider.jsx';
import AuthGate from './components/AuthGate.jsx';
import LoginPage from './pages/LoginPage.jsx';
import UserAvatar from './components/UserAvatar.jsx';
import { useAuth } from './context/auth.js';
import { useState } from 'react';
import { errorMessage } from './services/api.js';

function Shell({ children }) {
  const { user, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState('');
  async function logout() {
    setSigningOut(true); setError('');
    try { await signOut(); } catch (failure) { setError(errorMessage(failure)); }
    finally { setSigningOut(false); }
  }
  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="app-header">
      <div className="header-inner">
        <button type="button" className="brand" aria-label="Reload PulseDesk" onClick={() => window.location.reload()}><span className="brand-mark"><Activity size={23} strokeWidth={2.2} /></span><span>PulseDesk</span></button>
        <span className="workspace-label">Support workspace</span>
        <Link className="header-link" to="/dashboard">Ticket dashboard <ArrowRight size={15} /></Link><div className="header-user"><UserAvatar user={user} /><span>{user.name}</span><button className="button secondary compact" disabled={signingOut} onClick={logout}>{signingOut ? 'Signing out…' : 'Sign out'}</button></div>
      </div>
    </header>
    <main id="main" className="main-container">{error && <p className="form-alert" role="alert">{error}</p>}{children}</main>
    <footer className="app-footer"><span><span className="small-dot" /> Made for better customer support</span><span>PulseDesk <span className="footer-version">v1.0</span></span></footer>
  </>;
}

export default function App() {
  return <ToastProvider><AuthProvider><Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route element={<AuthGate />}>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<Shell><DashboardPage /></Shell>} />
      <Route path="/tickets/:id" element={<Shell><TicketDetailPage /></Shell>} />
      <Route path="*" element={<Shell><div className="not-found"><h1>Page not found</h1><p>This page doesn’t exist. Your tickets are one click away.</p><Link className="button primary" to="/dashboard">Back to dashboard</Link></div></Shell>} />
    </Route>
  </Routes></AuthProvider></ToastProvider>;
}
