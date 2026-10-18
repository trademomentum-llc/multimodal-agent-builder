import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import Sidebar from '@/components/Layout/Sidebar';
import Header from '@/components/Layout/Header';
import StatsGrid from '@/components/Dashboard/StatsGrid';
import ActivityFeed from '@/components/Dashboard/ActivityFeed';
import SecurityStatus from '@/components/Dashboard/SecurityStatus';
import QuickActions from '@/components/Dashboard/QuickActions';

export default function Dashboard() {
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();

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

  if (isLoading) {
    return (
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-300">
              Loading dashboard...
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
          title="Dashboard Overview"
          description="Manage your AI agents and monitor system performance"
        />

        <main className="flex-1 overflow-auto p-4 lg:p-8 w-full max-w-full">
          <StatsGrid />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
            <div className="lg:col-span-2">
              {/* Agent Factory Preview - This could be its own component */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-8">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Agent Factory
                    </h3>
                    <button className="text-primary hover:text-blue-700 text-sm font-medium">
                      View All
                    </button>
                  </div>
                </div>

                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-primary transition-colors cursor-pointer">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
                          <i className="fas fa-share-alt text-purple-600 dark:text-purple-400"></i>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            Social Media Agent
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-300">
                            Content generation & scheduling
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-xs bg-success/10 text-success px-2 py-1 rounded-full">
                            Active
                          </span>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            3 instances
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-primary transition-colors cursor-pointer">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                          <i className="fas fa-envelope text-blue-600 dark:text-blue-400"></i>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            Email Marketing Agent
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-300">
                            Campaign setup & management
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-xs bg-success/10 text-success px-2 py-1 rounded-full">
                            Active
                          </span>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            5 instances
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <ActivityFeed />
              <SecurityStatus />
            </div>
          </div>

          <QuickActions />
        </main>
      </div>
    </div>
  );
}
