import { useRef, useState } from 'react';
import { MessageSquare, LoaderCircle, Send } from 'lucide-react';
import { useResource } from '../hooks/useResource.js';
import { addComment, errorMessage } from '../services/api.js';
import { fullDate } from '../utils/tickets.js';
import UserAvatar from './UserAvatar.jsx';

export default function CommentSection({ ticketId, users }) {
  const comments = useResource(`/tickets/${ticketId}/comments`);
  const [userId, setUserId] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const textbox = useRef(null);
  const disabled = saving || users.loading || Boolean(users.error) || !users.data?.length;
  async function submit(event) {
    event.preventDefault();
    if (pending.current || disabled) return;
    if (!userId) { setError('Choose a comment author.'); return; }
    const trimmed = content.trim();
    if (!trimmed.replace(/[\s\u200b-\u200d\u2060\ufeff]/gu, '')) { setError('Enter a comment.'); textbox.current?.focus(); return; }
    if (trimmed.length > 5000) { setError('Comments must be 5,000 characters or fewer.'); return; }
    pending.current = true; setSaving(true); setError('');
    try { await addComment(ticketId, { userId, content: trimmed }); setContent(''); comments.refresh(); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { pending.current = false; setSaving(false); }
  }
  return <section className="detail-card comments-card" aria-labelledby="comments-heading">
    <div className="detail-card-heading"><MessageSquare size={18} /><h2 id="comments-heading">Comments</h2></div>
    {comments.loading ? <p className="collaboration-note" role="status">Loading comments…</p> : comments.error ? <div className="form-alert" role="alert">{errorMessage(comments.error)} <button className="button secondary compact" type="button" onClick={comments.refresh}>Retry comments</button></div> : comments.data.length ? <ol className="comment-list" aria-label="Ticket comments">{comments.data.map((comment) => <li key={comment.id}><div className="comment-heading"><UserAvatar user={comment.user} /><div><strong>{comment.user.name}</strong><time dateTime={comment.createdAt}>{fullDate(comment.createdAt)}</time></div></div><p className="comment-content">{comment.content}</p></li>)}</ol> : <p className="collaboration-note">No comments yet. Share an update with the team.</p>}
    <form className="comment-form" onSubmit={submit} noValidate>
      <div className="form-field"><label htmlFor="comment-author">Comment author</label><select id="comment-author" value={userId} disabled={disabled} onChange={(event) => { setUserId(event.target.value); setError(''); }} aria-describedby="comment-author-note"><option value="">Choose a support user</option>{(users.data || []).map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select><p id="comment-author-note" className="collaboration-note">Authors are chosen manually for now.</p></div>
      <div className="form-field"><div className="label-row"><label htmlFor="comment-content">Write a comment</label><span className="character-count">{content.length}/5000</span></div><textarea ref={textbox} id="comment-content" value={content} disabled={disabled} maxLength={5000} rows={3} placeholder="Share progress, findings, or a customer update…" onChange={(event) => { setContent(event.target.value); setError(''); }} aria-describedby={error ? 'comment-error' : undefined} /></div>
      {users.loading && <p className="collaboration-note" role="status">Loading comment authors…</p>}
      {users.error && <div className="form-alert" role="alert">Comment authors could not be loaded. <button className="button secondary compact" type="button" onClick={users.refresh}>Retry comment authors</button></div>}
      {!users.loading && !users.error && !users.data?.length && <p className="collaboration-note">No support users are available to post comments.</p>}
      {error && <p className="field-error" id="comment-error" role="alert">{error}</p>}
      <button type="submit" className="button primary" disabled={disabled}>{saving ? <LoaderCircle size={16} className="spin" /> : <Send size={16} />}{saving ? 'Adding comment…' : 'Add comment'}</button>
    </form>
  </section>;
}
