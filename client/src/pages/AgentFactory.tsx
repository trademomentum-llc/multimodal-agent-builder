import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import Sidebar from '@/components/Layout/Sidebar';
import Header from '@/components/Layout/Header';
import AgentTypeCard from '@/components/AgentFactory/AgentTypeCard';
import CreateAgentModal from '@/components/AgentFactory/CreateAgentModal';
import MultimodalInterface from '@/components/AgentFactory/MultimodalInterface';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AgentType, Agent } from '@/types/agent';
import { Plus, Brain } from 'lucide-react';

export default function AgentFactory() {
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedAgentForTesting, setSelectedAgentForTesting] =
    useState<Agent | null>(null);

  // Redirect to home if not authenticated
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

  const {
    data: agentTypes,
    isLoading: agentTypesLoading,
    error: agentTypesError,
  } = useQuery<AgentType[]>({
    queryKey: ['/api/agent-types'],
    enabled: isAuthenticated,
  });

  const { data: agents } = useQuery<Agent[]>({
    queryKey: ['/api/agents'],
    enabled: isAuthenticated,
  });

  const getInstanceCount = (typeId: number) => {
    return agents?.filter((agent) => agent.typeId === typeId).length || 0;
  };

  const getAgentStatus = (typeId: number): 'active' | 'setup' | 'inactive' => {
    const agentsOfType =
      agents?.filter((agent) => agent.typeId === typeId) || [];
    if (agentsOfType.length === 0) return 'inactive';
    if (agentsOfType.some((agent) => agent.status === 'active'))
      return 'active';
    return 'setup';
  };

  const handleTestMultimodal = (agentType: AgentType) => {
    // Find first active agent of this type
    const activeAgent = agents?.find(
      (agent) => agent.typeId === agentType.id && agent.status === 'active',
    );

    if (activeAgent) {
      setSelectedAgentForTesting(activeAgent);
    } else {
      toast({
        title: 'No active agent',
        description: 'Please create and activate an agent first',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-300">
              Loading agent factory...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden w-full">
        <Header
          title="Agent Factory"
          description="Create and manage specialized AI agents for your business operations"
          onCreateAgent={() => setIsCreateModalOpen(true)}
        />

        <main className="flex-1 overflow-auto p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Foundation Model Integration */}
            <Card className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-950 dark:to-blue-950 border-green-200 dark:border-green-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-900 dark:text-green-100">
                  <Brain className="w-5 h-5" />
                  BERT Foundation Model Integration
                </CardTitle>
                <CardDescription>
                  All agents are enhanced with BERT foundation model for
                  advanced reasoning, intent analysis, and workflow execution
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-lg font-semibold text-green-600">
                      Advanced Reasoning
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Multi-step logical analysis
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-blue-600">
                      Intent Understanding
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Precise request interpretation
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
                  <div className="text-center">
                    <div className="text-lg font-semibold text-orange-600">
                      Cross-Collaboration
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Agent-to-agent communication
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Available Agent Types
                  </h3>
                  <Button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="bg-primary hover:bg-blue-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Agent
                  </Button>
                </div>
              </div>

              <div className="p-6">
                {agentTypesLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[...Array(6)].map((_, i) => (
                      <Card key={i}>
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-3">
                            <Skeleton className="w-10 h-10 rounded-lg" />
                            <div className="flex-1 space-y-2">
                              <Skeleton className="h-4 w-32" />
                              <Skeleton className="h-3 w-48" />
                            </div>
                            <div className="text-right space-y-1">
                              <Skeleton className="h-5 w-16" />
                              <Skeleton className="h-3 w-20" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : agentTypesError ? (
                  <div className="text-center py-8">
                    <p className="text-error mb-4">
                      Failed to load agent types
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => window.location.reload()}
                    >
                      Retry
                    </Button>
                  </div>
                ) : !agentTypes || agentTypes.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 dark:text-gray-400">
                      No agent types available
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {agentTypes.map((agentType) => (
                      <AgentTypeCard
                        key={agentType.id}
                        agentType={agentType}
                        instanceCount={getInstanceCount(agentType.id)}
                        status={getAgentStatus(agentType.id)}
                        onClick={() => setIsCreateModalOpen(true)}
                        onTestMultimodal={() => handleTestMultimodal(agentType)}
                      />
                    ))}
                  </div>
                )}

                <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                  <Button
                    variant="outline"
                    className="w-full border-2 border-dashed border-gray-300 dark:border-gray-600 h-20 text-gray-600 dark:text-gray-300 hover:border-primary hover:text-primary transition-colors"
                    onClick={() => setIsCreateModalOpen(true)}
                  >
                    <div className="text-center">
                      <Plus className="w-6 h-6 mx-auto mb-2" />
                      <p className="font-medium">Create Custom Agent</p>
                      <p className="text-sm">
                        Build a specialized agent for your workflow
                      </p>
                    </div>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      <CreateAgentModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />

      {selectedAgentForTesting && (
        <MultimodalInterface
          agent={selectedAgentForTesting}
          onClose={() => setSelectedAgentForTesting(null)}
        />
      )}
    </div>
  );
}
