import { useEffect, useRef, useState } from 'react';
import { UsersRound, Plus, X, LoaderCircle } from 'lucide-react';
import { useResource } from '../hooks/useResource.js';
import { addAssignee, removeAssignee, errorMessage } from '../services/api.js';
import UserAvatar from './UserAvatar.jsx';

export default function AssigneeSection({ ticketId, users }) {
  const assignments = useResource(`/tickets/${ticketId}/assignees`);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const pending = useRef(false);
  const picker = useRef(null);
  const trigger = useRef(null);
  const chooser = useRef(null);
  const available = (users.data || []).filter((user) => !assignments.data?.some((assignment) => assignment.userId === user.id));
  const disabled = Boolean(busy) || assignments.loading || users.loading || Boolean(assignments.error || users.error);
  useEffect(() => {
    if (!open) return;
    chooser.current?.querySelector('button:not(:disabled)')?.focus();
    const dismiss = (event) => { if (!picker.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);
  async function mutate(userId, removing = false) {
    if (pending.current) return;
    pending.current = true; setBusy(userId); setError('');
    try {
      if (removing) await removeAssignee(ticketId, userId); else await addAssignee(ticketId, userId);
      setOpen(false); assignments.refresh(); trigger.current?.focus();
    } catch (failure) { setError(errorMessage(failure)); }
    finally { pending.current = false; setBusy(''); }
  }
  return <section className="detail-card assignees-card" aria-labelledby="assignees-heading">
    <div className="detail-card-heading"><UsersRound size={18} /><h2 id="assignees-heading">Assignees</h2></div>
    {assignments.loading ? <p className="collaboration-note" role="status">Loading assignees…</p> : assignments.error ? <div className="form-alert" role="alert">{errorMessage(assignments.error)} <button className="button secondary compact" onClick={assignments.refresh}>Retry assignees</button></div> : <div className="assignee-chips" aria-label="Assigned support users">
      {assignments.data.length ? assignments.data.map(({ user }) => <span className="assignee-chip" key={user.id}><UserAvatar user={user} /><span>{user.name}</span><button type="button" className="icon-button" aria-label={`Remove assignee ${user.name}`} disabled={disabled} onClick={() => mutate(user.id, true)}>{busy === user.id ? <LoaderCircle size={14} className="spin" /> : <X size={14} />}</button></span>) : <p className="collaboration-note">No assignees yet.</p>}
    </div>}
    <div className="assignee-picker" ref={picker} onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); setOpen(false); trigger.current?.focus(); } }}>
      <button ref={trigger} className="button secondary compact" type="button" disabled={disabled} aria-expanded={open} aria-controls="assignee-chooser" onClick={() => { setOpen((current) => !current); setError(''); }}><Plus size={14} />Add assignee</button>
      {open && <div ref={chooser} id="assignee-chooser" className="assignee-chooser" role="group" aria-label="Available support users">{available.length ? available.map((user) => <button type="button" key={user.id} disabled={Boolean(busy)} onClick={() => mutate(user.id)}><UserAvatar user={user} /><span><strong>{user.name}</strong><small>{user.email}</small></span>{busy === user.id && <LoaderCircle size={14} className="spin" />}</button>) : <p>All support users are already assigned.</p>}</div>}
    </div>
    {users.loading && <p className="collaboration-note" role="status">Loading support users…</p>}
    {users.error && <div className="form-alert" role="alert">Support users could not be loaded. <button className="button secondary compact" onClick={users.refresh}>Retry support users</button></div>}
    {error && <p className="field-error" role="alert">{error}</p>}
  </section>;
}
