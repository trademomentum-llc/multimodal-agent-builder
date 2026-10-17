import {
  users,
  agents,
  agentTypes,
  tasks,
  approvals,
  activities,
  auditLog,
  credentials,
  models,
  flywheelRuns,
  modelEvaluations,
  trafficLogs,
  optimizations,
  multimodalSessions,
  multimodalInteractions,
  multimodalFiles,
  securityBlacklist,
  type User,
  type UpsertUser,
  type Agent,
  type InsertAgent,
  type AgentType,
  type InsertAgentType,
  type Task,
  type InsertTask,
  type Approval,
  type InsertApproval,
  type Activity,
  type InsertActivity,
  type AuditLogEntry,
  type InsertAuditLogEntry,
  type Credential,
  type InsertCredential,
  type Model,
  type FlywheelRun,
  type InsertFlywheelRun,
  type ModelEvaluation,
  type InsertModelEvaluation,
  type TrafficLog,
  type Optimization,
  type MultimodalSession,
  type InsertMultimodalSession,
  type MultimodalInteraction,
  type InsertMultimodalInteraction,
  type MultimodalFile,
  type InsertMultimodalFile,
  type SecurityBlacklist,
  type InsertSecurityBlacklist,
} from '@shared/schema';
import { db } from './db';
import { eq, desc, and, sql, count } from 'drizzle-orm';

export interface IStorage {
  // User operations (IMPORTANT: mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserSecurity(
    userId: string,
    securityUpdate: {
      twoFactorEnabled?: boolean;
      twoFactorSecret?: string | null;
      twoFactorBackupCodes?: string[] | null;
      passwordHash?: string;
      lastPasswordChange?: Date;
      mustChangePassword?: boolean;
    },
  ): Promise<void>;

  // Agent type operations
  getAgentTypes(): Promise<AgentType[]>;
  createAgentType(agentType: InsertAgentType): Promise<AgentType>;

  // Agent operations
  getAgents(userId: string): Promise<Agent[]>;
  getAgent(id: number): Promise<Agent | undefined>;
  createAgent(agent: InsertAgent): Promise<Agent>;
  updateAgent(id: number, agent: Partial<InsertAgent>): Promise<Agent>;
  deleteAgent(id: number): Promise<void>;

  // Task operations
  getTasks(userId: string, limit?: number): Promise<Task[]>;
  getTask(id: number): Promise<Task | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: number, task: Partial<InsertTask>): Promise<Task>;
  deleteTask(id: number): Promise<void>;

  // Approval operations
  getApprovals(userId: string, limit?: number): Promise<Approval[]>;
  getApproval(id: number): Promise<Approval | undefined>;
  createApproval(approval: InsertApproval): Promise<Approval>;
  updateApproval(
    id: number,
    approval: Partial<InsertApproval>,
  ): Promise<Approval>;

  // Activity operations
  getActivities(userId: string, limit?: number): Promise<Activity[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;

  // Audit log operations
  createAuditLog(auditEntry: InsertAuditLogEntry): Promise<AuditLogEntry>;
  getAuditLogs(userId: string, limit?: number): Promise<AuditLogEntry[]>;

  // Credential operations
  getCredentials(userId: string): Promise<Credential[]>;
  createCredential(credential: InsertCredential): Promise<Credential>;
  updateCredential(
    id: number,
    credential: Partial<InsertCredential>,
  ): Promise<Credential>;
  deleteCredential(id: number): Promise<void>;

  // Dashboard statistics
  getDashboardStats(userId: string): Promise<{
    activeAgents: number;
    tasksProcessed: number;
    pendingApprovals: number;
    systemUptime: number;
  }>;

  // Flywheel operations
  getFlywheelRuns(userId: string): Promise<FlywheelRun[]>;
  createFlywheelRun(run: InsertFlywheelRun): Promise<FlywheelRun>;
  updateFlywheelRun(
    id: number,
    run: Partial<InsertFlywheelRun>,
  ): Promise<FlywheelRun>;
  getFlywheelRunById(id: number): Promise<FlywheelRun | undefined>;

  // Model evaluation operations
  createModelEvaluation(
    evaluation: InsertModelEvaluation,
  ): Promise<ModelEvaluation>;
  getModelEvaluationsByRunId(runId: number): Promise<ModelEvaluation[]>;

  // Multimodal operations
  createMultimodalSession(
    session: InsertMultimodalSession,
  ): Promise<MultimodalSession>;
  getMultimodalSession(
    sessionId: string,
  ): Promise<MultimodalSession | undefined>;
  updateMultimodalSession(
    id: number,
    session: Partial<InsertMultimodalSession>,
  ): Promise<MultimodalSession>;

  createMultimodalInteraction(
    interaction: InsertMultimodalInteraction,
  ): Promise<MultimodalInteraction>;
  getMultimodalInteractionsBySession(
    sessionId: string,
  ): Promise<MultimodalInteraction[]>;

  createMultimodalFile(file: InsertMultimodalFile): Promise<MultimodalFile>;
  updateMultimodalFile(
    id: number,
    file: Partial<InsertMultimodalFile>,
  ): Promise<MultimodalFile>;
  getMultimodalFileById(id: number): Promise<MultimodalFile | undefined>;

  // Security blacklist operations
  createBlacklistEntry(
    entry: InsertSecurityBlacklist,
  ): Promise<SecurityBlacklist>;
  getActiveBlacklistEntries(ipAddress: string): Promise<SecurityBlacklist[]>;
  getBlacklistEntry(
    ipAddress: string,
    reason: string,
  ): Promise<SecurityBlacklist | undefined>;
  updateBlacklistEntry(
    id: number,
    entry: Partial<InsertSecurityBlacklist>,
  ): Promise<SecurityBlacklist>;
  deactivateBlacklistEntries(
    ipAddress: string,
    reviewedBy: string,
    notes?: string,
  ): Promise<void>;
  cleanupExpiredBlacklist(): Promise<void>;
  getBlacklistStats(): Promise<any>;
  getRecentFailedAttempts(
    ipAddress: string,
    windowMinutes: number,
  ): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  // User operations (IMPORTANT: mandatory for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUserSecurity(
    userId: string,
    securityUpdate: {
      twoFactorEnabled?: boolean;
      twoFactorSecret?: string | null;
      twoFactorBackupCodes?: string[] | null;
      passwordHash?: string;
      lastPasswordChange?: Date;
      mustChangePassword?: boolean;
    },
  ): Promise<void> {
    await db
      .update(users)
      .set({
        ...securityUpdate,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  // Agent type operations
  async getAgentTypes(): Promise<AgentType[]> {
    return await db
      .select()
      .from(agentTypes)
      .where(eq(agentTypes.isActive, true));
  }

  async createAgentType(agentType: InsertAgentType): Promise<AgentType> {
    const [created] = await db.insert(agentTypes).values(agentType).returning();
    return created;
  }

  // Agent operations
  async getAgents(userId: string): Promise<Agent[]> {
    return await db
      .select()
      .from(agents)
      .where(eq(agents.userId, userId))
      .orderBy(desc(agents.createdAt));
  }

  async getAgent(id: number): Promise<Agent | undefined> {
    const [agent] = await db.select().from(agents).where(eq(agents.id, id));
    return agent;
  }

  async createAgent(agent: InsertAgent): Promise<Agent> {
    const [created] = await db.insert(agents).values(agent).returning();
    return created;
  }

  async updateAgent(id: number, agent: Partial<InsertAgent>): Promise<Agent> {
    const [updated] = await db
      .update(agents)
      .set({ ...agent, updatedAt: new Date() })
      .where(eq(agents.id, id))
      .returning();
    return updated;
  }

  async deleteAgent(id: number): Promise<void> {
    await db.delete(agents).where(eq(agents.id, id));
  }

  // Task operations
  async getTasks(userId: string, limit: number = 50): Promise<Task[]> {
    return await db
      .select()
      .from(tasks)
      .where(eq(tasks.userId, userId))
      .orderBy(desc(tasks.createdAt))
      .limit(limit);
  }

  async getTask(id: number): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    return task;
  }

  async createTask(task: InsertTask): Promise<Task> {
    const [created] = await db.insert(tasks).values(task).returning();
    return created;
  }

  async updateTask(id: number, task: Partial<InsertTask>): Promise<Task> {
    const [updated] = await db
      .update(tasks)
      .set({ ...task, updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();
    return updated;
  }

  async deleteTask(id: number): Promise<void> {
    await db.delete(tasks).where(eq(tasks.id, id));
  }

  // Approval operations
  async getApprovals(userId: string, limit: number = 50): Promise<Approval[]> {
    return await db
      .select()
      .from(approvals)
      .where(eq(approvals.userId, userId))
      .orderBy(desc(approvals.createdAt))
      .limit(limit);
  }

  async getApproval(id: number): Promise<Approval | undefined> {
    const [approval] = await db
      .select()
      .from(approvals)
      .where(eq(approvals.id, id));
    return approval;
  }

  async createApproval(approval: InsertApproval): Promise<Approval> {
    const [created] = await db.insert(approvals).values(approval).returning();
    return created;
  }

  async updateApproval(
    id: number,
    approval: Partial<InsertApproval>,
  ): Promise<Approval> {
    const [updated] = await db
      .update(approvals)
      .set({ ...approval, updatedAt: new Date() })
      .where(eq(approvals.id, id))
      .returning();
    return updated;
  }

  // Activity operations
  async getActivities(userId: string, limit: number = 20): Promise<Activity[]> {
    return await db
      .select()
      .from(activities)
      .where(eq(activities.userId, userId))
      .orderBy(desc(activities.createdAt))
      .limit(limit);
  }

  async createActivity(activity: InsertActivity): Promise<Activity> {
    const [created] = await db.insert(activities).values(activity).returning();
    return created;
  }

  // Audit log operations
  async createAuditLog(
    auditEntry: InsertAuditLogEntry,
  ): Promise<AuditLogEntry> {
    const [created] = await db.insert(auditLog).values(auditEntry).returning();
    return created;
  }

  async getAuditLogs(
    userId: string,
    limit: number = 100,
  ): Promise<AuditLogEntry[]> {
    return await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.userId, userId))
      .orderBy(desc(auditLog.createdAt))
      .limit(limit);
  }

  // Credential operations
  async getCredentials(userId: string): Promise<Credential[]> {
    return await db
      .select()
      .from(credentials)
      .where(
        and(eq(credentials.userId, userId), eq(credentials.isActive, true)),
      )
      .orderBy(desc(credentials.createdAt));
  }

  async createCredential(credential: InsertCredential): Promise<Credential> {
    const [created] = await db
      .insert(credentials)
      .values(credential)
      .returning();
    return created;
  }

  async updateCredential(
    id: number,
    credential: Partial<InsertCredential>,
  ): Promise<Credential> {
    const [updated] = await db
      .update(credentials)
      .set({ ...credential, updatedAt: new Date() })
      .where(eq(credentials.id, id))
      .returning();
    return updated;
  }

  async deleteCredential(id: number): Promise<void> {
    await db
      .update(credentials)
      .set({ isActive: false })
      .where(eq(credentials.id, id));
  }

  // Dashboard statistics
  async getDashboardStats(userId: string): Promise<{
    activeAgents: number;
    tasksProcessed: number;
    pendingApprovals: number;
    systemUptime: number;
  }> {
    const [activeAgentsResult] = await db
      .select({ count: count() })
      .from(agents)
      .where(and(eq(agents.userId, userId), eq(agents.status, 'active')));

    const [tasksProcessedResult] = await db
      .select({ count: count() })
      .from(tasks)
      .where(and(eq(tasks.userId, userId), eq(tasks.status, 'completed')));

    const [pendingApprovalsResult] = await db
      .select({ count: count() })
      .from(approvals)
      .where(
        and(eq(approvals.userId, userId), eq(approvals.status, 'pending')),
      );

    return {
      activeAgents: activeAgentsResult?.count || 0,
      tasksProcessed: tasksProcessedResult?.count || 0,
      pendingApprovals: pendingApprovalsResult?.count || 0,
      systemUptime: 99.9, // Static for now
    };
  }

  // Flywheel operations
  async getFlywheelRuns(userId: string): Promise<FlywheelRun[]> {
    return await db
      .select()
      .from(flywheelRuns)
      .where(eq(flywheelRuns.userId, userId))
      .orderBy(desc(flywheelRuns.createdAt));
  }

  async createFlywheelRun(run: InsertFlywheelRun): Promise<FlywheelRun> {
    const [created] = await db.insert(flywheelRuns).values(run).returning();
    return created;
  }

  async updateFlywheelRun(
    id: number,
    run: Partial<InsertFlywheelRun>,
  ): Promise<FlywheelRun> {
    const [updated] = await db
      .update(flywheelRuns)
      .set({ ...run, updatedAt: new Date() })
      .where(eq(flywheelRuns.id, id))
      .returning();
    return updated;
  }

  async getFlywheelRunById(id: number): Promise<FlywheelRun | undefined> {
    const [run] = await db
      .select()
      .from(flywheelRuns)
      .where(eq(flywheelRuns.id, id));
    return run;
  }

  // Model evaluation operations
  async createModelEvaluation(
    evaluation: InsertModelEvaluation,
  ): Promise<ModelEvaluation> {
    const [created] = await db
      .insert(modelEvaluations)
      .values(evaluation)
      .returning();
    return created;
  }

  async getModelEvaluationsByRunId(runId: number): Promise<ModelEvaluation[]> {
    return await db
      .select()
      .from(modelEvaluations)
      .where(eq(modelEvaluations.flywheelRunId, runId))
      .orderBy(desc(modelEvaluations.createdAt));
  }

  // Multimodal operations
  async createMultimodalSession(
    session: InsertMultimodalSession,
  ): Promise<MultimodalSession> {
    const [created] = await db
      .insert(multimodalSessions)
      .values(session)
      .returning();
    return created;
  }

  async getMultimodalSession(
    sessionId: string,
  ): Promise<MultimodalSession | undefined> {
    const [session] = await db
      .select()
      .from(multimodalSessions)
      .where(eq(multimodalSessions.sessionId, sessionId));
    return session;
  }

  async updateMultimodalSession(
    id: number,
    session: Partial<InsertMultimodalSession>,
  ): Promise<MultimodalSession> {
    const [updated] = await db
      .update(multimodalSessions)
      .set({ ...session, updatedAt: new Date() })
      .where(eq(multimodalSessions.id, id))
      .returning();
    return updated;
  }

  async createMultimodalInteraction(
    interaction: InsertMultimodalInteraction,
  ): Promise<MultimodalInteraction> {
    const [created] = await db
      .insert(multimodalInteractions)
      .values(interaction)
      .returning();
    return created;
  }

  async getMultimodalInteractionsBySession(
    sessionId: string,
  ): Promise<MultimodalInteraction[]> {
    const session = await this.getMultimodalSession(sessionId);
    if (!session) return [];

    return await db
      .select()
      .from(multimodalInteractions)
      .where(eq(multimodalInteractions.sessionId, session.id))
      .orderBy(desc(multimodalInteractions.createdAt));
  }

  async createMultimodalFile(
    file: InsertMultimodalFile,
  ): Promise<MultimodalFile> {
    const [created] = await db.insert(multimodalFiles).values(file).returning();
    return created;
  }

  async updateMultimodalFile(
    id: number,
    file: Partial<InsertMultimodalFile>,
  ): Promise<MultimodalFile> {
    const [updated] = await db
      .update(multimodalFiles)
      .set({ ...file, updatedAt: new Date() })
      .where(eq(multimodalFiles.id, id))
      .returning();
    return updated;
  }

  async getMultimodalFileById(id: number): Promise<MultimodalFile | undefined> {
    const [file] = await db
      .select()
      .from(multimodalFiles)
      .where(eq(multimodalFiles.id, id));
    return file;
  }

  // Security blacklist operations
  async createBlacklistEntry(
    entry: InsertSecurityBlacklist,
  ): Promise<SecurityBlacklist> {
    const [created] = await db
      .insert(securityBlacklist)
      .values(entry)
      .returning();
    return created;
  }

  async getActiveBlacklistEntries(
    ipAddress: string,
  ): Promise<SecurityBlacklist[]> {
    return await db
      .select()
      .from(securityBlacklist)
      .where(
        and(
          eq(securityBlacklist.ipAddress, ipAddress),
          eq(securityBlacklist.isActive, true),
          sql`${securityBlacklist.blockedUntil} > NOW()`,
        ),
      )
      .orderBy(desc(securityBlacklist.createdAt));
  }

  async getBlacklistEntry(
    ipAddress: string,
    reason: string,
  ): Promise<SecurityBlacklist | undefined> {
    const [entry] = await db
      .select()
      .from(securityBlacklist)
      .where(
        and(
          eq(securityBlacklist.ipAddress, ipAddress),
          eq(securityBlacklist.reason, reason),
          eq(securityBlacklist.isActive, true),
        ),
      );
    return entry;
  }

  async updateBlacklistEntry(
    id: number,
    entry: Partial<InsertSecurityBlacklist>,
  ): Promise<SecurityBlacklist> {
    const [updated] = await db
      .update(securityBlacklist)
      .set({ ...entry, updatedAt: new Date() })
      .where(eq(securityBlacklist.id, id))
      .returning();
    return updated;
  }

  async deactivateBlacklistEntries(
    ipAddress: string,
    reviewedBy: string,
    notes?: string,
  ): Promise<void> {
    await db
      .update(securityBlacklist)
      .set({
        isActive: false,
        reviewedBy,
        reviewedAt: new Date(),
        notes: notes || 'Manually removed by admin',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(securityBlacklist.ipAddress, ipAddress),
          eq(securityBlacklist.isActive, true),
        ),
      );
  }

  async cleanupExpiredBlacklist(): Promise<void> {
    await db
      .update(securityBlacklist)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(securityBlacklist.isActive, true),
          sql`${securityBlacklist.blockedUntil} <= NOW()`,
        ),
      );
  }

  async getBlacklistStats(): Promise<any> {
    const totalBlocked = await db
      .select({ count: count() })
      .from(securityBlacklist);

    const activeBlocks = await db
      .select({ count: count() })
      .from(securityBlacklist)
      .where(
        and(
          eq(securityBlacklist.isActive, true),
          sql`${securityBlacklist.blockedUntil} > NOW()`,
        ),
      );

    const threatLevels = await db
      .select({
        threatLevel: securityBlacklist.threatLevel,
        count: count(),
      })
      .from(securityBlacklist)
      .where(eq(securityBlacklist.isActive, true))
      .groupBy(securityBlacklist.threatLevel);

    return {
      totalBlocked: totalBlocked[0]?.count || 0,
      activeBlocks: activeBlocks[0]?.count || 0,
      threatLevels: threatLevels.reduce(
        (acc, level) => {
          // threat_level defaults to 'medium' when unset
          const key = level.threatLevel ?? 'medium';
          acc[key] = (acc[key] ?? 0) + level.count;
          return acc;
        },
        {} as Record<string, number>,
      ),
    };
  }

  async getRecentFailedAttempts(
    ipAddress: string,
    windowMinutes: number,
  ): Promise<number> {
    const result = await db
      .select({ count: count() })
      .from(auditLog)
      .where(
        and(
          eq(auditLog.ipAddress, ipAddress),
          eq(auditLog.success, false),
          sql`${auditLog.createdAt} > NOW() - INTERVAL '${sql.raw(windowMinutes.toString())} minutes'`,
          sql`(${auditLog.action} LIKE '%login%' OR ${auditLog.action} LIKE '%auth%')`,
        ),
      );

    return result[0]?.count || 0;
  }
}

export const storage = new DatabaseStorage();
