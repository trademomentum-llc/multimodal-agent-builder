import OpenAI from 'openai';
import { z } from 'zod';

// Foundation model interface for BERT and reasoning capabilities
interface FoundationModel {
  generateText(prompt: string, options?: GenerationOptions): Promise<string>;
  embedText(text: string): Promise<number[]>;
  analyzeIntent(text: string): Promise<IntentAnalysis>;
  executeReasoning(query: string, context?: string): Promise<ReasoningResult>;
  createWorkflow(description: string): Promise<WorkflowPlan>;
}

interface GenerationOptions {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  model?: string;
}

interface IntentAnalysis {
  intent: string;
  confidence: number;
  entities: Array<{ name: string; value: string; type: string }>;
  actions: string[];
}

interface ReasoningResult {
  reasoning: string;
  conclusion: string;
  confidence: number;
  steps: string[];
  sources?: string[];
}

interface WorkflowPlan {
  id: string;
  steps: WorkflowStep[];
  estimatedDuration: number;
  dependencies: string[];
  resources: string[];
}

interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  type: 'analysis' | 'action' | 'decision' | 'communication';
  parameters: Record<string, unknown>;
  expectedOutput: string;
  nextSteps: string[];
}

// Schema definitions for structured outputs
const IntentSchema = z.object({
  intent: z.string(),
  confidence: z.number().min(0).max(1),
  entities: z.array(
    z.object({
      name: z.string(),
      value: z.string(),
      type: z.string(),
    }),
  ),
  actions: z.array(z.string()),
});

const ReasoningSchema = z.object({
  reasoning: z.string(),
  conclusion: z.string(),
  confidence: z.number().min(0).max(1),
  steps: z.array(z.string()),
  sources: z.array(z.string()).optional(),
});

const WorkflowSchema = z.object({
  id: z.string(),
  steps: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      type: z.enum(['analysis', 'action', 'decision', 'communication']),
      parameters: z.record(z.any()),
      expectedOutput: z.string(),
      nextSteps: z.array(z.string()),
    }),
  ),
  estimatedDuration: z.number(),
  dependencies: z.array(z.string()),
  resources: z.array(z.string()),
});

class BERTFoundationModel implements FoundationModel {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async generateText(
    prompt: string,
    options: GenerationOptions = {},
  ): Promise<string> {
    try {
      const response = await this.openai.chat.completions.create({
        model: options.model || 'gpt-4',
        messages: [
          {
            role: 'system',
            content:
              'You are BERT, a foundational reasoning model integrated into the Agent Factory platform. Provide clear, structured responses with logical reasoning.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: options.maxTokens || 1500,
        temperature: options.temperature || 0.7,
        top_p: options.topP || 0.9,
      });

      return response.choices[0]?.message?.content || '';
    } catch (error) {
      console.error('Error generating text:', error);
      throw new Error('Failed to generate text from foundation model');
    }
  }

  async embedText(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: text,
      });
      return response.data[0].embedding;
    } catch (error) {
      console.error('Error creating embeddings:', error);
      throw new Error('Failed to create text embeddings');
    }
  }

  async analyzeIntent(text: string): Promise<IntentAnalysis> {
    const prompt = `
    Analyze the following text for intent, entities, and required actions.
    
    Text: "${text}"
    
    Provide a structured analysis with:
    1. The primary intent
    2. Confidence level (0-1)
    3. Named entities (name, value, type)
    4. Suggested actions
    
    Format as JSON with fields: intent, confidence, entities, actions
    `;

    try {
      const response = await this.generateText(prompt, { temperature: 0.3 });
      const parsed = JSON.parse(response);
      return IntentSchema.parse(parsed);
    } catch (error) {
      console.error('Error analyzing intent:', error);
      // Fallback basic analysis
      return {
        intent: 'general_query',
        confidence: 0.5,
        entities: [],
        actions: ['process_request'],
      };
    }
  }

  async executeReasoning(
    query: string,
    context?: string,
  ): Promise<ReasoningResult> {
    const prompt = `
    Execute step-by-step reasoning for the following query.
    
    Query: "${query}"
    ${context ? `Context: "${context}"` : ''}
    
    Provide:
    1. Detailed reasoning process
    2. Clear conclusion
    3. Confidence level (0-1)
    4. Step-by-step breakdown
    5. Sources or references if applicable
    
    Format as JSON with fields: reasoning, conclusion, confidence, steps, sources
    `;

    try {
      const response = await this.generateText(prompt, {
        temperature: 0.2,
        maxTokens: 2000,
      });
      const parsed = JSON.parse(response);
      return ReasoningSchema.parse(parsed);
    } catch (error) {
      console.error('Error executing reasoning:', error);
      return {
        reasoning: 'Unable to complete full reasoning analysis',
        conclusion: 'Analysis incomplete due to processing error',
        confidence: 0.1,
        steps: ['Error in reasoning pipeline'],
        sources: [],
      };
    }
  }

  async createWorkflow(description: string): Promise<WorkflowPlan> {
    const prompt = `
    Create a detailed workflow plan for the following requirement:
    
    Description: "${description}"
    
    Generate a comprehensive workflow with:
    1. Unique workflow ID
    2. Sequential steps with clear descriptions
    3. Step types (analysis, action, decision, communication)
    4. Parameters for each step
    5. Expected outputs
    6. Next step connections
    7. Estimated duration in minutes
    8. Dependencies and required resources
    
    Format as JSON with fields: id, steps, estimatedDuration, dependencies, resources
    `;

    try {
      const response = await this.generateText(prompt, {
        temperature: 0.4,
        maxTokens: 2500,
      });
      const parsed = JSON.parse(response);
      const workflow = WorkflowSchema.parse(parsed);

      // Ensure unique ID if not provided
      if (!workflow.id) {
        workflow.id = `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }

      return workflow;
    } catch (error) {
      console.error('Error creating workflow:', error);
      // Return basic fallback workflow
      return {
        id: `fallback_${Date.now()}`,
        steps: [
          {
            id: 'step_1',
            name: 'Initial Analysis',
            description: 'Analyze the requirements',
            type: 'analysis',
            parameters: { input: description },
            expectedOutput: 'Requirements analysis',
            nextSteps: ['step_2'],
          },
          {
            id: 'step_2',
            name: 'Execute Action',
            description: 'Perform the requested action',
            type: 'action',
            parameters: {},
            expectedOutput: 'Action completed',
            nextSteps: [],
          },
        ],
        estimatedDuration: 30,
        dependencies: [],
        resources: ['foundation_model', 'agent_factory'],
      };
    }
  }

  // Enhanced capabilities for National Reserve integration
  async analyzePatterns(data: string[], context: string): Promise<unknown> {
    const prompt = `
    Analyze the following data patterns for the National Reserve system:
    
    Data: ${JSON.stringify(data)}
    Context: ${context}
    
    Identify:
    1. Communication patterns
    2. Behavioral indicators
    3. Potential security concerns
    4. Recommendations for agent deployment
    `;

    return await this.generateText(prompt, { temperature: 0.3 });
  }

  async optimizeAgentConfiguration(
    agentType: string,
    performance: Record<string, unknown>,
  ): Promise<unknown> {
    const prompt = `
    Optimize configuration for ${agentType} agent based on performance metrics:
    
    Performance Data: ${JSON.stringify(performance)}
    
    Provide:
    1. Configuration adjustments
    2. Performance improvement strategies
    3. Resource allocation recommendations
    4. Training data suggestions
    `;

    return await this.generateText(prompt, { temperature: 0.2 });
  }
}

// Singleton instance
export const foundationModel = new BERTFoundationModel();

// Export types for use in other modules
export type {
  FoundationModel,
  IntentAnalysis,
  ReasoningResult,
  WorkflowPlan,
  WorkflowStep,
  GenerationOptions,
};
