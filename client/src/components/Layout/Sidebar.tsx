import { Link, useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { useWebSocket } from '@/hooks/useWebSocket';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import {
  Bot,
  Gauge,
  ServerCog,
  Library,
  ListTodo,
  CheckCheck,
  BarChart3,
  Shield,
  Crown,
  Menu,
  X,
  Settings,
  User,
  Zap,
  ChevronLeft,
  ChevronRight,
  Users,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: Gauge },
  { name: 'Agent Factory', href: '/agents', icon: ServerCog },
  { name: 'Agent Library', href: '/library', icon: Library },
  { name: 'Council Chat', href: '/council', icon: Users },
  { name: 'National Reserve', href: '/national-reserve', icon: Crown },
  { name: 'Data Flywheel', href: '/data-flywheel', icon: Zap },
  { name: 'Task Queue', href: '/tasks', icon: ListTodo },
  { name: 'Approvals', href: '/approvals', icon: CheckCheck },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Security', href: '/security', icon: Shield },
];

export default function Sidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const { connectionStatus } = useWebSocket();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Handle collapse animation
  const handleCollapseToggle = () => {
    setIsTransitioning(true);
    setIsCollapsed(!isCollapsed);

    // Reset transition state after animation completes
    setTimeout(() => {
      setIsTransitioning(false);
    }, 300);
  };

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location]);

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-primary text-white rounded-md shadow-lg"
      >
        {isMobileOpen ? (
          <X className="w-5 h-5" />
        ) : (
          <Menu className="w-5 h-5" />
        )}
      </button>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          'bg-white dark:bg-gray-800 shadow-lg border-r border-gray-200 dark:border-gray-700 flex flex-col z-40',
          // Smooth transitions for all states
          'transition-all duration-300 ease-in-out',
          // Mobile styles
          'fixed lg:relative h-full',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          // Desktop styles with smooth width transition
          isCollapsed ? 'lg:w-16' : 'lg:w-64',
          // Mobile always full width when open
          'w-64',
          // Add subtle hover effect on desktop
          'lg:hover:shadow-xl lg:transition-shadow',
        )}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 min-w-0">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center flex-shrink-0 transition-transform duration-300 hover:scale-110">
                <Bot className="text-white text-lg" />
              </div>
              <div
                className={cn(
                  'transition-all duration-300 ease-in-out min-w-0',
                  isCollapsed
                    ? 'opacity-0 w-0 overflow-hidden'
                    : 'opacity-100 w-auto',
                )}
              >
                <h1 className="text-xl font-bold text-gray-900 dark:text-white whitespace-nowrap">
                  Agent Factory
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  Neurodivergence Framework
                </p>
              </div>
            </div>
            {/* Desktop collapse button with icon animation */}
            <button
              onClick={handleCollapseToggle}
              disabled={isTransitioning}
              className={cn(
                'hidden lg:flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200',
                'hover:bg-gray-100 dark:hover:bg-gray-700 hover:scale-105',
                'focus:outline-none focus:ring-2 focus:ring-primary/20',
                isTransitioning && 'pointer-events-none',
              )}
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <div
                className={cn(
                  'transition-transform duration-300',
                  isCollapsed ? 'rotate-180' : 'rotate-0',
                )}
              >
                {isCollapsed ? (
                  <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                ) : (
                  <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                )}
              </div>
            </button>
          </div>
        </div>

        {/* Navigation - Scrollable */}
        <div className="flex-1 overflow-y-auto">
          <nav className="p-4 space-y-2">
            {navigation.map((item, index) => {
              const isActive = location === item.href;
              return (
                <Link key={item.name} href={item.href}>
                  {(props: any) => (
                    <a
                      {...props}
                      className={cn(
                        'group flex items-center px-4 py-3 text-gray-600 dark:text-gray-300 rounded-lg relative overflow-hidden sidebar-item-hover',
                        'transition-all duration-200 ease-in-out',
                        isCollapsed ? 'justify-center' : 'space-x-3',
                        isActive
                          ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-primary text-gray-700 dark:text-white font-medium shadow-sm animate-fade-in-scale'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700',
                      )}
                      title={isCollapsed ? item.name : undefined}
                      onClick={() => setIsMobileOpen(false)}
                      style={{
                        animationDelay: `${index * 50}ms`,
                      }}
                    >
                      {/* Icon with subtle animations */}
                      <item.icon
                        className={cn(
                          'w-5 h-5 flex-shrink-0 transition-all duration-200',
                          isActive ? 'text-primary' : 'group-hover:scale-110',
                          isCollapsed && 'mx-auto',
                        )}
                      />

                      {/* Text content with slide animation */}
                      <div
                        className={cn(
                          'flex items-center justify-between w-full min-w-0 transition-all duration-300 ease-in-out',
                          isCollapsed
                            ? 'opacity-0 w-0 overflow-hidden translate-x-4'
                            : 'opacity-100 w-auto translate-x-0',
                        )}
                      >
                        <span className="truncate">{item.name}</span>

                        {/* Badges and indicators */}
                        <div className="flex items-center space-x-2 ml-auto">
                          {item.name === 'Task Queue' && (
                            <span className="bg-warning text-white text-xs px-2 py-1 rounded-full animate-pulse">
                              12
                            </span>
                          )}
                          {item.name === 'Approvals' && (
                            <span className="bg-error text-white text-xs px-2 py-1 rounded-full animate-bounce">
                              5
                            </span>
                          )}
                          {item.name === 'Security' && (
                            <div
                              className={cn(
                                'w-2 h-2 rounded-full transition-colors duration-300',
                                connectionStatus === 'connected'
                                  ? 'bg-secure animate-pulse'
                                  : 'bg-error',
                              )}
                            />
                          )}
                        </div>
                      </div>

                      {/* Hover indicator */}
                      <div
                        className={cn(
                          'absolute inset-y-0 left-0 w-1 bg-primary transition-all duration-300',
                          isActive
                            ? 'opacity-100'
                            : 'opacity-0 group-hover:opacity-50',
                        )}
                      />
                    </a>
                  )}
                </Link>
              );
            })}

            <Link href="/settings">
              {(props: any) => (
                <a
                  {...props}
                  className={cn(
                    'group flex items-center px-4 py-3 text-gray-600 dark:text-gray-300 rounded-lg relative overflow-hidden',
                    'transition-all duration-200 ease-in-out hover:bg-gray-50 dark:hover:bg-gray-700 hover:translate-x-1 hover:shadow-md',
                    isCollapsed ? 'justify-center' : 'space-x-3',
                  )}
                  title={isCollapsed ? 'Settings' : undefined}
                  onClick={() => setIsMobileOpen(false)}
                >
                  <Settings
                    className={cn(
                      'w-5 h-5 flex-shrink-0 transition-all duration-200 group-hover:scale-110 group-hover:rotate-45',
                      isCollapsed && 'mx-auto',
                    )}
                  />
                  <span
                    className={cn(
                      'transition-all duration-300 ease-in-out',
                      isCollapsed
                        ? 'opacity-0 w-0 overflow-hidden translate-x-4'
                        : 'opacity-100 w-auto translate-x-0',
                    )}
                  >
                    Settings
                  </span>

                  {/* Hover indicator */}
                  <div className="absolute inset-y-0 left-0 w-1 bg-primary transition-all duration-300 opacity-0 group-hover:opacity-50" />
                </a>
              )}
            </Link>
          </nav>
        </div>

        {/* User Profile - Animated */}
        <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
          <div
            className={cn(
              'p-4 transition-all duration-300 ease-in-out',
              isCollapsed ? 'px-2' : 'px-4',
            )}
          >
            <div
              className={cn(
                'flex items-center transition-all duration-300 ease-in-out',
                isCollapsed ? 'justify-center' : 'space-x-3',
              )}
            >
              {/* Avatar with hover animation */}
              <div
                className={cn(
                  'bg-primary rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110',
                  isCollapsed ? 'w-10 h-10' : 'w-8 h-8',
                )}
              >
                {(user as any)?.email ? (
                  <span
                    className={cn(
                      'font-medium text-white transition-all duration-300',
                      isCollapsed ? 'text-sm' : 'text-xs',
                    )}
                  >
                    {(user as any).email.charAt(0).toUpperCase()}
                  </span>
                ) : (
                  <User
                    className={cn(
                      'text-white transition-all duration-300',
                      isCollapsed ? 'w-5 h-5' : 'w-4 h-4',
                    )}
                  />
                )}
              </div>

              {/* User info with slide animation */}
              <div
                className={cn(
                  'flex-1 min-w-0 transition-all duration-300 ease-in-out',
                  isCollapsed
                    ? 'opacity-0 w-0 overflow-hidden translate-x-4'
                    : 'opacity-100 w-auto translate-x-0',
                )}
              >
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {(user as any)?.email || 'User'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  Admin • Online
                </p>
              </div>

              {/* Status indicator */}
              <div
                className={cn(
                  'rounded-full transition-all duration-300',
                  isCollapsed ? 'w-3 h-3' : 'w-2 h-2',
                  connectionStatus === 'connected'
                    ? 'bg-green-500 animate-pulse'
                    : 'bg-red-500',
                )}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
