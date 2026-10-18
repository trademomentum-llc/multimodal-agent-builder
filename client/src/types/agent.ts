export interface Agent {
  id: number;
  name: string;
  description?: string;
  typeId?: number;
  userId?: string;
  status: 'inactive' | 'active' | 'error' | 'paused';
  priority: 'low' | 'medium' | 'high';
  configuration?: Record<string, unknown>;
  securityConfig?: Record<string, unknown>;
  lastActivity?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AgentType {
  id: number;
  name: string;
  description?: string;
  category: string;
  icon?: string;
  color?: string;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateAgentRequest {
  name: string;
  description?: string;
  typeId?: number;
  priority: 'low' | 'medium' | 'high';
  configuration?: Record<string, unknown>;
  securityConfig?: {
    approvalRequired?: boolean;
    encryption?: boolean;
    rateLimiting?: boolean;
    auditLogging?: boolean;
  };
}

export interface AgentStats {
  activeAgents: number;
  tasksProcessed: number;
  pendingApprovals: number;
  systemUptime: number;
}
