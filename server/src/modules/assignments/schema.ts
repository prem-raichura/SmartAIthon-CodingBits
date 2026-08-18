import { z } from 'zod';

export const CreateAssignmentSchema = z.object({
  user_id: z.string().uuid(),
  cell_id: z.string().uuid(),
  run_id: z.string().uuid(),
  time_limit: z.string().datetime().optional(),
});

export const PatchAssignmentSchema = z.object({
  action: z.enum(['open', 'complete', 'expire']),
});
