import { Switch, Route } from 'wouter';
import { queryClient } from './lib/queryClient';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useAuth } from '@/hooks/useAuth';
import Dashboard from '@/pages/Dashboard';
import Landing from '@/pages/Landing';
import AgentFactory from '@/pages/AgentFactory';
import AgentLibrary from '@/pages/AgentLibrary';
import TaskQueue from '@/pages/TaskQueue';
import Approvals from '@/pages/Approvals';
import Analytics from '@/pages/Analytics';
import Security from '@/pages/Security';
import Settings from '@/pages/Settings';
import NationalReserve from '@/pages/NationalReserve';
import DataFlywheel from '@/pages/DataFlywheel';
import CouncilChat from '@/pages/CouncilChat';
import NotFound from '@/pages/not-found';

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      {isLoading || !isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <>
          <Route path="/" component={Dashboard} />
          <Route path="/agents" component={AgentFactory} />
          <Route path="/library" component={AgentLibrary} />
          <Route path="/tasks" component={TaskQueue} />
          <Route path="/approvals" component={Approvals} />
          <Route path="/analytics" component={Analytics} />
          <Route path="/security" component={Security} />
          <Route path="/settings" component={Settings} />
          <Route path="/national-reserve" component={NationalReserve} />
          <Route path="/data-flywheel" component={DataFlywheel} />
          <Route path="/council" component={CouncilChat} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
