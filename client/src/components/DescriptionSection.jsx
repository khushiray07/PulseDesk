import { useState } from 'react';
import { FileText, Pencil, LoaderCircle } from 'lucide-react';
import RichTextEditor from './RichTextEditor.jsx';
import RichTextDescription from './RichTextDescription.jsx';
import { updateTicket, errorMessage } from '../services/api.js';
import { validateTicket } from '../utils/tickets.js';
import { useToast } from './Toast.jsx';

export default function DescriptionSection({ ticket, onSaved, onPasteFiles, onDropFiles }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(ticket.description);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const notify = useToast();
  async function save(event) {
    event.preventDefault();
    if (saving) return;
    const validation = validateTicket({ title: ticket.title, customerEmail: ticket.customerEmail, priority: ticket.priority, description: value });
    if (validation.errors.description) { setError(validation.errors.description); return; }
    setSaving(true); setError('');
    try { const saved = await updateTicket(ticket.id, { description: validation.data.description }); onSaved(saved); setEditing(false); notify('Description saved.'); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setSaving(false); }
  }
  return <section className="detail-card description-card" onPasteCapture={onPasteFiles} onDropCapture={onDropFiles}>
    <div className="detail-card-heading"><FileText size={19} /><h2>Issue description</h2>{!editing && <button className="button secondary compact" onClick={() => { setValue(ticket.description); setError(''); setEditing(true); }}><Pencil size={14} />Edit description</button>}</div>
    {editing ? <form className="description-edit" onSubmit={save}><div className="form-field"><label htmlFor="detail-description">Description</label><RichTextEditor id="detail-description" value={value} onChange={(next) => { setValue(next); setError(''); }} disabled={saving} invalid={Boolean(error)} describedBy={error ? 'description-edit-error' : undefined} /></div>{error && <p className="field-error" id="description-edit-error" role="alert">{error}</p>}<div className="description-actions"><button type="button" className="button secondary" disabled={saving} onClick={() => setEditing(false)}>Cancel editing</button><button type="submit" className="button primary" disabled={saving || value === ticket.description}>{saving && <LoaderCircle size={16} className="spin" />}{saving ? 'Saving description…' : 'Save description'}</button></div></form> : <RichTextDescription value={ticket.description} />}
  </section>;
}
