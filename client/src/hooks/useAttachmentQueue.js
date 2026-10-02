import { useState } from 'react';
import { uploadAttachment, errorMessage } from '../services/api.js';

const allowedExtension = /\.(png|jpe?g|webp|pdf|txt)$/i;
export function useAttachmentQueue(existingCount = 0) {
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  function addFiles(selected) {
    const incoming = Array.from(selected);
    if (!incoming.length || uploading) return;
    if (files.length + incoming.length + existingCount > 10) { setError('A ticket can have at most 10 attachments.'); return; }
    setError('');
    const entries = incoming.map((file) => {
        const invalid = !allowedExtension.test(file.name) ? 'Use PNG, JPEG, WEBP, PDF, or TXT.' : !file.size ? 'Choose a nonempty file.' : file.size > 5 * 1024 * 1024 ? 'Each file must be 5 MiB or smaller.' : '';
        return { id: crypto.randomUUID(), file, status: invalid ? 'invalid' : 'ready', error: invalid };
    });
    setFiles((current) => [...current, ...entries]);
  }
  function remove(id) { if (!uploading) { setFiles((current) => current.filter((file) => file.id !== id)); setError(''); } }
  function update(id, data) { setFiles((current) => current.map((file) => file.id === id ? { ...file, ...data } : file)); }
  async function uploadAll(ticketId) {
    if (uploading) return false;
    setUploading(true); setError('');
    let success = true;
    try {
      for (const entry of files) {
        if (entry.status === 'uploaded') continue;
        if (entry.status === 'invalid') { success = false; continue; }
        update(entry.id, { status: 'uploading', error: '' });
        try { const attachment = await uploadAttachment(ticketId, entry.file); update(entry.id, { status: 'uploaded', attachment }); }
        catch (failure) { success = false; update(entry.id, { status: 'error', error: errorMessage(failure) }); }
      }
      return success;
    } finally { setUploading(false); }
  }
  const handlePaste = (event) => {
    if (!event.clipboardData?.files.length) return;
    event.preventDefault(); event.stopPropagation();
    addFiles(event.clipboardData.files);
  };
  const handleDrop = (event) => {
    if (!event.dataTransfer?.files.length) return;
    event.preventDefault(); event.stopPropagation();
    addFiles(event.dataTransfer.files);
  };
  return { files, error, uploading, addFiles, remove, uploadAll, handlePaste, handleDrop,
    clearUploaded: () => setFiles((current) => current.filter((file) => file.status !== 'uploaded')),
  };
}
