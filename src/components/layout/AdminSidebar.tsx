import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Bus,
  Users,
  UserCircle,
  Route,
  MapPin,
  Calendar,
  Radio,
  MessageSquareWarning,
  Megaphone,
  Warehouse,
  BarChart3,
  X,
  Menu,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Buses', href: '/buses', icon: Bus },
  { name: 'Drivers', href: '/drivers', icon: Users },
  { name: 'Passengers', href: '/passengers', icon: UserCircle },
  { name: 'Routes', href: '/routes', icon: Route },
  { name: 'Stops', href: '/stops', icon: MapPin },
  { name: 'Schedules', href: '/schedules', icon: Calendar },
  { name: 'Live Monitoring', href: '/live', icon: Radio },
  { name: 'Complaints', href: '/complaints', icon: MessageSquareWarning },
  { name: 'Announcements', href: '/announcements', icon: Megaphone },
  { name: 'Depots', href: '/depots', icon: Warehouse },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
];

interface AdminSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function AdminSidebar({ isOpen = true, onClose }: AdminSidebarProps) {
  const location = useLocation();

  const handleNavClick = () => {
    if (onClose && window.innerWidth < 1024) {
      onClose();
    }
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed left-0 top-0 z-50 h-screen w-64 bg-sidebar border-r border-sidebar-border transform transition-transform duration-300 ease-in-out',
          'lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4 lg:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#005BAC]">
                <Bus className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-sidebar-foreground">
                  KMT Admin
                </h1>
                <p className="text-xs text-sidebar-muted">Municipal Transport</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="lg:hidden p-2 rounded-lg text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <NavLink
                  key={item.name}
                  to={item.href}
                  onClick={handleNavClick}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                  )}
                >
                  <item.icon className={cn('h-5 w-5', isActive ? 'text-[#FFD100]' : 'text-sidebar-muted')} />
                  {item.name}
                </NavLink>
              );
            })}
          </nav>

          <div className="border-t border-sidebar-border p-4">
            <p className="text-xs text-sidebar-muted">KMT Bus Tracking System</p>
            <p className="text-xs text-sidebar-muted">v1.0.0</p>
          </div>
        </div>
      </aside>
    </>
  );
}

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="lg:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
      aria-label="Open menu"
    >
      <Menu className="h-6 w-6" />
    </button>
  );
}
