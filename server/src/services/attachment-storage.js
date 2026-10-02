import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultDirectory = fileURLToPath(new URL('../../../.local/attachments/', import.meta.url));
const directory = resolve(process.env.ATTACHMENT_STORAGE_DIR || defaultDirectory);
const pathFor = (key) => {
  if (!/^[0-9a-f-]{36}\.(png|jpg|webp|pdf|txt)$/.test(key)) throw new Error('Invalid internal storage key.');
  return resolve(directory, key);
};

// Only this adapter knows the filesystem. Ticket/attachment services use keys.
export const attachmentStorage = {
  async write(key, buffer) {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await writeFile(pathFor(key), buffer, { flag: 'wx', mode: 0o600 });
  },
  read(key) { return readFile(pathFor(key)); },
  async remove(key) {
    try { await unlink(pathFor(key)); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  },
};
