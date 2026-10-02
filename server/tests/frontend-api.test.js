import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });
describe('deployment API routing', () => {
  it('keeps the same-origin API default for local development and the production proxy', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    const { api, apiUrl, attachmentContentUrl } = await import('../../client/src/services/api.js');
    expect(api.defaults.withCredentials).toBe(true);
    expect(apiUrl('/auth/google')).toBe('/api/auth/google');
    expect(attachmentContentUrl('ticket', 'file', true)).toBe('/api/tickets/ticket/attachments/file/content?download=1');
  });
  it('uses the configured base consistently for requests, login, and attachment content', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://support.example.com/api/');
    const { api, apiUrl, attachmentContentUrl } = await import('../../client/src/services/api.js');
    expect(api.getUri({ url: '/tickets', params: { search: 'pasword' } })).toBe('https://support.example.com/api/tickets?search=pasword');
    expect(apiUrl('/auth/google')).toBe('https://support.example.com/api/auth/google');
    expect(attachmentContentUrl('ticket', 'file')).toBe('https://support.example.com/api/tickets/ticket/attachments/file/content');
  });
});
