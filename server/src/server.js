import 'dotenv/config';
import { app } from './app.js';
import { prisma } from './utils/prisma.js';
import { closeSessionStore } from './auth/session.js';

await prisma.$connect();
const host = process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');
const server = app.listen(Number(process.env.PORT || 5000), host, () => {
  console.log(`PulseDesk API listening on port ${process.env.PORT || 5000}`);
});

async function shutdown() {
  server.close(async () => { await closeSessionStore(); await prisma.$disconnect(); process.exit(0); });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
