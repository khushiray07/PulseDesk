import { useEffect, useRef, useState } from 'react';
import { Upload, FileText, Image as ImageIcon, Check, LoaderCircle, X, AlertCircle } from 'lucide-react';
import { fileSizeLabel } from '../utils/attachments.js';

function LocalThumbnail({ file }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return;
    const next = URL.createObjectURL(file); setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url ? <img className="attachment-thumbnail" src={url} alt="" /> : file.type.startsWith('image/') ? <ImageIcon size={22} /> : <FileText size={22} />;
}

export default function AttachmentUploader({ queue, disabled = false }) {
  const input = useRef(null);
  const [dragging, setDragging] = useState(false);
  const blocked = disabled || queue.uploading;
  return <div className="attachment-uploader" onPaste={queue.handlePaste}>
    <span className="static-label">Attachments</span>
    <input ref={input} className="visually-hidden" type="file" aria-label="Choose attachments" tabIndex={-1} accept=".png,.jpg,.jpeg,.webp,.pdf,.txt" multiple disabled={blocked} onChange={(event) => { queue.addFiles(event.target.files); event.target.value = ''; }} />
    <button className={`attachment-dropzone${dragging ? ' dragging' : ''}`} type="button" aria-label="Browse, drop, or paste attachments" disabled={blocked} onClick={() => input.current.click()} onDragOver={(event) => { event.preventDefault(); if (!blocked) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { setDragging(false); if (blocked) event.preventDefault(); else queue.handleDrop(event); }}>
      <Upload size={23} /><strong>Drop files here or click to browse</strong><span>You can also paste screenshots here or in the description.</span><small>PNG, JPEG, WEBP, PDF, TXT · 5 MiB each · 10 files per ticket</small>
    </button>
    {queue.error && <p className="field-error" role="alert">{queue.error}</p>}
    {queue.files.length > 0 && <ul className="attachment-list" aria-label="Selected attachments">{queue.files.map((entry) => <li key={entry.id}>
      <LocalThumbnail file={entry.file} /><div className="attachment-info"><strong>{entry.file.name}</strong><span>{fileSizeLabel(entry.file.size)} · {entry.file.type || 'Unknown type'}</span><span className={entry.error ? 'field-error' : 'attachment-status'} role={entry.error ? 'alert' : 'status'}>{entry.status === 'uploaded' ? 'Uploaded' : entry.status === 'uploading' ? 'Uploading…' : entry.error || 'Ready to upload'}</span></div>
      {entry.status === 'uploading' ? <LoaderCircle size={16} className="spin" /> : entry.status === 'uploaded' ? <Check size={16} className="attachment-check" /> : entry.error ? <AlertCircle size={16} /> : null}
      {entry.status !== 'uploaded' && <button className="icon-button" type="button" aria-label={`Remove ${entry.file.name}`} disabled={blocked} onClick={() => queue.remove(entry.id)}><X size={16} /></button>}
    </li>)}</ul>}
  </div>;
}
