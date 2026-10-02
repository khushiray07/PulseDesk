import { Navigate, Route, Routes, Link } from 'react-router-dom';
import { Activity, ArrowRight } from 'lucide-react';
import DashboardPage from './pages/DashboardPage.jsx';
import TicketDetailPage from './pages/TicketDetailPage.jsx';
import { ToastProvider } from './components/Toast.jsx';

function Shell({ children }) {
  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="app-header">
      <div className="header-inner">
        <Link to="/dashboard" className="brand" aria-label="PulseDesk dashboard"><span className="brand-mark"><Activity size={23} strokeWidth={2.2} /></span><span>PulseDesk<span className="brand-dot">.</span></span></Link>
        <span className="workspace-label">Support workspace</span>
        <Link className="header-link" to="/dashboard">Ticket dashboard <ArrowRight size={15} /></Link>
      </div>
    </header>
    <main id="main" className="main-container">{children}</main>
    <footer className="app-footer"><span><span className="small-dot" /> Made for better customer support</span><span>PulseDesk <span className="footer-version">v1.0</span></span></footer>
  </>;
}

export default function App() {
  return <ToastProvider><Shell><Routes>
    <Route path="/" element={<Navigate to="/dashboard" replace />} />
    <Route path="/dashboard" element={<DashboardPage />} />
    <Route path="/tickets/:id" element={<TicketDetailPage />} />
    <Route path="*" element={<div className="not-found"><h1>Page not found</h1><p>This page doesn’t exist. Your tickets are one click away.</p><Link className="button primary" to="/dashboard">Back to dashboard</Link></div>} />
  </Routes></Shell></ToastProvider>;
}
