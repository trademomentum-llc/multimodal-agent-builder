import { Request, Response, NextFunction } from 'express';
import { threatIntelligenceService } from '../services/threatIntelligence';
import { auditLogger } from '../services/auditLogger';

/**
 * Middleware to check if client IP is blacklisted
 */
export const blacklistMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const clientIP = getClientIP(req);

    if (!clientIP) {
      return next(); // No IP found, continue
    }

    // Check if IP is currently blacklisted
    const isBlacklisted =
      await threatIntelligenceService.isBlacklisted(clientIP);

    if (isBlacklisted) {
      // Log the blocked attempt
      await auditLogger.log(
        null,
        'security.blacklist.blocked',
        'security',
        {
          ipAddress: clientIP,
          userAgent: req.headers['user-agent'],
          requestPath: req.path,
          requestMethod: req.method,
        },
        req,
        false,
        `Blocked request from blacklisted IP: ${clientIP}`,
      );

      return res.status(403).json({
        error: 'Access Denied',
        message:
          'Your IP address has been temporarily blocked due to suspicious activity.',
        code: 'IP_BLACKLISTED',
      });
    }

    next();
  } catch (error) {
    console.error('Error in blacklist middleware:', error);
    // Don't block on middleware errors, but log them
    await auditLogger.log(
      null,
      'security.blacklist.error',
      'security',
      { error: (error as Error).message },
      req,
      false,
      'Blacklist middleware error',
    );
    next();
  }
};

/**
 * Middleware to analyze threats and handle failed requests
 */
export const threatAnalysisMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const originalJson = res.json;
  const originalStatus = res.status;
  let statusCode = 200;

  // Override status to capture the response code
  res.status = function (code: number) {
    statusCode = code;
    return originalStatus.call(this, code);
  };

  // Override json to capture response and analyze failures
  res.json = function (data: any) {
    const clientIP = getClientIP(req);

    // Analyze on completion for threat patterns
    setImmediate(async () => {
      try {
        if (clientIP) {
          // Check for various failure patterns
          if (statusCode === 401 && req.path.includes('/auth/')) {
            // Failed authentication attempt
            await threatIntelligenceService.handleFailedLogin(
              clientIP,
              null,
              req,
            );
          } else if (statusCode === 429) {
            // Rate limit exceeded - potential API abuse
            await threatIntelligenceService.handleApiAbuse(
              clientIP,
              req.path,
              req,
            );
          } else if (statusCode >= 400 && isSuspiciousRequest(req)) {
            // Suspicious request patterns
            await threatIntelligenceService.handleCurlAbuse(clientIP, req);
          }
        }
      } catch (error) {
        console.error('Error in threat analysis:', error);
      }
    });

    return originalJson.call(this, data);
  };

  next();
};

/**
 * Enhanced authentication failure handler
 */
export const authFailureHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const clientIP = getClientIP(req);

  if (clientIP && req.path.includes('/auth/') && res.statusCode === 401) {
    try {
      const userId = (req as any).user?.claims?.sub || null;
      await threatIntelligenceService.handleFailedLogin(clientIP, userId, req);
    } catch (error) {
      console.error('Error handling auth failure:', error);
    }
  }

  next();
};

/**
 * Extract client IP address with support for proxy headers
 */
function getClientIP(req: Request): string | null {
  // Check various headers for client IP (in order of preference)
  const xForwardedFor = req.headers['x-forwarded-for'];
  const xRealIP = req.headers['x-real-ip'];
  const connectionRemoteAddress = req.connection?.remoteAddress;
  const socketRemoteAddress = (req.socket as any)?.remoteAddress;
  const reqIP = (req as any).ip;

  let clientIP: string | null = null;

  if (xForwardedFor) {
    // X-Forwarded-For can contain multiple IPs, take the first one
    const ips = Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor;
    clientIP = ips.split(',')[0].trim();
  } else if (xRealIP) {
    clientIP = Array.isArray(xRealIP) ? xRealIP[0] : xRealIP;
  } else if (connectionRemoteAddress) {
    clientIP = connectionRemoteAddress;
  } else if (socketRemoteAddress) {
    clientIP = socketRemoteAddress;
  } else if (reqIP) {
    clientIP = reqIP;
  }

  // Clean up IPv6 mapped IPv4 addresses
  if (clientIP && clientIP.includes('::ffff:')) {
    clientIP = clientIP.replace('::ffff:', '');
  }

  // Filter out local/private IPs in production
  if (clientIP && process.env.NODE_ENV === 'production') {
    if (isPrivateIP(clientIP)) {
      return null;
    }
  }

  return clientIP;
}

/**
 * Check if an IP address is private/local
 */
function isPrivateIP(ip: string): boolean {
  const privateRanges = [
    /^127\./, // localhost
    /^10\./, // private class A
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // private class B
    /^192\.168\./, // private class C
    /^::1$/, // IPv6 localhost
    /^fe80:/, // IPv6 link-local
  ];

  return privateRanges.some((range) => range.test(ip));
}

/**
 * Detect suspicious request patterns
 */
function isSuspiciousRequest(req: Request): boolean {
  const userAgent = req.headers['user-agent'] || '';
  const path = req.path.toLowerCase();
  const method = req.method;

  // Suspicious patterns
  const suspiciousPatterns = [
    // Common admin/test paths
    /\/(admin|wp-admin|phpmyadmin|manager|console)/,
    // File extensions that shouldn't be requested on APIs
    /\.(php|asp|jsp|cgi|pl)$/,
    // SQL injection attempts in path
    /['";]|union|select|insert|delete|drop/i,
    // Path traversal attempts
    /\.\.\//,
    // Common vulnerability probes
    /\/(\.well-known|\.env|config|backup)/,
  ];

  // Suspicious user agents
  const suspiciousAgents = [
    /masscan|nmap|nikto|sqlmap|burp|metasploit|nuclei|acunetix/i,
    /python-requests|go-http-client|java\/1\./i,
  ];

  // Check for suspicious patterns
  if (suspiciousPatterns.some((pattern) => pattern.test(path))) {
    return true;
  }

  if (suspiciousAgents.some((pattern) => pattern.test(userAgent))) {
    return true;
  }

  // Unusual request patterns
  if (method === 'POST' && path.includes('..')) {
    return true;
  }

  // Check for automated tool signatures in headers
  const headers = JSON.stringify(req.headers).toLowerCase();
  if (
    headers.includes('scanner') ||
    headers.includes('probe') ||
    headers.includes('exploit')
  ) {
    return true;
  }

  return false;
}

/**
 * Cleanup middleware to run periodically
 */
export const scheduleBlacklistCleanup = () => {
  // Clean up expired entries every hour
  setInterval(
    async () => {
      try {
        await threatIntelligenceService.cleanupExpiredEntries();
      } catch (error) {
        console.error('Error during blacklist cleanup:', error);
      }
    },
    60 * 60 * 1000,
  ); // 1 hour
};
