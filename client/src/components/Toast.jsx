import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';

const ToastContext = createContext(null);
export function ToastProvider({ children }) {
  const [message, setMessage] = useState('');
  const timer = useRef();
  const notify = (value) => {
    clearTimeout(timer.current);
    setMessage(value);
    timer.current = setTimeout(() => setMessage(''), 5000);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  return <ToastContext.Provider value={notify}>{children}<div className="toast-region" role="status" aria-live="polite">{message && <div className="toast"><CheckCircle2 size={20} /><span>{message}</span><button aria-label="Dismiss notification" className="icon-button" onClick={() => setMessage('')}><X size={17} /></button></div>}</div></ToastContext.Provider>;
}
// This hook is consumed only by pages and forms.
// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastContext);
