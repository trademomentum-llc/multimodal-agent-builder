import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import Sidebar from '@/components/Layout/Sidebar';
import Header from '@/components/Layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart, TrendingUp, Download, Calendar } from 'lucide-react';

export default function Analytics() {
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();

  const handleExportData = async () => {
    try {
      toast({
        title: 'Export Started',
        description: 'Generating analytics export...',
      });

      // Simulate export process
      setTimeout(() => {
        toast({
          title: 'Export Complete',
          description: 'Analytics data has been exported successfully',
        });
      }, 2000);
    } catch {
      toast({
        title: 'Export Failed',
        description: 'Failed to export analytics data',
        variant: 'destructive',
      });
    }
  };

  const handleScheduleReport = async () => {
    try {
      toast({
        title: 'Report Scheduled',
        description: 'Weekly analytics report has been scheduled',
      });
    } catch {
      toast({
        title: 'Schedule Failed',
        description: 'Failed to schedule report',
        variant: 'destructive',
      });
    }
  };

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
              Loading analytics...
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
          title="Analytics & Reporting"
          description="Monitor performance metrics and generate business intelligence reports"
        />

        <main className="flex-1 overflow-auto p-8">
          <div className="max-w-7xl mx-auto space-y-8">
            {/* Quick Actions */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Analytics Dashboard
                </h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Button
                    variant="outline"
                    className="h-24 flex flex-col items-center justify-center hover:bg-primary/5 hover:border-primary transition-colors"
                    onClick={() =>
                      toast({
                        title: 'Intelligence Data',
                        description: 'Performance report generated',
                      })
                    }
                  >
                    <BarChart className="w-6 h-6 mb-2" />
                    <span className="text-sm">Intelligence Data</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-24 flex flex-col items-center justify-center hover:bg-primary/5 hover:border-primary transition-colors"
                    onClick={() =>
                      toast({
                        title: 'Trend Analysis',
                        description: 'Analyzing performance trends',
                      })
                    }
                  >
                    <TrendingUp className="w-6 h-6 mb-2" />
                    <span className="text-sm">Trend Analysis</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-24 flex flex-col items-center justify-center hover:bg-primary/5 hover:border-primary transition-colors"
                    onClick={handleExportData}
                  >
                    <Download className="w-6 h-6 mb-2" />
                    <span className="text-sm">Export Data</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-24 flex flex-col items-center justify-center hover:bg-primary/5 hover:border-primary transition-colors"
                    onClick={handleScheduleReport}
                  >
                    <Calendar className="w-6 h-6 mb-2" />
                    <span className="text-sm">Schedule Report</span>
                  </Button>
                </div>
              </div>
            </div>

            {/* Analytics Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card>
                <CardHeader>
                  <CardTitle>Agent Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12">
                    <BarChart className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">
                      Analytics charts and metrics will be displayed here
                    </p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                      Connect your data sources to see detailed analytics
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Task Completion Trends</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12">
                    <TrendingUp className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">
                      Task completion trends will be shown here
                    </p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                      Historical data and predictive analytics
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>System Usage</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12">
                    <BarChart className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">
                      System usage metrics and resource utilization
                    </p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                      Monitor system performance and capacity
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Business Intelligence</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12">
                    <TrendingUp className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">
                      Business insights and recommendations
                    </p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                      AI-powered business intelligence reports
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Reports */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Recent Reports</CardTitle>
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    Generate Report
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <p className="text-gray-500 dark:text-gray-400">
                    No reports generated yet
                  </p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                    Generated reports will appear here for download and review
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
