import { Approval } from '@/types/task';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { Check, X, Clock, AlertCircle, Eye } from 'lucide-react';

interface ApprovalCardProps {
  approval: Approval;
  onApprove?: (approvalId: number) => void;
  onReject?: (approvalId: number) => void;
  onView?: (approval: Approval) => void;
}

function getStatusConfig(status: string) {
  switch (status) {
    case 'pending':
      return {
        icon: Clock,
        color: 'bg-warning/10 text-warning',
        label: 'Pending Review',
      };
    case 'approved':
      return {
        icon: Check,
        color: 'bg-success/10 text-success',
        label: 'Approved',
      };
    case 'rejected':
      return {
        icon: X,
        color: 'bg-error/10 text-error',
        label: 'Rejected',
      };
    default:
      return {
        icon: AlertCircle,
        color: 'bg-gray-100 text-gray-600',
        label: status,
      };
  }
}

function getApprovalTypeIcon() {
  // Single icon for now; extend with a per-type mapping when types diverge
  return AlertCircle; // Default icon
}

export default function ApprovalCard({
  approval,
  onApprove,
  onReject,
  onView,
}: ApprovalCardProps) {
  const statusConfig = getStatusConfig(approval.status);
  const StatusIcon = statusConfig.icon;
  const TypeIcon = getApprovalTypeIcon();

  const isPending = approval.status === 'pending';
  const isCompleted =
    approval.status === 'approved' || approval.status === 'rejected';

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                <TypeIcon className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {approval.title}
                </h3>
                <Badge className={cn('text-xs', statusConfig.color)}>
                  <StatusIcon className="w-3 h-3 mr-1" />
                  {statusConfig.label}
                </Badge>
              </div>
            </div>

            {approval.description && (
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                {approval.description}
              </p>
            )}

            {approval.suggestedResponse && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-3">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                  Suggested Response:
                </p>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  {approval.suggestedResponse}
                </p>
              </div>
            )}

            <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
              <span>Type: {approval.type}</span>
              {approval.createdAt && (
                <span>
                  Requested{' '}
                  {formatDistanceToNow(new Date(approval.createdAt), {
                    addSuffix: true,
                  })}
                </span>
              )}
              {isCompleted && approval.reviewedAt && (
                <span>
                  Reviewed{' '}
                  {formatDistanceToNow(new Date(approval.reviewedAt), {
                    addSuffix: true,
                  })}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2 ml-4">
            {onView && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onView(approval)}
              >
                <Eye className="w-4 h-4 mr-1" />
                View
              </Button>
            )}

            {isPending && onApprove && (
              <Button
                size="sm"
                className="bg-success hover:bg-success/90 text-white"
                onClick={() => onApprove(approval.id)}
              >
                <Check className="w-4 h-4 mr-1" />
                Approve
              </Button>
            )}

            {isPending && onReject && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => onReject(approval.id)}
              >
                <X className="w-4 h-4 mr-1" />
                Reject
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
