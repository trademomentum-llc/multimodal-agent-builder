import helmet from 'helmet';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import sanitizeHtml from 'sanitize-html';
// Security headers middleware
export const securityMiddleware = helmet({
  // Disable Helmet's built-in CSP as we set a dynamic one with nonces below
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  frameguard: { action: 'deny' },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
});

// Per-request CSP with nonces. In dev we still allow 'unsafe-inline' due to tooling,
// but we include a nonce and encourage clients to adopt it.
export const cspWithNonce = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    const nonce = crypto.randomBytes(16).toString('base64');
    (res.locals as any).cspNonce = nonce;

    const isDev = process.env.NODE_ENV !== 'production';
    const scriptSrc = ["'self'", `'nonce-${nonce}'`];
    const styleSrc = ["'self'", `'nonce-${nonce}'`, 'https://fonts.googleapis.com'];
    const base = [
      `default-src 'self'`,
      `script-src ${scriptSrc.concat(isDev ? ["'unsafe-inline'"] : []).join(' ')}`,
      `style-src ${styleSrc.concat(isDev ? ["'unsafe-inline'"] : []).join(' ')}`,
      `img-src 'self' data: https:`,
      `font-src 'self' https://fonts.gstatic.com`,
      `connect-src 'self' ws: wss:`,
      `frame-src 'none'`,
      `object-src 'none'`,
      `base-uri 'self'`,
    ];

    res.setHeader('Content-Security-Policy', base.join('; '));
    next();
  };
};

// Rate limiting configuration - Relaxed for development
export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2000, // Significantly increased limit to prevent 429 errors during development
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  skip: (req) => {
    // Skip rate limiting for development dashboard endpoints
    const developmentSkipPaths = ['/api/dashboard/', '/api/auth/user'];
    return (
      process.env.NODE_ENV === 'development' &&
      developmentSkipPaths.some((path) => req.path.includes(path))
    );
  },
});

// Stricter rate limiting for sensitive operations
export const strictRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: {
    error:
      'Too many sensitive operations from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// CSRF protection middleware
export const csrfProtection = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Skip CSRF for GET requests and API endpoints with proper authentication
  if (req.method === 'GET' || req.path.startsWith('/api/auth/')) {
    return next();
  }

  const token = req.headers['x-csrf-token'] || req.body._csrf;
  const sessionToken = req.session?.csrfToken;

  if (!token || !sessionToken || token !== sessionToken) {
    return res.status(403).json({ message: 'CSRF token mismatch' });
  }

  next();
};

// Input sanitization middleware
export const sanitizeInput = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Recursively sanitize object properties
  const sanitizeObject = (obj: any): any => {
    if (typeof obj === 'string') {
      // Robust HTML/script tag removal using sanitize-html
      return sanitizeHtml(obj, { allowedTags: [], allowedAttributes: {} }).trim();
    }

    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }

    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          sanitized[key] = sanitizeObject(obj[key]);
        }
      }
      return sanitized;
    }

    return obj;
  };

  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  next();
};

// IP whitelisting middleware (for development/testing)
export const ipWhitelist = (allowedIPs: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientIP =
      req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];

    if (process.env.NODE_ENV === 'development') {
      return next(); // Skip in development
    }

    if (allowedIPs.includes(clientIP as string)) {
      return next();
    }

    res.status(403).json({ message: 'Access denied from this IP address' });
  };
};

// Request size limiting
export const requestSizeLimit = (limit: string = '10mb') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = req.headers['content-length'];
    const maxSize = parseSize(limit);

    if (contentLength && parseInt(contentLength) > maxSize) {
      return res.status(413).json({ message: 'Request entity too large' });
    }

    next();
  };
};

function parseSize(size: string): number {
  const units: { [key: string]: number } = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
  };

  const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*([a-z]+)?$/);
  if (!match) return 0;

  const value = parseFloat(match[1]);
  const unit = match[2] || 'b';

  return Math.floor(value * (units[unit] || 1));
}
