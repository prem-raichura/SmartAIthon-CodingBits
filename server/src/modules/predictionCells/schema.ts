import { z } from 'zod';

export const ListCellsQuerySchema = z.object({
  run_id: z.string().optional(),
  risk_level: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  window: z.enum(['H24', 'H48']).optional(),
});
