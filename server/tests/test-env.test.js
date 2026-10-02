import { describe, expect, it } from 'vitest';
import { getTestEnvironment } from '../scripts/test-env.mjs';

describe('test database isolation', () => {
  it('requires an explicit test database URL', () => {
    expect(() => getTestEnvironment({})).toThrow('Set TEST_DATABASE_URL');
  });

  it('rejects a database without the required test suffix', () => {
    expect(() => getTestEnvironment({ TEST_DATABASE_URL: 'postgresql://user@localhost/pulsedesk' })).toThrow('must end in _test');
  });

  it.each([
    ['postgresql://dev@localhost/pulsedesk_test', 'postgresql://test:secret@127.0.0.1:5432/pulsedesk_test?schema=other'],
    ['postgresql://dev@[::1]:5432/pulsedesk_test', 'postgresql://test@localhost/pulsedesk_test'],
    ['postgresql://dev@db.example:5432/pulsedesk_test', 'postgresql://test@db.example/pulsedesk_test?schema=public'],
  ])('rejects the same database despite URL differences', (development, target) => {
    expect(() => getTestEnvironment({ DATABASE_URL: development, TEST_DATABASE_URL: target })).toThrow('development database');
  });

  it('selects the separate test database without modifying the caller environment', () => {
    const source = { DATABASE_URL: 'postgresql://user@localhost/pulsedesk', TEST_DATABASE_URL: 'postgresql://user@localhost/pulsedesk_test' };
    const result = getTestEnvironment(source);
    expect(result.DATABASE_URL).toBe(source.TEST_DATABASE_URL);
    expect(result.PULSEDESK_TEST_DATABASE_VERIFIED).toBe('true');
    expect(result.ATTACHMENT_STORAGE_DIR).toContain('/.local/test-attachments/');
    expect(result.ATTACHMENT_STORAGE_DIR).not.toBe(source.ATTACHMENT_STORAGE_DIR);
    expect(source.DATABASE_URL).toBe('postgresql://user@localhost/pulsedesk');
  });
});
