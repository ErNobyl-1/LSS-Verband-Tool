import { Router, Request, Response } from 'express';
import { incidentQuerySchema } from '../validation/schemas.js';
import { queryIncidents, getIncidentById } from '../services/incidents.js';
import { addClient, removeClient, getClientCount } from '../services/sse.js';
import { getLatestAllianceStats, getLatestAllianceStatsWithChanges, getLatestAllianceStatsWithAllChanges, getAllianceStatsHistory, getAggregatedStats } from '../services/alliance-stats.js';
import { getAllMembers, getOnlineMembers, getMemberById, getMemberActivityHistory, getMemberCounts } from '../services/alliance-members.js';
import { getAllMissionCredits, getMissionTypeCacheStats, refreshMissionTypes } from '../services/mission-types.js';
import { requireAdmin, authMiddlewareAllowPending } from '../middleware/auth.js';
import {
  getUserByLssName,
  verifyPassword,
  createSession,
  deleteSession,
  getAllUsers,
  getPendingUsers,
  activateUser,
  deleteUser,
  updateLastLogin,
  createUserAsAdmin,
  updateUserAsAdmin,
  resetUserPassword,
  updateOwnSettings,
  updateOwnPassword,
} from '../services/auth.js';
import { authMiddleware } from '../middleware/auth.js';

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

// GET /api/alliance/stats - Get latest alliance stats with 24h changes
router.get('/alliance/stats', async (req: Request, res: Response) => {
  try {
    const latest = await getLatestAllianceStatsWithChanges();

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

// GET /api/alliance/stats/full - Get latest alliance stats with all time period changes
router.get('/alliance/stats/full', async (req: Request, res: Response) => {
  try {
    const latest = await getLatestAllianceStatsWithAllChanges();

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
    console.error('Error fetching full alliance stats:', error);
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

// ============================================
// MISSION TYPES ENDPOINTS
// ============================================

// GET /api/mission-credits - Get all mission type credits (for frontend lookup)
router.get('/mission-credits', async (req: Request, res: Response) => {
  try {
    const credits = getAllMissionCredits();
    const stats = getMissionTypeCacheStats();

    return res.json({
      success: true,
      data: credits,
      meta: {
        count: stats.count,
        lastUpdate: stats.lastUpdate?.toISOString() || null,
      },
    });
  } catch (error) {
    console.error('Error fetching mission credits:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /api/mission-credits/refresh - Manually refresh mission credits from LSS API
router.post('/mission-credits/refresh', async (req: Request, res: Response) => {
  try {
    const count = await refreshMissionTypes();

    return res.json({
      success: true,
      message: `Refreshed ${count} mission types from LSS API`,
    });
  } catch (error) {
    console.error('Error refreshing mission credits:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================
// AUTHENTICATION ENDPOINTS
// ============================================

// POST /api/auth/login - Login
router.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const { lssName, password } = req.body;

    if (!lssName || !password) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: 'LSS-Name und Passwort erforderlich',
      });
    }

    // Find user
    const user = await getUserByLssName(lssName);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Ungültiger LSS-Name oder Passwort',
      });
    }

    // Verify password
    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Ungültiger LSS-Name oder Passwort',
      });
    }

    // Create session
    const token = await createSession(user.id);

    // Update last login
    await updateLastLogin(user.id);

    return res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          lssName: user.lssName,
          displayName: user.displayName,
          allianceMemberId: user.allianceMemberId,
          isActive: user.isActive,
          isAdmin: user.isAdmin,
        },
        token,
      },
    });
  } catch (error) {
    console.error('Error logging in:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Login fehlgeschlagen',
    });
  }
});

// POST /api/auth/logout - Logout
router.post('/auth/logout', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      await deleteSession(token);
    }

    return res.json({
      success: true,
      message: 'Erfolgreich abgemeldet',
    });
  } catch (error) {
    console.error('Error logging out:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Logout fehlgeschlagen',
    });
  }
});

// GET /api/auth/me - Get current user (allows pending users)
router.get('/auth/me', authMiddlewareAllowPending, (req: Request, res: Response) => {
  const user = req.user!;

  return res.json({
    success: true,
    data: {
      id: user.id,
      lssName: user.lssName,
      displayName: user.displayName,
      badgeColor: user.badgeColor,
      allianceMemberId: user.allianceMemberId,
      isActive: user.isActive,
      isAdmin: user.isAdmin,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    },
  });
});

// PUT /api/auth/settings - Update own settings
router.put('/auth/settings', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { displayName, badgeColor } = req.body;

    const updated = await updateOwnSettings(user.id, {
      displayName: displayName !== undefined ? displayName : user.displayName,
      badgeColor: badgeColor !== undefined ? badgeColor : user.badgeColor,
    });

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Benutzer nicht gefunden',
      });
    }

    return res.json({
      success: true,
      data: {
        id: updated.id,
        lssName: updated.lssName,
        displayName: updated.displayName,
        badgeColor: updated.badgeColor,
        allianceMemberId: updated.allianceMemberId,
        isActive: updated.isActive,
        isAdmin: updated.isAdmin,
      },
      message: 'Einstellungen gespeichert',
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Fehler beim Speichern der Einstellungen',
    });
  }
});

// PUT /api/auth/password - Change own password
router.put('/auth/password', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: 'Aktuelles und neues Passwort erforderlich',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: 'Neues Passwort muss mindestens 6 Zeichen lang sein',
      });
    }

    const result = await updateOwnPassword(user.id, currentPassword, newPassword);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: result.error === 'Current password is incorrect'
          ? 'Aktuelles Passwort ist falsch'
          : result.error,
      });
    }

    return res.json({
      success: true,
      message: 'Passwort geändert',
    });
  } catch (error) {
    console.error('Error changing password:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Fehler beim Ändern des Passworts',
    });
  }
});

// ============================================
// ADMIN ENDPOINTS (Require admin role)
// ============================================

// GET /api/admin/users - Get all users
router.get('/admin/users', requireAdmin, async (req: Request, res: Response) => {
  try {
    const users = await getAllUsers();

    return res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Fehler beim Laden der Benutzer',
    });
  }
});

// GET /api/admin/users/pending - Get pending users
router.get('/admin/users/pending', requireAdmin, async (req: Request, res: Response) => {
  try {
    const users = await getPendingUsers();

    return res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error('Error fetching pending users:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Fehler beim Laden der wartenden Benutzer',
    });
  }
});

// PUT /api/admin/users/:id/activate - Activate a user
router.put('/admin/users/:id/activate', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: 'Ungültige User-ID',
      });
    }

    const { allianceMemberId, displayName } = req.body;

    const user = await activateUser(
      id,
      allianceMemberId || null,
      displayName || null
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Benutzer nicht gefunden',
      });
    }

    return res.json({
      success: true,
      data: {
        id: user.id,
        lssName: user.lssName,
        displayName: user.displayName,
        allianceMemberId: user.allianceMemberId,
        isActive: user.isActive,
      },
      message: 'Benutzer freigeschaltet',
    });
  } catch (error) {
    console.error('Error activating user:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Fehler beim Freischalten des Benutzers',
    });
  }
});

// POST /api/admin/users - Create a new user (admin only)
router.post('/admin/users', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { lssName, password, displayName, badgeColor, allianceMemberId } = req.body;

    if (!lssName || typeof lssName !== 'string' || lssName.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: 'LSS-Name muss mindestens 2 Zeichen lang sein',
      });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: 'Passwort muss mindestens 6 Zeichen lang sein',
      });
    }

    // Check if user already exists
    const existingUser = await getUserByLssName(lssName.trim());
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'Conflict',
        message: 'Ein Account mit diesem LSS-Namen existiert bereits',
      });
    }

    const user = await createUserAsAdmin(
      lssName.trim(),
      password,
      displayName || null,
      badgeColor || null,
      allianceMemberId || null
    );

    return res.status(201).json({
      success: true,
      data: {
        id: user.id,
        lssName: user.lssName,
        displayName: user.displayName,
        badgeColor: user.badgeColor,
        allianceMemberId: user.allianceMemberId,
        isActive: user.isActive,
        isAdmin: user.isAdmin,
      },
      message: 'Benutzer erstellt',
    });
  } catch (error) {
    console.error('Error creating user:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Fehler beim Erstellen des Benutzers',
    });
  }
});

// PUT /api/admin/users/:id - Update a user (admin only)
router.put('/admin/users/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: 'Ungültige User-ID',
      });
    }

    const { displayName, badgeColor, allianceMemberId, isActive } = req.body;

    const user = await updateUserAsAdmin(id, {
      displayName: displayName !== undefined ? displayName : undefined,
      badgeColor: badgeColor !== undefined ? badgeColor : undefined,
      allianceMemberId: allianceMemberId !== undefined ? allianceMemberId : undefined,
      isActive: isActive !== undefined ? isActive : undefined,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Benutzer nicht gefunden',
      });
    }

    return res.json({
      success: true,
      data: {
        id: user.id,
        lssName: user.lssName,
        displayName: user.displayName,
        badgeColor: user.badgeColor,
        allianceMemberId: user.allianceMemberId,
        isActive: user.isActive,
        isAdmin: user.isAdmin,
      },
      message: 'Benutzer aktualisiert',
    });
  } catch (error) {
    console.error('Error updating user:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Fehler beim Aktualisieren des Benutzers',
    });
  }
});

// PUT /api/admin/users/:id/password - Reset user password (admin only)
router.put('/admin/users/:id/password', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: 'Ungültige User-ID',
      });
    }

    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: 'Neues Passwort muss mindestens 6 Zeichen lang sein',
      });
    }

    const success = await resetUserPassword(id, newPassword);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Benutzer nicht gefunden',
      });
    }

    return res.json({
      success: true,
      message: 'Passwort zurückgesetzt',
    });
  } catch (error) {
    console.error('Error resetting password:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Fehler beim Zurücksetzen des Passworts',
    });
  }
});

// GET /api/player-names - Get mapping of lssName -> displayName for all active users
router.get('/player-names', async (req: Request, res: Response) => {
  try {
    const users = await getAllUsers();

    // Build mapping: lssName -> displayName (only for users with displayName)
    const mapping: Record<string, string> = {};
    for (const user of users) {
      if (user.isActive && user.displayName) {
        mapping[user.lssName] = user.displayName;
      }
    }

    return res.json({
      success: true,
      data: mapping,
    });
  } catch (error) {
    console.error('Error fetching player names:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// DELETE /api/admin/users/:id - Delete a user
router.delete('/admin/users/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: 'Ungültige User-ID',
      });
    }

    // Prevent deleting yourself
    if (req.user?.id === id) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Du kannst deinen eigenen Account nicht löschen',
      });
    }

    const deleted = await deleteUser(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Benutzer nicht gefunden',
      });
    }

    return res.json({
      success: true,
      message: 'Benutzer gelöscht',
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Fehler beim Löschen des Benutzers',
    });
  }
});

export default router;
