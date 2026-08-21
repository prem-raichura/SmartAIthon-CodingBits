import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Every data table except "stations" (and except _prisma_migrations).
const TABLES = [
  'field_validations',
  'location_pings',
  'notifications',
  'unassign_requests',
  'assignments',
  'model_feedback_batches',
  'run_analytics',
  'prediction_cells',
  'prediction_runs',
  'registration_requests',
  'users',
];

const CONFIRM = process.argv.includes('--confirm');

async function counts(label: string) {
  const rows: Record<string, number> = {};
  for (const t of [...TABLES, 'stations']) {
    const r = await prisma.$queryRawUnsafe<{ c: bigint }[]>(
      `SELECT COUNT(*)::bigint AS c FROM "${t}";`,
    );
    rows[t] = Number(r[0].c);
  }
  console.log(`\n=== ${label} ===`);
  console.table(rows);
}

async function main() {
  const url = new URL(process.env.DATABASE_URL!);
  console.log(`Target DB: ${url.host}${url.pathname}`);

  await counts('BEFORE');

  if (!CONFIRM) {
    console.log('\n[preview] No changes made. Re-run with --confirm to execute.');
    return;
  }

  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE;`,
  );

  console.log('\nDone. Only "stations" data remains.');
  await counts('AFTER');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
