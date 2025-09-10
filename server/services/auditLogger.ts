import { InsertAuditLog } from '@shared/schema';
import { storage } from '../storage';
import { Request } from 'express';

interface AuditLogEntry {
  userId: string;
  action: string;
  resource: string;
  resourceId?: string | null;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  error?: string | null;
  metadata?: Record<string, any>;
}

class AuditLogger {
  async log(
    userId: string | null,
    action: string,
    resource: string,
    resourceId?: string | null,
    req?: Request | null,
    success: boolean = true,
    error?: string | null,
    metadata?: Record<string, any>,
  ): Promise<void> {
    try {
      const auditEntry: InsertAuditLog = {
        userId: userId || 'system',
        action,
        resource,
        resourceId,
        ipAddress: req?.ip || req?.connection?.remoteAddress || null,
        userAgent: req?.get('User-Agent') || null,
        success,
        error,
        metadata,
      };

      await storage.createAuditLog(auditEntry);

      // Log to console for immediate visibility
      const logLevel = success ? 'INFO' : 'ERROR';
      const logMessage = `[${logLevel}] ${userId || 'system'} - ${action} on ${resource}${resourceId ? ` (${resourceId})` : ''} - ${success ? 'SUCCESS' : 'FAILED'}`;

      if (success) {
        console.log(logMessage);
      } else {
        console.error('%s', logMessage, error);
      }

      // Additional security alerting for critical actions
      if (this.isCriticalAction(action) || !success) {
        await this.handleCriticalEvent(auditEntry);
      }
    } catch (auditError) {
      console.error('Failed to write audit log:', auditError);
      // Still log to console even if database fails
      console.error(
        `AUDIT FAILURE: ${action} by ${userId} on ${resource} - ${success ? 'SUCCESS' : 'FAILED'}`,
      );
    }
  }

  async logSecurityEvent(
    userId: string | null,
    eventType: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    description: string,
    req?: Request | null,
    metadata?: Record<string, any>,
  ): Promise<void> {
    const action = `security.${eventType}`;
    const success = severity !== 'critical';

    await this.log(
      userId,
      action,
      'security',
      null,
      req,
      success,
      severity === 'critical' ? description : null,
      {
        ...metadata,
        severity,
        eventType,
        description,
      },
    );

    // Immediate console output for security events
    const logMessage = `[SECURITY:${severity.toUpperCase()}] ${eventType} - ${description}`;

    if (severity === 'critical' || severity === 'high') {
      console.error(logMessage);
    } else {
      console.warn(logMessage);
    }
  }

  async logAuthEvent(
    userId: string | null,
    eventType:
      | 'login'
      | 'logout'
      | 'login_failure'
      | 'password_change'
      | 'account_locked',
    req?: Request | null,
    metadata?: Record<string, any>,
  ): Promise<void> {
    const success =
      !eventType.includes('failure') && eventType !== 'account_locked';

    await this.log(
      userId,
      `auth.${eventType}`,
      'authentication',
      userId,
      req,
      success,
      success ? null : `Authentication event: ${eventType}`,
      metadata,
    );
  }

  async logDataAccess(
    userId: string,
    resource: string,
    resourceId: string,
    operation: 'read' | 'write' | 'delete',
    req?: Request | null,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.log(
      userId,
      `data.${operation}`,
      resource,
      resourceId,
      req,
      true,
      null,
      {
        ...metadata,
        operation,
        sensitive: this.isSensitiveResource(resource),
      },
    );
  }

  async logSystemEvent(
    eventType: string,
    description: string,
    success: boolean = true,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.log(
      null,
      `system.${eventType}`,
      'system',
      null,
      null,
      success,
      success ? null : description,
      {
        ...metadata,
        description,
        timestamp: new Date().toISOString(),
      },
    );
  }

  async getSecurityAlerts(
    userId: string,
    timeRange: { from: Date; to: Date },
    severity?: 'low' | 'medium' | 'high' | 'critical',
  ): Promise<any[]> {
    // This would fetch security-related audit logs
    const auditLogs = await storage.getAuditLogs(userId, 100);

    return auditLogs
      .filter(
        (log) =>
          log.action.startsWith('security.') &&
          log.createdAt >= timeRange.from &&
          log.createdAt <= timeRange.to &&
          (!severity || log.metadata?.severity === severity),
      )
      .map((log) => ({
        id: log.id,
        action: log.action,
        severity: log.metadata?.severity || 'medium',
        description: log.metadata?.description || log.action,
        timestamp: log.createdAt,
        userId: log.userId,
        ipAddress: log.ipAddress,
        success: log.success,
      }));
  }

  async generateSecurityReport(
    userId: string,
    timeRange: { from: Date; to: Date },
  ): Promise<{
    totalEvents: number;
    securityEvents: number;
    failedLogins: number;
    criticalEvents: number;
    topActions: Array<{ action: string; count: number }>;
    ipAddresses: Array<{ ip: string; count: number }>;
  }> {
    const auditLogs = await storage.getAuditLogs(userId, 1000);

    const filteredLogs = auditLogs.filter(
      (log) => log.createdAt >= timeRange.from && log.createdAt <= timeRange.to,
    );

    const securityEvents = filteredLogs.filter(
      (log) =>
        log.action.startsWith('security.') || log.action.startsWith('auth.'),
    );

    const failedLogins = filteredLogs.filter(
      (log) => log.action === 'auth.login_failure',
    );

    const criticalEvents = filteredLogs.filter(
      (log) => log.metadata?.severity === 'critical' || !log.success,
    );

    // Count actions
    const actionCounts = new Map<string, number>();
    filteredLogs.forEach((log) => {
      const count = actionCounts.get(log.action) || 0;
      actionCounts.set(log.action, count + 1);
    });

    // Count IP addresses
    const ipCounts = new Map<string, number>();
    filteredLogs.forEach((log) => {
      if (log.ipAddress) {
        const count = ipCounts.get(log.ipAddress) || 0;
        ipCounts.set(log.ipAddress, count + 1);
      }
    });

    return {
      totalEvents: filteredLogs.length,
      securityEvents: securityEvents.length,
      failedLogins: failedLogins.length,
      criticalEvents: criticalEvents.length,
      topActions: Array.from(actionCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([action, count]) => ({ action, count })),
      ipAddresses: Array.from(ipCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([ip, count]) => ({ ip, count })),
    };
  }

  private isCriticalAction(action: string): boolean {
    const criticalActions = [
      'auth.login_failure',
      'auth.account_locked',
      'security.breach',
      'security.unauthorized_access',
      'agent.delete',
      'credential.create',
      'credential.delete',
      'system.shutdown',
      'system.configuration_change',
    ];

    return criticalActions.some((critical) => action.includes(critical));
  }

  private isSensitiveResource(resource: string): boolean {
    const sensitiveResources = [
      'credential',
      'user',
      'security',
      'payment',
      'personal_data',
    ];

    return sensitiveResources.some((sensitive) => resource.includes(sensitive));
  }

  private async handleCriticalEvent(auditEntry: AuditLogEntry): Promise<void> {
    // In a production environment, this would:
    // 1. Send alerts to administrators
    // 2. Trigger automated security responses
    // 3. Log to external security monitoring systems
    // 4. Create incident tickets

    const alertMessage = `CRITICAL SECURITY EVENT: ${auditEntry.action} on ${auditEntry.resource} by ${auditEntry.userId}`;

    console.error('🚨 SECURITY ALERT:', alertMessage);

    // Here you would integrate with:
    // - Email/SMS alerting systems
    // - Slack/Teams notifications
    // - External SIEM systems
    // - Incident management tools

    // For now, we'll just ensure it's logged prominently
    if (auditEntry.error) {
      console.error('Error details:', auditEntry.error);
    }

    if (auditEntry.metadata) {
      console.error('Additional context:', auditEntry.metadata);
    }
  }
}

export const auditLogger = new AuditLogger();
