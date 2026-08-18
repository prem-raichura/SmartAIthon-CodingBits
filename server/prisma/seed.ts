import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  // Clear demo data so re-running seed stays idempotent (FK-safe order).
  // Users are preserved (upserted below); their assignments/notifications/validations
  // are rebuilt. unassign_requests and location_pings must go first — both
  // reference assignments with RESTRICT, so omitting them made a second
  // `npm run seed` fail with a foreign-key violation.
  await prisma.unassignRequest.deleteMany({});
  await prisma.locationPing.deleteMany({});
  await prisma.fieldValidation.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.assignment.deleteMany({});
  await prisma.runAnalytics.deleteMany({});
  await prisma.predictionCell.deleteMany({});
  await prisma.predictionRun.deleteMany({});
  console.log('Cleared prior demo data (unassign requests, pings, validations, notifications, assignments, analytics, cells, runs).');

  // Admin
  const adminHash = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
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
  console.log(`Admin seeded → id: ${admin.id} | username: admin | password: admin123`);

  // Officer
  const officerHash = await bcrypt.hash('officer123', 12);
  const officer = await prisma.user.upsert({
    where: { username: 'officer' },
    update: {},
    create: {
      name: 'Ravi Kumar',
      email: 'ravi.kumar@police.gov.in',
      number: '9876543210',
      police_station: 'Koramangala PS',
      username: 'officer',
      password: officerHash,
      role: 'officer',
      is_active: true,
    },
  });
  console.log(`Officer seeded → id: ${officer.id} | username: officer | password: officer123`);

  // PredictionRun
  const run = await prisma.predictionRun.create({
    data: {
      csv_path: '/data/predictions/btp_h24_run1.csv',
      model_version: '1.0.0',
      prediction_window: 'H24',
      h3_resolution: 8,
      status: 'done',
      run_at: new Date(),
    },
  });
  console.log(`PredictionRun seeded → run_id: ${run.run_id}`);

  // PredictionCells — real coordinates from the dataset, varied risk
  const cellsData = [
    {
      h3_index: '881f8d6591fffff',
      latitude: 12.9716,
      longitude: 77.5946,
      risk_level: 'critical' as const,
      predicted_violations: 42,
      h3_resolution: 8,
      prediction_window: 'H24' as const,
    },
    {
      h3_index: '881f8d6559fffff',
      latitude: 12.9352,
      longitude: 77.6245,
      risk_level: 'high' as const,
      predicted_violations: 28,
      h3_resolution: 8,
      prediction_window: 'H24' as const,
    },
    {
      h3_index: '881f8d6541fffff',
      latitude: 12.9081,
      longitude: 77.6476,
      risk_level: 'medium' as const,
      predicted_violations: 14,
      h3_resolution: 8,
      prediction_window: 'H24' as const,
    },
    {
      h3_index: '881f8d6529fffff',
      latitude: 13.0012,
      longitude: 77.5980,
      risk_level: 'low' as const,
      predicted_violations: 5,
      h3_resolution: 8,
      prediction_window: 'H24' as const,
    },
  ];

  const cells = [];
  for (const c of cellsData) {
    const cell = await prisma.predictionCell.create({
      data: { run_id: run.run_id, ...c },
    });
    cells.push(cell);
    console.log(`Cell seeded → ${cell.cell_id} | risk: ${cell.risk_level} | lat: ${cell.latitude}`);
  }

  // Assignments (active x2, completed) for officer — no pending stage
  // active — high-risk cell
  const secondActiveAssignment = await prisma.assignment.create({
    data: {
      user_id: officer.id,
      cell_id: cells[1].cell_id,
      run_id: run.run_id,
      status: 'active',
      time_limit: new Date(Date.now() + 24 * 60 * 60 * 1000),
      opened_at: new Date(Date.now() - 15 * 60 * 1000),
      notified_at: new Date(Date.now() - 30 * 60 * 1000),
    },
  });
  console.log(`Assignment (active/high) seeded → id: ${secondActiveAssignment.id}`);

  // active — critical cell
  const activeAssignment = await prisma.assignment.create({
    data: {
      user_id: officer.id,
      cell_id: cells[0].cell_id,
      run_id: run.run_id,
      status: 'active',
      time_limit: new Date(Date.now() + 12 * 60 * 60 * 1000),
      opened_at: new Date(Date.now() - 30 * 60 * 1000),
      notified_at: new Date(Date.now() - 60 * 60 * 1000),
    },
  });
  console.log(`Assignment (active) seeded → id: ${activeAssignment.id}`);

  // completed — medium cell with validation
  const completedAssignment = await prisma.assignment.create({
    data: {
      user_id: officer.id,
      cell_id: cells[2].cell_id,
      run_id: run.run_id,
      status: 'completed',
      opened_at: new Date(Date.now() - 3 * 60 * 60 * 1000),
      notified_at: new Date(Date.now() - 4 * 60 * 60 * 1000),
    },
  });
  await prisma.fieldValidation.create({
    data: {
      assignment_id: completedAssignment.id,
      officer_id: officer.id,
      cell_id: cells[2].cell_id,
      has_congestion: true,
      congestion_severity: 'medium',
      dominant_vehicle_type: 'two-wheeler',
      vehicle_count_approx: 85,
      notes: 'Heavy two-wheeler traffic near Silk Board junction. Minor congestion during lunch hour.',
    },
  });
  console.log(`Assignment (completed) seeded → id: ${completedAssignment.id}`);

  // Notifications for officer
  await prisma.notification.create({
    data: {
      user_id: officer.id,
      assignment_id: secondActiveAssignment.id,
      type: 'assignment',
      title: 'New patrol zone assigned',
      body: `You have been assigned to patrol a high-risk zone near MG Road. Active within 24 hours.`,
      is_read: false,
    },
  });
  await prisma.notification.create({
    data: {
      user_id: officer.id,
      assignment_id: activeAssignment.id,
      type: 'assignment',
      title: 'Critical zone — active patrol',
      body: 'Your zone near Majestic has critical risk. Please complete validation promptly.',
      is_read: true,
    },
  });
  console.log('Notifications seeded.');

  console.log('\n✓ Seed complete.');
  console.log('  Login: username=officer  password=officer123');
  console.log('  Admin: username=admin    password=admin123\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    // Without this the open pg pool keeps the process alive.
    await pool.end();
  });
