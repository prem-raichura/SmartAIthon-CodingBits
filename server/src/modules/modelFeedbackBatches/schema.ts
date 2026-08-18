import { z } from 'zod';

export const GenerateBatchSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/, 'Format: YYYY-MM or YYYY-MM-DD'),
  model_version: z.string().max(50),
});
