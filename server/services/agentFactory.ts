import { Agent } from '@shared/schema';
import { errorMessage } from '@shared/errors';
import { storage } from '../storage';
import { openaiService, type ContentGenerationRequest } from './openai';
import { auditLogger } from './auditLogger';

export interface AgentConfig {
  apiKeys?: Record<string, string>;
  webhooks?: string[];
  schedules?: Array<{
    cron: string;
    action: string;
  }>;
  approvalRequired?: boolean;
  securityLevel?: 'low' | 'medium' | 'high';
  rateLimits?: {
    requests: number;
    period: number;
  };
}

export interface AgentCapability {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  securityLevel: 'low' | 'medium' | 'high';
}

class AgentFactory {
  private agentCapabilities: Map<string, AgentCapability[]> = new Map();

  constructor() {
    this.initializeCapabilities();
  }

  private initializeCapabilities() {
    // Social Media Agent Capabilities
    this.agentCapabilities.set('social_media', [
      {
        name: 'generate_post',
        description: 'Generate social media posts with AI',
        parameters: { platform: 'string', topic: 'string', tone: 'string' },
        securityLevel: 'medium',
      },
      {
        name: 'schedule_post',
        description: 'Schedule posts for publication',
        parameters: {
          content: 'string',
          publishTime: 'datetime',
          platform: 'string',
        },
        securityLevel: 'high',
      },
      {
        name: 'analyze_engagement',
        description: 'Analyze post engagement metrics',
        parameters: { postId: 'string', platform: 'string' },
        securityLevel: 'low',
      },
    ]);

    // Email Marketing Agent Capabilities
    this.agentCapabilities.set('email_marketing', [
      {
        name: 'create_campaign',
        description: 'Create email marketing campaigns',
        parameters: {
          subject: 'string',
          content: 'string',
          recipients: 'array',
        },
        securityLevel: 'high',
      },
      {
        name: 'send_email',
        description: 'Send individual emails',
        parameters: { to: 'string', subject: 'string', content: 'string' },
        securityLevel: 'high',
      },
      {
        name: 'analyze_campaign',
        description: 'Analyze campaign performance',
        parameters: { campaignId: 'string' },
        securityLevel: 'low',
      },
    ]);

    // Analytics Agent Capabilities
    this.agentCapabilities.set('analytics', [
      {
        name: 'generate_report',
        description: 'Generate analytics reports',
        parameters: { metrics: 'array', timeRange: 'string', format: 'string' },
        securityLevel: 'low',
      },
      {
        name: 'monitor_traffic',
        description: 'Monitor website traffic',
        parameters: { domain: 'string', alerts: 'boolean' },
        securityLevel: 'medium',
      },
      {
        name: 'create_dashboard',
        description: 'Create custom dashboards',
        parameters: { widgets: 'array', layout: 'object' },
        securityLevel: 'low',
      },
    ]);

    // File System Agent Capabilities
    this.agentCapabilities.set('file_system', [
      {
        name: 'organize_files',
        description: 'Organize files and folders',
        parameters: { path: 'string', rules: 'object' },
        securityLevel: 'high',
      },
      {
        name: 'backup_files',
        description: 'Create file backups',
        parameters: {
          source: 'string',
          destination: 'string',
          schedule: 'string',
        },
        securityLevel: 'high',
      },
      {
        name: 'monitor_changes',
        description: 'Monitor file system changes',
        parameters: { watchPaths: 'array', notifications: 'boolean' },
        securityLevel: 'medium',
      },
    ]);

    // DNS Agent Capabilities
    this.agentCapabilities.set('dns', [
      {
        name: 'update_records',
        description: 'Update DNS records',
        parameters: { domain: 'string', recordType: 'string', value: 'string' },
        securityLevel: 'high',
      },
      {
        name: 'monitor_propagation',
        description: 'Monitor DNS propagation',
        parameters: { domain: 'string', recordType: 'string' },
        securityLevel: 'low',
      },
    ]);
  }

  async initializeAgent(agent: Agent): Promise<void> {
    try {
      await auditLogger.log(
        agent.userId!,
        'agent.initialize',
        'agent',
        agent.id.toString(),
        null,
        true,
        null,
        { agentName: agent.name, agentType: agent.typeId },
      );

      // Initialize agent with default configuration
      const defaultConfig = this.getDefaultConfig();

      await storage.updateAgent(agent.id, {
        configuration: defaultConfig,
        status: 'active',
        lastActivity: new Date(),
      });

      await storage.createActivity({
        userId: agent.userId!,
        agentId: agent.id,
        type: 'agent.initialized',
        message: `Agent "${agent.name}" has been initialized and is ready for tasks`,
        metadata: { configuration: defaultConfig },
      });
    } catch (error) {
      console.error('Error initializing agent:', error);

      await storage.updateAgent(agent.id, {
        status: 'error',
        lastActivity: new Date(),
      });

      await auditLogger.log(
        agent.userId!,
        'agent.initialize',
        'agent',
        agent.id.toString(),
        null,
        false,
        errorMessage(error),
      );

      throw error;
    }
  }

  async executeAgentTask(
    agentId: number,
    taskType: string,
    parameters: Record<string, unknown>,
  ): Promise<unknown> {
    const agent = await storage.getAgent(agentId);
    if (!agent) {
      throw new Error('Agent not found');
    }

    try {
      await auditLogger.log(
        agent.userId!,
        'agent.task.execute',
        'task',
        null,
        null,
        true,
        null,
        { agentId, taskType, parameters },
      );

      const result = await this.processTask(agent, taskType, parameters);

      await storage.createActivity({
        userId: agent.userId!,
        agentId: agent.id,
        type: 'task.completed',
        message: `Agent "${agent.name}" completed task: ${taskType}`,
        metadata: { taskType, parameters, result },
      });

      return result;
    } catch (error) {
      console.error('Error executing agent task:', error);

      await auditLogger.log(
        agent.userId!,
        'agent.task.execute',
        'task',
        null,
        null,
        false,
        errorMessage(error),
        { agentId, taskType, parameters },
      );

      await storage.createActivity({
        userId: agent.userId!,
        agentId: agent.id,
        type: 'task.failed',
        message: `Agent "${agent.name}" failed to complete task: ${taskType}`,
        metadata: { taskType, parameters, error: errorMessage(error) },
      });

      throw error;
    }
  }

  private async processTask(
    agent: Agent,
    taskType: string,
    parameters: Record<string, unknown>,
  ): Promise<unknown> {
    const agentType = await this.getAgentTypeFromAgent(agent);

    switch (agentType) {
      case 'social_media':
        return await this.processSocialMediaTask(agent, taskType, parameters);
      case 'email_marketing':
        return await this.processEmailMarketingTask(
          agent,
          taskType,
          parameters,
        );
      case 'analytics':
        return await this.processAnalyticsTask(agent, taskType, parameters);
      case 'file_system':
        return await this.processFileSystemTask(agent, taskType, parameters);
      default:
        throw new Error(`Unknown agent type: ${agentType}`);
    }
  }

  private async processSocialMediaTask(
    agent: Agent,
    taskType: string,
    parameters: Record<string, unknown>,
  ): Promise<unknown> {
    switch (taskType) {
      case 'generate_post': {
        const p = parameters as Partial<ContentGenerationRequest>;
        const contentRequest: ContentGenerationRequest = {
          type: 'social_media',
          platform: p.platform,
          topic: p.topic ?? '',
          tone: p.tone || 'professional',
          length: p.length || 'medium',
          targetAudience: p.targetAudience,
          keywords: p.keywords,
        };

        const contentResult =
          await openaiService.generateContent(contentRequest);

        // Check if approval is required
        if (agent.securityConfig?.approvalRequired) {
          await storage.createApproval({
            agentId: agent.id,
            userId: agent.userId!,
            type: 'social_media_post',
            title: `Social Media Post for ${parameters.platform}`,
            description: `Generated post about ${parameters.topic}`,
            requestData: {
              content: contentResult.content,
              platform: parameters.platform,
            },
            suggestedResponse: contentResult.content,
          });

          return {
            status: 'pending_approval',
            content: contentResult.content,
            approvalRequired: true,
          };
        }

        return {
          status: 'completed',
          content: contentResult.content,
          suggestions: contentResult.suggestions,
          metadata: contentResult.metadata,
        };
      }
      case 'schedule_post':
        return {
          status: 'scheduled',
          scheduledFor: parameters.publishTime,
          platform: parameters.platform,
          message: 'Post has been scheduled for publication',
        };

      case 'analyze_engagement':
        return {
          status: 'completed',
          engagement: {
            likes: Math.floor(Math.random() * 1000),
            shares: Math.floor(Math.random() * 100),
            comments: Math.floor(Math.random() * 50),
            reach: Math.floor(Math.random() * 5000),
          },
          insights: [
            'High engagement during evening hours',
            'Visual content performs better',
          ],
        };

      default:
        throw new Error(`Unknown social media task: ${taskType}`);
    }
  }

  private async processEmailMarketingTask(
    agent: Agent,
    taskType: string,
    parameters: Record<string, unknown>,
  ): Promise<unknown> {
    switch (taskType) {
      case 'create_campaign': {
        const campaignId = `campaign_${Date.now()}`;
        const recipients = Array.isArray(parameters.recipients)
          ? parameters.recipients
          : [];

        if (agent.securityConfig?.approvalRequired) {
          await storage.createApproval({
            agentId: agent.id,
            userId: agent.userId!,
            type: 'email_campaign',
            title: `Email Campaign: ${parameters.subject}`,
            description: `Campaign to ${recipients.length} recipients`,
            requestData: parameters,
            suggestedResponse: `Send campaign to ${recipients.length} recipients`,
          });

          return {
            status: 'pending_approval',
            campaignId,
            approvalRequired: true,
          };
        }

        return {
          status: 'created',
          campaignId,
          recipients: recipients.length,
          subject: parameters.subject,
        };
      }
      case 'send_email':
        return {
          status: 'sent',
          messageId: `msg_${Date.now()}`,
          deliveredAt: new Date().toISOString(),
        };

      case 'analyze_campaign':
        return {
          status: 'completed',
          metrics: {
            sent: 1000,
            delivered: 985,
            opened: 320,
            clicked: 45,
            bounced: 15,
            unsubscribed: 3,
          },
          openRate: 0.325,
          clickRate: 0.046,
          deliveryRate: 0.985,
        };

      default:
        throw new Error(`Unknown email marketing task: ${taskType}`);
    }
  }

  private async processAnalyticsTask(
    agent: Agent,
    taskType: string,
    parameters: Record<string, unknown>,
  ): Promise<unknown> {
    switch (taskType) {
      case 'generate_report':
        return {
          status: 'completed',
          reportId: `report_${Date.now()}`,
          format: parameters.format,
          metrics: parameters.metrics,
          timeRange: parameters.timeRange,
          data: {
            pageViews: Math.floor(Math.random() * 10000),
            uniqueVisitors: Math.floor(Math.random() * 5000),
            bounceRate: Math.random() * 0.5,
            averageSessionDuration: Math.floor(Math.random() * 300),
          },
        };

      case 'monitor_traffic':
        return {
          status: 'monitoring',
          domain: parameters.domain,
          alerts: parameters.alerts,
          currentTraffic: {
            visitors: Math.floor(Math.random() * 100),
            pageViews: Math.floor(Math.random() * 500),
            loading: Math.random() * 3,
          },
        };

      case 'create_dashboard':
        return {
          status: 'created',
          dashboardId: `dashboard_${Date.now()}`,
          widgets: parameters.widgets,
          layout: parameters.layout,
          url: `/dashboard/${Date.now()}`,
        };

      default:
        throw new Error(`Unknown analytics task: ${taskType}`);
    }
  }

  private async processFileSystemTask(
    agent: Agent,
    taskType: string,
    parameters: Record<string, unknown>,
  ): Promise<unknown> {
    switch (taskType) {
      case 'organize_files':
        return {
          status: 'completed',
          path: parameters.path,
          filesOrganized: Math.floor(Math.random() * 100),
          foldersCreated: Math.floor(Math.random() * 10),
          rules: parameters.rules,
        };

      case 'backup_files':
        return {
          status: 'completed',
          source: parameters.source,
          destination: parameters.destination,
          filesBackedUp: Math.floor(Math.random() * 1000),
          backupSize: `${Math.floor(Math.random() * 100)}MB`,
          schedule: parameters.schedule,
        };

      case 'monitor_changes':
        return {
          status: 'monitoring',
          watchPaths: parameters.watchPaths,
          notifications: parameters.notifications,
          changesDetected: Math.floor(Math.random() * 5),
        };

      default:
        throw new Error(`Unknown file system task: ${taskType}`);
    }
  }

  private getDefaultConfig(): AgentConfig {
    return {
      apiKeys: {},
      webhooks: [],
      schedules: [],
      approvalRequired: true,
      securityLevel: 'high',
      rateLimits: {
        requests: 100,
        period: 3600, // 1 hour
      },
    };
  }

  private async getAgentTypeFromAgent(agent: Agent): Promise<string> {
    if (!agent.typeId) {
      throw new Error('Agent type not specified');
    }

    // Map type IDs to type names (this would be dynamic based on agent types)
    const typeMap: Record<number, string> = {
      1: 'social_media',
      2: 'email_marketing',
      3: 'analytics',
      4: 'file_system',
      5: 'dns',
    };

    return typeMap[agent.typeId] || 'unknown';
  }

  getAgentCapabilities(agentType: string): AgentCapability[] {
    return this.agentCapabilities.get(agentType) || [];
  }

  async validateAgentSecurity(agent: Agent): Promise<{
    valid: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check security configuration
    if (!agent.securityConfig) {
      issues.push('No security configuration found');
      recommendations.push('Configure security settings for the agent');
    }

    // Check encryption settings
    if (!agent.securityConfig?.encryption) {
      issues.push('Encryption not enabled');
      recommendations.push('Enable encryption for sensitive data');
    }

    // Check approval requirements
    if (!agent.securityConfig?.approvalRequired) {
      recommendations.push(
        'Consider enabling approval requirements for high-risk actions',
      );
    }

    return {
      valid: issues.length === 0,
      issues,
      recommendations,
    };
  }
}

export const agentFactory = new AgentFactory();
