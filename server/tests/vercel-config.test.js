import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

function config(backend) {
  return JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', "console.log(JSON.stringify((await import('./vercel.mjs')).config));"], {
    cwd: fileURLToPath(new URL('../../client/', import.meta.url)), env: { ...process.env, BACKEND_ORIGIN: backend }, stdio: 'pipe',
  }).toString());
}
describe('production Vercel routing', () => {
  it('proxies APIs before the SPA fallback and keeps authenticated responses out of caches', () => {
    const deployment = config('https://api.example.com');
    expect(deployment.outputDirectory).toBe('dist');
    expect(deployment.rewrites).toEqual([
      { source: '/api/:path*', destination: 'https://api.example.com/api/:path*' },
      { source: '/(.*)', destination: '/index.html' },
    ]);
    expect(deployment.headers[0].headers).toContainEqual({ key: 'Cache-Control', value: 'no-store' });
  });
  it.each(['', 'http://api.example.com', 'https://localhost', 'https://127.0.0.1', 'https://api.example.com/api', 'https://secret@api.example.com'])('rejects unsafe/missing backend configuration: %j', (backend) => {
    expect(() => config(backend)).toThrow();
  });
});
