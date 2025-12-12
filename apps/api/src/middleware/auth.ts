import { Request, Response, NextFunction } from 'express';
import { validateSession } from '../services/auth.js';
import { User } from '../db/index.js';
import { apiLogger as logger } from '../lib/logger.js';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

// Paths that don't require authentication
const PUBLIC_PATHS = [
  '/health',
  '/auth/login',
  '/auth/register',
];

// Check if path starts with any of the public prefixes
function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.some(p => path === p || path.startsWith(p + '/'));
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // Allow public paths without authentication
  if (isPublicPath(req.path)) {
    return next();
  }

  // Extract token from Authorization header or query parameter
  let token: string | undefined;

  // Check Authorization header first (format: "Bearer TOKEN")
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  }

  // Fall back to query parameter (for SSE connections)
  if (!token && req.query.token) {
    token = req.query.token as string;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Nicht angemeldet',
    });
  }

  try {
    // Validate session and get user
    const user = await validateSession(token);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Session abgelaufen oder ungültig',
      });
    }

    // Check if user is active (approved by admin)
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Account noch nicht freigeschaltet',
        code: 'PENDING_APPROVAL',
      });
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    logger.error({ err: error }, 'Auth middleware error');
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Authentifizierung fehlgeschlagen',
    });
  }
}

// Middleware that requires admin role
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Nicht angemeldet',
    });
  }

  if (!req.user.isAdmin) {
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'Admin-Berechtigung erforderlich',
    });
  }

  next();
}

// Middleware that allows pending users (for /auth/me endpoint)
export async function authMiddlewareAllowPending(req: Request, res: Response, next: NextFunction) {
  // Extract token
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  }

  if (!token && req.query.token) {
    token = req.query.token as string;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Nicht angemeldet',
    });
  }

  try {
    const user = await validateSession(token);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Session abgelaufen oder ungültig',
      });
    }

    // Allow pending users
    req.user = user;
    next();
  } catch (error) {
    logger.error({ err: error }, 'Auth middleware error');
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Authentifizierung fehlgeschlagen',
    });
  }
}
