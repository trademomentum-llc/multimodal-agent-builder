import { useQuery } from '@tanstack/react-query';

interface DashboardStats {
  activeAgents?: number;
  tasksProcessed?: number;
  pendingApprovals?: number;
  systemUptime?: number;
}
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Bot, CheckCircle, Clock, Server, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCard {
  title: string;
  value: string | number;
  change: string;
  changeType: 'positive' | 'negative' | 'neutral';
  icon: typeof Bot;
  color: string;
}

export default function StatsGrid() {
  const {
    data: stats,
    isLoading,
    error,
  } = useQuery<DashboardStats>({
    queryKey: ['/api/dashboard/stats'],
    refetchInterval: 300000, // Refresh every 5 minutes to reduce API calls
    refetchOnWindowFocus: false, // Prevent refetch on window focus
    refetchOnMount: true,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="h-12 w-12 rounded-lg" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="col-span-full">
          <CardContent className="p-6 text-center">
            <p className="text-error">Failed to load dashboard statistics</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statCards: StatCard[] = [
    {
      title: 'Active Agents',
      value: stats?.activeAgents || 0,
      change: '12% from last month',
      changeType: 'positive',
      icon: Bot,
      color: 'bg-primary/10 text-primary',
    },
    {
      title: 'Tasks Processed',
      value: stats?.tasksProcessed || 0,
      change: '8% from last week',
      changeType: 'positive',
      icon: CheckCircle,
      color: 'bg-success/10 text-success',
    },
    {
      title: 'Pending Approvals',
      value: stats?.pendingApprovals || 0,
      change: 'Needs attention',
      changeType: 'neutral',
      icon: Clock,
      color: 'bg-warning/10 text-warning',
    },
    {
      title: 'System Uptime',
      value: `${stats?.systemUptime || 99.9}%`,
      change: 'All systems operational',
      changeType: 'positive',
      icon: Server,
      color: 'bg-secure/10 text-secure',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {statCards.map((card) => (
        <Card key={card.title} className="relative overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 dark:text-gray-300 text-sm font-medium">
                  {card.title}
                </p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                  {typeof card.value === 'number'
                    ? card.value.toLocaleString()
                    : card.value}
                </p>
                <p
                  className={cn(
                    'text-sm mt-1 flex items-center',
                    card.changeType === 'positive'
                      ? 'text-success'
                      : card.changeType === 'negative'
                        ? 'text-error'
                        : 'text-warning',
                  )}
                >
                  {card.changeType === 'positive' && (
                    <TrendingUp className="w-3 h-3 mr-1" />
                  )}
                  {card.changeType === 'negative' && (
                    <TrendingUp className="w-3 h-3 mr-1 rotate-180" />
                  )}
                  {card.changeType === 'neutral' && (
                    <Clock className="w-3 h-3 mr-1" />
                  )}
                  <span>{card.change}</span>
                </p>
              </div>
              <div
                className={cn(
                  'w-12 h-12 rounded-lg flex items-center justify-center',
                  card.color,
                )}
              >
                <card.icon className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
