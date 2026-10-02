import DOMPurify from 'dompurify';

export const MAX_DESCRIPTION_SIZE = 50000;
export const MAX_DESCRIPTION_TEXT = 10000;
export const isRichDescription = (value) => /<\/?[a-z][\s\S]*?>/i.test(value);
const tags = ['p', 'br', 'strong', 'b', 'em', 'i', 'ul', 'ol', 'li', 'a', 'code', 'pre'];

export function sanitizeDescription(html) {
  const fragment = DOMPurify.sanitize(html, { ALLOWED_TAGS: tags, ALLOWED_ATTR: ['href'], RETURN_DOM_FRAGMENT: true });
  fragment.querySelectorAll('a').forEach((link) => {
    const href = link.getAttribute('href');
    if (href && !/^(https?:\/\/|mailto:)/i.test(href)) link.removeAttribute('href');
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener noreferrer');
  });
  const container = document.createElement('div');
  container.append(fragment);
  return container.innerHTML;
}

export function descriptionHtml(value) {
  if (isRichDescription(value)) return sanitizeDescription(value);
  const container = document.createElement('div');
  container.textContent = value;
  return `<p>${container.innerHTML.replace(/\n/g, '<br>')}</p>`;
}

export function descriptionText(value) {
  if (!isRichDescription(value)) return value;
  const container = document.createElement('div');
  container.innerHTML = sanitizeDescription(value);
  return container.textContent || '';
}
export const hasDescriptionText = (value) => descriptionText(value).replace(/[\s\u200b-\u200d\u2060\ufeff]/gu, '').length > 0;
