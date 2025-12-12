import { z } from 'zod';

// Schema for incoming incident data
export const incidentInputSchema = z.object({
  ls_id: z.string().min(1, 'ls_id is required'),
  title: z.string().min(1, 'title is required').max(500),
  type: z.string().max(100).optional().nullable(),
  status: z.string().max(50).optional().default('active'),
  source: z.enum(['alliance', 'alliance_event', 'own', 'own_shared', 'unknown']).optional().default('unknown'),
  category: z.enum(['emergency', 'planned', 'event']).optional().default('emergency'),
  lat: z.number().min(-90).max(90).optional().nullable(),
  lon: z.number().min(-180).max(180).optional().nullable(),
  address: z.string().optional().nullable(),
  raw_json: z.record(z.any()).optional().nullable(),
});

// Allow both single object and array
export const incidentIngestSchema = z.union([
  incidentInputSchema,
  z.array(incidentInputSchema),
]);

// Query parameters for listing incidents
export const incidentQuerySchema = z.object({
  source: z.enum(['alliance', 'alliance_event', 'own', 'own_shared', 'unknown']).optional(),
  category: z.enum(['emergency', 'planned', 'event']).optional(),
  status: z.string().optional(),
  q: z.string().optional(),
  limit: z.coerce.number().min(1).max(1000).optional().default(100),
  offset: z.coerce.number().min(0).optional().default(0),
});

export type IncidentInput = z.infer<typeof incidentInputSchema>;
export type IncidentQuery = z.infer<typeof incidentQuerySchema>;
