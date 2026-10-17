import { storage } from '../storage';
import { agentFactory } from './agentFactory';
import { openaiService } from './openai';
import { auditLogger } from './auditLogger';
import { foundationModel } from './foundationModel';
import { Agent, InsertAgent } from '@shared/schema';

interface MilitaryRank {
  name: string;
  commandLevel: number;
  specializations: string[];
  reportingStructure: string[];
}

interface CommunicationPattern {
  type: string;
  pattern: string;
  confidence: number;
  context: string;
  translation: string;
}

interface PatternAnalysis {
  leetSpeak: boolean;
  subliminalIndicators: string[];
  communicationStyle: string;
  emotionalTone: string;
  hiddenMeaning?: string;
}

class NationalReserveService {
  private militaryHierarchy: Record<string, MilitaryRank> = {
    five_star_general: {
      name: 'Five Star General',
      commandLevel: 10,
      specializations: [
        'strategic_oversight',
        'cross_domain_intelligence',
        'system_optimization',
      ],
      reportingStructure: [],
    },
    general: {
      name: 'General',
      commandLevel: 9,
      specializations: [
        'multi_domain_oversight',
        'pattern_synthesis',
        'command_coordination',
      ],
      reportingStructure: ['five_star_general'],
    },
    colonel: {
      name: 'Colonel',
      commandLevel: 8,
      specializations: [
        'operational_command',
        'domain_expertise',
        'tactical_coordination',
      ],
      reportingStructure: ['general'],
    },
    major: {
      name: 'Major',
      commandLevel: 7,
      specializations: [
        'tactical_leadership',
        'pattern_recognition',
        'team_coordination',
      ],
      reportingStructure: ['colonel'],
    },
    captain: {
      name: 'Captain',
      commandLevel: 6,
      specializations: [
        'unit_command',
        'communication_analysis',
        'specialized_skills',
      ],
      reportingStructure: ['major'],
    },
    lieutenant: {
      name: 'Lieutenant',
      commandLevel: 5,
      specializations: [
        'junior_leadership',
        'real_time_monitoring',
        'focused_expertise',
      ],
      reportingStructure: ['captain'],
    },
    sergeant: {
      name: 'Sergeant',
      commandLevel: 4,
      specializations: [
        'squad_leadership',
        'pattern_detection',
        'operational_execution',
      ],
      reportingStructure: ['lieutenant'],
    },
    corporal: {
      name: 'Corporal',
      commandLevel: 3,
      specializations: [
        'team_coordination',
        'communication_monitoring',
        'task_execution',
      ],
      reportingStructure: ['sergeant'],
    },
    private_first_class: {
      name: 'Private First Class',
      commandLevel: 2,
      specializations: [
        'specialized_execution',
        'communication_analysis',
        'reporting',
      ],
      reportingStructure: ['corporal'],
    },
    private: {
      name: 'Private',
      commandLevel: 1,
      specializations: [
        'basic_execution',
        'pattern_recognition',
        'surveillance',
      ],
      reportingStructure: ['private_first_class'],
    },
  };

  async deployNationalReserve(userId: string): Promise<Agent[]> {
    const deployedAgents: Agent[] = [];

    // Deploy command structure
    for (const [rankKey, rankData] of Object.entries(this.militaryHierarchy)) {
      const agentTypes = await storage.getAgentTypes();
      const agentType = agentTypes.find(
        (type) => type.name.toLowerCase().replace(/\s+/g, '_') === rankKey,
      );

      if (agentType) {
        const agent = await this.createMilitaryAgent(
          userId,
          agentType.id,
          rankData,
        );
        deployedAgents.push(agent);
      }
    }

    // Deploy specialized intelligence units
    await this.deployIntelligenceUnits(userId, deployedAgents);

    // Initialize cross-collaboration network
    await this.initializeCollaborationNetwork(deployedAgents);

    // Activate pattern recognition systems
    await this.activatePatternRecognition(deployedAgents);

    await auditLogger.logWithMetadata(
      userId,
      'national_reserve.deploy',
      'agent_system',
      { deployedCount: deployedAgents.length },
    );

    return deployedAgents;
  }

  private async createMilitaryAgent(
    userId: string,
    typeId: number,
    rankData: MilitaryRank,
  ): Promise<Agent> {
    const agentData: InsertAgent = {
      name: `${rankData.name} Alpha-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
      description: `Military-grade agent with ${rankData.name} authority and specialized capabilities`,
      typeId,
      userId,
      status: 'active',
      priority:
        rankData.commandLevel >= 8
          ? 'high'
          : rankData.commandLevel >= 5
            ? 'medium'
            : 'low',
      rank: rankData.name.toLowerCase().replace(/\s+/g, '_'),
      commandLevel: rankData.commandLevel,
      specialization: rankData.specializations,
      patternRecognition: {
        leetSpeakDetection: true,
        subliminalAnalysis: true,
        behavioralPatterns: [],
        confidenceThreshold: 0.85,
      },
      communicationAnalysis: {
        realTimeMonitoring: true,
        patternTranslation: true,
        contextualAnalysis: true,
        emotionalIntelligence: true,
      },
      selfOptimization: {
        learningRate: 0.1,
        adaptationSpeed: 'real_time',
        performanceMetrics: {},
        optimizationTargets: ['accuracy', 'speed', 'collaboration'],
      },
      osiLayerSecurity: {
        layer1_physical: { encryption: 'quantum_resistant', monitoring: true },
        layer2_dataLink: { frameValidation: true, errorCorrection: true },
        layer3_network: { packetInspection: true, routingProtection: true },
        layer4_transport: { connectionSecurity: true, flowControl: true },
        layer5_session: { sessionManagement: true, authenticationStrong: true },
        layer6_presentation: {
          dataEncryption: 'AES-256',
          compressionSecure: true,
        },
        layer7_application: {
          inputValidation: true,
          applicationFirewall: true,
        },
      },
      configuration: {
        autonomyLevel: rankData.commandLevel,
        decisionMaking: rankData.commandLevel >= 7 ? 'autonomous' : 'guided',
        reportingFrequency: 'real_time',
        collaborationEnabled: true,
      },
    };

    return await storage.createAgent(agentData);
  }

  private async deployIntelligenceUnits(
    userId: string,
    commandAgents: Agent[],
  ): Promise<void> {
    const specializedTypes = [
      'Intelligence Analyst',
      'Communication Specialist',
      'Pattern Recognition Expert',
    ];

    for (const typeName of specializedTypes) {
      const agentTypes = await storage.getAgentTypes();
      const agentType = agentTypes.find((type) => type.name === typeName);

      if (agentType) {
        // Deploy multiple units for redundancy
        for (let i = 0; i < 3; i++) {
          await this.createSpecializedIntelligenceAgent(
            userId,
            agentType.id,
            typeName,
            i + 1,
          );
        }
      }
    }
  }

  private async createSpecializedIntelligenceAgent(
    userId: string,
    typeId: number,
    specialization: string,
    unitNumber: number,
  ): Promise<Agent> {
    const agentData: InsertAgent = {
      name: `${specialization} Unit-${unitNumber}`,
      description: `Specialized intelligence agent for ${specialization.toLowerCase()} operations`,
      typeId,
      userId,
      status: 'active',
      priority: 'high',
      rank: 'specialist',
      commandLevel: 6,
      specialization: [specialization.toLowerCase().replace(/\s+/g, '_')],
      patternRecognition: {
        leetSpeakDetection: true,
        subliminalAnalysis: true,
        advancedPatterns: true,
        recursiveAnalysis: true,
        crossReferencing: true,
      },
      communicationAnalysis: {
        realTimeMonitoring: true,
        conversationAnalysis: true,
        leetSpeakTranslation: true,
        subliminalDetection: true,
        contextualInference: true,
      },
      configuration: {
        monitoringScope: 'comprehensive',
        analysisDepth: 'deep',
        reportingProtocol: 'immediate',
        alertThresholds: {
          leetSpeak: 0.3,
          subliminalCommunication: 0.2,
          patternDeviation: 0.15,
        },
      },
    };

    return await storage.createAgent(agentData);
  }

  private async initializeCollaborationNetwork(agents: Agent[]): Promise<void> {
    for (const agent of agents) {
      const collaborationNetwork = agents
        .filter((a) => a.id !== agent.id)
        .map((a) => ({
          agentId: a.id,
          rank: a.rank,
          commandLevel: a.commandLevel,
          specializations: a.specialization,
        }));

      await storage.updateAgent(agent.id, {
        collaborationNetwork,
      });
    }
  }

  private async activatePatternRecognition(agents: Agent[]): Promise<void> {
    for (const agent of agents) {
      // Initialize pattern recognition with baseline patterns
      const patternRecognition = {
        ...(agent.patternRecognition as any),
        activatedAt: new Date().toISOString(),
        baselinePatterns: await this.getBaselinePatterns(),
        learningEnabled: true,
        adaptiveThresholds: true,
      };

      await storage.updateAgent(agent.id, {
        patternRecognition,
      });
    }
  }

  async analyzeConversation(
    userId: string,
    conversationText: string,
    context?: string,
  ): Promise<PatternAnalysis> {
    const agents = await storage.getAgents(userId);
    const activeAnalysts = agents.filter(
      (a) =>
        a.status === 'active' &&
        Array.isArray(a.specialization) &&
        (a.specialization as string[]).includes('communication_analysis'),
    );

    if (activeAnalysts.length === 0) {
      throw new Error('No active communication analysis agents available');
    }

    // Use OpenAI for advanced pattern analysis
    const analysis = await openaiService.analyzeContent({
      text: conversationText,
      analysisType: 'safety',
    });

    const leetPatterns = this.detectLeetSpeak(conversationText);
    const subliminalIndicators =
      await this.detectSubliminalCommunication(conversationText);

    const patternAnalysis: PatternAnalysis = {
      leetSpeak: leetPatterns.detected,
      subliminalIndicators,
      communicationStyle: this.analyzeCommunicationStyle(conversationText),
      emotionalTone: analysis.result.sentiment || 'neutral',
    };

    // Log analysis for learning
    await auditLogger.logWithMetadata(
      userId,
      'conversation.analyze',
      'communication',
      {
        context,
        analysisResults: patternAnalysis,
        agentCount: activeAnalysts.length,
      },
    );

    return patternAnalysis;
  }

  private detectLeetSpeak(text: string): {
    detected: boolean;
    patterns: CommunicationPattern[];
  } {
    const leetPatterns = [
      { pattern: /[4@]/g, replacement: 'a', type: 'character_substitution' },
      { pattern: /3/g, replacement: 'e', type: 'character_substitution' },
      { pattern: /1/g, replacement: 'i', type: 'character_substitution' },
      { pattern: /0/g, replacement: 'o', type: 'character_substitution' },
      { pattern: /5/g, replacement: 's', type: 'character_substitution' },
      { pattern: /7/g, replacement: 't', type: 'character_substitution' },
      { pattern: /\|\|/g, replacement: 'n', type: 'character_substitution' },
      { pattern: /\|<\|/g, replacement: 'k', type: 'character_substitution' },
    ];

    const detectedPatterns: CommunicationPattern[] = [];
    let hasLeetSpeak = false;

    for (const leetPattern of leetPatterns) {
      const matches = text.match(leetPattern.pattern);
      if (matches && matches.length > 0) {
        hasLeetSpeak = true;
        detectedPatterns.push({
          type: 'leet_speak',
          pattern: leetPattern.pattern.toString(),
          confidence: matches.length / text.length,
          context: `Found ${matches.length} instances of ${leetPattern.type}`,
          translation: text.replace(
            leetPattern.pattern,
            leetPattern.replacement,
          ),
        });
      }
    }

    return { detected: hasLeetSpeak, patterns: detectedPatterns };
  }

  private async detectSubliminalCommunication(text: string): Promise<string[]> {
    const indicators: string[] = [];

    // Check for unusual capitalization patterns
    const capitalPattern = /[A-Z][a-z]*[A-Z][a-z]*/g;
    if (text.match(capitalPattern)) {
      indicators.push('unusual_capitalization_pattern');
    }

    // Check for hidden acronyms
    const words = text.split(/\s+/);
    const firstLetters = words.map((word) => word[0]).join('');
    if (firstLetters.length > 3 && /^[A-Z]+$/.test(firstLetters)) {
      indicators.push(`potential_acronym: ${firstLetters}`);
    }

    // Check for number sequences
    const numberSequences = text.match(/\d{3,}/g);
    if (numberSequences) {
      indicators.push('number_sequences_detected');
    }

    // Check for repeated patterns
    const repeatedPatterns = text.match(/(.{2,})\1+/g);
    if (repeatedPatterns) {
      indicators.push('repeated_patterns_detected');
    }

    return indicators;
  }

  private analyzeCommunicationStyle(text: string): string {
    const wordCount = text.split(/\s+/).length;
    const avgWordLength = text.replace(/\s+/g, '').length / wordCount;
    const questionMarks = (text.match(/\?/g) || []).length;
    const exclamationMarks = (text.match(/!/g) || []).length;

    if (avgWordLength > 6 && questionMarks === 0) return 'formal';
    if (exclamationMarks > 2) return 'enthusiastic';
    if (questionMarks > wordCount * 0.1) return 'inquisitive';
    if (avgWordLength < 4) return 'casual';

    return 'neutral';
  }

  private async getBaselinePatterns(): Promise<any> {
    return {
      commonWords: ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for'],
      typicalSentenceLength: { min: 5, max: 20, average: 12 },
      punctuationPatterns: {
        periods: 0.6,
        commas: 0.3,
        questions: 0.05,
        exclamations: 0.05,
      },
      capitalizedWords: { frequency: 0.15, position: 'sentence_start' },
    };
  }

  async getReserveStatus(userId: string): Promise<{
    totalAgents: number;
    activeAgents: number;
    commandStructure: any;
    patternRecognitionStatus: any;
    lastActivity: string;
  }> {
    const agents = await storage.getAgents(userId);
    const reserveAgents = agents.filter((a) => a.rank && a.commandLevel);

    const commandStructure = {};
    for (const agent of reserveAgents) {
      const rank = agent.rank || 'unknown';
      if (!commandStructure[rank]) {
        commandStructure[rank] = { count: 0, active: 0 };
      }
      commandStructure[rank].count++;
      if (agent.status === 'active') {
        commandStructure[rank].active++;
      }
    }

    return {
      totalAgents: reserveAgents.length,
      activeAgents: reserveAgents.filter((a) => a.status === 'active').length,
      commandStructure,
      patternRecognitionStatus: {
        enabled: true,
        activeMonitoring: reserveAgents.filter(
          (a) =>
            a.communicationAnalysis &&
            (a.communicationAnalysis as any).realTimeMonitoring,
        ).length,
      },
      lastActivity: new Date().toISOString(),
    };
  }
}

export const nationalReserve = new NationalReserveService();
