import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Stable id so previously-issued admin JWTs remain valid.
const ADMIN_ID = '00000000-0000-4000-a000-000000000001';

// Every data table (everything except _prisma_migrations).
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
  'stations',
  'users',
];

async function main() {
  // Wipe all data in one shot (CASCADE handles FK order).
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE;`,
  );
  console.log('All tables truncated.');

  const adminHash = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.create({
    data: {
      id: ADMIN_ID,
      name: 'Admin',
      email: 'admin@officerapp.local',
      number: '0000000000',
      police_station: 'HQ',
      username: 'admin',
      password: adminHash,
      role: 'admin',
      is_active: true,
    },
  });

  console.log(`\nDone. DB now holds ONLY the admin user.`);
  console.log(`  username: admin`);
  console.log(`  password: admin123`);
  console.log(`  id: ${admin.id}`);
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
