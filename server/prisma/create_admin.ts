import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const USERNAME = 'admin';
const PASSWORD = 'admin@123';

async function main() {
  const password = await bcrypt.hash(PASSWORD, 12);
  const admin = await prisma.user.upsert({
    where: { username: USERNAME },
    update: { password, role: 'admin', is_active: true, must_change_password: false },
    create: {
      name: 'Admin',
      email: 'admin@officerapp.local',
      number: '0000000000',
      police_station: 'HQ',
      username: USERNAME,
      password,
      role: 'admin',
      is_active: true,
      must_change_password: false,
    },
  });
  console.log(`admin ready: username=${USERNAME} password=${PASSWORD} id=${admin.id}`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
