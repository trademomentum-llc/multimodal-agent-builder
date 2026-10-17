import type { Request } from 'express';

/** Session user populated by the Replit OIDC passport strategy (see replitAuth.ts). */
export interface AuthUser {
  claims: { sub: string; email?: string; exp?: number; [key: string]: unknown };
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
}

/** Request type for handlers that run after `isAuthenticated` (or check `req.user` themselves). */
export type AuthenticatedRequest = Request<Record<string, string>> & {
  user: AuthUser;
};
