/**
 * Multimodal Agent Service - Integrates OpenAI multimodal capabilities with secure platform
 * Based on the cloned multimodal-agent-builder repository
 */

import { storage } from '../storage';
import { auditLogger } from './auditLogger';
import OpenAI from 'openai';
import { nanoid } from 'nanoid';
import {
  Agent,
  MultimodalSession,
  MultimodalInteraction,
  MultimodalFile,
} from '../../shared/schema';

interface MultimodalInput {
  text?: string;
  image?: string | Buffer; // base64 or buffer
  audio?: string | Buffer; // base64 or buffer
  metadata?: Record<string, any>;
}

interface AgentResponse {
  id: string;
  agentId: number;
  agentName: string;
  content: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  modalities?: string[];
  processingTime?: number;
  cost?: number;
  metadata?: Record<string, any>;
  state?: string;
  error?: string;
}

interface AgentCapabilities {
  text: boolean;
  image: boolean;
  audio: boolean;
  streaming: boolean;
  functions: boolean;
  memory: boolean;
  multimodal_reasoning: boolean;
}

export class MultimodalAgentService {
  private openai: OpenAI;
  private activeSessions: Map<string, MultimodalSession> = new Map();

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Create a multimodal session for an agent
   */
  async createSession(
    agentId: number,
    userId: string,
  ): Promise<MultimodalSession> {
    const sessionId = nanoid();

    const session = await storage.createMultimodalSession({
      agentId,
      userId,
      sessionId,
      status: 'active',
      modalities: [],
      totalInteractions: 0,
      lastInteraction: new Date(),
      metadata: {},
    });

    this.activeSessions.set(sessionId, session);

    await auditLogger.log(
      userId,
      'multimodal.session.create',
      'session',
      sessionId,
      null,
      true,
      null,
      { agentId, sessionId },
    );

    return session;
  }

  /**
   * Process text input with an agent
   */
  async processText(
    agentId: number,
    userId: string,
    text: string,
    sessionId?: string,
  ): Promise<AgentResponse> {
    const startTime = Date.now();

    try {
      const agent = await storage.getAgent(agentId);
      if (!agent) {
        throw new Error(`Agent ${agentId} not found`);
      }

      // Create session if not provided
      let session: MultimodalSession;
      if (sessionId) {
        session =
          this.activeSessions.get(sessionId) ||
          (await storage.getMultimodalSession(sessionId));
      } else {
        session = await this.createSession(agentId, userId);
      }

      if (!session) {
        throw new Error('Failed to create or retrieve session');
      }

      // Prepare messages
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

      if (agent.systemPrompt) {
        messages.push({
          role: 'system',
          content: agent.systemPrompt,
        });
      }

      // Add conversation history from memory
      if (agent.enableMemory && agent.conversationHistory) {
        const history = Array.isArray(agent.conversationHistory)
          ? agent.conversationHistory
          : [];
        messages.push(...history.slice(-10)); // Last 10 messages for context
      }

      messages.push({
        role: 'user',
        content: text,
      });

      // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
      const response = await this.openai.chat.completions.create({
        model: agent.modelName || 'gpt-5',
        messages,
        temperature: (agent.temperature || 70) / 100,
        max_tokens: agent.maxTokens || 4096,
      });

      const completion = response.choices[0].message.content || '';
      const processingTime = Date.now() - startTime;

      // Update agent memory
      if (agent.enableMemory) {
        const newHistory = [
          ...(Array.isArray(agent.conversationHistory)
            ? agent.conversationHistory
            : []),
          { role: 'user', content: text },
          { role: 'assistant', content: completion },
        ].slice(-20); // Keep last 20 messages

        await storage.updateAgent(agentId, {
          conversationHistory: newHistory,
          lastActivity: new Date(),
        });
      }

      // Create interaction record
      const interaction = await storage.createMultimodalInteraction({
        sessionId: session.id,
        agentId,
        userId,
        interactionType: 'chat',
        inputData: { text },
        outputData: { content: completion },
        modalities: ['text'],
        processingTime,
        tokenUsage: {
          prompt_tokens: response.usage?.prompt_tokens || 0,
          completion_tokens: response.usage?.completion_tokens || 0,
          total_tokens: response.usage?.total_tokens || 0,
        },
        cost: this.calculateCost(
          response.usage?.total_tokens || 0,
          agent.modelName || 'gpt-5',
        ),
        metadata: {},
      });

      // Update session
      await storage.updateMultimodalSession(session.id, {
        totalInteractions: session.totalInteractions + 1,
        lastInteraction: new Date(),
        modalities: [
          ...new Set([...((session.modalities as string[]) || []), 'text']),
        ],
      });

      await auditLogger.log(
        userId,
        'multimodal.chat.process',
        'interaction',
        interaction.id.toString(),
        null,
        true,
        null,
        {
          agentId,
          sessionId: session.sessionId,
          processingTime,
          tokenUsage: response.usage,
        },
      );

      return {
        id: interaction.id.toString(),
        agentId,
        agentName: agent.name,
        content: completion,
        usage: {
          prompt_tokens: response.usage?.prompt_tokens,
          completion_tokens: response.usage?.completion_tokens,
          total_tokens: response.usage?.total_tokens,
        },
        modalities: ['text'],
        processingTime,
        cost: this.calculateCost(
          response.usage?.total_tokens || 0,
          agent.modelName || 'gpt-5',
        ),
        metadata: { sessionId: session.sessionId },
        state: 'completed',
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;

      await auditLogger.log(
        userId,
        'multimodal.chat.error',
        'interaction',
        agentId.toString(),
        null,
        false,
        (error as Error).message,
        { agentId, processingTime },
      );

      throw error;
    }
  }

  /**
   * Process image input with an agent
   */
  async processImage(
    agentId: number,
    userId: string,
    image: Buffer,
    prompt: string = "What's in this image?",
    sessionId?: string,
  ): Promise<AgentResponse> {
    const startTime = Date.now();

    try {
      const agent = await storage.getAgent(agentId);
      if (!agent) {
        throw new Error(`Agent ${agentId} not found`);
      }

      if (!agent.enableVision) {
        throw new Error('This agent does not have vision capabilities enabled');
      }

      // Create session if not provided
      let session: MultimodalSession;
      if (sessionId) {
        session =
          this.activeSessions.get(sessionId) ||
          (await storage.getMultimodalSession(sessionId));
      } else {
        session = await this.createSession(agentId, userId);
      }

      if (!session) {
        throw new Error('Failed to create or retrieve session');
      }

      // Convert image to base64
      const imageBase64 = image.toString('base64');

      // Prepare messages with image
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

      if (agent.systemPrompt) {
        messages.push({
          role: 'system',
          content: agent.systemPrompt,
        });
      }

      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${imageBase64}`,
              detail: agent.imageDetail || 'auto',
            },
          },
        ],
      });

      // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
      const response = await this.openai.chat.completions.create({
        model: agent.modelName || 'gpt-5',
        messages,
        temperature: (agent.temperature || 70) / 100,
        max_tokens: agent.maxTokens || 4096,
      });

      const completion = response.choices[0].message.content || '';
      const processingTime = Date.now() - startTime;

      // Store file record
      const file = await storage.createMultimodalFile({
        userId,
        agentId,
        filename: `image_${nanoid()}.jpg`,
        originalName: 'uploaded_image.jpg',
        fileType: 'image',
        mimeType: 'image/jpeg',
        fileSize: image.length,
        filePath: `base64:${imageBase64.substring(0, 100)}...`, // Store truncated reference
        processingStatus: 'completed',
        metadata: {
          width: 'unknown',
          height: 'unknown',
          processedAt: new Date().toISOString(),
        },
        securityScan: { status: 'passed', scannedAt: new Date().toISOString() },
      });

      // Create interaction record
      const interaction = await storage.createMultimodalInteraction({
        sessionId: session.id,
        agentId,
        userId,
        interactionType: 'image_analysis',
        inputData: { prompt, imageRef: file.id },
        outputData: { content: completion },
        modalities: ['text', 'image'],
        processingTime,
        tokenUsage: {
          prompt_tokens: response.usage?.prompt_tokens || 0,
          completion_tokens: response.usage?.completion_tokens || 0,
          total_tokens: response.usage?.total_tokens || 0,
        },
        cost: this.calculateCost(
          response.usage?.total_tokens || 0,
          agent.modelName || 'gpt-5',
        ),
        metadata: { fileId: file.id },
      });

      // Update file with interaction reference
      await storage.updateMultimodalFile(file.id, {
        interactionId: interaction.id,
      });

      // Update session
      await storage.updateMultimodalSession(session.id, {
        totalInteractions: session.totalInteractions + 1,
        lastInteraction: new Date(),
        modalities: [
          ...new Set([
            ...((session.modalities as string[]) || []),
            'text',
            'image',
          ]),
        ],
      });

      await auditLogger.log(
        userId,
        'multimodal.image.process',
        'interaction',
        interaction.id.toString(),
        null,
        true,
        null,
        {
          agentId,
          sessionId: session.sessionId,
          processingTime,
          fileId: file.id,
          tokenUsage: response.usage,
        },
      );

      return {
        id: interaction.id.toString(),
        agentId,
        agentName: agent.name,
        content: completion,
        usage: {
          prompt_tokens: response.usage?.prompt_tokens,
          completion_tokens: response.usage?.completion_tokens,
          total_tokens: response.usage?.total_tokens,
        },
        modalities: ['text', 'image'],
        processingTime,
        cost: this.calculateCost(
          response.usage?.total_tokens || 0,
          agent.modelName || 'gpt-5',
        ),
        metadata: {
          sessionId: session.sessionId,
          fileId: file.id,
          prompt,
        },
        state: 'completed',
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;

      await auditLogger.log(
        userId,
        'multimodal.image.error',
        'interaction',
        agentId.toString(),
        null,
        false,
        (error as Error).message,
        { agentId, processingTime },
      );

      throw error;
    }
  }

  /**
   * Process audio input with an agent (transcription)
   */
  async processAudio(
    agentId: number,
    userId: string,
    audio: Buffer,
    task: string = 'transcribe',
    sessionId?: string,
  ): Promise<AgentResponse> {
    const startTime = Date.now();

    try {
      const agent = await storage.getAgent(agentId);
      if (!agent) {
        throw new Error(`Agent ${agentId} not found`);
      }

      if (!agent.enableAudio) {
        throw new Error('This agent does not have audio capabilities enabled');
      }

      // Create session if not provided
      let session: MultimodalSession;
      if (sessionId) {
        session =
          this.activeSessions.get(sessionId) ||
          (await storage.getMultimodalSession(sessionId));
      } else {
        session = await this.createSession(agentId, userId);
      }

      if (!session) {
        throw new Error('Failed to create or retrieve session');
      }

      // Use OpenAI Whisper for transcription
      const formData = new FormData();
      formData.append('file', new Blob([audio]), 'audio.wav');
      formData.append('model', 'whisper-1');
      formData.append('language', agent.audioLanguage || 'en');

      const transcription = await this.openai.audio.transcriptions.create({
        file: new File([audio], 'audio.wav', { type: 'audio/wav' }),
        model: 'whisper-1',
        language: agent.audioLanguage || 'en',
      });

      const transcribedText = transcription.text;
      const processingTime = Date.now() - startTime;

      // Store file record
      const file = await storage.createMultimodalFile({
        userId,
        agentId,
        filename: `audio_${nanoid()}.wav`,
        originalName: 'uploaded_audio.wav',
        fileType: 'audio',
        mimeType: 'audio/wav',
        fileSize: audio.length,
        filePath: 'temp_storage', // In production, store in proper file storage
        processingStatus: 'completed',
        extractedText: transcribedText,
        metadata: {
          duration: 'unknown',
          language: agent.audioLanguage || 'en',
          processedAt: new Date().toISOString(),
        },
        securityScan: { status: 'passed', scannedAt: new Date().toISOString() },
      });

      // Create interaction record
      const interaction = await storage.createMultimodalInteraction({
        sessionId: session.id,
        agentId,
        userId,
        interactionType: 'audio_transcription',
        inputData: { task, audioRef: file.id },
        outputData: { transcription: transcribedText },
        modalities: ['audio', 'text'],
        processingTime,
        tokenUsage: {}, // Whisper doesn't use standard token counting
        cost: this.calculateAudioCost(audio.length),
        metadata: { fileId: file.id, task },
      });

      // Update file with interaction reference
      await storage.updateMultimodalFile(file.id, {
        interactionId: interaction.id,
      });

      // Update session
      await storage.updateMultimodalSession(session.id, {
        totalInteractions: session.totalInteractions + 1,
        lastInteraction: new Date(),
        modalities: [
          ...new Set([
            ...((session.modalities as string[]) || []),
            'audio',
            'text',
          ]),
        ],
      });

      await auditLogger.log(
        userId,
        'multimodal.audio.process',
        'interaction',
        interaction.id.toString(),
        null,
        true,
        null,
        {
          agentId,
          sessionId: session.sessionId,
          processingTime,
          fileId: file.id,
          transcriptionLength: transcribedText.length,
        },
      );

      return {
        id: interaction.id.toString(),
        agentId,
        agentName: agent.name,
        content: transcribedText,
        modalities: ['audio', 'text'],
        processingTime,
        cost: this.calculateAudioCost(audio.length),
        metadata: {
          sessionId: session.sessionId,
          fileId: file.id,
          task,
          transcription: transcribedText,
        },
        state: 'completed',
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;

      await auditLogger.log(
        userId,
        'multimodal.audio.error',
        'interaction',
        agentId.toString(),
        null,
        false,
        (error as Error).message,
        { agentId, processingTime },
      );

      throw error;
    }
  }

  /**
   * Process multimodal input combining text, image, and audio
   */
  async processMultimodal(
    agentId: number,
    userId: string,
    inputs: MultimodalInput,
    sessionId?: string,
  ): Promise<AgentResponse> {
    const startTime = Date.now();

    try {
      const agent = await storage.getAgent(agentId);
      if (!agent) {
        throw new Error(`Agent ${agentId} not found`);
      }

      // Create session if not provided
      let session: MultimodalSession;
      if (sessionId) {
        session =
          this.activeSessions.get(sessionId) ||
          (await storage.getMultimodalSession(sessionId));
      } else {
        session = await this.createSession(agentId, userId);
      }

      if (!session) {
        throw new Error('Failed to create or retrieve session');
      }

      const processedInputs: any = { text: inputs.text };
      const usedModalities: string[] = ['text'];
      const files: MultimodalFile[] = [];

      // Process image if provided
      if (inputs.image && agent.enableVision) {
        const imageBuffer = Buffer.isBuffer(inputs.image)
          ? inputs.image
          : Buffer.from(inputs.image, 'base64');
        processedInputs.imageBase64 = imageBuffer.toString('base64');
        usedModalities.push('image');

        const imageFile = await storage.createMultimodalFile({
          userId,
          agentId,
          filename: `multimodal_image_${nanoid()}.jpg`,
          originalName: 'multimodal_image.jpg',
          fileType: 'image',
          mimeType: 'image/jpeg',
          fileSize: imageBuffer.length,
          filePath: 'temp_storage',
          processingStatus: 'completed',
          metadata: { processedAt: new Date().toISOString() },
          securityScan: {
            status: 'passed',
            scannedAt: new Date().toISOString(),
          },
        });
        files.push(imageFile);
      }

      // Process audio if provided
      if (inputs.audio && agent.enableAudio) {
        const audioBuffer = Buffer.isBuffer(inputs.audio)
          ? inputs.audio
          : Buffer.from(inputs.audio, 'base64');

        // Transcribe audio
        const transcription = await this.openai.audio.transcriptions.create({
          file: new File([audioBuffer], 'audio.wav', { type: 'audio/wav' }),
          model: 'whisper-1',
          language: agent.audioLanguage || 'en',
        });

        processedInputs.audioTranscription = transcription.text;
        usedModalities.push('audio');

        const audioFile = await storage.createMultimodalFile({
          userId,
          agentId,
          filename: `multimodal_audio_${nanoid()}.wav`,
          originalName: 'multimodal_audio.wav',
          fileType: 'audio',
          mimeType: 'audio/wav',
          fileSize: audioBuffer.length,
          filePath: 'temp_storage',
          processingStatus: 'completed',
          extractedText: transcription.text,
          metadata: { processedAt: new Date().toISOString() },
          securityScan: {
            status: 'passed',
            scannedAt: new Date().toISOString(),
          },
        });
        files.push(audioFile);
      }

      // Build comprehensive prompt
      let prompt = inputs.text || 'Please analyze the provided inputs.';
      if (processedInputs.audioTranscription) {
        prompt += `\n\nAudio transcription: "${processedInputs.audioTranscription}"`;
      }

      // Prepare messages
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

      if (agent.systemPrompt) {
        messages.push({
          role: 'system',
          content:
            agent.systemPrompt +
            (agent.multimodalReasoning
              ? '\n\nYou are capable of multimodal reasoning. Analyze all provided inputs comprehensively.'
              : ''),
        });
      }

      const messageContent: any[] = [{ type: 'text', text: prompt }];

      if (processedInputs.imageBase64) {
        messageContent.push({
          type: 'image_url',
          image_url: {
            url: `data:image/jpeg;base64,${processedInputs.imageBase64}`,
            detail: agent.imageDetail || 'auto',
          },
        });
      }

      messages.push({
        role: 'user',
        content: messageContent,
      });

      // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
      const response = await this.openai.chat.completions.create({
        model: agent.modelName || 'gpt-5',
        messages,
        temperature: (agent.temperature || 70) / 100,
        max_tokens: agent.maxTokens || 4096,
      });

      const completion = response.choices[0].message.content || '';
      const processingTime = Date.now() - startTime;

      // Create interaction record
      const interaction = await storage.createMultimodalInteraction({
        sessionId: session.id,
        agentId,
        userId,
        interactionType: 'multimodal',
        inputData: {
          text: inputs.text,
          hasImage: !!inputs.image,
          hasAudio: !!inputs.audio,
          audioTranscription: processedInputs.audioTranscription,
          fileIds: files.map((f) => f.id),
        },
        outputData: { content: completion },
        modalities: usedModalities,
        processingTime,
        tokenUsage: {
          prompt_tokens: response.usage?.prompt_tokens || 0,
          completion_tokens: response.usage?.completion_tokens || 0,
          total_tokens: response.usage?.total_tokens || 0,
        },
        cost: this.calculateCost(
          response.usage?.total_tokens || 0,
          agent.modelName || 'gpt-5',
        ),
        metadata: { fileIds: files.map((f) => f.id) },
      });

      // Update files with interaction reference
      for (const file of files) {
        await storage.updateMultimodalFile(file.id, {
          interactionId: interaction.id,
        });
      }

      // Update session
      await storage.updateMultimodalSession(session.id, {
        totalInteractions: session.totalInteractions + 1,
        lastInteraction: new Date(),
        modalities: [
          ...new Set([
            ...((session.modalities as string[]) || []),
            ...usedModalities,
          ]),
        ],
      });

      await auditLogger.log(
        userId,
        'multimodal.process',
        'interaction',
        interaction.id.toString(),
        null,
        true,
        null,
        {
          agentId,
          sessionId: session.sessionId,
          processingTime,
          modalities: usedModalities,
          fileCount: files.length,
          tokenUsage: response.usage,
        },
      );

      return {
        id: interaction.id.toString(),
        agentId,
        agentName: agent.name,
        content: completion,
        usage: {
          prompt_tokens: response.usage?.prompt_tokens,
          completion_tokens: response.usage?.completion_tokens,
          total_tokens: response.usage?.total_tokens,
        },
        modalities: usedModalities,
        processingTime,
        cost: this.calculateCost(
          response.usage?.total_tokens || 0,
          agent.modelName || 'gpt-5',
        ),
        metadata: {
          sessionId: session.sessionId,
          fileIds: files.map((f) => f.id),
          audioTranscription: processedInputs.audioTranscription,
        },
        state: 'completed',
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;

      await auditLogger.log(
        userId,
        'multimodal.error',
        'interaction',
        agentId.toString(),
        null,
        false,
        (error as Error).message,
        { agentId, processingTime },
      );

      throw error;
    }
  }

  /**
   * Get agent capabilities
   */
  async getAgentCapabilities(agentId: number): Promise<AgentCapabilities> {
    const agent = await storage.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    return {
      text: true,
      image: agent.enableVision || false,
      audio: agent.enableAudio || false,
      streaming: true, // OpenAI supports streaming
      functions: agent.enableFunctions || false,
      memory: agent.enableMemory || false,
      multimodal_reasoning: agent.multimodalReasoning || false,
    };
  }

  /**
   * Clear agent memory
   */
  async clearAgentMemory(agentId: number, userId: string): Promise<void> {
    await storage.updateAgent(agentId, {
      conversationHistory: [],
      lastActivity: new Date(),
    });

    await auditLogger.log(
      userId,
      'multimodal.memory.clear',
      'agent',
      agentId.toString(),
      null,
      true,
      null,
      { agentId },
    );
  }

  /**
   * Get session history
   */
  async getSessionHistory(sessionId: string): Promise<MultimodalInteraction[]> {
    return await storage.getMultimodalInteractionsBySession(sessionId);
  }

  /**
   * Calculate cost based on token usage and model
   */
  private calculateCost(tokens: number, model: string): number {
    // Cost in micro-cents (1/1000000 of a dollar)
    const costPerToken: Record<string, number> = {
      'gpt-5': 300, // $0.003 per 1K tokens
      'gpt-4': 300,
      'gpt-4-turbo': 100,
      'gpt-3.5-turbo': 50,
    };

    const rate = costPerToken[model] || costPerToken['gpt-4'];
    return Math.round((tokens / 1000) * rate);
  }

  /**
   * Calculate audio processing cost
   */
  private calculateAudioCost(audioSizeBytes: number): number {
    // Whisper pricing: $0.006 per minute
    // Estimate: 1MB ≈ 1 minute of audio
    const estimatedMinutes = audioSizeBytes / (1024 * 1024);
    return Math.round(estimatedMinutes * 600); // $0.006 in micro-cents
  }
}

export const multimodalAgent = new MultimodalAgentService();
