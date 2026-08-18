import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { env } from '../config/env.js';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function makePrisma() {
  const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? makePrisma();

if (env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
