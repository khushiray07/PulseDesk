import { useState } from 'react';

export default function UserAvatar({ user }) {
  const [failedUrl, setFailedUrl] = useState('');
  const initials = user.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  const safeUrl = user.avatarUrl && /^https:\/\//i.test(user.avatarUrl);
  return <span className="user-avatar" aria-hidden="true">{safeUrl && failedUrl !== user.avatarUrl ? <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" onError={() => setFailedUrl(user.avatarUrl)} /> : initials}</span>;
}
