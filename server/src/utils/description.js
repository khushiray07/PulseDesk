import sanitizeHtml from 'sanitize-html';
import { decodeHTML } from 'entities';

export const MAX_DESCRIPTION_SIZE = 50000;
export const MAX_DESCRIPTION_TEXT = 10000;
const looksLikeHtml = (value) => /<\/?[a-z][\s\S]*?>/i.test(value);
const options = {
  allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'ul', 'ol', 'li', 'a', 'code', 'pre'],
  allowedAttributes: { a: ['href', 'target', 'rel'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowProtocolRelative: false,
  transformTags: {
    a: (_tag, attributes) => ({ tagName: 'a', attribs: { href: attributes.href || '', target: '_blank', rel: 'noopener noreferrer' } }),
  },
};

export function normalizeDescription(value) {
  const trimmed = value.trim();
  // Legacy plain text remains a string; formatted submissions use sanitized HTML.
  return looksLikeHtml(trimmed) ? sanitizeHtml(trimmed, options) : trimmed;
}

export function descriptionText(value) {
  return looksLikeHtml(value) ? decodeHTML(sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} })) : value;
}

export const hasDescriptionText = (value) => descriptionText(value).replace(/[\s\u200b-\u200d\u2060\ufeff]/gu, '').length > 0;
