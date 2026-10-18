import { AgentType } from '@/types/agent';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Share2,
  Mail,
  BarChart3,
  Folder,
  Globe,
  Eye,
  Bot,
  Brain,
} from 'lucide-react';

interface AgentTypeCardProps {
  agentType: AgentType;
  instanceCount?: number;
  status?: 'active' | 'setup' | 'inactive';
  onClick?: () => void;
  onTestMultimodal?: () => void;
}

function getAgentIcon(category: string) {
  switch (category) {
    case 'social_media':
      return { icon: Share2, color: 'bg-purple-100 text-purple-600' };
    case 'email_marketing':
      return { icon: Mail, color: 'bg-blue-100 text-blue-600' };
    case 'analytics':
      return { icon: BarChart3, color: 'bg-green-100 text-green-600' };
    case 'file_system':
      return { icon: Folder, color: 'bg-orange-100 text-orange-600' };
    case 'dns':
      return { icon: Globe, color: 'bg-indigo-100 text-indigo-600' };
    case 'monitoring':
      return { icon: Eye, color: 'bg-pink-100 text-pink-600' };
    default:
      return { icon: Bot, color: 'bg-gray-100 text-gray-600' };
  }
}

export default function AgentTypeCard({
  agentType,
  instanceCount = 0,
  status = 'inactive',
  onClick,
  onTestMultimodal,
}: AgentTypeCardProps) {
  const { icon: Icon, color } = getAgentIcon(agentType.category);

  const statusConfig = {
    active: { label: 'Active', color: 'bg-success/10 text-success' },
    setup: { label: 'Setup', color: 'bg-warning/10 text-warning' },
    inactive: { label: 'Inactive', color: 'bg-gray-100 text-gray-600' },
  };

  return (
    <Card
      className="cursor-pointer hover:border-primary transition-colors"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center space-x-3">
          <div
            className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center',
              color,
            )}
          >
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h4 className="font-medium text-gray-900 dark:text-white">
              {agentType.name}
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {agentType.description}
            </p>
          </div>
          <div className="text-right space-y-2">
            <Badge
              variant="secondary"
              className={cn('text-xs', statusConfig[status].color)}
            >
              {statusConfig[status].label}
            </Badge>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {instanceCount} instance{instanceCount !== 1 ? 's' : ''}
            </div>
            {status === 'active' && onTestMultimodal && (
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  onTestMultimodal();
                }}
                className="text-xs py-1 px-2 h-auto"
              >
                <Brain className="w-3 h-3 mr-1" />
                Test AI
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
