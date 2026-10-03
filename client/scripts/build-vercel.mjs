import { access, cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function createOutputConfig(backendOrigin) {
  const invalid = () => new Error('Set BACKEND_ORIGIN to the deployed HTTPS Render origin, without a path or credentials.');
  if (typeof backendOrigin !== 'string' || !backendOrigin.trim()) throw invalid();
  let backend;
  try { backend = new URL(backendOrigin); } catch { throw invalid(); }
  if (backend.protocol !== 'https:' || backend.username || backend.password
    || backend.pathname !== '/' || backend.search || backend.hash
    || ['localhost', '127.0.0.1', '[::1]', '0.0.0.0'].includes(backend.hostname) || backend.hostname.endsWith('.localhost')) {
    throw invalid();
  }
  const headers = { 'Cache-Control': 'no-store', 'CDN-Cache-Control': 'no-store' };
  return {
    version: 3,
    routes: [
      { src: '^/api$', dest: `${backend.origin}/api`, headers },
      { src: '^/api/(.*)$', dest: `${backend.origin}/api/$1`, headers },
      { handle: 'filesystem' },
      { src: '^/.*$', dest: '/index.html' },
    ],
  };
}

export async function writeBuildOutput({
  clientRoot = fileURLToPath(new URL('../', import.meta.url)),
  backendOrigin = process.env.BACKEND_ORIGIN,
} = {}) {
  const config = createOutputConfig(backendOrigin);
  const dist = join(clientRoot, 'dist');
  await access(join(dist, 'index.html'));
  const output = join(clientRoot, '.vercel/output');
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  await cp(dist, join(output, 'static'), { recursive: true });
  await writeFile(join(output, 'config.json'), `${JSON.stringify(config, null, 2)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await writeBuildOutput();
  console.log('Prepared Vercel Build Output API: static frontend, API proxy and SPA routing.');
}
