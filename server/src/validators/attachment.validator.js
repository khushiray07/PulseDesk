import { fileTypeFromBuffer } from 'file-type';
import { AppError } from '../utils/app-error.js';

export const MAX_FILE_SIZE = 5 * 1024 * 1024;
export const MAX_ATTACHMENTS = 10;
const extensions = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'application/pdf': 'pdf' };

export async function validateAttachment(file) {
  if (!file?.buffer?.length) throw new AppError(400, 'FILE_REQUIRED', 'Choose a nonempty file to upload.');
  if (file.size > MAX_FILE_SIZE) throw new AppError(413, 'FILE_TOO_LARGE', 'Each attachment must be 5 MiB or smaller.');
  let detected;
  try { detected = await fileTypeFromBuffer(file.buffer); } catch { /* Truncated/invalid files are rejected below. */ }
  let mimeType = detected?.mime;
  let extension = extensions[mimeType];
  // TXT has no magic bytes: require its extension and strictly valid, nonbinary UTF-8.
  if (!detected && /\.txt$/i.test(file.originalname)) {
    try {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(file.buffer);
      const binary = Array.from(text).some((character) => { const code = character.codePointAt(0); return (code < 32 && ![9, 10, 13].includes(code)) || code === 127; });
      if (!binary) { mimeType = 'text/plain'; extension = 'txt'; }
    } catch { /* Invalid UTF-8 is not a text document. */ }
  }
  if (!extension) throw new AppError(415, 'UNSUPPORTED_FILE_TYPE', 'Use a PNG, JPEG, WEBP, PDF, or UTF-8 TXT file.');
  const baseName = file.originalname.split(/[\\/]/).pop();
  const fileName = Array.from(baseName).filter((character) => character.codePointAt(0) >= 32 && character.codePointAt(0) !== 127).join('').trim().slice(0, 255) || `attachment.${extension}`;
  return { fileName, mimeType, extension, fileSize: file.buffer.length };
}
