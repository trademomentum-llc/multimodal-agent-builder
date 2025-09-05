import { storage } from '../storage';
import { auditLogger } from './auditLogger';
import type { Request } from 'express';

interface ThreatPattern {
  pattern: RegExp;
  description: string;
  threatLevel: 'low' | 'medium' | 'high' | 'critical';
  scoreMultiplier: number;
}

interface BlacklistEntry {
  ipAddress: string;
  reason: string;
  threatLevel: 'low' | 'medium' | 'high' | 'critical';
  attemptCount: number;
  blockedUntil: Date;
  userAgent?: string;
  requestPatterns?: any[];
  threatIntelligence?: any;
}

export class ThreatIntelligenceService {
  private readonly maxLoginAttempts = 5;
  private readonly maxApiAttempts = 50;
  private readonly maxCurlAttempts = 20;
  private readonly baseBlockDuration = 15; // minutes

  // Threat intelligence patterns based on common attack vectors
  private threatPatterns: ThreatPattern[] = [
    // SQL Injection patterns
    {
      pattern:
        /(['"]?\s*(union|select|insert|delete|drop|update|exec|execute)\s+)/i,
      description: 'SQL Injection attempt',
      threatLevel: 'high',
      scoreMultiplier: 3,
    },
    {
      pattern: /(or\s+1\s*=\s*1|'.*'.*=.*'|".*".*=.*")/i,
      description: 'SQL Injection payload',
      threatLevel: 'high',
      scoreMultiplier: 3,
    },

    // XSS patterns
    {
      pattern: /<script\b[^>]*>[\s\S]*?<\/script\b[^>]*>/i,
      description: 'XSS script injection',
      threatLevel: 'high',
      scoreMultiplier: 2.5,
    },
    {
      pattern:
        /(javascript:|data:text\/html|vbscript:|onload|onerror|onclick)/i,
      description: 'XSS payload',
      threatLevel: 'medium',
      scoreMultiplier: 2,
    },

    // Command injection
    {
      pattern: /(\||\&\&|\;|\$\(|\`|system\(|exec\(|eval\()/i,
      description: 'Command injection attempt',
      threatLevel: 'critical',
      scoreMultiplier: 4,
    },

    // Path traversal
    {
      pattern: /(\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e%5c)/i,
      description: 'Directory traversal',
      threatLevel: 'high',
      scoreMultiplier: 2.5,
    },

    // Brute force indicators
    {
      pattern: /admin|administrator|root|test|guest|demo/i,
      description: 'Common credential enumeration',
      threatLevel: 'medium',
      scoreMultiplier: 1.5,
    },

    // Automated tool signatures
    {
      pattern: /(nikto|nmap|sqlmap|burp|metasploit|nuclei|acunetix)/i,
      description: 'Automated security tool',
      threatLevel: 'high',
      scoreMultiplier: 3,
    },

    // Suspicious curl patterns
    {
      pattern: /curl.*(-X|--data|--form|--header).*[';|&]/,
      description: 'Malicious curl command',
      threatLevel: 'medium',
      scoreMultiplier: 2,
    },

    // Rate limiting bypass attempts
    {
      pattern: /(x-forwarded-for|x-real-ip).*[\d,\s]+/,
      description: 'IP spoofing attempt',
      threatLevel: 'medium',
      scoreMultiplier: 2,
    },
  ];

  // Known malicious user agents
  private maliciousUserAgents: ThreatPattern[] = [
    {
      pattern: /bot|crawler|spider|scraper/i,
      description: 'Automated bot',
      threatLevel: 'low',
      scoreMultiplier: 1.2,
    },
    {
      pattern: /(masscan|zmap|nessus|openvas|w3af)/i,
      description: 'Security scanner',
      threatLevel: 'high',
      scoreMultiplier: 3,
    },
    {
      pattern: /^(curl|wget|python-requests|go-http-client)/i,
      description: 'Scripted request',
      threatLevel: 'low',
      scoreMultiplier: 1.1,
    },
    {
      pattern: /(havij|sqlmap|pangolin|hexjector|bsqlbf)/i,
      description: 'SQL injection tool',
      threatLevel: 'critical',
      scoreMultiplier: 4,
    },
  ];

  /**
   * Analyzes request for threat patterns and returns threat score
   */
  public analyzeThreat(req: Request): {
    score: number;
    patterns: string[];
    threatLevel: string;
  } {
    let threatScore = 0;
    const detectedPatterns: string[] = [];

    const requestData = JSON.stringify({
      url: req.url,
      method: req.method,
      headers: req.headers,
      body: req.body,
      query: req.query,
    });

    // Check for threat patterns in request data
    for (const threat of this.threatPatterns) {
      if (threat.pattern.test(requestData)) {
        threatScore += threat.scoreMultiplier;
        detectedPatterns.push(threat.description);
      }
    }

    // Check user agent
    const userAgent = req.headers['user-agent'] || '';
    for (const agent of this.maliciousUserAgents) {
      if (agent.pattern.test(userAgent)) {
        threatScore += agent.scoreMultiplier;
        detectedPatterns.push(`Malicious User Agent: ${agent.description}`);
      }
    }

    // Determine threat level based on score
    let threatLevel = 'low';
    if (threatScore >= 4) threatLevel = 'critical';
    else if (threatScore >= 3) threatLevel = 'high';
    else if (threatScore >= 2) threatLevel = 'medium';

    return { score: threatScore, patterns: detectedPatterns, threatLevel };
  }

  /**
   * Calculate block duration based on threat level and attempt count
   */
  private calculateBlockDuration(
    threatLevel: string,
    attemptCount: number,
  ): number {
    const baseMinutes = this.baseBlockDuration;
    let multiplier = 1;

    switch (threatLevel) {
      case 'critical':
        multiplier = 8;
        break;
      case 'high':
        multiplier = 4;
        break;
      case 'medium':
        multiplier = 2;
        break;
      case 'low':
        multiplier = 1;
        break;
    }

    // Exponential backoff for repeated attempts
    const backoffMultiplier = Math.min(Math.pow(2, attemptCount - 1), 16);

    return baseMinutes * multiplier * backoffMultiplier;
  }

  /**
   * Check if IP is currently blacklisted
   */
  public async isBlacklisted(ipAddress: string): Promise<boolean> {
    try {
      const entries = await storage.getActiveBlacklistEntries(ipAddress);
      return entries.length > 0;
    } catch (error) {
      console.error('Error checking blacklist:', error);
      return false;
    }
  }

  /**
   * Add IP to blacklist with threat intelligence
   */
  public async addToBlacklist(
    ipAddress: string,
    reason: string,
    req: Request,
    threatAnalysis?: { score: number; patterns: string[]; threatLevel: string },
  ): Promise<void> {
    try {
      const userAgent = req.headers['user-agent'] || '';
      const existingEntry = await storage.getBlacklistEntry(ipAddress, reason);

      if (existingEntry) {
        // Update existing entry with increased attempt count
        const newAttemptCount = (existingEntry.attemptCount || 0) + 1;
        const newBlockDuration = this.calculateBlockDuration(
          existingEntry.threatLevel || 'medium',
          newAttemptCount,
        );
        const newBlockedUntil = new Date(
          Date.now() + newBlockDuration * 60 * 1000,
        );

        await storage.updateBlacklistEntry(existingEntry.id, {
          attemptCount: newAttemptCount,
          lastSeen: new Date(),
          blockedUntil: newBlockedUntil,
          requestPatterns: threatAnalysis?.patterns || [],
          threatIntelligence: {
            ...((existingEntry.threatIntelligence as any) || {}),
            lastThreatScore: threatAnalysis?.score || 0,
            escalationCount: newAttemptCount,
            analysisTimestamp: new Date().toISOString(),
          },
        });

        await auditLogger.log(
          null,
          'security.blacklist.escalated',
          'security',
          {
            ipAddress,
            reason,
            attemptCount: newAttemptCount,
            blockDuration: newBlockDuration,
          },
          req,
          true,
        );
      } else {
        // Create new blacklist entry
        const threatLevel =
          (threatAnalysis?.threatLevel as
            | 'low'
            | 'medium'
            | 'high'
            | 'critical') || 'medium';
        const blockDuration = this.calculateBlockDuration(threatLevel, 1);
        const blockedUntil = new Date(Date.now() + blockDuration * 60 * 1000);

        await storage.createBlacklistEntry({
          ipAddress,
          reason,
          threatLevel,
          attemptCount: 1,
          firstSeen: new Date(),
          lastSeen: new Date(),
          blockedUntil,
          userAgent,
          requestPatterns: threatAnalysis?.patterns || [],
          threatIntelligence: {
            threatScore: threatAnalysis?.score || 0,
            detectedPatterns: threatAnalysis?.patterns || [],
            requestMethod: req.method,
            requestPath: req.path,
            analysisTimestamp: new Date().toISOString(),
            userAgent: userAgent,
          },
          isActive: true,
        });

        await auditLogger.log(
          null,
          'security.blacklist.added',
          'security',
          { ipAddress, reason, threatLevel, blockDuration },
          req,
          true,
        );
      }
    } catch (error) {
      console.error('Error adding to blacklist:', error);
      throw error;
    }
  }

  /**
   * Handle failed login attempt with progressive blocking
   */
  public async handleFailedLogin(
    ipAddress: string,
    userId: string | null,
    req: Request,
  ): Promise<void> {
    const threatAnalysis = this.analyzeThreat(req);

    // Check current attempts
    const recentAttempts = await storage.getRecentFailedAttempts(ipAddress, 15); // Last 15 minutes

    if (recentAttempts >= this.maxLoginAttempts) {
      await this.addToBlacklist(ipAddress, 'failed_login', req, threatAnalysis);
    }

    // Log the failed attempt
    await auditLogger.log(
      userId,
      'auth.login.failed',
      'security',
      {
        ipAddress,
        threatScore: threatAnalysis.score,
        patterns: threatAnalysis.patterns,
      },
      req,
      false,
    );
  }

  /**
   * Handle excessive API requests
   */
  public async handleApiAbuse(
    ipAddress: string,
    endpoint: string,
    req: Request,
  ): Promise<void> {
    const threatAnalysis = this.analyzeThreat(req);

    await this.addToBlacklist(ipAddress, 'api_abuse', req, threatAnalysis);

    await auditLogger.log(
      null,
      'security.api.abuse',
      'security',
      { ipAddress, endpoint, threatScore: threatAnalysis.score },
      req,
      false,
    );
  }

  /**
   * Handle suspicious curl/automation patterns
   */
  public async handleCurlAbuse(ipAddress: string, req: Request): Promise<void> {
    const threatAnalysis = this.analyzeThreat(req);

    if (threatAnalysis.score > 2 || threatAnalysis.threatLevel === 'high') {
      await this.addToBlacklist(ipAddress, 'curl_abuse', req, threatAnalysis);

      await auditLogger.log(
        null,
        'security.curl.abuse',
        'security',
        {
          ipAddress,
          threatScore: threatAnalysis.score,
          patterns: threatAnalysis.patterns,
        },
        req,
        false,
      );
    }
  }

  /**
   * Remove IP from blacklist (admin function)
   */
  public async removeFromBlacklist(
    ipAddress: string,
    reviewedBy: string,
    reason?: string,
  ): Promise<void> {
    try {
      await storage.deactivateBlacklistEntries(ipAddress, reviewedBy, reason);

      await auditLogger.log(
        reviewedBy,
        'security.blacklist.removed',
        'security',
        { ipAddress, reason },
        null,
        true,
      );
    } catch (error) {
      console.error('Error removing from blacklist:', error);
      throw error;
    }
  }

  /**
   * Get blacklist statistics for security dashboard
   */
  public async getBlacklistStats(): Promise<any> {
    try {
      const stats = await storage.getBlacklistStats();
      return stats;
    } catch (error) {
      console.error('Error fetching blacklist stats:', error);
      return { totalBlocked: 0, activeBlocks: 0, threatLevels: {} };
    }
  }

  /**
   * Clean up expired blacklist entries
   */
  public async cleanupExpiredEntries(): Promise<void> {
    try {
      await storage.cleanupExpiredBlacklist();
      console.log('Cleaned up expired blacklist entries');
    } catch (error) {
      console.error('Error cleaning up blacklist:', error);
    }
  }
}

export const threatIntelligenceService = new ThreatIntelligenceService();
