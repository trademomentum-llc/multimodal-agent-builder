import { Task, InsertTask } from '@shared/schema';
import { storage } from '../storage';
import { agentFactory } from './agentFactory';
import { auditLogger } from './auditLogger';
import cron from 'node-cron';

interface QueuedTask extends Task {
  retryCount: number;
  maxRetries: number;
}

class TaskQueue {
  private queue: QueuedTask[] = [];
  private processing: boolean = false;
  private maxConcurrentTasks: number = 5;
  private currentlyProcessing: Set<number> = new Set();

  constructor() {
    this.startProcessing();
    this.scheduleCleanup();
  }

  async enqueue(
    task: Task,
    priority: 'low' | 'medium' | 'high' = 'medium',
  ): Promise<void> {
    const queuedTask: QueuedTask = {
      ...task,
      priority,
      retryCount: 0,
      maxRetries: 3,
    };

    // Update task status to pending
    await storage.updateTask(task.id, {
      status: 'pending',
    });

    // Add to queue based on priority
    if (priority === 'high') {
      this.queue.unshift(queuedTask);
    } else {
      this.queue.push(queuedTask);
    }

    await storage.createActivity({
      userId: task.userId!,
      taskId: task.id,
      type: 'task.queued',
      message: `Task "${task.title}" has been added to the queue`,
      metadata: { priority, queueLength: this.queue.length },
    });

    // Trigger immediate processing if not already processing
    if (!this.processing) {
      this.processQueue();
    }
  }

  private async startProcessing(): Promise<void> {
    // Process queue every 5 seconds
    setInterval(() => {
      if (!this.processing && this.queue.length > 0) {
        this.processQueue();
      }
    }, 5000);
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    try {
      while (
        this.queue.length > 0 &&
        this.currentlyProcessing.size < this.maxConcurrentTasks
      ) {
        const task = this.queue.shift();
        if (task && !this.currentlyProcessing.has(task.id)) {
          this.processTask(task);
        }
      }
    } finally {
      this.processing = false;
    }
  }

  private async processTask(task: QueuedTask): Promise<void> {
    this.currentlyProcessing.add(task.id);

    try {
      await storage.updateTask(task.id, {
        status: 'processing',
        startedAt: new Date(),
      });

      await auditLogger.log(
        task.userId!,
        'task.process.start',
        'task',
        task.id.toString(),
        null,
        true,
        null,
        { taskType: task.type, agentId: task.agentId },
      );

      let result: any;

      // Check if task is scheduled for future execution
      if (task.scheduledFor && new Date(task.scheduledFor) > new Date()) {
        // Re-queue for later
        await storage.updateTask(task.id, {
          status: 'pending',
        });

        // Add back to queue with delay
        setTimeout(
          () => {
            this.queue.push(task);
          },
          new Date(task.scheduledFor).getTime() - Date.now(),
        );

        return;
      }

      // Execute the task based on its type
      if (task.agentId) {
        result = await agentFactory.executeAgentTask(
          task.agentId,
          task.type,
          task.payload,
        );
      } else {
        result = await this.executeSystemTask(task);
      }

      // Update task as completed
      await storage.updateTask(task.id, {
        status: 'completed',
        result,
        completedAt: new Date(),
      });

      await storage.createActivity({
        userId: task.userId!,
        taskId: task.id,
        agentId: task.agentId,
        type: 'task.completed',
        message: `Task "${task.title}" completed successfully`,
        metadata: {
          result,
          processingTime: Date.now() - new Date(task.startedAt!).getTime(),
        },
      });

      await auditLogger.log(
        task.userId!,
        'task.process.complete',
        'task',
        task.id.toString(),
        null,
        true,
        null,
        {
          result,
          processingTime: Date.now() - new Date(task.startedAt!).getTime(),
        },
      );
    } catch (error) {
      console.error(`Error processing task ${task.id}:`, error);

      // Handle retry logic
      if (task.retryCount < task.maxRetries) {
        task.retryCount++;

        await storage.updateTask(task.id, {
          status: 'pending',
          error: (error as Error).message,
        });

        // Re-queue with exponential backoff
        const retryDelay = Math.pow(2, task.retryCount) * 1000; // 2s, 4s, 8s
        setTimeout(() => {
          this.queue.push(task);
        }, retryDelay);

        await storage.createActivity({
          userId: task.userId!,
          taskId: task.id,
          type: 'task.retry',
          message: `Task "${task.title}" failed, retry attempt ${task.retryCount}/${task.maxRetries}`,
          metadata: {
            error: (error as Error).message,
            retryCount: task.retryCount,
          },
        });
      } else {
        // Max retries reached, mark as failed
        await storage.updateTask(task.id, {
          status: 'failed',
          error: (error as Error).message,
          completedAt: new Date(),
        });

        await storage.createActivity({
          userId: task.userId!,
          taskId: task.id,
          type: 'task.failed',
          message: `Task "${task.title}" failed after ${task.maxRetries} retry attempts`,
          metadata: {
            error: (error as Error).message,
            retryCount: task.retryCount,
          },
        });

        await auditLogger.log(
          task.userId!,
          'task.process.fail',
          'task',
          task.id.toString(),
          null,
          false,
          (error as Error).message,
          { retryCount: task.retryCount },
        );
      }
    } finally {
      this.currentlyProcessing.delete(task.id);
    }
  }

  private async executeSystemTask(task: Task): Promise<any> {
    switch (task.type) {
      case 'system.cleanup':
        return await this.performSystemCleanup();
      case 'system.backup':
        return await this.performSystemBackup();
      case 'system.security_scan':
        return await this.performSecurityScan();
      default:
        throw new Error(`Unknown system task type: ${task.type}`);
    }
  }

  private async performSystemCleanup(): Promise<any> {
    // Simulate system cleanup
    await new Promise((resolve) => setTimeout(resolve, 1000));

    return {
      status: 'completed',
      filesDeleted: Math.floor(Math.random() * 100),
      spaceSaved: `${Math.floor(Math.random() * 500)}MB`,
      duration: '1.2s',
    };
  }

  private async performSystemBackup(): Promise<any> {
    // Simulate system backup
    await new Promise((resolve) => setTimeout(resolve, 2000));

    return {
      status: 'completed',
      backupSize: `${Math.floor(Math.random() * 1000) + 100}MB`,
      filesBackedUp: Math.floor(Math.random() * 1000) + 100,
      duration: '2.1s',
    };
  }

  private async performSecurityScan(): Promise<any> {
    // Simulate security scan
    await new Promise((resolve) => setTimeout(resolve, 3000));

    return {
      status: 'completed',
      vulnerabilities: Math.floor(Math.random() * 3),
      risksFound: Math.floor(Math.random() * 2),
      recommendations: [
        'Update dependencies',
        'Review access permissions',
        'Enable additional security features',
      ],
      duration: '3.0s',
    };
  }

  private scheduleCleanup(): void {
    // Clean up completed tasks older than 7 days every day at 2 AM
    cron.schedule('0 2 * * *', async () => {
      try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        // This would be implemented with a proper database query
        console.log(
          `Scheduled cleanup of tasks older than ${sevenDaysAgo.toISOString()}`,
        );

        // Log cleanup activity
        await auditLogger.log(
          'system',
          'task.cleanup.scheduled',
          'system',
          null,
          null,
          true,
          null,
          { cleanupDate: sevenDaysAgo.toISOString() },
        );
      } catch (error) {
        console.error('Error during scheduled cleanup:', error);
      }
    });
  }

  async getQueueStats(): Promise<{
    totalQueued: number;
    processing: number;
    completed: number;
    failed: number;
    avgProcessingTime: number;
  }> {
    return {
      totalQueued: this.queue.length,
      processing: this.currentlyProcessing.size,
      completed: 0, // Would be calculated from database
      failed: 0, // Would be calculated from database
      avgProcessingTime: 0, // Would be calculated from database
    };
  }

  async pauseQueue(): Promise<void> {
    this.processing = true; // Prevents new tasks from being processed
  }

  async resumeQueue(): Promise<void> {
    this.processing = false;
    this.processQueue();
  }

  async clearQueue(): Promise<void> {
    this.queue = [];
  }

  async getQueueStatus(): Promise<{
    status: 'running' | 'paused';
    queueLength: number;
    processing: number;
  }> {
    return {
      status: this.processing ? 'paused' : 'running',
      queueLength: this.queue.length,
      processing: this.currentlyProcessing.size,
    };
  }
}

export const taskQueue = new TaskQueue();
