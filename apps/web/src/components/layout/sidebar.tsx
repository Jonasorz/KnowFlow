import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/app-store';
import { useSources } from '@/hooks/use-sources';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tooltip } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import {
  FileText,
  Star,
  BookOpen,
  Settings,
  PanelLeftClose,
  PanelLeft,
  Rss,
  MessageCircle,
} from 'lucide-react';
import { useNavigate, useMatchRoute } from '@tanstack/react-router';

function KnowFlowLogo({ collapsed }: { collapsed: boolean }) {
  return (
    <div className={cn('flex items-center gap-2.5 px-3 py-1', collapsed && 'justify-center px-0')}>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 shadow-sm">
        <Rss className="h-4 w-4 text-white" />
      </div>
      {!collapsed && (
        <span className="text-lg font-semibold tracking-tight bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
          KnowFlow
        </span>
      )}
    </div>
  );
}

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  collapsed?: boolean;
  badge?: number;
  onClick?: () => void;
}

function NavItem({ icon, label, active, collapsed, badge, onClick }: NavItemProps) {
  const content = (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
        'hover:bg-sidebar-active/60',
        active
          ? 'bg-sidebar-active text-sidebar-active-foreground'
          : 'text-sidebar-foreground hover:text-foreground',
        collapsed && 'justify-center px-2'
      )}
    >
      <span className="shrink-0">{icon}</span>
      {!collapsed && (
        <>
          <span className="flex-1 text-left">{label}</span>
          {badge !== undefined && badge > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums">{badge}</span>
          )}
        </>
      )}
    </button>
  );

  if (collapsed) {
    return <Tooltip content={label} side="right">{content}</Tooltip>;
  }

  return content;
}

export function Sidebar() {
  const navigate = useNavigate();
  const matchRoute = useMatchRoute();
  const {
    sidebarCollapsed,
    sidebarWidth,
    toggleSidebar,
    currentView,
    setCurrentView,
    selectedSourceId,
    setSelectedSourceId,
  } = useAppStore();
  const { data: sources } = useSources();

  const isHome = matchRoute({ to: '/' });
  const isSources = matchRoute({ to: '/sources' });
  const isSettings = matchRoute({ to: '/settings' });

  return (
    <aside
      className={cn(
        'flex h-screen flex-col border-r border-border bg-sidebar shrink-0',
        sidebarCollapsed && 'w-16 transition-all duration-300 ease-[var(--ease-spring)]'
      )}
      style={{
        width: sidebarCollapsed ? undefined : sidebarWidth,
      }}
    >
      {/* Logo */}
      <div className="flex h-14 items-center justify-between px-3">
        <KnowFlowLogo collapsed={sidebarCollapsed} />
      </div>

      <Separator />

      {/* Main Nav */}
      <ScrollArea className="flex-1 px-2 py-2">
        <nav className="flex flex-col gap-0.5">
          <NavItem
            icon={<FileText className="h-4 w-4" />}
            label="All Articles"
            active={!!isHome && currentView === 'all' && !selectedSourceId}
            collapsed={sidebarCollapsed}
            onClick={() => { setCurrentView('all'); setSelectedSourceId(null); navigate({ to: '/' }); }}
          />
          <NavItem
            icon={<Star className="h-4 w-4" />}
            label="Starred"
            active={!!isHome && currentView === 'starred'}
            collapsed={sidebarCollapsed}
            onClick={() => { setCurrentView('starred'); navigate({ to: '/' }); }}
          />
          <NavItem
            icon={<BookOpen className="h-4 w-4" />}
            label="Read"
            active={!!isHome && currentView === 'read'}
            collapsed={sidebarCollapsed}
            onClick={() => { setCurrentView('read'); navigate({ to: '/' }); }}
          />
        </nav>

        {/* Sources */}
        {!sidebarCollapsed && (
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between px-3">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Sources
              </span>
              <button
                onClick={() => navigate({ to: '/sources' })}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Manage
              </button>
            </div>
            <div className="flex flex-col gap-0.5">
              {sources?.map((source) => (
                <NavItem
                  key={source.id}
                  icon={
                    source.avatarUrl ? (
                      <img
                        src={source.avatarUrl}
                        alt={source.name}
                        className="h-5 w-5 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <MessageCircle className="h-3 w-3" />
                      </div>
                    )
                  }
                  label={source.name}
                  active={selectedSourceId === source.id}
                  collapsed={sidebarCollapsed}
                  badge={source.articleCount}
                  onClick={() => { setSelectedSourceId(source.id); navigate({ to: '/' }); }}
                />
              ))}
              {(!sources || sources.length === 0) && (
                <p className="px-3 py-2 text-xs text-muted-foreground">
                  No sources yet
                </p>
              )}
            </div>
          </div>
        )}

        {sidebarCollapsed && sources && sources.length > 0 && (
          <div className="mt-4 flex flex-col gap-0.5">
            <Separator className="mb-2" />
            {sources.map((source) => (
              <NavItem
                key={source.id}
                icon={
                  source.avatarUrl ? (
                    <img
                      src={source.avatarUrl}
                      alt={source.name}
                      className="h-5 w-5 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <MessageCircle className="h-3 w-3" />
                    </div>
                  )
                }
                label={source.name}
                active={selectedSourceId === source.id}
                collapsed={sidebarCollapsed}
                onClick={() => { setSelectedSourceId(source.id); navigate({ to: '/' }); }}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      <Separator />

      {/* Bottom section */}
      <div className="flex flex-col gap-0.5 p-2">
        <NavItem
          icon={<Settings className="h-4 w-4" />}
          label="Settings"
          active={!!isSettings}
          collapsed={sidebarCollapsed}
          onClick={() => navigate({ to: '/settings' })}
        />
        <NavItem
          icon={<Rss className="h-4 w-4" />}
          label="Sources"
          active={!!isSources}
          collapsed={sidebarCollapsed}
          onClick={() => navigate({ to: '/sources' })}
        />
        <Separator className="my-1" />
        <Button
          variant="ghost"
          size={sidebarCollapsed ? 'icon-sm' : 'sm'}
          onClick={toggleSidebar}
          className={cn('w-full', sidebarCollapsed && 'mx-auto')}
        >
          {sidebarCollapsed ? (
            <PanelLeft className="h-4 w-4" />
          ) : (
            <>
              <PanelLeftClose className="h-4 w-4" />
              <span className="flex-1 text-left text-xs">Collapse</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}
