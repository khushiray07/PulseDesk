import 'dotenv/config';
import { app } from './app.js';
import { prisma } from './utils/prisma.js';

await prisma.$connect();
const server = app.listen(Number(process.env.PORT || 5000), process.env.HOST || '127.0.0.1', () => {
  console.log(`PulseDesk API listening on port ${process.env.PORT || 5000}`);
});

async function shutdown() {
  server.close(async () => { await prisma.$disconnect(); process.exit(0); });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
