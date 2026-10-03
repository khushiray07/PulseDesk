// Vercel project Root Directory: client. Use Vercel CLI 54.1.0 or newer.
// BACKEND_ORIGIN is public routing configuration, never a credential.
const backend = new URL(process.env.BACKEND_ORIGIN || 'https://missing.invalid');
if (!process.env.BACKEND_ORIGIN || backend.protocol !== 'https:' || backend.username || backend.password
  || backend.pathname !== '/' || backend.search || backend.hash
  || ['localhost', '127.0.0.1', '[::1]', '0.0.0.0'].includes(backend.hostname) || backend.hostname.endsWith('.localhost')) {
  throw new Error('Set BACKEND_ORIGIN to the deployed HTTPS Render origin, without a path or credentials.');
}

export const config = {
  framework: 'vite',
  installCommand: 'npm ci --include=dev',
  buildCommand: 'npm run build',
  outputDirectory: 'dist',
  rewrites: [
    { source: '/api/:path*', destination: `${backend.origin}/api/:path*` },
    { source: '/(.*)', destination: '/index.html' },
  ],
  headers: [{ source: '/api/:path*', headers: [
    { key: 'Cache-Control', value: 'no-store' },
    { key: 'CDN-Cache-Control', value: 'no-store' },
  ] }],
};
