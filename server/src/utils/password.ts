import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export const hashPassword = (plain: string) => bcrypt.hash(plain, 12);
export const comparePassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

export function genTempPassword(): string {
  return crypto.randomBytes(6).toString('hex');
}

export function genUsername(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
  const rand = crypto.randomBytes(3).toString('hex');
  return `${base}_${rand}`;
}
