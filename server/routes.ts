import type { Express } from 'express';
import { createServer, type Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { storage } from './storage';
import { setupAuth, isAuthenticated } from './replitAuth';
import { securityMiddleware, rateLimiter } from './middleware/security';
import {
  blacklistMiddleware,
  threatAnalysisMiddleware,
  scheduleBlacklistCleanup,
} from './middleware/blacklist';
import { validateRequest } from './middleware/validation';
import { agentFactory } from './services/agentFactory';
import { taskQueue } from './services/taskQueue';
import { auditLogger } from './services/auditLogger';
import { foundationModel } from './services/foundationModel';
import { twoFactorAuthService } from './services/twoFactorAuth';
import { threatIntelligenceService } from './services/threatIntelligence';
import multimodalRoutes from './routes/multimodal';
import {
  insertAgentSchema,
  insertTaskSchema,
  insertApprovalSchema,
} from '@shared/schema';
import { z } from 'zod';

export async function registerRoutes(app: Express): Promise<Server> {
  // Security middleware
  app.use(securityMiddleware);

  // Blacklist middleware - check for blocked IPs
  app.use(blacklistMiddleware);

  // Threat analysis middleware - monitor for suspicious patterns
  app.use(threatAnalysisMiddleware);

  // Auth middleware
  await setupAuth(app);

  // Rate limiting for API routes
  app.use('/api', rateLimiter);

  // Start blacklist cleanup scheduler
  scheduleBlacklistCleanup();

  // Multimodal agent routes
  app.use('/api/multimodal', isAuthenticated, multimodalRoutes);

  // Two-Factor Authentication routes
  app.get('/api/auth/2fa/setup', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      await auditLogger.log(userId, '2fa.setup.start', 'security', null, req);

      const setup = await twoFactorAuthService.generateTwoFactorSetup(
        userId,
        user.email || '',
      );
      res.json(setup);
    } catch (error: any) {
      console.error('Error setting up 2FA:', error);
      res.status(500).json({ message: 'Failed to setup 2FA' });
    }
  });

  app.post(
    '/api/auth/2fa/verify-setup',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const { secret, token, backupCodes } = req.body;

        if (!secret || !token || !backupCodes) {
          return res.status(400).json({ message: 'Missing required fields' });
        }

        const verified = await twoFactorAuthService.verifySetupToken(
          secret,
          token,
          userId,
        );

        if (verified) {
          const enabled = await twoFactorAuthService.enableTwoFactor(
            userId,
            secret,
            backupCodes,
          );
          if (enabled) {
            await auditLogger.log(
              userId,
              '2fa.setup.completed',
              'security',
              null,
              req,
            );
            res.json({
              success: true,
              message: 'Two-factor authentication enabled successfully',
            });
          } else {
            res.status(500).json({ message: 'Failed to enable 2FA' });
          }
        } else {
          res.status(400).json({ message: 'Invalid verification code' });
        }
      } catch (error: any) {
        console.error('Error verifying 2FA setup:', error);
        res.status(500).json({ message: 'Failed to verify 2FA setup' });
      }
    },
  );

  app.post('/api/auth/2fa/verify-login', async (req: any, res) => {
    try {
      const { userId, token } = req.body;

      if (!userId || !token) {
        return res.status(400).json({ message: 'Missing required fields' });
      }

      const verified = await twoFactorAuthService.verifyLoginToken(
        userId,
        token,
      );

      if (verified) {
        // Generate secure session token
        const sessionToken = twoFactorAuthService.generateSecureToken(
          userId,
          true,
        );

        await auditLogger.log(
          userId,
          '2fa.login.success',
          'security',
          null,
          req,
        );
        res.json({
          success: true,
          sessionToken,
          message: '2FA verification successful',
        });
      } else {
        await auditLogger.log(
          userId,
          '2fa.login.failed',
          'security',
          null,
          req,
          false,
        );
        res.status(400).json({ message: 'Invalid verification code' });
      }
    } catch (error: any) {
      console.error('Error verifying 2FA login:', error);
      res.status(500).json({ message: 'Failed to verify 2FA' });
    }
  });

  app.post('/api/auth/2fa/disable', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { currentPassword, token } = req.body;

      if (!currentPassword || !token) {
        return res
          .status(400)
          .json({ message: 'Current password and 2FA token required' });
      }

      const disabled = await twoFactorAuthService.disableTwoFactor(
        userId,
        currentPassword,
        token,
      );

      if (disabled) {
        res.json({
          success: true,
          message: 'Two-factor authentication disabled',
        });
      } else {
        res
          .status(400)
          .json({ message: 'Invalid credentials or verification code' });
      }
    } catch (error: any) {
      console.error('Error disabling 2FA:', error);
      res.status(500).json({ message: 'Failed to disable 2FA' });
    }
  });

  app.get('/api/auth/password-policy', async (req: any, res) => {
    try {
      const policy = twoFactorAuthService.getPasswordPolicy();
      res.json(policy);
    } catch (error: any) {
      console.error('Error fetching password policy:', error);
      res.status(500).json({ message: 'Failed to fetch password policy' });
    }
  });

  app.post(
    '/api/auth/change-password',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const { currentPassword, newPassword, twoFactorToken } = req.body;

        if (!currentPassword || !newPassword) {
          return res
            .status(400)
            .json({ message: 'Current and new password required' });
        }

        // Validate new password
        const validation = twoFactorAuthService.validatePassword(newPassword);
        if (!validation.valid) {
          return res.status(400).json({
            message: 'Password does not meet policy requirements',
            errors: validation.errors,
          });
        }

        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(404).json({ message: 'User not found' });
        }

        // If 2FA is enabled, require 2FA token
        if (user.twoFactorEnabled && !twoFactorToken) {
          return res
            .status(400)
            .json({ message: 'Two-factor authentication token required' });
        }

        // Verify current password
        if (user.passwordHash) {
          const passwordValid = await twoFactorAuthService.verifyPassword(
            currentPassword,
            user.passwordHash,
          );
          if (!passwordValid) {
            await auditLogger.log(
              userId,
              'password.change.failed',
              'security',
              null,
              req,
              false,
              'Invalid current password',
            );
            return res
              .status(400)
              .json({ message: 'Current password is incorrect' });
          }
        }

        // Verify 2FA if enabled
        if (user.twoFactorEnabled && twoFactorToken) {
          const tokenValid = await twoFactorAuthService.verifyLoginToken(
            userId,
            twoFactorToken,
          );
          if (!tokenValid) {
            await auditLogger.log(
              userId,
              'password.change.failed',
              'security',
              null,
              req,
              false,
              'Invalid 2FA token',
            );
            return res
              .status(400)
              .json({ message: 'Invalid two-factor authentication code' });
          }
        }

        // Hash new password and update
        const newPasswordHash =
          await twoFactorAuthService.hashPassword(newPassword);

        // Update password
        await storage.updateUserSecurity(userId, {
          passwordHash: newPasswordHash,
          lastPasswordChange: new Date(),
          mustChangePassword: false,
        });

        await auditLogger.log(
          userId,
          'password.changed',
          'security',
          null,
          req,
        );
        res.json({ success: true, message: 'Password changed successfully' });
      } catch (error: any) {
        console.error('Error changing password:', error);
        await auditLogger.log(
          req.user?.claims?.sub,
          'password.change.error',
          'security',
          null,
          req,
          false,
          (error as Error).message,
        );
        res.status(500).json({ message: 'Failed to change password' });
      }
    },
  );

  app.get(
    '/api/auth/password-expiry',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const expiry = await twoFactorAuthService.checkPasswordExpiry(userId);
        res.json(expiry);
      } catch (error: any) {
        console.error('Error checking password expiry:', error);
        res.status(500).json({ message: 'Failed to check password expiry' });
      }
    },
  );

  // National Reserve routes
  app.get(
    '/api/national-reserve/status',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        await auditLogger.log(
          userId,
          'national-reserve.status.view',
          'national-reserve',
          null,
          req,
        );

        const agents = await storage.getAgents(userId);
        const agentTypes = await storage.getAgentTypes();

        // Create command structure based on military hierarchy
        const commandStructure = {
          'Five Star General': { count: 0, active: 0 },
          General: { count: 0, active: 0 },
          Colonel: { count: 0, active: 0 },
          Major: { count: 0, active: 0 },
          Captain: { count: 0, active: 0 },
          Lieutenant: { count: 0, active: 0 },
          Sergeant: { count: 0, active: 0 },
          Corporal: { count: 0, active: 0 },
          Private: { count: 0, active: 0 },
          'Intelligence Analyst': { count: 0, active: 0 },
          'Communication Specialist': { count: 0, active: 0 },
          'Pattern Recognition Expert': { count: 0, active: 0 },
        };

        // Categorize agents by their types into military ranks
        agents.forEach((agent) => {
          const agentType = agentTypes.find((type) => type.id === agent.typeId);
          let rank = 'Private'; // Default rank

          if (agentType) {
            // Map agent types to military ranks based on their actual names
            switch (agentType.name) {
              case 'Five Star General':
                rank = 'Five Star General';
                break;
              case 'General':
                rank = 'General';
                break;
              case 'Colonel':
                rank = 'Colonel';
                break;
              case 'Major':
                rank = 'Major';
                break;
              case 'Captain':
                rank = 'Captain';
                break;
              case 'Lieutenant':
                rank = 'Lieutenant';
                break;
              case 'Sergeant':
                rank = 'Sergeant';
                break;
              case 'Corporal':
                rank = 'Corporal';
                break;
              case 'Private First Class':
              case 'Private':
                rank = 'Private';
                break;
              case 'Intelligence Analyst':
                rank = 'Intelligence Analyst';
                break;
              case 'Communication Specialist':
                rank = 'Communication Specialist';
                break;
              case 'Pattern Recognition Expert':
                rank = 'Pattern Recognition Expert';
                break;
              default:
                // Legacy types get assigned based on category
                if (agentType.category === 'analytics') {
                  rank = 'General';
                } else if (agentType.category === 'command') {
                  rank = 'General';
                } else if (agentType.category === 'operations') {
                  rank = 'Colonel';
                } else if (agentType.category === 'tactical') {
                  rank = 'Major';
                } else if (agentType.category === 'execution') {
                  rank = 'Sergeant';
                } else if (agentType.category === 'intelligence') {
                  rank = 'General';
                } else {
                  rank = 'Private';
                }
                break;
            }
          }

          if (commandStructure[rank]) {
            commandStructure[rank].count++;
            if (agent.status === 'active') {
              commandStructure[rank].active++;
            }
          }
        });

        const reserveStatus = {
          totalAgents: agents.length,
          activeAgents: agents.filter((a) => a.status === 'active').length,
          commandStructure,
          patternRecognitionStatus: {
            enabled: true,
            activeMonitoring: agents.filter((a) => a.status === 'active')
              .length,
          },
          lastActivity: new Date().toISOString(),
        };

        res.json(reserveStatus);
      } catch (error: any) {
        console.error('Error fetching National Reserve status:', error);
        res.status(500).json({ message: 'Failed to fetch reserve status' });
      }
    },
  );

  app.post(
    '/api/national-reserve/deploy',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        await auditLogger.log(
          userId,
          'national-reserve.deploy',
          'national-reserve',
          null,
          req,
        );

        // Deploy a full military hierarchy if not already existing
        const existingAgents = await storage.getAgents(userId);
        const agentTypes = await storage.getAgentTypes();

        if (existingAgents.length < 25) {
          // Create full military hierarchy deployment
          const deployments = [
            { typeName: 'Five Star General', count: 1 },
            { typeName: 'General', count: 2 },
            { typeName: 'Colonel', count: 3 },
            { typeName: 'Major', count: 4 },
            { typeName: 'Captain', count: 5 },
            { typeName: 'Lieutenant', count: 6 },
            { typeName: 'Sergeant', count: 7 },
            { typeName: 'Corporal', count: 8 },
            { typeName: 'Private', count: 10 },
            { typeName: 'Intelligence Analyst', count: 3 },
            { typeName: 'Communication Specialist', count: 3 },
            { typeName: 'Pattern Recognition Expert', count: 3 },
          ];

          for (const deployment of deployments) {
            const agentType = agentTypes.find(
              (type) => type.name === deployment.typeName,
            );
            if (agentType) {
              for (let i = 0; i < deployment.count; i++) {
                await storage.createAgent({
                  name: `${deployment.typeName} ${String.fromCharCode(65 + i)}${i + 1}`, // A1, B2, etc.
                  typeId: agentType.id,
                  description: `National Reserve ${deployment.typeName} - Unit ${i + 1}`,
                  config: {
                    rank: deployment.typeName,
                    unitId: `NR-${agentType.id}-${String.fromCharCode(65 + i)}${i + 1}`,
                    deploymentTimestamp: Date.now(),
                    militaryUnit: 'National Reserve',
                    commandLevel:
                      agentType.category === 'command'
                        ? 10
                        : agentType.category === 'intelligence'
                          ? 9
                          : agentType.category === 'operations'
                            ? 7
                            : agentType.category === 'tactical'
                              ? 5
                              : 3,
                  },
                  status: 'active',
                  userId,
                });
              }
            }
          }
        }

        res.json({
          message: 'National Reserve deployed successfully',
          timestamp: new Date().toISOString(),
        });
      } catch (error: any) {
        console.error('Error deploying National Reserve:', error);
        res.status(500).json({ message: 'Failed to deploy reserve' });
      }
    },
  );

  app.post(
    '/api/national-reserve/analyze-pattern',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const { text, context } = req.body;

        await auditLogger.log(
          userId,
          'national-reserve.pattern-analysis',
          'national-reserve',
          { textLength: text?.length },
          req,
        );

        // Advanced pattern recognition analysis
        const analysis = {
          leetSpeak: /[3471]/g.test(text) || /[@$]/g.test(text),
          subliminalIndicators: [],
          communicationStyle: 'direct',
          emotionalTone: 'neutral',
          hiddenMeaning: undefined,
        };

        // Check for subliminal patterns
        if (
          text.toLowerCase().includes('urgent') ||
          text.toLowerCase().includes('asap')
        ) {
          analysis.subliminalIndicators.push('urgency_trigger');
        }
        if (text.match(/[A-Z]{3,}/)) {
          analysis.subliminalIndicators.push('capitalization_emphasis');
        }
        if (text.includes('...') || text.includes('!!!')) {
          analysis.subliminalIndicators.push('emotional_punctuation');
        }

        // Determine communication style
        if (text.length < 50) {
          analysis.communicationStyle = 'concise';
        } else if (text.length > 200) {
          analysis.communicationStyle = 'verbose';
        }

        // Emotional tone analysis
        const positiveWords = /great|good|excellent|amazing|wonderful/gi;
        const negativeWords = /bad|terrible|awful|horrible|disappointing/gi;

        if (positiveWords.test(text)) {
          analysis.emotionalTone = 'positive';
        } else if (negativeWords.test(text)) {
          analysis.emotionalTone = 'negative';
        }

        // Hidden meaning detection
        if (analysis.subliminalIndicators.length > 2) {
          analysis.hiddenMeaning = 'Potential manipulation tactics detected';
        }

        res.json(analysis);
      } catch (error: any) {
        console.error('Error analyzing pattern:', error);
        res.status(500).json({ message: 'Pattern analysis failed' });
      }
    },
  );

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error: any) {
      console.error('Error fetching user:', error);
      res.status(500).json({ message: 'Failed to fetch user' });
    }
  });

  // Dashboard routes
  app.get('/api/dashboard/stats', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await auditLogger.log(
        userId,
        'dashboard.stats.view',
        'dashboard',
        null,
        req,
      );

      const stats = await storage.getDashboardStats(userId);
      res.json(stats);
    } catch (error: any) {
      console.error('Error fetching dashboard stats:', error);
      await auditLogger.log(
        req.user.claims.sub,
        'dashboard.stats.view',
        'dashboard',
        null,
        req,
        false,
        error?.message,
      );
      res.status(500).json({ message: 'Failed to fetch dashboard statistics' });
    }
  });

  // Security status route - Dynamic calculation based on real data
  app.get('/api/security/status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await auditLogger.log(
        userId,
        'security.status.view',
        'security',
        null,
        req,
      );

      // Get real data for security calculations
      const agents = await storage.getAgents(userId);
      const auditLogs = await storage.getAuditLogs(userId, 24);
      const tasks = await storage.getTasks(userId);

      // Calculate real security metrics
      const protectedAgents = agents.filter(
        (agent) => agent.status === 'active',
      ).length;
      const totalAgents = agents.length;

      // Security events in last 24 hours (failed logins, suspicious activity)
      const recentSecurityEvents = auditLogs.filter((log) => {
        const logTime = new Date(log.createdAt || 0).getTime();
        const last24Hours = Date.now() - 24 * 60 * 60 * 1000;
        return (
          logTime > last24Hours &&
          (!log.success ||
            log.action.includes('failed') ||
            log.action.includes('error'))
        );
      }).length;

      // Calculate dynamic security score based on multiple factors
      let securityScore = 0;

      // Base score for having agents protected (40% weight)
      if (totalAgents > 0) {
        securityScore += Math.round((protectedAgents / totalAgents) * 40);
      }

      // Security event penalty (30% weight)
      const eventPenalty = Math.min(recentSecurityEvents * 5, 30);
      securityScore += Math.max(0, 30 - eventPenalty);

      // Task completion rate (15% weight)
      const completedTasks = tasks.filter(
        (task) => task.status === 'completed',
      ).length;
      const taskSuccessRate =
        tasks.length > 0 ? completedTasks / tasks.length : 1;
      securityScore += Math.round(taskSuccessRate * 15);

      // Authentication and access control (15% weight)
      const recentSuccessfulLogins = auditLogs.filter(
        (log) => log.action.includes('auth') && log.success,
      ).length;
      securityScore += Math.min(recentSuccessfulLogins > 0 ? 15 : 5, 15);

      // Ensure score is between 0-100
      securityScore = Math.max(0, Math.min(100, securityScore));

      // Determine compliance level based on score
      let complianceLevel = 'Non-Compliant';
      if (securityScore >= 90) complianceLevel = 'Fully Compliant';
      else if (securityScore >= 70) complianceLevel = 'Mostly Compliant';
      else if (securityScore >= 50) complianceLevel = 'Partially Compliant';

      const securityStatus = {
        overallScore: securityScore,
        protectedAgents,
        securityEvents: recentSecurityEvents,
        lastScanTime: new Date().toISOString(),
        complianceLevel,
        // Additional details for transparency
        scoreBreakdown: {
          agentProtection: Math.round(
            (protectedAgents / Math.max(totalAgents, 1)) * 40,
          ),
          securityEvents: Math.max(0, 30 - eventPenalty),
          taskSuccess: Math.round(taskSuccessRate * 15),
          accessControl: Math.min(recentSuccessfulLogins > 0 ? 15 : 5, 15),
        },
      };

      res.json(securityStatus);
    } catch (error: any) {
      console.error('Error fetching security status:', error);
      res.status(500).json({ message: 'Failed to fetch security status' });
    }
  });

  // Blacklist management routes
  app.get('/api/security/blacklist', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await auditLogger.log(
        userId,
        'security.blacklist.view',
        'security',
        null,
        req,
      );

      const stats = await threatIntelligenceService.getBlacklistStats();
      res.json(stats);
    } catch (error: any) {
      console.error('Error fetching blacklist stats:', error);
      res.status(500).json({ message: 'Failed to fetch blacklist statistics' });
    }
  });

  app.post(
    '/api/security/blacklist/remove',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const { ipAddress, reason } = req.body;

        if (!ipAddress) {
          return res.status(400).json({ message: 'IP address is required' });
        }

        await threatIntelligenceService.removeFromBlacklist(
          ipAddress,
          userId,
          reason,
        );
        await auditLogger.log(
          userId,
          'security.blacklist.removed',
          'security',
          { ipAddress, reason },
          req,
        );

        res.json({
          success: true,
          message: `IP ${ipAddress} removed from blacklist`,
        });
      } catch (error: any) {
        console.error('Error removing from blacklist:', error);
        res.status(500).json({ message: 'Failed to remove IP from blacklist' });
      }
    },
  );

  app.post(
    '/api/security/blacklist/add',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const { ipAddress, reason, threatLevel, duration } = req.body;

        if (!ipAddress || !reason) {
          return res
            .status(400)
            .json({ message: 'IP address and reason are required' });
        }

        // Manual blacklist addition
        const threatAnalysis = {
          score: 5,
          patterns: ['Manual addition by admin'],
          threatLevel: threatLevel || 'high',
        };

        await threatIntelligenceService.addToBlacklist(
          ipAddress,
          reason,
          req,
          threatAnalysis,
        );
        await auditLogger.log(
          userId,
          'security.blacklist.manual_add',
          'security',
          { ipAddress, reason, threatLevel },
          req,
        );

        res.json({
          success: true,
          message: `IP ${ipAddress} added to blacklist`,
        });
      } catch (error: any) {
        console.error('Error adding to blacklist:', error);
        res.status(500).json({ message: 'Failed to add IP to blacklist' });
      }
    },
  );

  // Threat analysis endpoint for real-time analysis
  app.post(
    '/api/security/analyze-threat',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const analysis = threatIntelligenceService.analyzeThreat(req);

        await auditLogger.log(
          userId,
          'security.threat.analyzed',
          'security',
          {
            threatScore: analysis.score,
            threatLevel: analysis.threatLevel,
            patterns: analysis.patterns,
          },
          req,
        );

        res.json(analysis);
      } catch (error: any) {
        console.error('Error analyzing threat:', error);
        res.status(500).json({ message: 'Failed to analyze threat' });
      }
    },
  );

  // Agents routes for library
  app.get('/api/agents', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await auditLogger.log(userId, 'agents.list.view', 'agents', null, req);

      // Sample agents data for the library
      const agents = [
        {
          id: 1,
          name: 'Social Media Agent',
          type: 'Social Media',
          status: 'active',
          description:
            'Automated content generation and social media scheduling for all platforms',
          capabilities: ['Content Generation', 'Scheduling', 'Analytics'],
          createdAt: '2025-08-15T10:00:00Z',
          lastActive: '2025-08-16T20:30:00Z',
          performanceScore: 95,
          instances: 3,
        },
        {
          id: 2,
          name: 'Email Marketing Agent',
          type: 'Email Marketing',
          status: 'active',
          description:
            'Campaign setup, management, and optimization for email marketing',
          capabilities: ['Campaign Management', 'A/B Testing', 'Automation'],
          createdAt: '2025-08-15T11:00:00Z',
          lastActive: '2025-08-16T21:00:00Z',
          performanceScore: 88,
          instances: 5,
        },
        {
          id: 3,
          name: 'Security Monitor',
          type: 'Security',
          status: 'active',
          description: 'Real-time security monitoring and threat detection',
          capabilities: [
            'Threat Detection',
            'Real-time Monitoring',
            'Automated Response',
          ],
          createdAt: '2025-08-15T12:00:00Z',
          lastActive: '2025-08-16T21:05:00Z',
          performanceScore: 100,
          instances: 1,
        },
        {
          id: 4,
          name: 'Analytics Agent',
          type: 'Analytics',
          status: 'paused',
          description: 'Business intelligence and performance analytics',
          capabilities: ['Data Analysis', 'Report Generation', 'Insights'],
          createdAt: '2025-08-15T13:00:00Z',
          lastActive: '2025-08-16T19:00:00Z',
          performanceScore: 92,
          instances: 2,
        },
      ];

      res.json(agents);
    } catch (error: any) {
      console.error('Error fetching agents:', error);
      res.status(500).json({ message: 'Failed to fetch agents' });
    }
  });

  // Agent actions
  app.get(
    '/api/agents/:id/download',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const agentId = req.params.id;
        await auditLogger.log(userId, 'agent.download', 'agents', agentId, req);

        res.json({
          message: 'Agent package prepared for download',
          downloadUrl: `/downloads/agent-${agentId}.zip`,
          agentId: agentId,
        });
      } catch (error: any) {
        console.error('Error preparing agent download:', error);
        res.status(500).json({ message: 'Failed to prepare agent download' });
      }
    },
  );

  app.post(
    '/api/agents/:id/:action',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const agentId = req.params.id;
        const action = req.params.action;
        await auditLogger.log(
          userId,
          `agent.${action}`,
          'agents',
          agentId,
          req,
        );

        res.json({
          message: `Agent ${action} completed successfully`,
          agentId: agentId,
          action: action,
        });
      } catch (error: any) {
        console.error('Error performing agent %s:', req.params.action, error);
        res
          .status(500)
          .json({ message: `Failed to ${req.params.action} agent` });
      }
    },
  );

  app.get(
    '/api/dashboard/activities',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const limit = parseInt(req.query.limit as string) || 20;

        const activities = await storage.getActivities(userId, limit);
        res.json(activities);
      } catch (error: any) {
        console.error('Error fetching activities:', error);
        res.status(500).json({ message: 'Failed to fetch activities' });
      }
    },
  );

  // Agent type routes
  app.get('/api/agent-types', isAuthenticated, async (req: any, res) => {
    try {
      const agentTypes = await storage.getAgentTypes();
      res.json(agentTypes);
    } catch (error: any) {
      console.error('Error fetching agent types:', error);
      res.status(500).json({ message: 'Failed to fetch agent types' });
    }
  });

  // Agent routes
  app.get('/api/agents', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const agents = await storage.getAgents(userId);
      res.json(agents);
    } catch (error: any) {
      console.error('Error fetching agents:', error);
      res.status(500).json({ message: 'Failed to fetch agents' });
    }
  });

  app.post(
    '/api/agents',
    isAuthenticated,
    validateRequest(insertAgentSchema),
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const agentData = { ...req.body, userId };

        await auditLogger.log(userId, 'agent.create', 'agent', null, req);

        const agent = await storage.createAgent(agentData);
        await agentFactory.initializeAgent(agent);

        await storage.createActivity({
          userId,
          agentId: agent.id,
          type: 'agent.created',
          message: `Agent "${agent.name}" was created successfully`,
          metadata: { agentType: agent.typeId },
        });

        res.status(201).json(agent);
      } catch (error: any) {
        console.error('Error creating agent:', error);
        await auditLogger.log(
          req.user.claims.sub,
          'agent.create',
          'agent',
          null,
          req,
          false,
          error?.message,
        );
        res.status(500).json({ message: 'Failed to create agent' });
      }
    },
  );

  app.get('/api/agents/:id', isAuthenticated, async (req: any, res) => {
    try {
      const agentId = parseInt(req.params.id);
      const agent = await storage.getAgent(agentId);

      if (!agent) {
        return res.status(404).json({ message: 'Agent not found' });
      }

      if (agent.userId !== req.user.claims.sub) {
        return res.status(403).json({ message: 'Access denied' });
      }

      res.json(agent);
    } catch (error) {
      console.error('Error fetching agent:', error);
      res.status(500).json({ message: 'Failed to fetch agent' });
    }
  });

  app.put(
    '/api/agents/:id',
    isAuthenticated,
    validateRequest(insertAgentSchema.partial()),
    async (req: any, res) => {
      try {
        const agentId = parseInt(req.params.id);
        const userId = req.user.claims.sub;

        const existingAgent = await storage.getAgent(agentId);
        if (!existingAgent || existingAgent.userId !== userId) {
          return res.status(404).json({ message: 'Agent not found' });
        }

        await auditLogger.log(
          userId,
          'agent.update',
          'agent',
          agentId.toString(),
          req,
        );

        const agent = await storage.updateAgent(agentId, req.body);

        await storage.createActivity({
          userId,
          agentId: agent.id,
          type: 'agent.updated',
          message: `Agent "${agent.name}" was updated`,
        });

        res.json(agent);
      } catch (error: any) {
        console.error('Error updating agent:', error);
        await auditLogger.log(
          req.user.claims.sub,
          'agent.update',
          'agent',
          req.params.id,
          req,
          false,
          error?.message,
        );
        res.status(500).json({ message: 'Failed to update agent' });
      }
    },
  );

  app.delete('/api/agents/:id', isAuthenticated, async (req: any, res) => {
    try {
      const agentId = parseInt(req.params.id);
      const userId = req.user.claims.sub;

      const existingAgent = await storage.getAgent(agentId);
      if (!existingAgent || existingAgent.userId !== userId) {
        return res.status(404).json({ message: 'Agent not found' });
      }

      await auditLogger.log(
        userId,
        'agent.delete',
        'agent',
        agentId.toString(),
        req,
      );

      await storage.deleteAgent(agentId);

      await storage.createActivity({
        userId,
        type: 'agent.deleted',
        message: `Agent "${existingAgent.name}" was deleted`,
      });

      res.json({ message: 'Agent deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting agent:', error);
      await auditLogger.log(
        req.user.claims.sub,
        'agent.delete',
        'agent',
        req.params.id,
        req,
        false,
        error?.message,
      );
      res.status(500).json({ message: 'Failed to delete agent' });
    }
  });

  // Task routes
  app.get('/api/tasks', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const limit = parseInt(req.query.limit as string) || 50;

      const tasks = await storage.getTasks(userId, limit);
      res.json(tasks);
    } catch (error: any) {
      console.error('Error fetching tasks:', error);
      res.status(500).json({ message: 'Failed to fetch tasks' });
    }
  });

  app.post(
    '/api/tasks',
    isAuthenticated,
    validateRequest(insertTaskSchema),
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const taskData = { ...req.body, userId };

        await auditLogger.log(userId, 'task.create', 'task', null, req);

        const task = await storage.createTask(taskData);
        await taskQueue.enqueue(task);

        await storage.createActivity({
          userId,
          taskId: task.id,
          type: 'task.created',
          message: `Task "${task.title}" was created`,
        });

        res.status(201).json(task);
      } catch (error: any) {
        console.error('Error creating task:', error);
        await auditLogger.log(
          req.user.claims.sub,
          'task.create',
          'task',
          null,
          req,
          false,
          error?.message,
        );
        res.status(500).json({ message: 'Failed to create task' });
      }
    },
  );

  app.put(
    '/api/tasks/:id',
    isAuthenticated,
    validateRequest(insertTaskSchema.partial()),
    async (req: any, res) => {
      try {
        const taskId = parseInt(req.params.id);
        const userId = req.user.claims.sub;

        const existingTask = await storage.getTask(taskId);
        if (!existingTask || existingTask.userId !== userId) {
          return res.status(404).json({ message: 'Task not found' });
        }

        await auditLogger.log(
          userId,
          'task.update',
          'task',
          taskId.toString(),
          req,
        );

        const task = await storage.updateTask(taskId, req.body);

        await storage.createActivity({
          userId,
          taskId: task.id,
          type: 'task.updated',
          message: `Task "${task.title}" was updated`,
        });

        res.json(task);
      } catch (error: any) {
        console.error('Error updating task:', error);
        await auditLogger.log(
          req.user.claims.sub,
          'task.update',
          'task',
          req.params.id,
          req,
          false,
          error?.message,
        );
        res.status(500).json({ message: 'Failed to update task' });
      }
    },
  );

  // Approval routes
  app.get('/api/approvals', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const limit = parseInt(req.query.limit as string) || 50;

      const approvals = await storage.getApprovals(userId, limit);
      res.json(approvals);
    } catch (error: any) {
      console.error('Error fetching approvals:', error);
      res.status(500).json({ message: 'Failed to fetch approvals' });
    }
  });

  app.post(
    '/api/approvals/:id/approve',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const approvalId = parseInt(req.params.id);
        const userId = req.user.claims.sub;

        const existingApproval = await storage.getApproval(approvalId);
        if (!existingApproval || existingApproval.userId !== userId) {
          return res.status(404).json({ message: 'Approval not found' });
        }

        await auditLogger.log(
          userId,
          'approval.approve',
          'approval',
          approvalId.toString(),
          req,
        );

        const approval = await storage.updateApproval(approvalId, {
          status: 'approved',
          reviewedBy: userId,
          reviewedAt: new Date(),
        });

        await storage.createActivity({
          userId,
          type: 'approval.approved',
          message: `Approval request "${approval.title}" was approved`,
        });

        res.json(approval);
      } catch (error: any) {
        console.error('Error approving request:', error);
        await auditLogger.log(
          req.user.claims.sub,
          'approval.approve',
          'approval',
          req.params.id,
          req,
          false,
          error?.message,
        );
        res.status(500).json({ message: 'Failed to approve request' });
      }
    },
  );

  app.post(
    '/api/approvals/:id/reject',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const approvalId = parseInt(req.params.id);
        const userId = req.user.claims.sub;

        const existingApproval = await storage.getApproval(approvalId);
        if (!existingApproval || existingApproval.userId !== userId) {
          return res.status(404).json({ message: 'Approval not found' });
        }

        await auditLogger.log(
          userId,
          'approval.reject',
          'approval',
          approvalId.toString(),
          req,
        );

        const approval = await storage.updateApproval(approvalId, {
          status: 'rejected',
          reviewedBy: userId,
          reviewedAt: new Date(),
        });

        await storage.createActivity({
          userId,
          type: 'approval.rejected',
          message: `Approval request "${approval.title}" was rejected`,
        });

        res.json(approval);
      } catch (error: any) {
        console.error('Error rejecting request:', error);
        await auditLogger.log(
          req.user.claims.sub,
          'approval.reject',
          'approval',
          req.params.id,
          req,
          false,
          error?.message,
        );
        res.status(500).json({ message: 'Failed to reject request' });
      }
    },
  );

  // Security routes
  app.get(
    '/api/security/audit-logs',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const limit = parseInt(req.query.limit as string) || 100;

        const auditLogs = await storage.getAuditLogs(userId, limit);
        res.json(auditLogs);
      } catch (error: any) {
        console.error('Error fetching audit logs:', error);
        res.status(500).json({ message: 'Failed to fetch audit logs' });
      }
    },
  );

  app.get('/api/security/status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const agents = await storage.getAgents(userId);
      const auditLogs = await storage.getAuditLogs(userId, 24);

      // Calculate security metrics
      const protectedAgents = agents.filter(
        (agent) => agent.status === 'active',
      ).length;
      const recentSecurityEvents = auditLogs.filter(
        (log) =>
          log.createdAt &&
          new Date(log.createdAt).getTime() > Date.now() - 24 * 60 * 60 * 1000,
      ).length;

      const overallScore = Math.min(
        100,
        70 + protectedAgents * 5 + (recentSecurityEvents > 0 ? 15 : 0),
      );

      res.json({
        overallScore,
        protectedAgents,
        securityEvents: recentSecurityEvents,
        lastScanTime: new Date().toISOString(),
        complianceLevel: 'High',
      });
    } catch (error: any) {
      console.error('Error fetching security status:', error);
      res.status(500).json({ message: 'Failed to fetch security status' });
    }
  });

  app.get(
    '/api/security/threat-analysis',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const auditLogs = await storage.getAuditLogs(userId, 100);

        // Analyze for potential threats
        const failedLogins = auditLogs.filter(
          (log) => log.action.includes('login') && !log.success,
        ).length;

        const suspiciousActivity = auditLogs.filter(
          (log) =>
            log.action.includes('delete') || log.action.includes('admin'),
        ).length;

        const threats = [];
        if (failedLogins > 5) {
          threats.push({
            type: 'Multiple Failed Logins',
            description: `${failedLogins} failed login attempts detected`,
            severity: 'medium',
            timestamp: new Date().toISOString(),
          });
        }

        if (suspiciousActivity > 10) {
          threats.push({
            type: 'Suspicious Administrative Activity',
            description: `${suspiciousActivity} administrative actions detected`,
            severity: 'low',
            timestamp: new Date().toISOString(),
          });
        }

        res.json({
          activeThreats: threats.length,
          threats,
          riskLevel: threats.length > 0 ? 'Medium' : 'Low',
          lastAnalysis: new Date().toISOString(),
        });
      } catch (error: any) {
        console.error('Error performing threat analysis:', error);
        res.status(500).json({ message: 'Failed to perform threat analysis' });
      }
    },
  );

  // National Reserve routes
  app.post(
    '/api/national-reserve/deploy',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const { nationalReserve } = await import('./services/nationalReserve');

        // Use foundation model to create deployment strategy
        const deploymentPlan = await foundationModel.createWorkflow(
          'Deploy comprehensive National Reserve system with BERT foundation model integration, military hierarchy, pattern recognition, and cross-collaboration capabilities',
        );

        console.log('BERT Foundation Model Deployment Plan:', deploymentPlan);

        const deployedAgents =
          await nationalReserve.deployNationalReserve(userId);

        await auditLogger.log(
          userId,
          'national_reserve.deploy',
          'agent_system',
          null,
          req,
          true,
          null,
          {
            deployedCount: deployedAgents.length,
            foundationModel: 'BERT',
            workflowId: deploymentPlan.id,
          },
        );

        res.json({
          message:
            'National Reserve deployed successfully with BERT foundation model integration',
          deployedAgents: deployedAgents.length,
          foundationModel: 'BERT integrated for all agents',
          deploymentPlan: deploymentPlan.id,
          workflowSteps: deploymentPlan.steps.length,
          commandStructure: deployedAgents.reduce(
            (acc, agent) => {
              const rank = agent.rank || 'unknown';
              acc[rank] = (acc[rank] || 0) + 1;
              return acc;
            },
            {} as Record<string, number>,
          ),
          capabilities: [
            'BERT foundation model reasoning',
            'Advanced pattern recognition system',
            'Leet speech detection and translation',
            'Subliminal communication analysis',
            'Real-time conversation monitoring',
            'Cross-collaboration framework',
            'Workflow execution capabilities',
            'Intent analysis and action planning',
          ],
        });
      } catch (error: any) {
        console.error('Error deploying National Reserve:', error);
        await auditLogger.log(
          req.user.claims.sub,
          'national_reserve.deploy',
          'agent_system',
          null,
          req,
          false,
          error?.message,
        );
        res.status(500).json({ message: 'Failed to deploy National Reserve' });
      }
    },
  );

  app.get(
    '/api/national-reserve/status',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const { nationalReserve } = await import('./services/nationalReserve');

        const status = await nationalReserve.getReserveStatus(userId);
        res.json(status);
      } catch (error: any) {
        console.error('Error fetching National Reserve status:', error);
        res
          .status(500)
          .json({ message: 'Failed to fetch National Reserve status' });
      }
    },
  );

  app.post(
    '/api/national-reserve/analyze-conversation',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const { conversationText, context } = req.body;
        const { nationalReserve } = await import('./services/nationalReserve');

        if (!conversationText) {
          return res
            .status(400)
            .json({ message: 'Conversation text is required' });
        }

        const analysis = await nationalReserve.analyzeConversation(
          userId,
          conversationText,
          context,
        );

        await auditLogger.log(
          userId,
          'conversation.analyze',
          'communication',
          null,
          req,
          true,
          null,
          {
            hasLeetSpeak: analysis.leetSpeak,
            subliminalIndicators: analysis.subliminalIndicators.length,
          },
        );

        res.json(analysis);
      } catch (error: any) {
        console.error('Error analyzing conversation:', error);
        await auditLogger.log(
          req.user.claims.sub,
          'conversation.analyze',
          'communication',
          null,
          req,
          false,
          error?.message,
        );
        res.status(500).json({ message: 'Failed to analyze conversation' });
      }
    },
  );

  // Credential management routes
  app.get('/api/credentials', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const credentials = await storage.getCredentials(userId);

      // Remove encrypted keys from response
      const sanitizedCredentials = credentials.map((cred) => ({
        ...cred,
        encryptedKey: undefined,
      }));

      res.json(sanitizedCredentials);
    } catch (error) {
      console.error('Error fetching credentials:', error);
      res.status(500).json({ message: 'Failed to fetch credentials' });
    }
  });

  // WebSocket server for real-time updates
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws: WebSocket, req) => {
    console.log('WebSocket connection established');

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log('Received WebSocket message:', data);

        // Handle different message types
        switch (data.type) {
          case 'ping':
            ws.send(JSON.stringify({ type: 'pong' }));
            break;
          case 'subscribe':
            // Handle subscription to updates
            break;
          default:
            console.log('Unknown message type:', data.type);
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
      }
    });

    ws.on('close', () => {
      console.log('WebSocket connection closed');
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    // Send initial connection confirmation
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'connected', timestamp: Date.now() }));
    }
  });

  // Foundation Model API routes
  app.post(
    '/api/foundation-model/reasoning',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { query, context } = req.body;
        const reasoning = await foundationModel.executeReasoning(
          query,
          context,
        );
        res.json(reasoning);
      } catch (error: any) {
        console.error('Error executing reasoning:', error);
        res.status(500).json({ message: 'Failed to execute reasoning' });
      }
    },
  );

  app.post(
    '/api/foundation-model/intent-analysis',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { text } = req.body;
        const analysis = await foundationModel.analyzeIntent(text);
        res.json(analysis);
      } catch (error: any) {
        console.error('Error analyzing intent:', error);
        res.status(500).json({ message: 'Failed to analyze intent' });
      }
    },
  );

  app.post(
    '/api/foundation-model/workflow',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { description } = req.body;
        const workflow = await foundationModel.createWorkflow(description);
        res.json(workflow);
      } catch (error: any) {
        console.error('Error creating workflow:', error);
        res.status(500).json({ message: 'Failed to create workflow' });
      }
    },
  );

  // NVIDIA Data Flywheel API Routes

  // Get flywheel runs
  app.get('/api/flywheel/runs', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await auditLogger.log(
        userId,
        'flywheel.runs.view',
        'flywheel',
        null,
        req,
      );

      // For now, return sample data - in production this would query the database
      const sampleRuns = [
        {
          id: 1,
          name: 'General Agent Optimization',
          description: 'Autonomous model discovery for general agent tasks',
          status: 'completed',
          baseModelId: 1,
          targetWorkload: 'general_agent_tasks',
          datasetSize: 15420,
          costSavings: 87,
          accuracyRetention: 94,
          startedAt: new Date(Date.now() - 3600000).toISOString(),
          completedAt: new Date().toISOString(),
          createdAt: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: 2,
          name: 'Customer Service Optimization',
          description: 'Model distillation for customer service workflows',
          status: 'running',
          baseModelId: 2,
          targetWorkload: 'customer_service',
          datasetSize: 8950,
          costSavings: 0,
          accuracyRetention: 0,
          startedAt: new Date(Date.now() - 1800000).toISOString(),
          createdAt: new Date(Date.now() - 1800000).toISOString(),
        },
      ];

      res.json(sampleRuns);
    } catch (error: any) {
      console.error('Error fetching flywheel runs:', error);
      res.status(500).json({ message: 'Failed to fetch flywheel runs' });
    }
  });

  // Start new flywheel run
  app.post('/api/flywheel/runs', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { name, targetWorkload, description } = req.body;

      await auditLogger.log(
        userId,
        'flywheel.run.create',
        'flywheel',
        null,
        req,
      );

      // Simulate starting a new flywheel run
      const newRun = {
        id: Date.now(),
        name,
        description,
        status: 'running',
        targetWorkload,
        datasetSize: 0,
        costSavings: 0,
        accuracyRetention: 0,
        startedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      res.json(newRun);
    } catch (error: any) {
      console.error('Error starting flywheel run:', error);
      res.status(500).json({ message: 'Failed to start flywheel run' });
    }
  });

  // Get model evaluations
  app.get(
    '/api/flywheel/evaluations',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        await auditLogger.log(
          userId,
          'flywheel.evaluations.view',
          'flywheel',
          null,
          req,
        );

        const sampleEvaluations = [
          {
            id: 1,
            modelId: 1,
            experimentType: 'base',
            workloadId: 'general_agent_tasks',
            accuracyScore: 94,
            latency: 150,
            costPerRequest: 45,
            isPromoted: true,
            createdAt: new Date().toISOString(),
          },
          {
            id: 2,
            modelId: 2,
            experimentType: 'customized',
            workloadId: 'customer_service',
            accuracyScore: 91,
            latency: 89,
            costPerRequest: 12,
            isPromoted: false,
            createdAt: new Date().toISOString(),
          },
        ];

        res.json(sampleEvaluations);
      } catch (error: any) {
        console.error('Error fetching evaluations:', error);
        res.status(500).json({ message: 'Failed to fetch evaluations' });
      }
    },
  );

  // Get optimizations
  app.get(
    '/api/flywheel/optimizations',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        await auditLogger.log(
          userId,
          'flywheel.optimizations.view',
          'flywheel',
          null,
          req,
        );

        const sampleOptimizations = [
          {
            id: 1,
            workloadId: 'general_agent_tasks',
            optimizationType: 'Model Distillation',
            costReduction: 87,
            speedImprovement: 65,
            accuracyRetention: 94,
            confidence: 89,
            productionReady: true,
            createdAt: new Date(Date.now() - 3600000).toISOString(),
          },
          {
            id: 2,
            workloadId: 'customer_service',
            optimizationType: 'LoRA Fine-tuning',
            costReduction: 42,
            speedImprovement: 23,
            accuracyRetention: 91,
            confidence: 76,
            productionReady: false,
            createdAt: new Date(Date.now() - 1800000).toISOString(),
          },
          {
            id: 3,
            workloadId: 'document_analysis',
            optimizationType: 'Quantization',
            costReduction: 58,
            speedImprovement: 34,
            accuracyRetention: 96,
            confidence: 82,
            productionReady: true,
            createdAt: new Date(Date.now() - 7200000).toISOString(),
          },
        ];

        res.json(sampleOptimizations);
      } catch (error: any) {
        console.error('Error fetching optimizations:', error);
        res.status(500).json({ message: 'Failed to fetch optimizations' });
      }
    },
  );

  return httpServer;
}
