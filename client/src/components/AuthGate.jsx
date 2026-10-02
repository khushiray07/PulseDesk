import { Navigate, Outlet } from 'react-router-dom';
import { LoaderCircle } from 'lucide-react';
import { useAuth } from '../context/auth.js';
import { errorMessage } from '../services/api.js';

export default function AuthGate() {
  const { user, loading, error, refresh } = useAuth();
  if (loading) return <div className="auth-loading" role="status"><LoaderCircle className="spin" size={22} /> Checking your session…</div>;
  if (error) return <div className="auth-loading" role="alert"><p>{errorMessage(error)}</p><button className="button secondary" onClick={refresh}>Retry sign-in check</button></div>;
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}
