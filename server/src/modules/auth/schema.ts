import { z } from 'zod';

export const RegisterSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(150),
  number: z.string().max(20),
  police_station: z.string().max(150),
  avatar_url: z.string().url().optional(),
});

export const LoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const ChangePasswordSchema = z.object({
  current_password: z.string().min(1).optional(),
  new_password: z.string().min(6).max(72),
});
