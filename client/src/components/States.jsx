import { AlertCircle, Inbox, SearchX, RefreshCw, Plus } from 'lucide-react';
import { errorMessage } from '../services/api.js';

export function ErrorState({ error, retry, compact = false }) {
  return <div className={compact ? 'error-banner' : 'empty-state error-state'} role="alert"><span className="state-icon error-icon"><AlertCircle size={25} /></span><div><h3>{compact ? 'Summary is unavailable' : 'Something interrupted the connection'}</h3><p>{errorMessage(error)}</p></div><button className="button secondary" onClick={retry}><RefreshCw size={15} />Try again</button></div>;
}
export function EmptyState({ filtered, onReset, onCreate }) {
  const Icon = filtered ? SearchX : Inbox;
  return <div className="empty-state"><span className="state-icon"><Icon size={28} /></span><h3>{filtered ? 'No tickets match your search' : 'A fresh start for your support queue'}</h3><p>{filtered ? 'Try a different search or clear your filters to see all tickets.' : 'Create your first ticket to keep customer requests organized.'}</p><button className={`button ${filtered ? 'secondary' : 'primary'}`} onClick={filtered ? onReset : onCreate}>{filtered ? <RefreshCw size={15} /> : <Plus size={17} />}{filtered ? 'Clear filters' : 'Create your first ticket'}</button></div>;
}
export function TicketSkeleton() {
  return <div className="ticket-skeleton" role="status" aria-label="Loading tickets">{Array.from({ length: 6 }, (_, i) => <div className="skeleton-row" key={i}><span className="skeleton skeleton-avatar" /><div><span className="skeleton skeleton-line" /><span className="skeleton skeleton-line short" /></div><span className="skeleton skeleton-pill" /><span className="skeleton skeleton-pill" /></div>)}</div>;
}
