import { useState } from 'react';
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
  Twitter,
  Mic,
  Video,
  ChevronDown,
  ChevronRight,
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

function SourceAvatar({ avatarUrl, name, type }: { avatarUrl?: string; name: string; type: string }) {
  const badgeColors: Record<string, string> = {
    wechat: 'bg-emerald-500 text-white',
    twitter: 'bg-sky-500 text-white',
    podcast: 'bg-purple-500 text-white',
    video: 'bg-red-500 text-white',
  };

  const badgeIcon = {
    wechat: <MessageCircle className="h-2 w-2" />,
    twitter: <Twitter className="h-2 w-2 fill-current" />,
    podcast: <Mic className="h-2 w-2" />,
    video: <Video className="h-2 w-2" />,
  }[type] || <Rss className="h-2 w-2" />;

  const fallbackBg = {
    wechat: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400',
    twitter: 'bg-sky-50 text-sky-600 dark:bg-sky-950/30 dark:text-sky-400',
    podcast: 'bg-purple-50 text-purple-600 dark:bg-purple-950/30 dark:text-purple-400',
    video: 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400',
  }[type] || 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400';

  return (
    <div className="relative shrink-0 select-none">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name}
          className="h-5 w-5 rounded-full object-cover"
        />
      ) : (
        <div className={cn("flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold uppercase", fallbackBg)}>
          {name.slice(0, 1)}
        </div>
      )}
      <div className={cn("absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-sidebar bg-sidebar p-0.5 shadow-sm", badgeColors[type] || 'bg-gray-500 text-white')}>
        {badgeIcon}
      </div>
    </div>
  );
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
          <span className="flex-1 text-left truncate">{label}</span>
          {badge !== undefined && badge > 0 && (
            <span className="text-xs text-muted-foreground/85 font-mono tabular-nums">{badge}</span>
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
    selectedTag,
    setSelectedTag,
  } = useAppStore();
  const { data: sources } = useSources();
  const allTags = Array.from(
    new Set(
      (sources || [])
        .flatMap((s) => s.tags || [])
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
    )
  );
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({
    wechat: false,
    twitter: false,
    podcast: false,
    other: false,
  });

  const toggleGroup = (group: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };

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
            active={!!isHome && currentView === 'all' && !selectedSourceId && !selectedTag}
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
        {!sidebarCollapsed && sources && sources.length > 0 && (
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

            {allTags.length > 0 && (
              <div className="mb-5 px-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 block mb-2">
                  标签与分组
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                  {allTags.map((tag) => {
                    const isActive = selectedTag === tag;
                    return (
                      <button
                        key={tag}
                        onClick={() => {
                          setSelectedTag(isActive ? null : tag);
                          navigate({ to: '/' });
                        }}
                        className={cn(
                          "px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all duration-200 cursor-pointer border select-none",
                          isActive
                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                            : "bg-muted/30 text-muted-foreground border-border hover:bg-muted/65 hover:text-foreground"
                        )}
                      >
                        #{tag}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* WeChat group */}
            {sources.filter(s => s.type === 'wechat').length > 0 && (
              <div className="mb-4">
                <button
                  onClick={() => toggleGroup('wechat')}
                  className="mb-1.5 flex w-full items-center justify-between px-3 text-left hover:text-foreground transition-colors group/header cursor-pointer select-none"
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 group-hover/header:text-muted-foreground">
                    微信公众号
                  </span>
                  {collapsedGroups.wechat ? (
                    <ChevronRight className="h-3 w-3 text-muted-foreground/40 group-hover/header:text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-3 w-3 text-muted-foreground/40 group-hover/header:text-muted-foreground" />
                  )}
                </button>
                {!collapsedGroups.wechat && (
                  <div className="flex flex-col gap-0.5 animate-slide-down">
                    {sources.filter(s => s.type === 'wechat').map((source) => (
                      <NavItem
                        key={source.id}
                        icon={<SourceAvatar avatarUrl={source.avatarUrl} name={source.name} type={source.type} />}
                        label={source.name}
                        active={selectedSourceId === source.id}
                        collapsed={sidebarCollapsed}
                        badge={source.articleCount}
                        onClick={() => { setSelectedSourceId(source.id); navigate({ to: '/' }); }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* X (Twitter) group */}
            {sources.filter(s => s.type === 'twitter').length > 0 && (
              <div className="mb-4">
                <button
                  onClick={() => toggleGroup('twitter')}
                  className="mb-1.5 flex w-full items-center justify-between px-3 text-left hover:text-foreground transition-colors group/header cursor-pointer select-none"
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 group-hover/header:text-muted-foreground">
                    X (Twitter)
                  </span>
                  {collapsedGroups.twitter ? (
                    <ChevronRight className="h-3 w-3 text-muted-foreground/40 group-hover/header:text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-3 w-3 text-muted-foreground/40 group-hover/header:text-muted-foreground" />
                  )}
                </button>
                {!collapsedGroups.twitter && (
                  <div className="flex flex-col gap-0.5 animate-slide-down">
                    {sources.filter(s => s.type === 'twitter').map((source) => (
                      <NavItem
                        key={source.id}
                        icon={<SourceAvatar avatarUrl={source.avatarUrl} name={source.name} type={source.type} />}
                        label={source.name}
                        active={selectedSourceId === source.id}
                        collapsed={sidebarCollapsed}
                        badge={source.articleCount}
                        onClick={() => { setSelectedSourceId(source.id); navigate({ to: '/' }); }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Podcasts group */}
            {sources.filter(s => s.type === 'podcast').length > 0 && (
              <div className="mb-4">
                <button
                  onClick={() => toggleGroup('podcast')}
                  className="mb-1.5 flex w-full items-center justify-between px-3 text-left hover:text-foreground transition-colors group/header cursor-pointer select-none"
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 group-hover/header:text-muted-foreground">
                    播客 (Podcast)
                  </span>
                  {collapsedGroups.podcast ? (
                    <ChevronRight className="h-3 w-3 text-muted-foreground/40 group-hover/header:text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-3 w-3 text-muted-foreground/40 group-hover/header:text-muted-foreground" />
                  )}
                </button>
                {!collapsedGroups.podcast && (
                  <div className="flex flex-col gap-0.5 animate-slide-down">
                    {sources.filter(s => s.type === 'podcast').map((source) => (
                      <NavItem
                        key={source.id}
                        icon={<SourceAvatar avatarUrl={source.avatarUrl} name={source.name} type={source.type} />}
                        label={source.name}
                        active={selectedSourceId === source.id}
                        collapsed={sidebarCollapsed}
                        badge={source.articleCount}
                        onClick={() => { setSelectedSourceId(source.id); navigate({ to: '/' }); }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Other group */}
            {sources.filter(s => s.type !== 'wechat' && s.type !== 'twitter' && s.type !== 'podcast').length > 0 && (
              <div className="mb-4">
                <button
                  onClick={() => toggleGroup('other')}
                  className="mb-1.5 flex w-full items-center justify-between px-3 text-left hover:text-foreground transition-colors group/header cursor-pointer select-none"
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 group-hover/header:text-muted-foreground">
                    其他
                  </span>
                  {collapsedGroups.other ? (
                    <ChevronRight className="h-3 w-3 text-muted-foreground/40 group-hover/header:text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-3 w-3 text-muted-foreground/40 group-hover/header:text-muted-foreground" />
                  )}
                </button>
                {!collapsedGroups.other && (
                  <div className="flex flex-col gap-0.5 animate-slide-down">
                    {sources.filter(s => s.type !== 'wechat' && s.type !== 'twitter' && s.type !== 'podcast').map((source) => (
                      <NavItem
                        key={source.id}
                        icon={<SourceAvatar avatarUrl={source.avatarUrl} name={source.name} type={source.type} />}
                        label={source.name}
                        active={selectedSourceId === source.id}
                        collapsed={sidebarCollapsed}
                        badge={source.articleCount}
                        onClick={() => { setSelectedSourceId(source.id); navigate({ to: '/' }); }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {!sidebarCollapsed && (!sources || sources.length === 0) && (
          <div className="mt-6 px-3">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground block mb-2">
              Sources
            </span>
            <p className="text-xs text-muted-foreground">No sources yet</p>
          </div>
        )}

        {sidebarCollapsed && sources && sources.length > 0 && (
          <div className="mt-4 flex flex-col gap-0.5">
            <Separator className="mb-2" />
            {sources.map((source) => (
              <NavItem
                key={source.id}
                icon={<SourceAvatar avatarUrl={source.avatarUrl} name={source.name} type={source.type} />}
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
