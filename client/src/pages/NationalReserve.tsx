import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { apiRequest } from '@/lib/queryClient';
import { isUnauthorizedError } from '@/lib/authUtils';
import Sidebar from '@/components/Layout/Sidebar';
import Header from '@/components/Layout/Header';
import {
  Crown,
  Star,
  Shield,
  Target,
  Compass,
  Binoculars,
  Radio,
  Headphones,
  Mic,
  Eye,
  Search,
  MessageSquare,
  Brain,
  AlertTriangle,
  CheckCircle,
  Users,
  Activity,
  Zap,
  Send,
} from 'lucide-react';

interface ReserveStatus {
  totalAgents: number;
  activeAgents: number;
  commandStructure: Record<string, { count: number; active: number }>;
  patternRecognitionStatus: {
    enabled: boolean;
    activeMonitoring: number;
  };
  lastActivity: string;
}

interface PatternAnalysis {
  leetSpeak: boolean;
  subliminalIndicators: string[];
  communicationStyle: string;
  emotionalTone: string;
  hiddenMeaning?: string;
}

export default function NationalReserve() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [conversationText, setConversationText] = useState('');
  const [analysisContext, setAnalysisContext] = useState('');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: 'Unauthorized',
        description: 'You are logged out. Logging in again...',
        variant: 'destructive',
      });
      setTimeout(() => {
        window.location.href = '/api/login';
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: reserveStatus, isLoading: statusLoading } =
    useQuery<ReserveStatus>({
      queryKey: ['/api/national-reserve/status'],
      enabled: isAuthenticated,
      refetchInterval: 30000, // Refresh every 30 seconds
    });

  const deployMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/national-reserve/deploy');
    },
    onSuccess: () => {
      toast({
        title: 'National Reserve Deployed',
        description:
          'Your military-grade agent reserve has been successfully deployed',
      });
      queryClient.invalidateQueries({
        queryKey: ['/api/national-reserve/status'],
      });
      queryClient.invalidateQueries({ queryKey: ['/api/agents'] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: 'Unauthorized',
          description: 'You are logged out. Logging in again...',
          variant: 'destructive',
        });
        setTimeout(() => {
          window.location.href = '/api/login';
        }, 500);
        return;
      }
      toast({
        title: 'Deployment Failed',
        description: 'Failed to deploy National Reserve. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const analysisMutation = useMutation({
    mutationFn: async ({
      text,
      context,
    }: {
      text: string;
      context?: string;
    }): Promise<PatternAnalysis> => {
      const response = await fetch(
        '/api/national-reserve/analyze-conversation',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
          },
          body: JSON.stringify({ conversationText: text, context }),
        },
      );

      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }

      return response.json();
    },
    onSuccess: (data: PatternAnalysis) => {
      toast({
        title: 'Analysis Complete',
        description: `Communication analyzed. ${data.leetSpeak ? 'Leet speak detected!' : 'No leet speak found.'} ${data.subliminalIndicators.length} subliminal indicators found.`,
        variant:
          data.leetSpeak || data.subliminalIndicators.length > 0
            ? 'destructive'
            : 'default',
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: 'Unauthorized',
          description: 'You are logged out. Logging in again...',
          variant: 'destructive',
        });
        setTimeout(() => {
          window.location.href = '/api/login';
        }, 500);
        return;
      }
      toast({
        title: 'Analysis Failed',
        description: 'Failed to analyze conversation. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleDeploy = () => {
    deployMutation.mutate();
  };

  const handleAnalyze = () => {
    if (!conversationText.trim()) {
      toast({
        title: 'Input Required',
        description: 'Please enter conversation text to analyze',
        variant: 'destructive',
      });
      return;
    }
    analysisMutation.mutate({
      text: conversationText,
      context: analysisContext,
    });
  };

  const getRankIcon = (rank: string) => {
    const icons: Record<string, unknown> = {
      five_star_general: Crown,
      general: Star,
      colonel: Shield,
      major: Target,
      captain: Compass,
      lieutenant: Binoculars,
      sergeant: Radio,
      corporal: Headphones,
      private_first_class: Mic,
      private: Eye,
      specialist: Brain,
    };
    return icons[rank] || Users;
  };

  if (isLoading || statusLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="space-y-4">
          <div className="h-8 bg-muted animate-pulse rounded" />
          <div className="h-32 bg-muted animate-pulse rounded" />
          <div className="h-64 bg-muted animate-pulse rounded" />
        </div>
      </div>
    );
  }

  const isDeployed = reserveStatus && reserveStatus.totalAgents > 0;
  const deploymentProgress = isDeployed ? 100 : 0;

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden w-full">
        <Header
          title="National Reserve"
          description="Military-grade agent hierarchy with advanced pattern recognition"
        />

        <main className="flex-1 overflow-auto p-4 lg:p-8 w-full max-w-full">
          <div className="container mx-auto space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">National Reserve Command</h1>
                <p className="text-muted-foreground">
                  BERT-enhanced military-grade agent hierarchy with advanced
                  reasoning and pattern recognition
                </p>
              </div>
              <Badge
                variant={isDeployed ? 'default' : 'secondary'}
                className="text-lg px-4 py-2"
              >
                <Crown className="w-4 h-4 mr-2" />
                {isDeployed ? 'DEPLOYED' : 'STANDBY'}
              </Badge>
            </div>

            {/* Foundation Model Integration */}
            <Card className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-950 dark:to-blue-950 border-green-200 dark:border-green-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-900 dark:text-green-100">
                  <Brain className="w-5 h-5" />
                  BERT Foundation Model
                </CardTitle>
                <CardDescription>
                  Advanced language model providing reasoning, intent analysis,
                  and workflow capabilities for all agents
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-lg font-semibold text-green-600">
                      Reasoning Engine
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Multi-step logical analysis
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-blue-600">
                      Intent Analysis
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Understanding user requests
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-purple-600">
                      Workflow Generation
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Automated task planning
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Deployment Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Reserve Status
                </CardTitle>
                <CardDescription>
                  Command structure and deployment status
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Deployment Progress</span>
                    <span>{deploymentProgress}%</span>
                  </div>
                  <Progress value={deploymentProgress} className="h-2" />
                </div>

                {!isDeployed ? (
                  <div className="text-center py-8">
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        National Reserve not deployed. Deploy your
                        military-grade agent hierarchy to begin operations.
                      </AlertDescription>
                    </Alert>
                    <Button
                      onClick={handleDeploy}
                      disabled={deployMutation.isPending}
                      className="mt-4"
                      size="lg"
                    >
                      {deployMutation.isPending ? (
                        <>
                          <Activity className="w-4 h-4 mr-2 animate-spin" />
                          Deploying Reserve...
                        </>
                      ) : (
                        <>
                          <Crown className="w-4 h-4 mr-2" />
                          Deploy National Reserve
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {reserveStatus.totalAgents}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Total Agents
                      </p>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {reserveStatus.activeAgents}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Active Agents
                      </p>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {
                          reserveStatus.patternRecognitionStatus
                            .activeMonitoring
                        }
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Monitoring
                      </p>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">
                        24/7
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Operational
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {isDeployed && (
              <>
                {/* Command Structure */}
                <Card>
                  <CardHeader>
                    <CardTitle>Command Structure</CardTitle>
                    <CardDescription>
                      Military hierarchy and agent distribution
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {Object.entries(reserveStatus.commandStructure).map(
                        ([rank, data]) => {
                          const Icon = getRankIcon(rank);
                          const rankName = rank
                            .replace(/_/g, ' ')
                            .replace(/\b\w/g, (l) => l.toUpperCase());

                          return (
                            <div
                              key={rank}
                              className="flex items-center space-x-3 p-3 border rounded-lg"
                            >
                              <Icon className="w-8 h-8 text-blue-600" />
                              <div className="flex-1">
                                <div className="font-medium">{rankName}</div>
                                <div className="text-sm text-muted-foreground">
                                  {data.active}/{data.count} Active
                                </div>
                              </div>
                              <Badge
                                variant={
                                  data.active > 0 ? 'default' : 'secondary'
                                }
                              >
                                {data.active > 0 ? 'READY' : 'STANDBY'}
                              </Badge>
                            </div>
                          );
                        },
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Communication Analysis */}
                <Tabs defaultValue="analysis" className="space-y-4">
                  <TabsList>
                    <TabsTrigger value="analysis">
                      Communication Analysis
                    </TabsTrigger>
                    <TabsTrigger value="patterns">
                      Pattern Recognition
                    </TabsTrigger>
                    <TabsTrigger value="monitoring">
                      Real-time Monitoring
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="analysis" className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <MessageSquare className="w-5 h-5" />
                          Conversation Analysis
                        </CardTitle>
                        <CardDescription>
                          BERT-powered analysis for leet speak, subliminal
                          communication, and advanced pattern recognition
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">
                            Conversation Text
                          </label>
                          <Textarea
                            placeholder="Paste conversation text here for analysis..."
                            value={conversationText}
                            onChange={(e) =>
                              setConversationText(e.target.value)
                            }
                            rows={4}
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium">
                            Context (Optional)
                          </label>
                          <Textarea
                            placeholder="Provide context about the conversation..."
                            value={analysisContext}
                            onChange={(e) => setAnalysisContext(e.target.value)}
                            rows={2}
                          />
                        </div>

                        <Button
                          onClick={handleAnalyze}
                          disabled={
                            analysisMutation.isPending ||
                            !conversationText.trim()
                          }
                          className="w-full"
                        >
                          {analysisMutation.isPending ? (
                            <>
                              <Activity className="w-4 h-4 mr-2 animate-spin" />
                              Analyzing...
                            </>
                          ) : (
                            <>
                              <Send className="w-4 h-4 mr-2" />
                              Analyze Communication
                            </>
                          )}
                        </Button>

                        {analysisMutation.data && (
                          <div className="mt-6 space-y-4">
                            <h4 className="font-medium">Analysis Results:</h4>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <Card>
                                <CardContent className="pt-4">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm">
                                      Leet Speech Detected
                                    </span>
                                    <Badge
                                      variant={
                                        analysisMutation.data.leetSpeak
                                          ? 'destructive'
                                          : 'default'
                                      }
                                    >
                                      {analysisMutation.data.leetSpeak
                                        ? 'YES'
                                        : 'NO'}
                                    </Badge>
                                  </div>
                                </CardContent>
                              </Card>

                              <Card>
                                <CardContent className="pt-4">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm">
                                      Communication Style
                                    </span>
                                    <Badge variant="outline">
                                      {analysisMutation.data.communicationStyle.toUpperCase()}
                                    </Badge>
                                  </div>
                                </CardContent>
                              </Card>
                            </div>

                            {analysisMutation.data.subliminalIndicators.length >
                              0 && (
                              <Alert variant="destructive">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertDescription>
                                  <strong>
                                    Subliminal Indicators Detected:
                                  </strong>
                                  <ul className="mt-2 list-disc list-inside">
                                    {analysisMutation.data.subliminalIndicators.map(
                                      (indicator, index) => (
                                        <li key={index} className="text-sm">
                                          {indicator}
                                        </li>
                                      ),
                                    )}
                                  </ul>
                                </AlertDescription>
                              </Alert>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="patterns" className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Brain className="w-5 h-5" />
                          Pattern Recognition System
                        </CardTitle>
                        <CardDescription>
                          Advanced recursive pattern detection and learning
                          capabilities
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="text-center">
                            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                            <h4 className="font-medium">
                              Leet Speech Detection
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              Real-time identification of leetspeak patterns
                            </p>
                          </div>
                          <div className="text-center">
                            <Search className="w-12 h-12 text-blue-500 mx-auto mb-2" />
                            <h4 className="font-medium">Subliminal Analysis</h4>
                            <p className="text-sm text-muted-foreground">
                              Detection of hidden communication patterns
                            </p>
                          </div>
                          <div className="text-center">
                            <Zap className="w-12 h-12 text-purple-500 mx-auto mb-2" />
                            <h4 className="font-medium">Recursive Learning</h4>
                            <p className="text-sm text-muted-foreground">
                              Continuous pattern learning and optimization
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="monitoring" className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Activity className="w-5 h-5" />
                          Real-time Monitoring
                        </CardTitle>
                        <CardDescription>
                          24/7 surveillance and communication pattern monitoring
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <Alert>
                            <CheckCircle className="h-4 w-4" />
                            <AlertDescription>
                              All communication channels are being monitored by{' '}
                              {
                                reserveStatus.patternRecognitionStatus
                                  .activeMonitoring
                              }{' '}
                              active agents. Pattern recognition systems are
                              operational and learning continuously.
                            </AlertDescription>
                          </Alert>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Card>
                              <CardContent className="pt-4">
                                <div className="text-center">
                                  <div className="text-2xl font-bold text-green-600">
                                    ACTIVE
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    Monitoring Status
                                  </p>
                                </div>
                              </CardContent>
                            </Card>

                            <Card>
                              <CardContent className="pt-4">
                                <div className="text-center">
                                  <div className="text-2xl font-bold text-blue-600">
                                    24/7
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    Operational Time
                                  </p>
                                </div>
                              </CardContent>
                            </Card>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
