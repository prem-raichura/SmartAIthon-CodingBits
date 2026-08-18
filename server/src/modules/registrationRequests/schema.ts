import { z } from 'zod';

export const RejectSchema = z.object({
  reason: z.string().optional(),
});
