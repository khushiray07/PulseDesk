import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import pg from 'pg';
import { authConfig, cookieOptions } from './config.js';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
const PgStore = connectPgSimple(session);
const store = new PgStore({ pool, tableName: 'sessions', createTableIfMissing: false, disableTouch: true,
  pruneSessionInterval: process.env.NODE_ENV === 'test' ? false : 15 * 60,
});
export function sessionMiddleware() {
  return session({ name: authConfig.cookieName, secret: authConfig.secret, store,
    resave: false, saveUninitialized: false, cookie: { ...cookieOptions, maxAge: authConfig.maxAge },
  });
}
export async function closeSessionStore() { store.close(); await pool.end(); }
