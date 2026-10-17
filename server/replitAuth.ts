import type { AuthUser } from './authTypes';
import * as client from 'openid-client';
import { Strategy, type VerifyFunction } from 'openid-client/passport';

import passport from 'passport';
import session from 'express-session';
import type { Express, RequestHandler } from 'express';
import memoize from 'memoizee';
import connectPg from 'connect-pg-simple';
import rateLimit from 'express-rate-limit';
import { storage } from './storage';
import lusca from 'lusca';

if (!process.env.REPLIT_DOMAINS) {
  throw new Error('Environment variable REPLIT_DOMAINS not provided');
}

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? 'https://replit.com/oidc'),
      process.env.REPL_ID!,
    );
  },
  { maxAge: 3600 * 1000 },
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: 'sessions',
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      maxAge: sessionTtl,
    },
  });
}

/**
 * Returns the CSRF protection middleware.
 * Should be used after getSession() in your Express app:
 *   app.use(getSession());
 *   app.use(getCsrfProtection());
 */
export function getCsrfProtection(): RequestHandler {
  return lusca.csrf();
}

function updateUserSession(
  user: Partial<AuthUser>,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
) {
  user.claims = tokens.claims() as AuthUser['claims'] | undefined;
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(claims: client.IDToken) {
  await storage.upsertUser({
    id: claims['sub'],
    email: claims['email'] as string | undefined,
    firstName: claims['first_name'] as string | undefined,
    lastName: claims['last_name'] as string | undefined,
    profileImageUrl: claims['profile_image_url'] as string | undefined,
  });
}

export async function setupAuth(app: Express) {
  // Define a rate limiter for login/auth endpoints
  const loginRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    standardHeaders: true, // Return rate limit info in the RateLimit-* headers
    legacyHeaders: false, // Disable the X-RateLimit-* headers
  });

  app.set('trust proxy', 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback,
  ) => {
    const user: Partial<AuthUser> = {};
    updateUserSession(user, tokens);
    const claims = tokens.claims();
    if (!claims) {
      verified(new Error('OIDC token response contained no ID token claims'));
      return;
    }
    await upsertUser(claims);
    verified(null, user);
  };

  for (const domain of process.env.REPLIT_DOMAINS!.split(',')) {
    const strategy = new Strategy(
      {
        name: `replitauth:${domain}`,
        config,
        scope: 'openid email profile offline_access',
        callbackURL: `https://${domain}/api/callback`,
      },
      verify,
    );
    passport.use(strategy);
  }

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get('/api/login', loginRateLimiter, (req, res, next) => {
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: 'login consent',
      scope: ['openid', 'email', 'profile', 'offline_access'],
    })(req, res, next);
  });

  app.get('/api/callback', loginRateLimiter, (req, res, next) => {
    passport.authenticate(`replitauth:${req.hostname}`, {
      successReturnToOrRedirect: '/',
      failureRedirect: '/api/login',
    })(req, res, next);
  });

  app.get('/api/logout', loginRateLimiter, (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href,
      );
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as Partial<AuthUser> | undefined;

  if (!req.isAuthenticated() || !user?.expires_at) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
};
