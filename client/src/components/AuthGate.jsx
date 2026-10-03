import { Navigate, Outlet } from 'react-router-dom';
import SessionLoading from './SessionLoading.jsx';
import { useAuth } from '../context/auth.js';
import { errorMessage } from '../services/api.js';

export default function AuthGate() {
  const { user, loading, error, refresh } = useAuth();
  if (loading) return <SessionLoading />;
  if (error) return <div className="auth-loading" role="alert"><p>{errorMessage(error)}</p><button className="button secondary" onClick={refresh}>Retry sign-in check</button></div>;
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}
