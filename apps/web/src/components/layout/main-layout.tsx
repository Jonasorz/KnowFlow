import { useEffect, useRef } from 'react';
import { useLocation } from '@tanstack/react-router';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { AiSidebar } from '@/components/ai/ai-sidebar';
import { SyncProgressIndicator } from './sync-progress-indicator';
import { AudioPlayer } from '@/components/ui/audio-player';
import { useAppStore } from '@/stores/app-store';
import { useSettings, useUpdateSettings } from '@/hooks/use-settings';
import { useSources, useSyncAllSources } from '@/hooks/use-sources';
import { cn } from '@/lib/utils';

function getLocalDateKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function DailyOnlineAutoSync() {
  const { data: settings } = useSettings();
  const { data: sources } = useSources();
  const syncAll = useSyncAllSources();
  const updateSettings = useUpdateSettings();
  const inFlightDateRef = useRef<string | null>(null);

  useEffect(() => {
    if (!settings?.autoSyncOnOnline) return;
    if (!sources?.some((source) => source.isActive)) return;

    const runAutoSync = () => {
      if (!navigator.onLine || syncAll.isPending) return;

      const today = getLocalDateKey();
      if (settings.lastAutoSyncDate === today) return;
      if (inFlightDateRef.current === today) return;

      inFlightDateRef.current = today;
      syncAll.mutate(undefined, {
        onSuccess: () => {
          updateSettings.mutate({ lastAutoSyncDate: today });
        },
        onError: () => {
          inFlightDateRef.current = null;
        },
      });
    };

    runAutoSync();
    window.addEventListener('online', runAutoSync);
    return () => window.removeEventListener('online', runAutoSync);
  }, [settings?.autoSyncOnOnline, settings?.lastAutoSyncDate, sources, syncAll, updateSettings]);

  return null;
}

interface MainLayoutProps {
  children: React.ReactNode;
  showHeader?: boolean;
}

export function MainLayout({ children, showHeader = true }: MainLayoutProps) {
  const location = useLocation();
  const {
    sidebarCollapsed,
    sidebarWidth,
    setSidebarWidth,
    aiSidebarOpen,
    aiSidebarWidth,
    setAiSidebarWidth,
    closeAiSidebar,
  } = useAppStore();

  useEffect(() => {
    if (!location.pathname.startsWith('/article/')) {
      closeAiSidebar();
    }
  }, [location.pathname, closeAiSidebar]);

  const handleSidebarMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(160, Math.min(480, startWidth + deltaX));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleAiSidebarMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = aiSidebarWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = startX - moveEvent.clientX; // drag left to increase
      const newWidth = Math.max(240, Math.min(640, startWidth + deltaX));
      setAiSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <Sidebar />

      {/* Left resize handle */}
      {!sidebarCollapsed && (
        <div
          onMouseDown={handleSidebarMouseDown}
          className={cn(
            'relative w-[1px] hover:w-[3px] bg-border hover:bg-primary/50 cursor-col-resize transition-all h-screen select-none shrink-0 z-40',
            'after:absolute after:inset-y-0 after:-left-2 after:-right-2 after:cursor-col-resize'
          )}
        />
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {showHeader && <Header />}

        {/* Content + AI Sidebar */}
        <div className="flex flex-1 overflow-hidden">
          <main className={cn(
            'flex-1 overflow-y-auto',
          )}>
            {children}
          </main>

          {/* Right resize handle */}
          {aiSidebarOpen && (
            <div
              onMouseDown={handleAiSidebarMouseDown}
              className={cn(
                'relative w-[1px] hover:w-[3px] bg-border hover:bg-primary/50 cursor-col-resize transition-all h-full select-none shrink-0 z-40',
                'after:absolute after:inset-y-0 after:-left-2 after:-right-2 after:cursor-col-resize'
              )}
            />
          )}

          {/* AI Sidebar */}
          {aiSidebarOpen && <AiSidebar />}
        </div>

        {/* Audio Player */}
        <AudioPlayer />
      </div>

      {/* Sync Progress Indicator */}
      <SyncProgressIndicator />
      <DailyOnlineAutoSync />
    </div>
  );
}
