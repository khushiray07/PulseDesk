import { useCallback, useEffect, useRef, useState } from 'react';
import { AuthContext } from '../context/auth.js';
import { api, resetCsrfToken } from '../services/api.js';

export default function AuthProvider({ children }) {
  const version = useRef(0);
  const activeCheck = useRef(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [waking, setWaking] = useState(false);
  const [error, setError] = useState(null);
  const invalidateCheck = useCallback(() => { ++version.current; activeCheck.current?.abort(); }, []);
  const refresh = useCallback(async () => {
    invalidateCheck();
    const current = ++version.current;
    const controller = new AbortController();
    activeCheck.current = controller;
    const production = import.meta.env.PROD;
    const deadline = Date.now() + 75000;
    let lastFailure;
    setLoading(true); setWaking(false); setError(null);
    const slowTimer = production ? setTimeout(() => {
      if (current === version.current) setWaking(true);
    }, 5000) : undefined;
    const deadlineTimer = production ? setTimeout(() => {
      if (current !== version.current) return;
      setUser(null); setError(lastFailure || new Error('Session check timed out.'));
      setLoading(false); setWaking(false); invalidateCheck();
    }, 75000) : undefined;
    try {
      while (!controller.signal.aborted) {
        try {
          const response = await api.get('/auth/me', {
            signal: controller.signal,
            timeout: production ? Math.max(1, Math.min(15000, deadline - Date.now())) : 15000,
          });
          if (current === version.current) setUser(response.data.data);
          return;
        } catch (failure) {
          if (controller.signal.aborted || current !== version.current) return;
          lastFailure = failure;
          const status = failure.response?.status;
          const temporary = [502, 503, 504].includes(status)
            || (!failure.response && ['ERR_NETWORK', 'ECONNABORTED', 'ETIMEDOUT'].includes(failure.code));
          if (!production || !temporary || Date.now() >= deadline) {
            setUser(null);
            if (status !== 401) setError(failure);
            return;
          }
          setWaking(true);
          await new Promise((resolve) => {
            const cancel = () => { clearTimeout(timer); resolve(); };
            const timer = setTimeout(() => {
              controller.signal.removeEventListener('abort', cancel); resolve();
            }, Math.min(4000, deadline - Date.now()));
            controller.signal.addEventListener('abort', cancel, { once: true });
          });
        }
      }
    } finally {
      clearTimeout(slowTimer); clearTimeout(deadlineTimer);
      if (activeCheck.current === controller) activeCheck.current = null;
      if (current === version.current) { setLoading(false); setWaking(false); }
    }
  }, [invalidateCheck]);
  useEffect(() => {
    refresh();
    const expired = () => { invalidateCheck(); resetCsrfToken(); setUser(null); setLoading(false); setWaking(false); setError(null); };
    window.addEventListener('pulsedesk:unauthorized', expired);
    return () => { invalidateCheck(); window.removeEventListener('pulsedesk:unauthorized', expired); };
  }, [refresh, invalidateCheck]);
  async function signOut() {
    await api.post('/auth/logout');
    invalidateCheck(); resetCsrfToken(); setUser(null);
  }
  return <AuthContext.Provider value={{ user, loading, waking, error, refresh, signOut }}>{children}</AuthContext.Provider>;
}
