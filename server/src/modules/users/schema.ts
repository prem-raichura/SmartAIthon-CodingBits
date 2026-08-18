import { z } from 'zod';

export const PatchUserSchema = z.object({
  is_active: z.boolean().optional(),
  name: z.string().max(100).optional(),
  number: z.string().max(20).optional(),
  police_station: z.string().max(150).optional(),
  avatar_url: z.string().url().optional().nullable(),
});

export const UpdateMeSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().max(150).optional(),
  number: z.string().max(20).optional(),
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9._]+$/, 'Username may only use letters, numbers, dot and underscore')
    .optional(),
});

export const PushTokenSchema = z.object({
  push_token: z.string().min(1),
});
