import type { Request, Response, NextFunction } from 'express';
import { getConfig } from '../config.js';

function readApiKey(req: Request): string | undefined {
  const header = req.headers['x-api-key'];
  if (typeof header === 'string' && header.trim()) return header.trim();
  const auth = req.headers.authorization;
  if (!auth) return undefined;
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim();
}

export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  const cfg = getConfig();
  const expected = cfg.API_KEY;
  const provided = readApiKey(req);
  if (!expected || !provided || provided !== expected) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}
