import { ReactNode, useState } from 'react';
import { AdminSidebar, MobileMenuButton } from './AdminSidebar';

interface AdminLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function AdminLayout({ children, title, subtitle, actions }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main content area */}
      <main className="lg:ml-64 min-h-screen transition-all duration-300">
        {/* Page Header */}
        <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-14 sm:h-16 items-center justify-between px-4 sm:px-6 gap-3">
            {/* Mobile menu button + Title */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <MobileMenuButton onClick={() => setSidebarOpen(true)} />
              <div className="min-w-0">
                <h1 className="font-heading text-lg sm:text-xl font-semibold text-foreground truncate">
                  {title}
                </h1>
                {subtitle && (
                  <p className="text-xs sm:text-sm text-muted-foreground truncate hidden sm:block">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>

            {/* Actions */}
            {actions && (
              <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                {actions}
              </div>
            )}
          </div>
        </header>

        {/* Page Content */}
        <div className="p-4 sm:p-6">{children}</div>
      </main>
    </div>
  );
}
