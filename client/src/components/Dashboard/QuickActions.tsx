import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, Send, PieChart, Shield } from 'lucide-react';

interface QuickAction {
  name: string;
  icon: typeof Sparkles;
  color: string;
  action: string;
  description: string;
}

export default function QuickActions() {
  const { toast } = useToast();

  const quickActions: QuickAction[] = [
    {
      name: 'Generate Content',
      icon: Sparkles,
      color: 'bg-purple-100 text-purple-600',
      action: 'content-generation',
      description: 'Create social media content with AI',
    },
    {
      name: 'Launch Campaign',
      icon: Send,
      color: 'bg-blue-100 text-blue-600',
      action: 'email-campaign',
      description: 'Start a new email marketing campaign',
    },
    {
      name: 'View Analytics',
      icon: PieChart,
      color: 'bg-green-100 text-green-600',
      action: 'analytics-report',
      description: 'Generate performance reports',
    },
    {
      name: 'System Check',
      icon: Shield,
      color: 'bg-secure/10 text-secure',
      action: 'system-check',
      description: 'Run security diagnostics',
    },
  ];

  const handleQuickAction = async (action: string, name: string) => {
    try {
      switch (action) {
        case 'content-generation':
          window.location.href = '/agents';
          break;
        case 'email-campaign':
          window.location.href = '/agents';
          break;
        case 'analytics-report':
          window.location.href = '/analytics';
          break;
        case 'system-check':
          window.location.href = '/security';
          break;
        default:
          toast({
            title: 'Quick Action',
            description: `${name} workflow activated`,
          });
      }
    } catch {
      toast({
        title: 'Error',
        description: `Failed to activate ${name}`,
        variant: 'destructive',
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickActions.map((action) => (
            <Button
              key={action.action}
              variant="outline"
              className="flex flex-col items-center p-4 h-auto border hover:border-primary hover:bg-primary/5 transition-colors"
              onClick={() => handleQuickAction(action.action, action.name)}
            >
              <div
                className={`w-12 h-12 rounded-lg flex items-center justify-center mb-3 ${action.color}`}
              >
                <action.icon className="w-6 h-6" />
              </div>
              <span className="text-sm font-medium text-gray-900 dark:text-white text-center">
                {action.name}
              </span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
