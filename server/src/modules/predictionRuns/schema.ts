import { z } from 'zod';

export const CreateRunSchema = z.object({
  csv_path: z.string().min(1),
  model_version: z.string().max(50),
  prediction_window: z.enum(['H24', 'H48']).default('H24'),
  h3_resolution: z.number().int().min(0).max(15).default(8),
});
