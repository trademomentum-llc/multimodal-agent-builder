import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import Sidebar from '@/components/Layout/Sidebar';
import Header from '@/components/Layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search,
  Download,
  Play,
  Pause,
  Settings,
  MoreHorizontal,
  Bot,
  Brain,
  Shield,
  Zap,
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface Agent {
  id: number;
  name: string;
  type: string;
  status: 'active' | 'inactive' | 'paused';
  description: string;
  capabilities: string[];
  createdAt: string;
  lastActive: string;
  performanceScore: number;
  instances: number;
}

export default function AgentLibrary() {
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');

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

  const { data: agents = [], isLoading: agentsLoading } = useQuery<Agent[]>({
    queryKey: ['/api/agents'],
    enabled: isAuthenticated,
  });

  const downloadAgentMutation = useMutation({
    mutationFn: async (agentId: number) => {
      const response = await apiRequest(
        'GET',
        `/api/agents/${agentId}/download`,
      );
      return response;
    },
    onSuccess: (data, agentId) => {
      const agent = agents.find((a) => a.id === agentId);
      toast({
        title: 'Download Started',
        description: `${agent?.name} agent package is being prepared`,
      });

      // Simulate download process
      setTimeout(() => {
        toast({
          title: 'Download Complete',
          description: `${agent?.name} agent ready for deployment`,
        });
      }, 2000);
    },
    onError: () => {
      toast({
        title: 'Download Failed',
        description: 'Failed to download agent package',
        variant: 'destructive',
      });
    },
  });

  const toggleAgentMutation = useMutation({
    mutationFn: async ({
      agentId,
      action,
    }: {
      agentId: number;
      action: 'start' | 'stop' | 'pause';
    }) => {
      await apiRequest('POST', `/api/agents/${agentId}/${action}`, {});
    },
    onSuccess: (_, { agentId, action }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/agents'] });
      const agent = agents.find((a) => a.id === agentId);
      toast({
        title: 'Agent Updated',
        description: `${agent?.name} has been ${action}ped`,
      });
    },
    onError: () => {
      toast({
        title: 'Action Failed',
        description: 'Failed to update agent status',
        variant: 'destructive',
      });
    },
  });

  const handleDownloadAgent = (agent: Agent) => {
    downloadAgentMutation.mutate(agent.id);
  };

  const handleToggleAgent = (
    agent: Agent,
    action: 'start' | 'stop' | 'pause',
  ) => {
    toggleAgentMutation.mutate({ agentId: agent.id, action });
  };

  const filteredAgents = agents.filter(
    (agent) =>
      agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agent.type.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getAgentIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'social media':
        return Bot;
      case 'email marketing':
        return Zap;
      case 'security':
        return Shield;
      case 'analytics':
        return Brain;
      default:
        return Bot;
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-300">
              Loading agent library...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title="Agent Library"
          description="Access, manage, and download your AI agents"
        />

        <main className="flex-1 overflow-auto p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Search and Controls */}
            <div className="flex items-center justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search agents..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Button variant="outline">
                  <Settings className="w-4 h-4 mr-2" />
                  Manage
                </Button>
              </div>
            </div>

            <Tabs defaultValue="all" className="space-y-6">
              <TabsList>
                <TabsTrigger value="all">
                  All Agents ({agents.length})
                </TabsTrigger>
                <TabsTrigger value="active">
                  Active ({agents.filter((a) => a.status === 'active').length})
                </TabsTrigger>
                <TabsTrigger value="inactive">
                  Inactive (
                  {agents.filter((a) => a.status === 'inactive').length})
                </TabsTrigger>
                <TabsTrigger value="paused">
                  Paused ({agents.filter((a) => a.status === 'paused').length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="space-y-4">
                {agentsLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[...Array(6)].map((_, i) => (
                      <Card key={i} className="animate-pulse">
                        <CardContent className="p-6">
                          <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
                          <div className="h-3 bg-gray-300 rounded w-1/2 mb-4"></div>
                          <div className="h-20 bg-gray-300 rounded mb-4"></div>
                          <div className="flex space-x-2">
                            <div className="h-8 bg-gray-300 rounded w-16"></div>
                            <div className="h-8 bg-gray-300 rounded w-16"></div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : filteredAgents.length === 0 ? (
                  <div className="text-center py-12">
                    <Bot className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">
                      No Agents Found
                    </h3>
                    <p className="text-gray-500">
                      {searchTerm
                        ? 'Try adjusting your search terms'
                        : 'Create your first agent to get started'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredAgents.map((agent) => {
                      const IconComponent = getAgentIcon(agent.type);
                      return (
                        <Card
                          key={agent.id}
                          className="hover:shadow-md transition-shadow"
                        >
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                                  <IconComponent className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                  <CardTitle className="text-lg">
                                    {agent.name}
                                  </CardTitle>
                                  <p className="text-sm text-gray-500">
                                    {agent.type}
                                  </p>
                                </div>
                              </div>
                              <Badge className={getStatusColor(agent.status)}>
                                {agent.status}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              {agent.description}
                            </p>

                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span>Performance</span>
                                <span className="font-medium">
                                  {agent.performanceScore}%
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-primary h-2 rounded-full"
                                  style={{
                                    width: `${agent.performanceScore}%`,
                                  }}
                                ></div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-sm text-gray-500">
                              <span>{agent.instances} instances</span>
                              <span>
                                Updated{' '}
                                {new Date(
                                  agent.lastActive,
                                ).toLocaleDateString()}
                              </span>
                            </div>

                            <div className="flex items-center space-x-2 pt-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDownloadAgent(agent)}
                                disabled={downloadAgentMutation.isPending}
                              >
                                <Download className="w-4 h-4 mr-1" />
                                Download
                              </Button>

                              {agent.status === 'active' ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    handleToggleAgent(agent, 'pause')
                                  }
                                  disabled={toggleAgentMutation.isPending}
                                >
                                  <Pause className="w-4 h-4 mr-1" />
                                  Pause
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    handleToggleAgent(agent, 'start')
                                  }
                                  disabled={toggleAgentMutation.isPending}
                                >
                                  <Play className="w-4 h-4 mr-1" />
                                  Start
                                </Button>
                              )}

                              <Button size="sm" variant="outline">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              {/* Similar content for other tabs with filtered data */}
              <TabsContent value="active">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredAgents
                    .filter((agent) => agent.status === 'active')
                    .map((agent) => {
                      const IconComponent = getAgentIcon(agent.type);
                      return (
                        <Card
                          key={agent.id}
                          className="hover:shadow-md transition-shadow"
                        >
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                                  <IconComponent className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                  <CardTitle className="text-lg">
                                    {agent.name}
                                  </CardTitle>
                                  <p className="text-sm text-gray-500">
                                    {agent.type}
                                  </p>
                                </div>
                              </div>
                              <Badge className={getStatusColor(agent.status)}>
                                {agent.status}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              {agent.description}
                            </p>
                            <div className="flex items-center space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDownloadAgent(agent)}
                              >
                                <Download className="w-4 h-4 mr-1" />
                                Download
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  handleToggleAgent(agent, 'pause')
                                }
                              >
                                <Pause className="w-4 h-4 mr-1" />
                                Pause
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                </div>
              </TabsContent>

              <TabsContent value="inactive">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredAgents
                    .filter((agent) => agent.status === 'inactive')
                    .map((agent) => {
                      const IconComponent = getAgentIcon(agent.type);
                      return (
                        <Card
                          key={agent.id}
                          className="hover:shadow-md transition-shadow"
                        >
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                                  <IconComponent className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                  <CardTitle className="text-lg">
                                    {agent.name}
                                  </CardTitle>
                                  <p className="text-sm text-gray-500">
                                    {agent.type}
                                  </p>
                                </div>
                              </div>
                              <Badge className={getStatusColor(agent.status)}>
                                {agent.status}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              {agent.description}
                            </p>
                            <div className="flex items-center space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDownloadAgent(agent)}
                              >
                                <Download className="w-4 h-4 mr-1" />
                                Download
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  handleToggleAgent(agent, 'start')
                                }
                              >
                                <Play className="w-4 h-4 mr-1" />
                                Start
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                </div>
              </TabsContent>

              <TabsContent value="paused">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredAgents
                    .filter((agent) => agent.status === 'paused')
                    .map((agent) => {
                      const IconComponent = getAgentIcon(agent.type);
                      return (
                        <Card
                          key={agent.id}
                          className="hover:shadow-md transition-shadow"
                        >
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                                  <IconComponent className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                  <CardTitle className="text-lg">
                                    {agent.name}
                                  </CardTitle>
                                  <p className="text-sm text-gray-500">
                                    {agent.type}
                                  </p>
                                </div>
                              </div>
                              <Badge className={getStatusColor(agent.status)}>
                                {agent.status}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              {agent.description}
                            </p>
                            <div className="flex items-center space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDownloadAgent(agent)}
                              >
                                <Download className="w-4 h-4 mr-1" />
                                Download
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  handleToggleAgent(agent, 'start')
                                }
                              >
                                <Play className="w-4 h-4 mr-1" />
                                Resume
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}
