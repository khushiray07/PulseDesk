import { useEffect, useRef, useState } from 'react';
import { X, Plus, LoaderCircle, Mail, ArrowRight, LockKeyhole } from 'lucide-react';
import { createTicket, errorMessage } from '../services/api.js';
import { validateTicket, PRIORITY_LABELS } from '../utils/tickets.js';
import RichTextEditor from './RichTextEditor.jsx';
import AttachmentUploader from './AttachmentUploader.jsx';
import { useAttachmentQueue } from '../hooks/useAttachmentQueue.js';

const initialValues = { title: '', customerEmail: '', description: '', priority: 'MEDIUM' };
export default function CreateTicketModal({ onClose, onCreated }) {
  const dialog = useRef(null);
  const initializingFocus = useRef(true);
  const [values, setValues] = useState(initialValues);
  const [touched, setTouched] = useState({});
  const [serverErrors, setServerErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [createdTicket, setCreatedTicket] = useState(null);
  const attachments = useAttachmentQueue();
  const validation = validateTicket(values);
  const errors = { ...validation.errors, ...serverErrors };

  useEffect(() => {
    initializingFocus.current = true;
    const element = dialog.current;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    element.showModal();
    element.querySelector('#ticket-title').focus();
    document.body.style.overflow = 'hidden';
    initializingFocus.current = false;
    return () => { initializingFocus.current = true; element.close(); document.body.style.overflow = previousOverflow; previousFocus?.focus(); };
  }, []);

  const fieldError = (field) => (submitted || touched[field]) ? errors[field] : '';
  const change = (field, value) => {
    setValues((current) => ({ ...current, [field]: value }));
    setServerErrors((current) => { const next = { ...current }; delete next[field]; return next; });
    setError('');
  };
  const fieldProps = (field) => ({
    id: `ticket-${field}`, value: values[field], disabled: saving,
    onChange: (event) => change(field, event.target.value),
    onBlur: () => { if (!initializingFocus.current) setTouched((current) => ({ ...current, [field]: true })); },
    'aria-invalid': Boolean(fieldError(field)),
    'aria-describedby': fieldError(field) ? `${field}-error` : undefined,
  });
  const inlineError = (field) => fieldError(field) && <p id={`${field}-error`} className="field-error">{fieldError(field)}</p>;
  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    setSubmitted(true);
    if (!createdTicket && Object.keys(validation.errors).length) {
      dialog.current.querySelector(`#ticket-${Object.keys(validation.errors)[0]}`)?.focus();
      return;
    }
    setSaving(true); setError('');
    try {
      const ticket = createdTicket || await createTicket(validation.data);
      setCreatedTicket(ticket);
      if (await attachments.uploadAll(ticket.id)) onCreated(ticket);
      else { setError('The ticket was created. Some attachments failed; retry or remove them, then continue.'); setSaving(false); }
    }
    catch (failure) {
      setServerErrors(failure.response?.data?.error?.details || {});
      setError(errorMessage(failure));
      setSaving(false);
    }
  }
  return <dialog ref={dialog} className="create-dialog" aria-labelledby="create-title" aria-describedby="create-description" onCancel={(event) => { event.preventDefault(); if (!saving) onClose(); }} onClick={(event) => {
    if (event.target !== event.currentTarget || saving) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
  }}>
    <div className="modal-heading"><span className="modal-icon"><Plus size={24} /></span><button className="icon-button" aria-label="Close create ticket" onClick={onClose} disabled={saving}><X size={20} /></button></div>
    <h2 id="create-title">Create a new ticket</h2><p id="create-description" className="modal-description">A little context goes a long way. Tell us what the customer needs.</p>
    <form onSubmit={submit} noValidate onPasteCapture={(event) => { if (!saving) attachments.handlePaste(event); else if (event.clipboardData?.files.length) event.preventDefault(); }} onDropCapture={(event) => { if (event.target.closest('.rich-editor')) { if (!saving) attachments.handleDrop(event); else event.preventDefault(); } }}><div className="modal-fields">
      <fieldset className="ticket-fields" disabled={saving || Boolean(createdTicket)}>
      <div className="form-field"><div className="label-row"><label htmlFor="ticket-title">Ticket title <span>*</span></label><span className="character-count">{values.title.length}/120</span></div><input {...fieldProps('title')} maxLength={120} placeholder="A brief summary of the issue" required />{inlineError('title')}</div>
      <div className="form-field"><label htmlFor="ticket-customerEmail">Customer email <span>*</span></label><div className="input-with-icon"><Mail size={17} /><input {...fieldProps('customerEmail')} type="email" maxLength={255} autoComplete="email" placeholder="customer@company.com" required /></div>{inlineError('customerEmail')}</div>
      <div className="form-row"><div className="form-field"><label htmlFor="ticket-priority">Priority <span>*</span></label><select {...fieldProps('priority')}>{Object.entries(PRIORITY_LABELS).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select>{inlineError('priority')}</div><div className="form-field"><span className="static-label">Initial status</span><div className="read-only-value"><span className="badge status-open"><span className="badge-dot" />Open</span><LockKeyhole size={14} /></div></div></div>
      <div className="form-field"><label htmlFor="ticket-description">Description <span>*</span></label><RichTextEditor id="ticket-description" value={values.description} onChange={(value) => change('description', value)} disabled={saving || Boolean(createdTicket)} invalid={Boolean(fieldError('description'))} describedBy={fieldError('description') ? 'description-error' : undefined} onBlur={() => setTouched((current) => ({ ...current, description: true }))} />{inlineError('description')}</div>
      </fieldset>
      <AttachmentUploader queue={attachments} disabled={saving} />
      {createdTicket && <p className="created-ticket-note" role="status">Your ticket is saved. <button type="button" onClick={() => onCreated(createdTicket)} disabled={saving}>Open ticket</button> to manage uploaded attachments.</p>}
      {(error || serverErrors._form) && <div className="form-alert" role="alert">{serverErrors._form || error}</div>}
    </div><div className="modal-footer"><span className="required-note">* Required fields</span><div><button className="button secondary" type="button" onClick={createdTicket ? () => onCreated(createdTicket) : onClose} disabled={saving}>{createdTicket ? 'Open ticket' : 'Cancel'}</button><button className="button primary" type="submit" disabled={saving}>{saving ? <LoaderCircle size={16} className="spin" /> : <ArrowRight size={16} />}{saving ? createdTicket ? 'Uploading…' : 'Creating…' : createdTicket ? 'Retry / continue' : 'Create ticket'}</button></div></div></form>
  </dialog>;
}
