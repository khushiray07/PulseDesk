import { useState } from 'react';
import { Paperclip, FileText, Download, Trash2, LoaderCircle } from 'lucide-react';
import AttachmentUploader from './AttachmentUploader.jsx';
import { fileSizeLabel } from '../utils/attachments.js';
import { attachmentContentUrl, deleteAttachment, errorMessage } from '../services/api.js';

export default function AttachmentSection({ ticketId, resource, queue }) {
  const [deleting, setDeleting] = useState('');
  const [error, setError] = useState('');
  async function upload() { await queue.uploadAll(ticketId); queue.clearUploaded(); resource.refresh(); }
  async function remove(attachment) {
    if (deleting) return;
    setDeleting(attachment.id); setError('');
    try { await deleteAttachment(ticketId, attachment.id); resource.refresh(); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setDeleting(''); }
  }
  return <section className="detail-card attachments-card" onPasteCapture={queue.handlePaste}>
    <div className="detail-card-heading"><Paperclip size={18} /><h2>Ticket attachments</h2></div>
    {resource.loading ? <p role="status">Loading attachments…</p> : resource.error ? <div className="form-alert" role="alert">{errorMessage(resource.error)} <button className="button secondary compact" onClick={resource.refresh}>Retry attachments</button></div> : resource.data.length ? <ul className="attachment-list" aria-label="Ticket attachments">{resource.data.map((attachment) => <li key={attachment.id}>
      {attachment.mimeType.startsWith('image/') ? <a href={attachmentContentUrl(ticketId, attachment.id)} target="_blank" rel="noopener noreferrer" aria-label={`Preview ${attachment.fileName}`}><img className="attachment-thumbnail" src={attachmentContentUrl(ticketId, attachment.id)} alt={attachment.fileName} /></a> : <FileText size={22} />}
      <div className="attachment-info"><strong>{attachment.fileName}</strong><span>{fileSizeLabel(attachment.fileSize)} · {attachment.mimeType}</span></div>
      <a className="icon-button" href={attachmentContentUrl(ticketId, attachment.id, true)} aria-label={`Download ${attachment.fileName}`}><Download size={17} /></a>
      <button className="icon-button" type="button" aria-label={`Delete ${attachment.fileName}`} disabled={Boolean(deleting) || queue.uploading} onClick={() => remove(attachment)}>{deleting === attachment.id ? <LoaderCircle size={16} className="spin" /> : <Trash2 size={16} />}</button>
    </li>)}</ul> : <p className="attachment-empty">No attachments yet.</p>}
    {error && <p className="field-error" role="alert">{error}</p>}
    <AttachmentUploader queue={queue} disabled={Boolean(deleting) || resource.loading || Boolean(resource.error)} />
    {queue.files.length > 0 && <button className="button primary attachment-upload-button" type="button" disabled={queue.uploading || Boolean(deleting)} onClick={upload}>{queue.uploading && <LoaderCircle size={16} className="spin" />}{queue.uploading ? 'Uploading attachments…' : queue.files.some((file) => file.status === 'error') ? 'Retry failed uploads' : 'Upload attachments'}</button>}
  </section>;
}
