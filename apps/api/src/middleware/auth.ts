import { Request, Response, NextFunction } from 'express';

const API_KEY = process.env.API_KEY || 'your-secret-api-key-change-me';

export function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing X-API-Key header',
    });
  }

  if (apiKey !== API_KEY) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid API key',
    });
  }

  next();
}

// Optional auth for SSE stream (allows both authenticated and public access with query param)
export function optionalApiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;

  if (apiKey && apiKey !== API_KEY) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid API key',
    });
  }

  // Store auth status for later use
  (req as any).isAuthenticated = apiKey === API_KEY;
  next();
}
