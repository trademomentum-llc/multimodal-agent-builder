import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  serial,
  boolean,
  integer,
  unique,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  'sessions',
  {
    sid: varchar('sid').primaryKey(),
    sess: jsonb('sess').notNull(),
    expire: timestamp('expire').notNull(),
  },
  (table) => [index('IDX_session_expire').on(table.expire)],
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable('users', {
  id: varchar('id').primaryKey().notNull(),
  email: varchar('email').unique(),
  firstName: varchar('first_name'),
  lastName: varchar('last_name'),
  profileImageUrl: varchar('profile_image_url'),
  passwordHash: varchar('password_hash'),
  passwordSetAt: timestamp('password_set_at'),
  mustChangePassword: boolean('must_change_password').default(false),
  twoFactorEnabled: boolean('two_factor_enabled').default(false),
  twoFactorSecret: varchar('two_factor_secret'),
  twoFactorBackupCodes: jsonb('two_factor_backup_codes'),
  lastPasswordChange: timestamp('last_password_change'),
  securityQuestions: jsonb('security_questions'),
  loginAttempts: integer('login_attempts').default(0),
  lockedUntil: timestamp('locked_until'),
  sessionTimeout: integer('session_timeout').default(3600), // 1 hour default
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Agent types and configurations
export const agentTypes = pgTable('agent_types', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 100 }).notNull(),
  icon: varchar('icon', { length: 50 }),
  color: varchar('color', { length: 50 }),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Agent instances
/** Per-agent security settings stored in agents.security_config (JSONB). */
export interface AgentSecurityConfig {
  approvalRequired?: boolean;
  encryption?: boolean;
  [setting: string]: unknown;
}

export const agents = pgTable('agents', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  typeId: integer('type_id').references(() => agentTypes.id),
  userId: varchar('user_id').references(() => users.id),
  status: varchar('status', { length: 50 }).default('inactive'), // inactive, active, error, paused
  priority: varchar('priority', { length: 20 }).default('medium'), // low, medium, high
  rank: varchar('rank', { length: 50 }).default('private'), // Military hierarchy: private, corporal, sergeant, lieutenant, captain, major, colonel, general
  commandLevel: integer('command_level').default(1), // 1-10 command authority level
  specialization: jsonb('specialization').default('[]'), // Areas of expertise and capabilities
  patternRecognition: jsonb('pattern_recognition').default('{}'), // Learned communication patterns and behaviors
  communicationAnalysis: jsonb('communication_analysis').default('{}'), // Speech pattern analysis and leet detection
  collaborationNetwork: jsonb('collaboration_network').default('[]'), // Connected agents for cross-collaboration
  selfOptimization: jsonb('self_optimization').default('{}'), // Auto-improvement metrics and learning
  osiLayerSecurity: jsonb('osi_layer_security').default('{}'), // Security configurations per OSI layer
  configuration: jsonb('configuration'),
  securityConfig: jsonb('security_config').$type<AgentSecurityConfig>(),
  lastActivity: timestamp('last_activity'),
  // Multimodal agent capabilities
  llmProvider: varchar('llm_provider', { length: 50 }).default('openai'), // openai, anthropic, gemini
  modelName: varchar('model_name', { length: 100 }).default('gpt-4'), // specific model version
  temperature: integer('temperature').default(70), // 0-200, stored as hundredths
  maxTokens: integer('max_tokens').default(4096),
  systemPrompt: text('system_prompt'),
  enableVision: boolean('enable_vision').default(false),
  enableAudio: boolean('enable_audio').default(false),
  enableFunctions: boolean('enable_functions').default(true),
  enableMemory: boolean('enable_memory').default(true),
  imageDetail: varchar('image_detail', { length: 20 })
    .$type<'auto' | 'low' | 'high'>()
    .default('auto'), // low, high, auto
  audioLanguage: varchar('audio_language', { length: 10 }).default('en'),
  multimodalReasoning: boolean('multimodal_reasoning').default(true),
  capabilities: jsonb('capabilities').default('{}'), // vision, audio, streaming, functions
  conversationHistory: jsonb('conversation_history').default('[]'), // stored conversation memory
  toolConfigurations: jsonb('tool_configurations').default('[]'), // available tools and settings
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Task queue
export const tasks = pgTable('tasks', {
  id: serial('id').primaryKey(),
  agentId: integer('agent_id').references(() => agents.id),
  userId: varchar('user_id').references(() => users.id),
  type: varchar('type', { length: 100 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 50 }).default('pending'), // pending, processing, completed, failed, cancelled
  priority: varchar('priority', { length: 20 }).default('medium'),
  payload: jsonb('payload'),
  result: jsonb('result'),
  error: text('error'),
  scheduledFor: timestamp('scheduled_for'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Approval requests
export const approvals = pgTable('approvals', {
  id: serial('id').primaryKey(),
  taskId: integer('task_id').references(() => tasks.id),
  agentId: integer('agent_id').references(() => agents.id),
  userId: varchar('user_id').references(() => users.id),
  type: varchar('type', { length: 100 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 50 }).default('pending'), // pending, approved, rejected
  requestData: jsonb('request_data'),
  suggestedResponse: text('suggested_response'),
  reviewedBy: varchar('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Activity log
export const activities = pgTable('activities', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id').references(() => users.id),
  agentId: integer('agent_id').references(() => agents.id),
  taskId: integer('task_id').references(() => tasks.id),
  type: varchar('type', { length: 100 }).notNull(),
  message: text('message').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Security audit log
export const auditLog = pgTable('audit_log', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id').references(() => users.id),
  action: varchar('action', { length: 100 }).notNull(),
  resource: varchar('resource', { length: 100 }).notNull(),
  resourceId: varchar('resource_id', { length: 100 }),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  success: boolean('success').default(true),
  error: text('error'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
});

// API keys and credentials
export const credentials = pgTable('credentials', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id').references(() => users.id),
  name: varchar('name', { length: 255 }).notNull(),
  service: varchar('service', { length: 100 }).notNull(),
  encryptedKey: text('encrypted_key').notNull(),
  isActive: boolean('is_active').default(true),
  lastUsed: timestamp('last_used'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// NVIDIA Data Flywheel Implementation Tables

// Model catalog for the flywheel
export const models = pgTable('models', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  provider: varchar('provider', { length: 100 }).notNull(), // nvidia, openai, anthropic, etc.
  modelId: varchar('model_id', { length: 255 }).notNull(), // actual model identifier
  size: varchar('size', { length: 50 }), // 1B, 7B, 70B, etc.
  type: varchar('type', { length: 50 }).notNull(), // base, instruct, chat, code
  costPerToken: integer('cost_per_token').default(0), // cost in micro-cents per token
  inferenceLatency: integer('inference_latency').default(0), // average ms per request
  capabilities: jsonb('capabilities').default('[]'), // ["reasoning", "code", "math", etc.]
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Flywheel experiments and runs
export const flywheelRuns = pgTable('flywheel_runs', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id').references(() => users.id),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 50 }).default('pending'), // pending, running, completed, failed
  baseModelId: integer('base_model_id').references(() => models.id),
  targetWorkload: varchar('target_workload', { length: 255 }).notNull(),
  datasetSize: integer('dataset_size').default(0),
  experimentTypes: jsonb('experiment_types').default(
    '["base", "icl", "customized"]',
  ),
  configuration: jsonb('configuration').default('{}'),
  results: jsonb('results').default('{}'),
  metrics: jsonb('metrics').default('{}'),
  costSavings: integer('cost_savings').default(0), // percentage cost reduction
  accuracyRetention: integer('accuracy_retention').default(0), // percentage accuracy retained
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Model performance evaluations
export const modelEvaluations = pgTable('model_evaluations', {
  id: serial('id').primaryKey(),
  flywheelRunId: integer('flywheel_run_id').references(() => flywheelRuns.id),
  modelId: integer('model_id').references(() => models.id),
  experimentType: varchar('experiment_type', { length: 50 }).notNull(), // base, icl, customized
  workloadId: varchar('workload_id', { length: 255 }).notNull(),
  accuracyScore: integer('accuracy_score').default(0), // 0-100 similarity score
  latency: integer('latency').default(0), // ms per request
  costPerRequest: integer('cost_per_request').default(0), // micro-cents
  throughput: integer('throughput').default(0), // requests per second
  qualityMetrics: jsonb('quality_metrics').default('{}'),
  isPromoted: boolean('is_promoted').default(false),
  promotedAt: timestamp('promoted_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Production traffic logs for flywheel data collection
export const trafficLogs = pgTable('traffic_logs', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id').references(() => users.id),
  agentId: integer('agent_id').references(() => agents.id),
  workloadId: varchar('workload_id', { length: 255 }).notNull(),
  clientId: varchar('client_id', { length: 255 }).notNull(),
  requestTimestamp: timestamp('request_timestamp').notNull(),
  request: jsonb('request').notNull(), // OpenAI format request
  response: jsonb('response').notNull(), // OpenAI format response
  modelUsed: varchar('model_used', { length: 255 }),
  latency: integer('latency').default(0),
  tokenUsage: jsonb('token_usage').default('{}'),
  userFeedback: integer('user_feedback'), // 1-5 rating if available
  isProcessed: boolean('is_processed').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// Flywheel discovered optimizations
export const optimizations = pgTable('optimizations', {
  id: serial('id').primaryKey(),
  flywheelRunId: integer('flywheel_run_id').references(() => flywheelRuns.id),
  originalModelId: integer('original_model_id').references(() => models.id),
  optimizedModelId: integer('optimized_model_id').references(() => models.id),
  workloadId: varchar('workload_id', { length: 255 }).notNull(),
  optimizationType: varchar('optimization_type', { length: 100 }).notNull(), // distillation, fine-tuning, quantization
  costReduction: integer('cost_reduction').default(0), // percentage
  speedImprovement: integer('speed_improvement').default(0), // percentage
  accuracyRetention: integer('accuracy_retention').default(0), // percentage
  confidence: integer('confidence').default(0), // 0-100 confidence in optimization
  productionReady: boolean('production_ready').default(false),
  deployedAt: timestamp('deployed_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Multimodal interactions and file storage
export const multimodalSessions = pgTable('multimodal_sessions', {
  id: serial('id').primaryKey(),
  agentId: integer('agent_id').references(() => agents.id),
  userId: varchar('user_id').references(() => users.id),
  sessionId: varchar('session_id', { length: 255 }).notNull(),
  status: varchar('status', { length: 50 }).default('active'), // active, paused, completed
  modalities: jsonb('modalities').default('[]'), // ["text", "image", "audio"]
  totalInteractions: integer('total_interactions').default(0),
  lastInteraction: timestamp('last_interaction'),
  metadata: jsonb('metadata').default('{}'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Individual multimodal interactions
export const multimodalInteractions = pgTable('multimodal_interactions', {
  id: serial('id').primaryKey(),
  sessionId: integer('session_id').references(() => multimodalSessions.id),
  agentId: integer('agent_id').references(() => agents.id),
  userId: varchar('user_id').references(() => users.id),
  interactionType: varchar('interaction_type', { length: 50 }).notNull(), // chat, image_analysis, audio_transcription, multimodal
  inputData: jsonb('input_data').notNull(), // text, image_base64, audio_base64, etc.
  outputData: jsonb('output_data'), // agent response
  modalities: jsonb('modalities').default('[]'), // which modalities were used
  processingTime: integer('processing_time').default(0), // milliseconds
  tokenUsage: jsonb('token_usage').default('{}'), // prompt_tokens, completion_tokens, etc.
  cost: integer('cost').default(0), // micro-cents
  userFeedback: integer('user_feedback'), // 1-5 rating
  error: text('error'),
  metadata: jsonb('metadata').default('{}'),
  createdAt: timestamp('created_at').defaultNow(),
});

// File uploads and processing
export const multimodalFiles = pgTable('multimodal_files', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id').references(() => users.id),
  agentId: integer('agent_id').references(() => agents.id),
  interactionId: integer('interaction_id').references(
    () => multimodalInteractions.id,
  ),
  filename: varchar('filename', { length: 255 }).notNull(),
  originalName: varchar('original_name', { length: 255 }),
  fileType: varchar('file_type', { length: 50 }).notNull(), // image, audio, video, document
  mimeType: varchar('mime_type', { length: 100 }),
  fileSize: integer('file_size').default(0), // bytes
  filePath: text('file_path'), // storage path or URL
  processingStatus: varchar('processing_status', { length: 50 }).default(
    'pending',
  ), // pending, processing, completed, failed
  extractedText: text('extracted_text'), // OCR or transcription results
  metadata: jsonb('metadata').default('{}'), // dimensions, duration, etc.
  securityScan: jsonb('security_scan').default('{}'), // virus scan, content safety
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Security blacklist for threat intelligence-based blocking
export const securityBlacklist = pgTable(
  'security_blacklist',
  {
    id: serial('id').primaryKey(),
    ipAddress: varchar('ip_address', { length: 45 }).notNull(),
    reason: varchar('reason', { length: 100 }).notNull(), // failed_login, api_abuse, curl_abuse, brute_force, suspicious_pattern
    threatLevel: varchar('threat_level', { length: 20 }).default('medium'), // low, medium, high, critical
    attemptCount: integer('attempt_count').default(1),
    firstSeen: timestamp('first_seen').defaultNow(),
    lastSeen: timestamp('last_seen').defaultNow(),
    blockedUntil: timestamp('blocked_until').notNull(),
    userAgent: text('user_agent'),
    requestPatterns: jsonb('request_patterns').default('[]'), // Array of suspicious patterns detected
    geoLocation: jsonb('geo_location').default('{}'), // Country, region, ISP info if available
    threatIntelligence: jsonb('threat_intelligence').default('{}'), // Automated threat analysis
    isActive: boolean('is_active').default(true),
    reviewedBy: varchar('reviewed_by').references(() => users.id), // Admin who reviewed/approved
    reviewedAt: timestamp('reviewed_at'),
    notes: text('notes'), // Administrative notes
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [
    index('idx_blacklist_ip_active').on(table.ipAddress, table.isActive),
    index('idx_blacklist_blocked_until').on(table.blockedUntil),
    index('idx_blacklist_threat_level').on(table.threatLevel),
  ],
);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  agents: many(agents),
  tasks: many(tasks),
  approvals: many(approvals),
  activities: many(activities),
  auditLogs: many(auditLog),
  credentials: many(credentials),
  flywheelRuns: many(flywheelRuns),
  trafficLogs: many(trafficLogs),
  multimodalSessions: many(multimodalSessions),
  multimodalInteractions: many(multimodalInteractions),
  multimodalFiles: many(multimodalFiles),
}));

export const modelsRelations = relations(models, ({ many }) => ({
  flywheelRuns: many(flywheelRuns),
  evaluations: many(modelEvaluations),
  originalOptimizations: many(optimizations, { relationName: 'originalModel' }),
  optimizedOptimizations: many(optimizations, {
    relationName: 'optimizedModel',
  }),
}));

export const flywheelRunsRelations = relations(
  flywheelRuns,
  ({ one, many }) => ({
    user: one(users, {
      fields: [flywheelRuns.userId],
      references: [users.id],
    }),
    baseModel: one(models, {
      fields: [flywheelRuns.baseModelId],
      references: [models.id],
    }),
    evaluations: many(modelEvaluations),
    optimizations: many(optimizations),
  }),
);

export const modelEvaluationsRelations = relations(
  modelEvaluations,
  ({ one }) => ({
    flywheelRun: one(flywheelRuns, {
      fields: [modelEvaluations.flywheelRunId],
      references: [flywheelRuns.id],
    }),
    model: one(models, {
      fields: [modelEvaluations.modelId],
      references: [models.id],
    }),
  }),
);

export const trafficLogsRelations = relations(trafficLogs, ({ one }) => ({
  user: one(users, {
    fields: [trafficLogs.userId],
    references: [users.id],
  }),
  agent: one(agents, {
    fields: [trafficLogs.agentId],
    references: [agents.id],
  }),
}));

export const optimizationsRelations = relations(optimizations, ({ one }) => ({
  flywheelRun: one(flywheelRuns, {
    fields: [optimizations.flywheelRunId],
    references: [flywheelRuns.id],
  }),
  originalModel: one(models, {
    fields: [optimizations.originalModelId],
    references: [models.id],
    relationName: 'originalModel',
  }),
  optimizedModel: one(models, {
    fields: [optimizations.optimizedModelId],
    references: [models.id],
    relationName: 'optimizedModel',
  }),
}));

export const agentTypesRelations = relations(agentTypes, ({ many }) => ({
  agents: many(agents),
}));

export const agentsRelations = relations(agents, ({ one, many }) => ({
  type: one(agentTypes, {
    fields: [agents.typeId],
    references: [agentTypes.id],
  }),
  user: one(users, {
    fields: [agents.userId],
    references: [users.id],
  }),
  tasks: many(tasks),
  approvals: many(approvals),
  activities: many(activities),
  multimodalSessions: many(multimodalSessions),
  multimodalInteractions: many(multimodalInteractions),
  multimodalFiles: many(multimodalFiles),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  agent: one(agents, {
    fields: [tasks.agentId],
    references: [agents.id],
  }),
  user: one(users, {
    fields: [tasks.userId],
    references: [users.id],
  }),
  approvals: many(approvals),
  activities: many(activities),
}));

export const approvalsRelations = relations(approvals, ({ one }) => ({
  task: one(tasks, {
    fields: [approvals.taskId],
    references: [tasks.id],
  }),
  agent: one(agents, {
    fields: [approvals.agentId],
    references: [agents.id],
  }),
  user: one(users, {
    fields: [approvals.userId],
    references: [users.id],
  }),
  reviewer: one(users, {
    fields: [approvals.reviewedBy],
    references: [users.id],
  }),
}));

export const activitiesRelations = relations(activities, ({ one }) => ({
  user: one(users, {
    fields: [activities.userId],
    references: [users.id],
  }),
  agent: one(agents, {
    fields: [activities.agentId],
    references: [agents.id],
  }),
  task: one(tasks, {
    fields: [activities.taskId],
    references: [tasks.id],
  }),
}));

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  user: one(users, {
    fields: [auditLog.userId],
    references: [users.id],
  }),
}));

export const credentialsRelations = relations(credentials, ({ one }) => ({
  user: one(users, {
    fields: [credentials.userId],
    references: [users.id],
  }),
}));

export const multimodalSessionsRelations = relations(
  multimodalSessions,
  ({ one, many }) => ({
    agent: one(agents, {
      fields: [multimodalSessions.agentId],
      references: [agents.id],
    }),
    user: one(users, {
      fields: [multimodalSessions.userId],
      references: [users.id],
    }),
    interactions: many(multimodalInteractions),
  }),
);

export const multimodalInteractionsRelations = relations(
  multimodalInteractions,
  ({ one, many }) => ({
    session: one(multimodalSessions, {
      fields: [multimodalInteractions.sessionId],
      references: [multimodalSessions.id],
    }),
    agent: one(agents, {
      fields: [multimodalInteractions.agentId],
      references: [agents.id],
    }),
    user: one(users, {
      fields: [multimodalInteractions.userId],
      references: [users.id],
    }),
    files: many(multimodalFiles),
  }),
);

export const multimodalFilesRelations = relations(
  multimodalFiles,
  ({ one }) => ({
    user: one(users, {
      fields: [multimodalFiles.userId],
      references: [users.id],
    }),
    agent: one(agents, {
      fields: [multimodalFiles.agentId],
      references: [agents.id],
    }),
    interaction: one(multimodalInteractions, {
      fields: [multimodalFiles.interactionId],
      references: [multimodalInteractions.id],
    }),
  }),
);

export const securityBlacklistRelations = relations(
  securityBlacklist,
  ({ one }) => ({
    reviewer: one(users, {
      fields: [securityBlacklist.reviewedBy],
      references: [users.id],
    }),
  }),
);

// Insert schemas
export const insertAgentTypeSchema = createInsertSchema(agentTypes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAgentSchema = createInsertSchema(agents, {
  imageDetail: z.enum(['auto', 'low', 'high']).nullable().optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertApprovalSchema = createInsertSchema(approvals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertActivitySchema = createInsertSchema(activities).omit({
  id: true,
  createdAt: true,
});

export const insertAuditLogSchema = createInsertSchema(auditLog).omit({
  id: true,
  createdAt: true,
});

export const insertCredentialSchema = createInsertSchema(credentials).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFlywheelRunSchema = createInsertSchema(flywheelRuns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertModelEvaluationSchema = createInsertSchema(
  modelEvaluations,
).omit({
  id: true,
  createdAt: true,
});

export const insertMultimodalSessionSchema = createInsertSchema(
  multimodalSessions,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMultimodalInteractionSchema = createInsertSchema(
  multimodalInteractions,
).omit({
  id: true,
  createdAt: true,
});

export const insertMultimodalFileSchema = createInsertSchema(
  multimodalFiles,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSecurityBlacklistSchema = createInsertSchema(
  securityBlacklist,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export type AgentType = typeof agentTypes.$inferSelect;
export type Agent = typeof agents.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Approval = typeof approvals.$inferSelect;
export type Activity = typeof activities.$inferSelect;
export type AuditLogEntry = typeof auditLog.$inferSelect;
export type Credential = typeof credentials.$inferSelect;
export type Model = typeof models.$inferSelect;
export type FlywheelRun = typeof flywheelRuns.$inferSelect;
export type ModelEvaluation = typeof modelEvaluations.$inferSelect;
export type TrafficLog = typeof trafficLogs.$inferSelect;
export type Optimization = typeof optimizations.$inferSelect;
export type MultimodalSession = typeof multimodalSessions.$inferSelect;
export type MultimodalInteraction = typeof multimodalInteractions.$inferSelect;
export type MultimodalFile = typeof multimodalFiles.$inferSelect;
export type SecurityBlacklist = typeof securityBlacklist.$inferSelect;

// Insert types
export type InsertAgentType = z.infer<typeof insertAgentTypeSchema>;
export type InsertAgent = z.infer<typeof insertAgentSchema>;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type InsertApproval = z.infer<typeof insertApprovalSchema>;
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type InsertAuditLogEntry = z.infer<typeof insertAuditLogSchema>;
export type InsertCredential = z.infer<typeof insertCredentialSchema>;
export type InsertFlywheelRun = z.infer<typeof insertFlywheelRunSchema>;
export type InsertModelEvaluation = z.infer<typeof insertModelEvaluationSchema>;
export type InsertMultimodalSession = z.infer<
  typeof insertMultimodalSessionSchema
>;
export type InsertMultimodalInteraction = z.infer<
  typeof insertMultimodalInteractionSchema
>;
export type InsertMultimodalFile = z.infer<typeof insertMultimodalFileSchema>;
export type InsertSecurityBlacklist = z.infer<
  typeof insertSecurityBlacklistSchema
>;
