/**
 * Multimodal API Routes - Secure multimodal agent interactions
 */

import { Router } from 'express';
import { multimodalAgent } from '../services/multimodalAgent';
import { auditLogger } from '../services/auditLogger';
import multer from 'multer';
import { z } from 'zod';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Allow images and audio files
    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/gif',
      'audio/mp3',
      'audio/wav',
      'audio/ogg',
      'audio/m4a',
      'audio/flac',
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`));
    }
  },
});

// Validation schemas
const chatRequestSchema = z.object({
  message: z.string().min(1).max(10000),
  sessionId: z.string().optional(),
});

const imageRequestSchema = z.object({
  prompt: z.string().min(1).max(1000).default("What's in this image?"),
  sessionId: z.string().optional(),
});

const audioRequestSchema = z.object({
  task: z.enum(['transcribe', 'translate', 'analyze']).default('transcribe'),
  sessionId: z.string().optional(),
});

/**
 * POST /api/multimodal/agents/:agentId/chat
 * Chat with a multimodal agent
 */
router.post('/agents/:agentId/chat', async (req, res) => {
  try {
    const agentId = parseInt(String(req.params.agentId), 10);
    const userId = req.user?.claims?.sub;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const validation = chatRequestSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: validation.error.issues,
      });
    }

    const { message, sessionId } = validation.data;

    const response = await multimodalAgent.processText(
      agentId,
      userId,
      message,
      sessionId,
    );

    res.json(response);
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: (error as Error).message,
    });
  }
});

/**
 * POST /api/multimodal/agents/:agentId/image
 * Process image with an agent
 */
router.post(
  '/agents/:agentId/image',
  upload.single('image'),
  async (req, res) => {
    try {
      const agentId = parseInt(String(req.params.agentId), 10);
      const userId = req.user?.claims?.sub;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No image file provided' });
      }

      const validation = imageRequestSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid request',
          details: validation.error.issues,
        });
      }

      const { prompt, sessionId } = validation.data;

      const response = await multimodalAgent.processImage(
        agentId,
        userId,
        req.file.buffer,
        prompt,
        sessionId,
      );

      res.json(response);
    } catch (error) {
      console.error('Image processing error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: (error as Error).message,
      });
    }
  },
);

/**
 * POST /api/multimodal/agents/:agentId/audio
 * Process audio with an agent
 */
router.post(
  '/agents/:agentId/audio',
  upload.single('audio'),
  async (req, res) => {
    try {
      const agentId = parseInt(String(req.params.agentId), 10);
      const userId = req.user?.claims?.sub;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No audio file provided' });
      }

      const validation = audioRequestSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid request',
          details: validation.error.issues,
        });
      }

      const { task, sessionId } = validation.data;

      const response = await multimodalAgent.processAudio(
        agentId,
        userId,
        req.file.buffer,
        task,
        sessionId,
      );

      res.json(response);
    } catch (error) {
      console.error('Audio processing error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: (error as Error).message,
      });
    }
  },
);

/**
 * POST /api/multimodal/agents/:agentId/multimodal
 * Process multimodal input (text + image + audio)
 */
router.post(
  '/agents/:agentId/multimodal',
  upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'audio', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const agentId = parseInt(String(req.params.agentId), 10);
      const userId = req.user?.claims?.sub;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const { text, sessionId } = req.body;

      const inputs: any = { text };

      if (files.image && files.image[0]) {
        inputs.image = files.image[0].buffer;
      }

      if (files.audio && files.audio[0]) {
        inputs.audio = files.audio[0].buffer;
      }

      if (!text && !inputs.image && !inputs.audio) {
        return res.status(400).json({
          error: 'At least one input (text, image, or audio) is required',
        });
      }

      const response = await multimodalAgent.processMultimodal(
        agentId,
        userId,
        inputs,
        sessionId,
      );

      res.json(response);
    } catch (error) {
      console.error('Multimodal processing error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: (error as Error).message,
      });
    }
  },
);

/**
 * GET /api/multimodal/agents/:agentId/capabilities
 * Get agent capabilities
 */
router.get('/agents/:agentId/capabilities', async (req, res) => {
  try {
    const agentId = parseInt(String(req.params.agentId), 10);
    const userId = req.user?.claims?.sub;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const capabilities = await multimodalAgent.getAgentCapabilities(agentId);
    res.json(capabilities);
  } catch (error) {
    console.error('Capabilities error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: (error as Error).message,
    });
  }
});

/**
 * POST /api/multimodal/agents/:agentId/memory/clear
 * Clear agent memory
 */
router.post('/agents/:agentId/memory/clear', async (req, res) => {
  try {
    const agentId = parseInt(String(req.params.agentId), 10);
    const userId = req.user?.claims?.sub;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await multimodalAgent.clearAgentMemory(agentId, userId);
    res.json({ message: 'Agent memory cleared successfully' });
  } catch (error) {
    console.error('Memory clear error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: (error as Error).message,
    });
  }
});

/**
 * GET /api/multimodal/sessions/:sessionId/history
 * Get session interaction history
 */
router.get('/sessions/:sessionId/history', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user?.claims?.sub;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const history = await multimodalAgent.getSessionHistory(sessionId);
    res.json(history);
  } catch (error) {
    console.error('Session history error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: (error as Error).message,
    });
  }
});

/**
 * Error handling middleware
 */
router.use((error: any, req: any, res: any, next: any) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res
        .status(400)
        .json({ error: 'File too large. Maximum size is 10MB.' });
    }
    return res.status(400).json({ error: `Upload error: ${error.message}` });
  }

  if (
    error.message.includes('File type') &&
    error.message.includes('not allowed')
  ) {
    return res.status(400).json({ error: error.message });
  }

  next(error);
});

export default router;
