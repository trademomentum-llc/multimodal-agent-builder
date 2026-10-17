export interface Task {
  id: number;
  agentId?: number;
  userId?: string;
  type: string;
  title: string;
  description?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
  payload?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
  scheduledFor?: Date;
  startedAt?: Date;
  completedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Approval {
  id: number;
  taskId?: number;
  agentId?: number;
  userId?: string;
  type: string;
  title: string;
  description?: string;
  status: 'pending' | 'approved' | 'rejected';
  requestData?: Record<string, unknown>;
  suggestedResponse?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Activity {
  id: number;
  userId?: string;
  agentId?: number;
  taskId?: number;
  type: string;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
}

export interface CreateTaskRequest {
  agentId?: number;
  type: string;
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  payload?: Record<string, unknown>;
  scheduledFor?: Date;
}
