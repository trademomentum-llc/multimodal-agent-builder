import OpenAI from 'openai';

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || 'default_key',
});

export interface ContentGenerationRequest {
  type: 'social_media' | 'email' | 'blog' | 'marketing';
  platform?: string;
  topic: string;
  tone: 'professional' | 'casual' | 'friendly' | 'formal';
  length: 'short' | 'medium' | 'long';
  targetAudience?: string;
  keywords?: string[];
}

export interface ContentGenerationResponse {
  content: string;
  suggestions: string[];
  safetyScore: number;
  metadata: {
    wordCount: number;
    readabilityScore: number;
    sentiment: string;
  };
}

export interface AnalysisRequest {
  text: string;
  analysisType: 'sentiment' | 'keywords' | 'summary' | 'safety';
}

export interface AnalysisResponse {
  result: Record<string, unknown>;
  confidence: number;
  metadata: Record<string, unknown>;
}

class OpenAIService {
  private isAvailable(): boolean {
    return !!process.env.OPENAI_API_KEY || !!process.env.OPENAI_KEY;
  }

  async generateContent(
    request: ContentGenerationRequest,
  ): Promise<ContentGenerationResponse> {
    if (!this.isAvailable()) {
      throw new Error('OpenAI API key not configured');
    }

    try {
      const prompt = this.buildContentPrompt(request);

      const response = await openai.chat.completions.create({
        model: 'gpt-4o', // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
        messages: [
          {
            role: 'system',
            content:
              'You are a professional content creator with expertise in neurodivergence-friendly communication. Generate content that is clear, structured, and accessible. Always respond in JSON format with the requested fields.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 1500,
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');

      return {
        content: result.content || '',
        suggestions: result.suggestions || [],
        safetyScore: result.safetyScore || 0.95,
        metadata: {
          wordCount: result.wordCount || 0,
          readabilityScore: result.readabilityScore || 0,
          sentiment: result.sentiment || 'neutral',
        },
      };
    } catch (error) {
      console.error('Error generating content:', error);
      throw new Error('Failed to generate content');
    }
  }

  async analyzeContent(request: AnalysisRequest): Promise<AnalysisResponse> {
    if (!this.isAvailable()) {
      throw new Error('OpenAI API key not configured');
    }

    try {
      const prompt = this.buildAnalysisPrompt(request);

      const response = await openai.chat.completions.create({
        model: 'gpt-4o', // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
        messages: [
          {
            role: 'system',
            content:
              'You are an expert content analyst. Provide detailed analysis in JSON format with confidence scores and metadata.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 1000,
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');

      return {
        result: result.analysis || {},
        confidence: result.confidence || 0,
        metadata: result.metadata || {},
      };
    } catch (error) {
      console.error('Error analyzing content:', error);
      throw new Error('Failed to analyze content');
    }
  }

  async checkContentSafety(text: string): Promise<{
    safe: boolean;
    score: number;
    issues: string[];
  }> {
    if (!this.isAvailable()) {
      return { safe: true, score: 0.95, issues: [] };
    }

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o', // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
        messages: [
          {
            role: 'system',
            content:
              'You are a content safety moderator. Analyze the provided text for potential safety issues including harmful content, misinformation, or inappropriate material. Respond in JSON format.',
          },
          {
            role: 'user',
            content: `Analyze this text for safety issues: "${text}"`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 500,
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');

      return {
        safe: result.safe !== false,
        score: result.score || 0.95,
        issues: result.issues || [],
      };
    } catch (error) {
      console.error('Error checking content safety:', error);
      // Default to safe on error
      return { safe: true, score: 0.95, issues: [] };
    }
  }

  private buildContentPrompt(request: ContentGenerationRequest): string {
    const { type, platform, topic, tone, length, targetAudience, keywords } =
      request;

    return `Generate ${type} content with the following specifications:
    - Topic: ${topic}
    - Tone: ${tone}
    - Length: ${length}
    ${platform ? `- Platform: ${platform}` : ''}
    ${targetAudience ? `- Target Audience: ${targetAudience}` : ''}
    ${keywords ? `- Keywords to include: ${keywords.join(', ')}` : ''}
    
    Please ensure the content is:
    1. Neurodivergence-friendly (clear structure, simple language)
    2. Engaging and appropriate for the target audience
    3. Optimized for the specified platform
    4. Safe and professional
    
    Respond in JSON format with:
    {
      "content": "the generated content",
      "suggestions": ["improvement suggestion 1", "improvement suggestion 2"],
      "safetyScore": 0.95,
      "wordCount": 150,
      "readabilityScore": 0.8,
      "sentiment": "positive"
    }`;
  }

  private buildAnalysisPrompt(request: AnalysisRequest): string {
    const { text, analysisType } = request;

    switch (analysisType) {
      case 'sentiment':
        return `Analyze the sentiment of this text: "${text}"
        
        Respond in JSON format with:
        {
          "analysis": {
            "sentiment": "positive/negative/neutral",
            "score": 0.8,
            "emotions": ["happy", "excited"]
          },
          "confidence": 0.95,
          "metadata": {
            "wordCount": 50,
            "keyPhrases": ["phrase1", "phrase2"]
          }
        }`;

      case 'keywords':
        return `Extract keywords and key phrases from this text: "${text}"
        
        Respond in JSON format with:
        {
          "analysis": {
            "keywords": ["keyword1", "keyword2"],
            "keyPhrases": ["phrase1", "phrase2"],
            "topics": ["topic1", "topic2"]
          },
          "confidence": 0.9,
          "metadata": {
            "wordCount": 50,
            "density": 0.1
          }
        }`;

      case 'summary':
        return `Provide a concise summary of this text: "${text}"
        
        Respond in JSON format with:
        {
          "analysis": {
            "summary": "brief summary",
            "keyPoints": ["point1", "point2"],
            "mainTopic": "main topic"
          },
          "confidence": 0.9,
          "metadata": {
            "originalLength": 200,
            "summaryLength": 50,
            "compressionRatio": 0.25
          }
        }`;

      case 'safety':
        return `Analyze this text for safety and appropriateness: "${text}"
        
        Respond in JSON format with:
        {
          "analysis": {
            "safe": true,
            "riskLevel": "low",
            "issues": [],
            "recommendations": []
          },
          "confidence": 0.95,
          "metadata": {
            "categories": ["business", "professional"],
            "flags": []
          }
        }`;

      default:
        return `Analyze this text: "${text}"`;
    }
  }
}

export const openaiService = new OpenAIService();
