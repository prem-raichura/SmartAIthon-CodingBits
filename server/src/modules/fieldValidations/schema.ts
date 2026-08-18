import { z } from 'zod';

// All fields compulsory — this report feeds monthly model retraining.
export const CreateValidationSchema = z.object({
  assignment_id: z.string().uuid(),
  cell_id: z.string().uuid(),
  has_congestion: z.boolean(),
  congestion_severity: z.enum(['none', 'low', 'medium', 'high']),
  dominant_vehicle_type: z.string().min(1).max(50),
  vehicle_count_approx: z.number().int().min(0),
  opinion: z.string().min(1),
  notes: z.string().optional(),
  latitude: z.number(),
  longitude: z.number(),
  photo_url: z.string().url(),
});
