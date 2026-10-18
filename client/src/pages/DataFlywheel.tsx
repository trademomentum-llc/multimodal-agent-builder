import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
  Zap,
  TrendingUp,
  DollarSign,
  Target,
  Play,
  RefreshCw,
  ChevronRight,
  Cpu,
  Database,
  BarChart3,
  Layers,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface FlywheelRun {
  id: number;
  name: string;
  description?: string;
  status: string;
  baseModelId?: number;
  targetWorkload: string;
  datasetSize: number;
  costSavings: number;
  accuracyRetention: number;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

interface Optimization {
  id: number;
  workloadId: string;
  optimizationType: string;
  costReduction: number;
  speedImprovement: number;
  accuracyRetention: number;
  confidence: number;
  productionReady: boolean;
  createdAt: string;
}

export default function DataFlywheel() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [selectedRun, setSelectedRun] = useState<number | null>(null);

  // Fetch flywheel runs
  const { data: flywheelRuns = [] } = useQuery<FlywheelRun[]>({
    queryKey: ['/api/flywheel/runs'],
    enabled: isAuthenticated,
  });

  // Fetch optimizations
  const { data: optimizations = [] } = useQuery<Optimization[]>({
    queryKey: ['/api/flywheel/optimizations'],
    enabled: isAuthenticated,
  });

  // Start new flywheel run mutation
  const startRunMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      targetWorkload: string;
      description?: string;
    }) => {
      const response = await fetch('/api/flywheel/runs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error('Failed to start flywheel run');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/flywheel/runs'] });
      toast({
        title: 'Flywheel Run Started',
        description: 'Model discovery and optimization process initiated.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to start flywheel run',
        variant: 'destructive',
      });
    },
  });

  const handleStartRun = () => {
    startRunMutation.mutate({
      name: `Optimization Run ${new Date().toLocaleDateString()}`,
      targetWorkload: 'general_agent_tasks',
      description: 'Autonomous model discovery and optimization cycle',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">Loading...</div>
    );
  }

  const runningRuns = flywheelRuns.filter((run) => run.status === 'running');

  // Calculate aggregate metrics
  const totalCostSavings =
    optimizations.reduce((sum, opt) => sum + opt.costReduction, 0) /
    Math.max(optimizations.length, 1);
  const averageAccuracy =
    optimizations.reduce((sum, opt) => sum + opt.accuracyRetention, 0) /
    Math.max(optimizations.length, 1);
  const productionReadyOptimizations = optimizations.filter(
    (opt) => opt.productionReady,
  ).length;

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">NVIDIA Data Flywheel</h1>
          <p className="text-muted-foreground">
            Autonomous model discovery and optimization platform powered by NeMo
            microservices
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={handleStartRun}
            disabled={startRunMutation.isPending || runningRuns.length > 0}
            className="bg-green-600 hover:bg-green-700"
          >
            <Play className="w-4 h-4 mr-2" />
            {runningRuns.length > 0 ? 'Run in Progress' : 'Start New Run'}
          </Button>
        </div>
      </div>

      {/* Key Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cost Savings</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {totalCostSavings.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Average across {optimizations.length} optimizations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Accuracy Retention
            </CardTitle>
            <Target className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {averageAccuracy.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Model performance maintained
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Production Ready
            </CardTitle>
            <Cpu className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {productionReadyOptimizations}
            </div>
            <p className="text-xs text-muted-foreground">
              Models ready for deployment
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Runs</CardTitle>
            <RefreshCw
              className={`h-4 w-4 text-orange-500 ${runningRuns.length > 0 ? 'animate-spin' : ''}`}
            />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {runningRuns.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Flywheel processes running
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="runs">Flywheel Runs</TabsTrigger>
          <TabsTrigger value="optimizations">Optimizations</TabsTrigger>
          <TabsTrigger value="models">Model Catalog</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-500" />
                  Data Flywheel Process
                </CardTitle>
                <CardDescription>
                  Autonomous optimization cycle using production traffic
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Database className="w-4 h-4 text-blue-500" />
                    <span className="text-sm">Traffic Collection</span>
                  </div>
                  <Badge variant="outline">Active</Badge>
                </div>
                <ChevronRight className="w-4 h-4 mx-auto text-muted-foreground" />
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Layers className="w-4 h-4 text-green-500" />
                    <span className="text-sm">Dataset Creation</span>
                  </div>
                  <Badge variant="outline">Automated</Badge>
                </div>
                <ChevronRight className="w-4 h-4 mx-auto text-muted-foreground" />
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <BarChart3 className="w-4 h-4 text-purple-500" />
                    <span className="text-sm">Model Evaluation</span>
                  </div>
                  <Badge variant="outline">NeMo</Badge>
                </div>
                <ChevronRight className="w-4 h-4 mx-auto text-muted-foreground" />
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Target className="w-4 h-4 text-orange-500" />
                    <span className="text-sm">Optimization</span>
                  </div>
                  <Badge variant="outline">Continuous</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>
                  Latest flywheel discoveries and optimizations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-3">
                    {optimizations.slice(0, 5).map((opt) => (
                      <div
                        key={opt.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="space-y-1">
                          <p className="text-sm font-medium">
                            {opt.optimizationType}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {opt.costReduction}% cost reduction,{' '}
                            {opt.accuracyRetention}% accuracy
                          </p>
                        </div>
                        <Badge
                          variant={
                            opt.productionReady ? 'default' : 'secondary'
                          }
                        >
                          {opt.productionReady ? 'Ready' : 'Testing'}
                        </Badge>
                      </div>
                    ))}
                    {optimizations.length === 0 && (
                      <div className="text-center text-muted-foreground py-8">
                        No optimizations discovered yet. Start a flywheel run to
                        begin.
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="runs" className="space-y-6">
          <div className="grid gap-4">
            {flywheelRuns.map((run) => (
              <Card
                key={run.id}
                className={`cursor-pointer transition-colors ${selectedRun === run.id ? 'ring-2 ring-primary' : ''}`}
              >
                <CardHeader onClick={() => setSelectedRun(run.id)}>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{run.name}</CardTitle>
                      <CardDescription>{run.description}</CardDescription>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={
                          run.status === 'running'
                            ? 'default'
                            : run.status === 'completed'
                              ? 'secondary'
                              : run.status === 'failed'
                                ? 'destructive'
                                : 'outline'
                        }
                      >
                        {run.status}
                      </Badge>
                      <div className="text-right text-sm">
                        <div className="font-medium">
                          {run.costSavings}% savings
                        </div>
                        <div className="text-muted-foreground">
                          {run.accuracyRetention}% accuracy
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                {selectedRun === run.id && (
                  <CardContent className="border-t">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                      <div>
                        <div className="text-sm text-muted-foreground">
                          Dataset Size
                        </div>
                        <div className="font-medium">
                          {run.datasetSize.toLocaleString()} samples
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">
                          Target Workload
                        </div>
                        <div className="font-medium">{run.targetWorkload}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">
                          Started
                        </div>
                        <div className="font-medium">
                          {run.startedAt
                            ? new Date(run.startedAt).toLocaleDateString()
                            : 'Not started'}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">
                          Duration
                        </div>
                        <div className="font-medium">
                          {run.completedAt && run.startedAt
                            ? `${Math.round((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / (1000 * 60))} min`
                            : run.status === 'running'
                              ? 'In progress'
                              : 'N/A'}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
            {flywheelRuns.length === 0 && (
              <Card>
                <CardContent className="text-center py-12">
                  <Zap className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Flywheel Runs</h3>
                  <p className="text-muted-foreground mb-4">
                    Start your first flywheel run to begin autonomous model
                    optimization.
                  </p>
                  <Button
                    onClick={handleStartRun}
                    disabled={startRunMutation.isPending}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Start First Run
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="optimizations" className="space-y-6">
          <div className="grid gap-4">
            {optimizations.map((opt) => (
              <Card key={opt.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg capitalize">
                        {opt.optimizationType}
                      </CardTitle>
                      <CardDescription>
                        Workload: {opt.workloadId}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={opt.productionReady ? 'default' : 'secondary'}
                      >
                        {opt.productionReady
                          ? 'Production Ready'
                          : 'Under Evaluation'}
                      </Badge>
                      <div className="text-right">
                        <div className="text-lg font-bold text-green-600">
                          {opt.costReduction}%
                        </div>
                        <div className="text-sm text-muted-foreground">
                          cost reduction
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">
                        Speed Improvement
                      </div>
                      <div className="text-lg font-medium text-blue-600">
                        {opt.speedImprovement}%
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">
                        Accuracy Retention
                      </div>
                      <div className="text-lg font-medium text-purple-600">
                        {opt.accuracyRetention}%
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">
                        Confidence
                      </div>
                      <div className="text-lg font-medium">
                        {opt.confidence}%
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">
                        Discovered
                      </div>
                      <div className="text-lg font-medium">
                        {new Date(opt.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">
                        Optimization Confidence
                      </span>
                      <span className="text-sm font-medium">
                        {opt.confidence}%
                      </span>
                    </div>
                    <Progress value={opt.confidence} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            ))}
            {optimizations.length === 0 && (
              <Card>
                <CardContent className="text-center py-12">
                  <TrendingUp className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">
                    No Optimizations Found
                  </h3>
                  <p className="text-muted-foreground">
                    Run the data flywheel to discover model optimizations.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="models" className="space-y-6">
          <Alert>
            <Cpu className="h-4 w-4" />
            <AlertDescription>
              Model catalog integration with NVIDIA NIM and NeMo microservices
              coming soon. The flywheel will automatically discover and evaluate
              models from the NVIDIA model catalog.
            </AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>
    </div>
  );
}
