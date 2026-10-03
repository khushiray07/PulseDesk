import 'dotenv/config';
import { pathToFileURL } from 'node:url';

export function assertDemoTarget(env, args) {
  if (!env.DATABASE_URL) throw new Error('Set DATABASE_URL before running the optional demo seed.');
  const target = new URL(env.DATABASE_URL);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname);
  if (!local && !args.includes('--production')) throw new Error('Remote demo seeding requires the explicit --production flag.');
  if (!local && (env.ATTACHMENT_STORAGE_DRIVER || 'local') !== 's3' && !env.RENDER_SERVICE_ID) {
    throw new Error('Run a filesystem-backed production demo seed inside the Render web service, so attachment bytes reach the serving instance.');
  }
}

async function main() {
  assertDemoTarget(process.env, process.argv.slice(2));
  const [{ prisma }, { attachmentStorage }, { seedDemo }] = await Promise.all([
    import('../src/utils/prisma.js'), import('../src/services/attachment-storage.js'), import('./demo-seed.js'),
  ]);
  try {
    const result = await seedDemo(prisma, attachmentStorage);
    console.log('Demo fixtures available: 60 tickets, 8 agents, 48 comments, 43 assignment pairs and 8 validated attachments.');
    console.log(`${result.upgradedLegacyTickets} unchanged legacy tickets upgraded; ${result.preservedEditedTickets} edited tickets preserved. Existing non-demo rows and users/sessions were not changed.`);
    console.log('Preserved non-demo tickets still count toward dashboard totals and pagination. Temporary-storage files may disappear after restart; rerun this seed on the backend to restore demo bytes.');
  } finally { await prisma.$disconnect(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => { console.error('Demo seeding failed. No database reset or deletion was performed. Review target, fixture conflicts and storage configuration before retrying.'); process.exitCode = 1; });
}
