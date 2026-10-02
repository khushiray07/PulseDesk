import { isRichDescription, sanitizeDescription } from '../utils/description.js';

export default function RichTextDescription({ value }) {
  return isRichDescription(value)
    ? <div className="description-body rich-content" dangerouslySetInnerHTML={{ __html: sanitizeDescription(value) }} />
    : <p className="description-body">{value}</p>;
}
