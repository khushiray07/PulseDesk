import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const directory = resolve('.local/postgres');
const run = (command, args, options = {}) => execFileSync(command, args, { stdio: 'inherit', ...options });

try {
  if (process.argv[2] === 'stop') {
    if (existsSync(`${directory}/postmaster.pid`)) run('pg_ctl', ['-D', directory, 'stop', '-m', 'fast']);
    else console.log('Local PostgreSQL is already stopped.');
  } else {
    mkdirSync(resolve('.local'), { recursive: true });
    if (!existsSync(`${directory}/PG_VERSION`)) {
      run('initdb', ['-D', directory, '-U', 'pulsedesk', '--encoding=UTF8', '--locale=C', '--auth-local=trust', '--auth-host=trust']);
    }
    try {
      run('pg_ctl', ['-D', directory, 'status'], { stdio: 'ignore' });
    } catch {
      run('pg_ctl', ['-D', directory, '-l', resolve('.local/postgres.log'), '-o', '-h 127.0.0.1 -p 55432 -k ""', 'start', '-w']);
    }
    for (const name of ['pulsedesk', 'pulsedesk_test']) {
      const result = execFileSync('psql', ['-h', '127.0.0.1', '-p', '55432', '-U', 'pulsedesk', '-d', 'postgres', '-tAc', `SELECT 1 FROM pg_database WHERE datname = '${name}'`], { encoding: 'utf8' });
      if (!result.trim()) run('createdb', ['-h', '127.0.0.1', '-p', '55432', '-U', 'pulsedesk', name]);
    }
    console.log('PulseDesk databases are ready on 127.0.0.1:55432.');
  }
} catch (error) {
  console.error('Local database setup failed. Ensure PostgreSQL tools are on PATH, or use docker compose up -d instead.');
  process.exit(error.status || 1);
}
