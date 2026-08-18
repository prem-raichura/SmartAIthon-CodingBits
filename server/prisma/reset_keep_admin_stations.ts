import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const PREVIEW = process.argv.includes('--preview');

async function counts(label: string) {
  const [
    users, admins, stations, regReqs, runs, cells, analytics,
    assignments, notifications, validations, pings, unassign, feedback,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: 'admin' } }),
    prisma.station.count(),
    prisma.registrationRequest.count(),
    prisma.predictionRun.count(),
    prisma.predictionCell.count(),
    prisma.runAnalytics.count(),
    prisma.assignment.count(),
    prisma.notification.count(),
    prisma.fieldValidation.count(),
    prisma.locationPing.count(),
    prisma.unassignRequest.count(),
    prisma.modelFeedbackBatch.count(),
  ]);
  console.log(`\n=== ${label} ===`);
  console.table({
    users, admins, stations, registration_requests: regReqs, prediction_runs: runs,
    prediction_cells: cells, run_analytics: analytics, assignments, notifications,
    field_validations: validations, location_pings: pings, unassign_requests: unassign,
    model_feedback_batches: feedback,
  });
}

async function main() {
  await counts('BEFORE');

  if (PREVIEW) {
    console.log('\n[preview] no changes made. Re-run without --preview to execute.');
    return;
  }

  // Ordered deletes: children first, then parents. Stations untouched; admin users kept.
  await prisma.$transaction([
    prisma.locationPing.deleteMany({}),
    prisma.fieldValidation.deleteMany({}),
    prisma.unassignRequest.deleteMany({}),
    prisma.notification.deleteMany({}),
    prisma.assignment.deleteMany({}),
    prisma.modelFeedbackBatch.deleteMany({}),
    prisma.runAnalytics.deleteMany({}),
    prisma.predictionCell.deleteMany({}),
    prisma.predictionRun.deleteMany({}),
    // Break users -> registration_requests link before removing requests.
    prisma.user.updateMany({ data: { request_id: null } }),
    prisma.registrationRequest.deleteMany({}),
    // Keep admins exactly as-is (credentials untouched); drop everyone else.
    prisma.user.deleteMany({ where: { role: { not: 'admin' } } }),
  ]);

  console.log('\nDone. Kept: admin users (unchanged) + stations.');
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
