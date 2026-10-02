import { useCallback, useEffect, useRef, useState } from 'react';
import { AuthContext } from '../context/auth.js';
import { api, resetCsrfToken } from '../services/api.js';

export default function AuthProvider({ children }) {
  const version = useRef(0);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const refresh = useCallback(async () => {
    const current = ++version.current;
    setLoading(true); setError(null);
    try { const response = await api.get('/auth/me'); if (current === version.current) setUser(response.data.data); }
    catch (failure) { if (current === version.current) { setUser(null); if (failure.response?.status !== 401) setError(failure); } }
    finally { if (current === version.current) setLoading(false); }
  }, []);
  const invalidateCheck = useCallback(() => { ++version.current; }, []);
  useEffect(() => {
    refresh();
    const expired = () => { invalidateCheck(); resetCsrfToken(); setUser(null); setLoading(false); };
    window.addEventListener('pulsedesk:unauthorized', expired);
    return () => { invalidateCheck(); window.removeEventListener('pulsedesk:unauthorized', expired); };
  }, [refresh, invalidateCheck]);
  async function signOut() {
    await api.post('/auth/logout');
    ++version.current; resetCsrfToken(); setUser(null);
  }
  return <AuthContext.Provider value={{ user, loading, error, refresh, signOut }}>{children}</AuthContext.Provider>;
}
