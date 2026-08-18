import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const stations: Array<{ name: string; latitude: number; longitude: number }> = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'stations_seed.json'), 'utf-8'),
  );

  // Upsert rather than deleteMany + createMany: a wipe also destroyed any
  // station auto-created from a CSV upload (csvUpload/service.ts).
  for (const s of stations) {
    await prisma.station.upsert({
      where: { name: s.name },
      update: { latitude: s.latitude, longitude: s.longitude },
      create: s,
    });
  }

  console.log(`stations seeded: ${stations.length} upserted`);
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
