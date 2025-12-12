import { Router, Request, Response } from 'express';
import { incidentQuerySchema } from '../validation/schemas.js';
import { queryIncidents, getIncidentById } from '../services/incidents.js';
import { addClient, removeClient, getClientCount } from '../services/sse.js';
import { getLatestAllianceStats, getAllianceStatsHistory, getAggregatedStats } from '../services/alliance-stats.js';
import { getAllMembers, getOnlineMembers, getMemberById, getMemberActivityHistory, getMemberCounts } from '../services/alliance-members.js';

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

// GET /api/alliance/stats - Get latest alliance stats
router.get('/alliance/stats', async (req: Request, res: Response) => {
  try {
    const latest = await getLatestAllianceStats();

    if (!latest) {
      return res.json({
        success: true,
        data: null,
        message: 'No alliance stats available yet',
      });
    }

    return res.json({
      success: true,
      data: latest,
    });
  } catch (error) {
    console.error('Error fetching alliance stats:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/alliance/stats/history - Get alliance stats history
router.get('/alliance/stats/history', async (req: Request, res: Response) => {
  try {
    const { alliance_id, period, limit, from, to } = req.query;

    // If no alliance_id provided, try to get from latest stats
    let allianceId: number;
    if (alliance_id) {
      allianceId = parseInt(alliance_id as string, 10);
      if (isNaN(allianceId)) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid alliance_id',
        });
      }
    } else {
      const latest = await getLatestAllianceStats();
      if (!latest) {
        return res.json({
          success: true,
          data: [],
          message: 'No alliance stats available yet',
        });
      }
      allianceId = latest.allianceId;
    }

    // Use aggregated stats if period is specified
    if (period) {
      const validPeriods = ['hour', 'day', 'week', 'month'];
      if (!validPeriods.includes(period as string)) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid period. Must be one of: hour, day, week, month',
        });
      }

      const limitNum = limit ? parseInt(limit as string, 10) : 30;
      const history = await getAggregatedStats(
        allianceId,
        period as 'hour' | 'day' | 'week' | 'month',
        limitNum
      );

      return res.json({
        success: true,
        data: history,
        meta: {
          allianceId,
          period,
          count: history.length,
        },
      });
    }

    // Otherwise return raw history with optional date filters
    const options: { from?: Date; to?: Date; limit?: number } = {};
    if (from) options.from = new Date(from as string);
    if (to) options.to = new Date(to as string);
    if (limit) options.limit = parseInt(limit as string, 10);

    const history = await getAllianceStatsHistory(allianceId, options);

    return res.json({
      success: true,
      data: history,
      meta: {
        allianceId,
        count: history.length,
      },
    });
  } catch (error) {
    console.error('Error fetching alliance stats history:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================
// ALLIANCE MEMBERS ENDPOINTS
// ============================================

// GET /api/members - Get all members (excludes configured excluded members)
router.get('/members', async (req: Request, res: Response) => {
  try {
    const { online_only } = req.query;

    const members = online_only === 'true'
      ? await getOnlineMembers()
      : await getAllMembers();

    const counts = await getMemberCounts();

    return res.json({
      success: true,
      data: members,
      meta: {
        total: counts.total,
        online: counts.online,
      },
    });
  } catch (error) {
    console.error('Error fetching members:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/members/online - Get only online members
router.get('/members/online', async (req: Request, res: Response) => {
  try {
    const members = await getOnlineMembers();
    const counts = await getMemberCounts();

    return res.json({
      success: true,
      data: members,
      meta: {
        total: counts.total,
        online: counts.online,
      },
    });
  } catch (error) {
    console.error('Error fetching online members:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/members/:id - Get single member by LSS ID
router.get('/members/:id', async (req: Request, res: Response) => {
  try {
    const lssMemberId = parseInt(req.params.id, 10);

    if (isNaN(lssMemberId)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid member ID',
      });
    }

    const member = await getMemberById(lssMemberId);

    if (!member) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Member not found',
      });
    }

    return res.json({
      success: true,
      data: member,
    });
  } catch (error) {
    console.error('Error fetching member:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/members/:id/activity - Get member activity history
router.get('/members/:id/activity', async (req: Request, res: Response) => {
  try {
    const lssMemberId = parseInt(req.params.id, 10);
    const { from, limit } = req.query;

    if (isNaN(lssMemberId)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid member ID',
      });
    }

    const options: { from?: Date; limit?: number } = {};
    if (from) options.from = new Date(from as string);
    if (limit) options.limit = parseInt(limit as string, 10);

    const activity = await getMemberActivityHistory(lssMemberId, options);

    return res.json({
      success: true,
      data: activity,
      meta: {
        lssMemberId,
        count: activity.length,
      },
    });
  } catch (error) {
    console.error('Error fetching member activity:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
