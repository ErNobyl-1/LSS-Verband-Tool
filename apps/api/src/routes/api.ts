import { Router, Request, Response } from 'express';
import { incidentQuerySchema } from '../validation/schemas.js';
import { queryIncidents, getIncidentById } from '../services/incidents.js';
import { addClient, removeClient, getClientCount } from '../services/sse.js';

const router = Router();

// GET /api/incidents - List incidents with filtering
router.get('/incidents', async (req: Request, res: Response) => {
  try {
    const parseResult = incidentQuerySchema.safeParse(req.query);

    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation Error',
        details: parseResult.error.issues,
      });
    }

    const result = await queryIncidents(parseResult.data);

    return res.json({
      success: true,
      data: result.incidents,
      meta: {
        total: result.total,
        limit: parseResult.data.limit,
        offset: parseResult.data.offset,
      },
    });
  } catch (error) {
    console.error('Error querying incidents:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/incidents/:id - Get single incident
router.get('/incidents/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid incident ID',
      });
    }

    const incident = await getIncidentById(id);

    if (!incident) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Incident not found',
      });
    }

    return res.json({
      success: true,
      data: incident,
    });
  } catch (error) {
    console.error('Error fetching incident:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/stream - SSE endpoint for live updates
router.get('/stream', (req: Request, res: Response) => {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // For nginx proxy

  // Send initial connection message
  res.write(`event: connected\n`);
  res.write(`data: ${JSON.stringify({ message: 'Connected to SSE stream', timestamp: new Date().toISOString() })}\n\n`);

  // Add client to broadcast list
  addClient(res);

  // Send heartbeat every 30 seconds to keep connection alive
  const heartbeatInterval = setInterval(() => {
    try {
      res.write(`event: heartbeat\n`);
      res.write(`data: ${JSON.stringify({ timestamp: new Date().toISOString(), clients: getClientCount() })}\n\n`);
    } catch (error) {
      clearInterval(heartbeatInterval);
      removeClient(res);
    }
  }, 30000);

  // Handle client disconnect
  req.on('close', () => {
    clearInterval(heartbeatInterval);
    removeClient(res);
  });
});

// GET /api/health - Health check endpoint
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    sseClients: getClientCount(),
  });
});

export default router;
