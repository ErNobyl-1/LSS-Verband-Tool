import { Router, Request, Response } from 'express';
import { incidentIngestSchema } from '../validation/schemas.js';
import { upsertIncident, upsertIncidents } from '../services/incidents.js';
import { apiKeyAuth } from '../middleware/auth.js';

const router = Router();

// POST /ingest/incidents - Ingest one or more incidents
router.post('/incidents', apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const parseResult = incidentIngestSchema.safeParse(req.body);

    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation Error',
        details: parseResult.error.issues,
      });
    }

    const data = parseResult.data;

    // Handle array or single object
    if (Array.isArray(data)) {
      if (data.length === 0) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Empty array provided',
        });
      }

      const result = await upsertIncidents(data);

      return res.status(200).json({
        success: true,
        message: `Processed ${result.incidents.length} incidents`,
        created: result.created,
        updated: result.updated,
        incidents: result.incidents,
      });
    }

    // Single incident
    const result = await upsertIncident(data);

    return res.status(result.isNew ? 201 : 200).json({
      success: true,
      message: result.isNew ? 'Incident created' : 'Incident updated',
      incident: result.incident,
    });
  } catch (error) {
    console.error('Error ingesting incidents:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
