import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createOutputConfig, writeBuildOutput } from '../../client/scripts/build-vercel.mjs';

describe('production Vercel routing', () => {
  it('emits import-safe config, static assets and uncached API routes before the SPA fallback', async () => {
    const project = JSON.parse(await readFile(new URL('../../client/vercel.json', import.meta.url), 'utf8'));
    expect(project.framework).toBeNull();
    expect(project.buildCommand).toBe('npm run build:vercel');
    expect(project).not.toHaveProperty('rewrites');
    const root = await mkdtemp(join(tmpdir(), 'pulsedesk-vercel-'));
    try {
      await mkdir(join(root, 'dist/assets'), { recursive: true });
      await mkdir(join(root, '.vercel/output'), { recursive: true });
      await writeFile(join(root, 'dist/index.html'), '<html>PulseDesk</html>');
      await writeFile(join(root, 'dist/assets/app.js'), 'console.log("asset");');
      await writeFile(join(root, '.env'), 'PRIVATE_VALUE=not-public');
      await writeFile(join(root, '.vercel/project.json'), '{"projectId":"keep-link"}');
      await writeFile(join(root, '.vercel/output/stale.txt'), 'old deployment');
      await writeBuildOutput({ clientRoot: root, backendOrigin: 'https://api.example.com' });
      const output = JSON.parse(await readFile(join(root, '.vercel/output/config.json'), 'utf8'));
      expect(output.version).toBe(3);
      const headers = { 'Cache-Control': 'no-store', 'CDN-Cache-Control': 'no-store' };
      expect(output.routes).toEqual([
        { src: '^/api$', dest: 'https://api.example.com/api', headers },
        { src: '^/api/(.*)$', dest: 'https://api.example.com/api/$1', headers },
        { handle: 'filesystem' },
        { src: '^/.*$', dest: '/index.html' },
      ]);
      for (const path of ['/api/tickets', '/api/auth/google/callback', '/api/tickets/id/attachments/id/content']) {
        expect(new RegExp(output.routes[1].src).test(path)).toBe(true);
      }
      for (const path of ['/dashboard', '/tickets/id', '/assets/app.js']) {
        expect(new RegExp(output.routes[1].src).test(path)).toBe(false);
        expect(new RegExp(output.routes[3].src).test(path)).toBe(true);
      }
      expect(await readFile(join(root, '.vercel/output/static/index.html'), 'utf8')).toBe('<html>PulseDesk</html>');
      expect(await readFile(join(root, '.vercel/output/static/assets/app.js'), 'utf8')).toBe('console.log("asset");');
      await expect(readFile(join(root, '.vercel/output/static/.env'))).rejects.toMatchObject({ code: 'ENOENT' });
      await expect(readFile(join(root, '.vercel/output/stale.txt'))).rejects.toMatchObject({ code: 'ENOENT' });
      expect(await readFile(join(root, '.vercel/project.json'), 'utf8')).toBe('{"projectId":"keep-link"}');
    } finally { await rm(root, { recursive: true, force: true }); }
  });
  it.each(['', 'http://api.example.com', 'https://localhost', 'https://127.0.0.1', 'https://api.example.com/api', 'https://secret@api.example.com'])('rejects unsafe/missing backend configuration: %j', (backend) => {
    expect(() => createOutputConfig(backend)).toThrow();
  });
});
