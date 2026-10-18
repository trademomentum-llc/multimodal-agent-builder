import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import Sidebar from '@/components/Layout/Sidebar';
import Header from '@/components/Layout/Header';
import ApprovalCard from '@/components/Approvals/ApprovalCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Approval } from '@/types/task';
import { apiRequest } from '@/lib/queryClient';
import { isUnauthorizedError } from '@/lib/authUtils';
import { RefreshCw, CheckCheck } from 'lucide-react';

type ApprovalStatus = 'all' | 'pending' | 'approved' | 'rejected';

export default function Approvals() {
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<ApprovalStatus>('pending');

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
    data: approvals,
    isLoading: approvalsLoading,
    error: approvalsError,
  } = useQuery<Approval[]>({
    queryKey: ['/api/approvals'],
    enabled: isAuthenticated,
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const approveMutation = useMutation({
    mutationFn: async (approvalId: number) => {
      await apiRequest('POST', `/api/approvals/${approvalId}/approve`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/approvals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      toast({
        title: 'Approved',
        description: 'Request has been approved successfully',
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
        title: 'Error',
        description: error.message || 'Failed to approve request',
        variant: 'destructive',
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (approvalId: number) => {
      await apiRequest('POST', `/api/approvals/${approvalId}/reject`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/approvals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      toast({
        title: 'Rejected',
        description: 'Request has been rejected',
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
        title: 'Error',
        description: error.message || 'Failed to reject request',
        variant: 'destructive',
      });
    },
  });

  const handleApprove = (approvalId: number) => {
    approveMutation.mutate(approvalId);
  };

  const handleReject = (approvalId: number) => {
    rejectMutation.mutate(approvalId);
  };

  const handleView = (approval: Approval) => {
    toast({
      title: 'Approval Details',
      description: `Viewing details for: ${approval.title}`,
    });
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/approvals'] });
  };

  const handleBulkApprove = () => {
    const pendingApprovals = filteredApprovals.filter(
      (approval) => approval.status === 'pending',
    );

    if (pendingApprovals.length === 0) {
      toast({
        title: 'No Pending Approvals',
        description: 'There are no pending approvals to process',
        variant: 'destructive',
      });
      return;
    }

    // For demo purposes, approve the first one
    if (pendingApprovals.length > 0) {
      handleApprove(pendingApprovals[0].id);
    }
  };

  const filteredApprovals =
    approvals?.filter(
      (approval) => activeTab === 'all' || approval.status === activeTab,
    ) || [];

  const getApprovalCountByStatus = (status: ApprovalStatus) => {
    if (status === 'all') return approvals?.length || 0;
    return (
      approvals?.filter((approval) => approval.status === status).length || 0
    );
  };

  if (isLoading) {
    return (
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-300">
              Loading approvals...
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
          title="Approval Center"
          description="Review and approve agent actions and automated workflows"
        />

        <main className="flex-1 overflow-auto p-8">
          <div className="max-w-7xl mx-auto">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Approval Requests
                  </h3>
                  <div className="flex items-center space-x-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRefresh}
                      disabled={approvalsLoading}
                    >
                      <RefreshCw
                        className={`w-4 h-4 mr-2 ${approvalsLoading ? 'animate-spin' : ''}`}
                      />
                      Refresh
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleBulkApprove}
                      className="bg-success hover:bg-success/90 text-white"
                      disabled={getApprovalCountByStatus('pending') === 0}
                    >
                      <CheckCheck className="w-4 h-4 mr-2" />
                      Bulk Approve
                    </Button>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <Tabs
                  value={activeTab}
                  onValueChange={(value) =>
                    setActiveTab(value as ApprovalStatus)
                  }
                >
                  <TabsList className="grid w-full grid-cols-4 gap-1 p-1">
                    <TabsTrigger
                      value="pending"
                      className="relative flex flex-col items-center justify-center min-h-[3rem] px-2"
                    >
                      <span className="text-xs font-medium">Pending</span>
                      <span className="bg-warning/10 text-warning text-xs px-1.5 py-0.5 rounded-full mt-1">
                        {getApprovalCountByStatus('pending')}
                      </span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="approved"
                      className="relative flex flex-col items-center justify-center min-h-[3rem] px-2"
                    >
                      <span className="text-xs font-medium">Approved</span>
                      <span className="bg-success/10 text-success text-xs px-1.5 py-0.5 rounded-full mt-1">
                        {getApprovalCountByStatus('approved')}
                      </span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="rejected"
                      className="relative flex flex-col items-center justify-center min-h-[3rem] px-2"
                    >
                      <span className="text-xs font-medium">Rejected</span>
                      <span className="bg-error/10 text-error text-xs px-1.5 py-0.5 rounded-full mt-1">
                        {getApprovalCountByStatus('rejected')}
                      </span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="all"
                      className="relative flex flex-col items-center justify-center min-h-[3rem] px-2"
                    >
                      <span className="text-xs font-medium">All</span>
                      <span className="bg-gray-100 dark:bg-gray-700 text-xs px-1.5 py-0.5 rounded-full mt-1">
                        {getApprovalCountByStatus('all')}
                      </span>
                    </TabsTrigger>
                  </TabsList>

                  <div className="mt-6">
                    <TabsContent value={activeTab} className="mt-0">
                      {approvalsLoading ? (
                        <div className="space-y-4">
                          {[...Array(3)].map((_, i) => (
                            <Card key={i}>
                              <CardContent className="p-6">
                                <div className="flex items-start justify-between">
                                  <div className="flex items-center space-x-3 mb-4">
                                    <Skeleton className="w-8 h-8 rounded-lg" />
                                    <div className="space-y-2">
                                      <Skeleton className="h-5 w-48" />
                                      <Skeleton className="h-4 w-16" />
                                    </div>
                                  </div>
                                  <div className="flex space-x-2">
                                    <Skeleton className="h-8 w-20" />
                                    <Skeleton className="h-8 w-20" />
                                  </div>
                                </div>
                                <Skeleton className="h-4 w-full mb-2" />
                                <Skeleton className="h-12 w-full" />
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      ) : approvalsError ? (
                        <div className="text-center py-8">
                          <p className="text-error mb-4">
                            Failed to load approval requests
                          </p>
                          <Button variant="outline" onClick={handleRefresh}>
                            Retry
                          </Button>
                        </div>
                      ) : filteredApprovals.length === 0 ? (
                        <div className="text-center py-12">
                          <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCheck className="w-8 h-8 text-success" />
                          </div>
                          <p className="text-gray-500 dark:text-gray-400 text-lg mb-2">
                            {activeTab === 'pending'
                              ? 'No pending approvals'
                              : `No ${activeTab === 'all' ? '' : activeTab} approvals found`}
                          </p>
                          <p className="text-sm text-gray-400 dark:text-gray-500">
                            {activeTab === 'pending'
                              ? 'All caught up! New requests will appear here'
                              : 'Approval requests will appear here as agents need authorization'}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {filteredApprovals.map((approval) => (
                            <ApprovalCard
                              key={approval.id}
                              approval={approval}
                              onApprove={handleApprove}
                              onReject={handleReject}
                              onView={handleView}
                            />
                          ))}
                        </div>
                      )}
                    </TabsContent>
                  </div>
                </Tabs>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
