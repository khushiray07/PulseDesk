import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, CalendarDays, Mail, SlidersHorizontal, Check, LoaderCircle, AlertCircle, Clock3 } from 'lucide-react';
import { useResource } from '../hooks/useResource.js';
import { updateTicket, errorMessage } from '../services/api.js';
import { fullDate, shortId, PRIORITY_LABELS, STATUS_LABELS } from '../utils/tickets.js';
import { PriorityBadge, StatusBadge } from '../components/Badge.jsx';
import { ErrorState } from '../components/States.jsx';
import { useToast } from '../components/Toast.jsx';
import DescriptionSection from '../components/DescriptionSection.jsx';
import AttachmentSection from '../components/AttachmentSection.jsx';
import { useAttachmentQueue } from '../hooks/useAttachmentQueue.js';
import AssigneeSection from '../components/AssigneeSection.jsx';
import CommentSection from '../components/CommentSection.jsx';

function UpdateForm({ ticket, onSaved }) {
  const [status, setStatus] = useState(ticket.status);
  const [priority, setPriority] = useState(ticket.priority);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const notify = useToast();
  const dirty = status !== ticket.status || priority !== ticket.priority;
  async function save(event) {
    event.preventDefault();
    if (!dirty || saving) return;
    setSaving(true); setError('');
    try {
      const saved = await updateTicket(ticket.id, { status, priority });
      onSaved(saved); notify('Ticket changes saved.');
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setSaving(false); }
  }
  return <section className="detail-card properties-card"><div className="detail-card-heading"><SlidersHorizontal size={18} /><h2>Ticket properties</h2></div><p className="properties-intro">Keep the queue up to date as work progresses.</p><form onSubmit={save}><div className="form-field"><label htmlFor="detail-status">Status</label><select id="detail-status" value={status} disabled={saving} onChange={(event) => { setStatus(event.target.value); setError(''); }}>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div className="form-field"><label htmlFor="detail-priority">Priority</label><select id="detail-priority" value={priority} disabled={saving} onChange={(event) => { setPriority(event.target.value); setError(''); }}>{Object.entries(PRIORITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>{error && <div className="form-alert" role="alert">{error}</div>}<button className="button primary save-button" disabled={!dirty || saving} type="submit">{saving ? <LoaderCircle size={16} className="spin" /> : <Check size={16} />}{saving ? 'Saving…' : 'Save changes'}</button><p className="save-note">{dirty ? 'You have unsaved changes.' : 'All changes are saved.'}</p></form></section>;
}

function TicketContent({ initialTicket }) {
  const [ticket, setTicket] = useState(initialTicket);
  const users = useResource('/users');
  const attachments = useResource(`/tickets/${ticket.id}/attachments`);
  const queue = useAttachmentQueue(attachments.data?.length || 0);
  return <>
    <div className="detail-heading"><div className="detail-id-row"><span className="detail-ticket-id">{shortId(ticket.id)}</span><StatusBadge value={ticket.status} /><PriorityBadge value={ticket.priority} /></div><h1>{ticket.title}</h1><p className="detail-subtitle"><Mail size={15} /><a href={`mailto:${ticket.customerEmail}`}>{ticket.customerEmail}</a><span className="metadata-dot">·</span><span>Created {fullDate(ticket.createdAt)}</span></p></div>
    <div className="detail-grid"><div className="detail-main"><DescriptionSection ticket={ticket} onSaved={setTicket} onPasteFiles={queue.handlePaste} onDropFiles={queue.handleDrop} /><AttachmentSection ticketId={ticket.id} resource={attachments} queue={queue} /><CommentSection ticketId={ticket.id} /><section className="detail-card customer-card"><div className="detail-card-heading"><Mail size={18} /><h2>Customer details</h2></div><div className="customer-detail"><span className="customer-avatar large">{ticket.customerEmail[0].toUpperCase()}</span><div><span className="metadata-label">CUSTOMER EMAIL</span><a href={`mailto:${ticket.customerEmail}`}>{ticket.customerEmail}<ArrowUpRight size={14} /></a></div></div></section><section className="detail-card timestamps-card"><div><CalendarDays size={18} /><div><span className="metadata-label">CREATED</span><time dateTime={ticket.createdAt}>{fullDate(ticket.createdAt)}</time></div></div><div><Clock3 size={18} /><div><span className="metadata-label">LAST UPDATED</span><time dateTime={ticket.updatedAt}>{fullDate(ticket.updatedAt)}</time></div></div></section></div><aside><UpdateForm ticket={ticket} onSaved={setTicket} /><AssigneeSection ticketId={ticket.id} users={users} /><div className="record-note"><span className="metadata-label">TICKET IDENTIFIER</span><code>{ticket.id}</code><p>Ticket title and customer email are recorded at creation. Descriptions can be updated as new details arrive.</p></div></aside></div>
  </>;
}

export default function TicketDetailPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const destination = params.get('returnTo') || '/dashboard';
  const returnTo = /^\/dashboard(?:\?|$)/.test(destination) ? destination : '/dashboard';
  const resource = useResource(`/tickets/${id}`);
  const missing = resource.error?.response?.status === 404;
  return <><Link className="back-link" to={returnTo}><ArrowLeft size={16} />Back to ticket queue</Link>{resource.loading ? <div className="detail-loading" role="status" aria-label="Loading ticket"><span className="skeleton detail-title-placeholder" /><span className="skeleton detail-body-placeholder" /></div> : missing ? <div className="empty-state"><span className="state-icon"><AlertCircle size={28} /></span><h1>Ticket not found</h1><p>This ticket may no longer be available.</p><Link className="button primary" to={returnTo}>Back to dashboard</Link></div> : resource.error ? <ErrorState error={resource.error} retry={resource.refresh} /> : <TicketContent key={resource.data.id} initialTicket={resource.data} />}</>;
}
