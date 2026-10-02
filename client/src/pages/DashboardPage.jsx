import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Info, Inbox } from 'lucide-react';
import { useResource } from '../hooks/useResource.js';
import { useToast } from '../components/Toast.jsx';
import SummaryCards from '../components/SummaryCards.jsx';
import TicketToolbar from '../components/TicketToolbar.jsx';
import TicketList from '../components/TicketList.jsx';
import Pagination from '../components/Pagination.jsx';
import CreateTicketModal from '../components/CreateTicketModal.jsx';
import { EmptyState, ErrorState, TicketSkeleton } from '../components/States.jsx';

export default function DashboardPage() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('search') || '');
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const notify = useToast();
  const query = Object.fromEntries(params);
  const urlSearch = params.get('search') || '';
  const summary = useResource('/tickets/summary');
  const tickets = useResource(`/tickets?${params.toString()}`);
  const returnTo = `/dashboard${params.size ? `?${params.toString()}` : ''}`;

  useEffect(() => { setSearch(urlSearch); }, [urlSearch]);
  useEffect(() => {
    if (search.trim() === urlSearch) return;
    const timeout = setTimeout(() => setParams((current) => {
      const next = new URLSearchParams(current);
      if (search.trim()) next.set('search', search.trim()); else next.delete('search');
      next.delete('page');
      return next;
    }, { replace: true }), 300);
    return () => clearTimeout(timeout);
  }, [search, urlSearch, setParams]);

  useEffect(() => {
    const pagination = tickets.data?.pagination;
    if (pagination && pagination.page > Math.max(1, pagination.totalPages)) {
      setParams((current) => { const next = new URLSearchParams(current); next.set('page', String(Math.max(1, pagination.totalPages))); return next; }, { replace: true });
    }
  }, [tickets.data, setParams]);

  const change = (key, value) => setParams((current) => {
    const next = new URLSearchParams(current);
    if (value) next.set(key, String(value)); else next.delete(key);
    if (key !== 'page') next.delete('page');
    return next;
  });
  const reset = () => { setSearch(''); setParams({}); };
  const filtered = Boolean(query.search || query.status || query.priority);
  return <>
    <div className="page-heading"><div><p className="eyebrow"><span className="eyebrow-line" />YOUR SUPPORT, IN FOCUS</p><h1>Ticket dashboard</h1><p className="page-description">A clearer view of every request. A better day for your customers.</p></div><button className="button primary create-button" onClick={() => setCreating(true)}><Plus size={18} />Create ticket</button></div>
    <SummaryCards resource={summary} />
    <p className="summary-note"><Info size={14} />Summary counts include all tickets, regardless of your filters.</p>
    <section className="queue-section" aria-labelledby="queue-heading"><div className="queue-heading"><div><span className="queue-icon"><Inbox size={19} /></span><h2 id="queue-heading">Ticket queue</h2>{tickets.data && <span className="count-badge">{tickets.data.pagination.total}</span>}</div><span className="queue-hint">Everything you need to keep things moving</span></div>
      <TicketToolbar query={query} search={search} setSearch={setSearch} change={change} reset={reset} />
      <div className="ticket-panel" aria-busy={tickets.loading}>{tickets.loading ? <TicketSkeleton /> : tickets.error ? <ErrorState error={tickets.error} retry={tickets.refresh} /> : tickets.data.tickets.length ? <><TicketList tickets={tickets.data.tickets} returnTo={returnTo} /><Pagination pagination={tickets.data.pagination} onPage={(page) => change('page', page)} /></> : <EmptyState filtered={filtered} onReset={reset} onCreate={() => setCreating(true)} />}</div>
    </section>
    <div className="dashboard-note"><span className="small-dot indigo-dot" /><p>One organized queue. More time for the people behind every ticket.</p></div>
    {creating && <CreateTicketModal onClose={() => setCreating(false)} onCreated={(ticket) => { setCreating(false); summary.refresh(); notify('Ticket created successfully.'); navigate(`/tickets/${ticket.id}?returnTo=${encodeURIComponent(returnTo)}`); }} />}
  </>;
}
