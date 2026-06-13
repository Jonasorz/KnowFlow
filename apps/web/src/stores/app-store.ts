import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark' | 'system';
type ViewMode = 'list' | 'grid';
type ArticleView = 'all' | 'starred' | 'read';

interface AppState {
  // Sidebar
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // Theme
  theme: Theme;
  setTheme: (theme: Theme) => void;

  // View
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  // Article filtering
  currentView: ArticleView;
  setCurrentView: (view: ArticleView) => void;

  // Selected source
  selectedSourceId: string | null;
  setSelectedSourceId: (id: string | null) => void;

  // Selected tag
  selectedTag: string | null;
  setSelectedTag: (tag: string | null) => void;
  selectedTagSourceId: string | null;
  setSelectedTagSourceId: (id: string | null) => void;

  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  
  // Sort
  sortBy: 'publishedAt' | 'readCount' | 'createdAt';
  sortOrder: 'asc' | 'desc';
  setSortBy: (sortBy: 'publishedAt' | 'readCount' | 'createdAt') => void;
  setSortOrder: (order: 'asc' | 'desc') => void;

  // AI sidebar
  aiSidebarOpen: boolean;
  aiArticleId: string | null;
  openAiSidebar: (articleId: string) => void;
  closeAiSidebar: () => void;

  // Sync state
  syncProgress: {
    isSyncing: boolean;
    total: number;
    current: number;
    currentName: string;
    newArticlesCount: number;
  } | null;
  setSyncProgress: (progress: {
    isSyncing: boolean;
    total: number;
    current: number;
    currentName: string;
    newArticlesCount: number;
  } | null) => void;

  // Resizable widths
  sidebarWidth: number;
  aiSidebarWidth: number;
  setSidebarWidth: (width: number) => void;
  setAiSidebarWidth: (width: number) => void;

  // Balance query caching
  balances: {
    dajiala: any | null;
    twitter: any | null;
    moonshot: any | null;
    deepseek: any | null;
    tavily: any | null;
    openrouter: any | null;
    dashscope: any | null;
  };
  balancesLastUpdated: {
    dajiala: string | null;
    twitter: string | null;
    moonshot: string | null;
    deepseek: string | null;
    tavily: string | null;
    openrouter: string | null;
    dashscope: string | null;
  };
  setBalance: (provider: 'dajiala' | 'twitter' | 'moonshot' | 'deepseek' | 'tavily' | 'openrouter' | 'dashscope', data: any | null) => void;
  clearBalances: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Sidebar
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

      // Theme
      theme: 'system',
      setTheme: (theme) => {
        set({ theme });
        const root = document.documentElement;
        root.classList.remove('dark', 'light');
        if (theme === 'dark') {
          root.classList.add('dark');
        } else if (theme === 'light') {
          root.classList.add('light');
        }
        // For 'system', rely on prefers-color-scheme media query
      },

      // View
      viewMode: 'list',
      setViewMode: (mode) => set({ viewMode: mode }),

      // Article filtering
      currentView: 'all',
      setCurrentView: (view) => set({ currentView: view, selectedSourceId: null, selectedTag: null }),

      // Selected source
      selectedSourceId: null,
      setSelectedSourceId: (id) => set({ selectedSourceId: id, currentView: 'all', selectedTag: null, selectedTagSourceId: null }),

      // Selected tag
      selectedTag: null,
      selectedTagSourceId: null,
      setSelectedTag: (tag) => set({ selectedTag: tag, selectedSourceId: null, selectedTagSourceId: null, currentView: 'all' }),
      setSelectedTagSourceId: (id) => set({ selectedTagSourceId: id }),

      // Search
      searchQuery: '',
      setSearchQuery: (query) => set({ searchQuery: query }),

      // Sort
      sortBy: 'publishedAt',
      sortOrder: 'desc',
      setSortBy: (sortBy) => set({ sortBy }),
      setSortOrder: (order) => set({ sortOrder: order }),

      // AI sidebar
      aiSidebarOpen: false,
      aiArticleId: null,
      openAiSidebar: (articleId) => set({ aiSidebarOpen: true, aiArticleId: articleId }),
      closeAiSidebar: () => set({ aiSidebarOpen: false, aiArticleId: null }),

      // Sync state
      syncProgress: null,
      setSyncProgress: (progress) => set({ syncProgress: progress }),

      // Resizable widths
      sidebarWidth: 240,
      aiSidebarWidth: 320,
      setSidebarWidth: (width) => set({ sidebarWidth: width }),
      setAiSidebarWidth: (width) => set({ aiSidebarWidth: width }),

      // Balance query caching
      balances: {
        dajiala: null,
        twitter: null,
        moonshot: null,
        deepseek: null,
        tavily: null,
        openrouter: null,
        dashscope: null,
      },
      balancesLastUpdated: {
        dajiala: null,
        twitter: null,
        moonshot: null,
        deepseek: null,
        tavily: null,
        openrouter: null,
        dashscope: null,
      },
      setBalance: (provider, data) => set((s) => ({
        balances: {
          ...s.balances,
          [provider]: data,
        },
        balancesLastUpdated: {
          ...s.balancesLastUpdated,
          [provider]: data === null ? null : new Date().toISOString(),
        },
      })),
      clearBalances: () => set({
        balances: {
          dajiala: null,
          twitter: null,
          moonshot: null,
          deepseek: null,
          tavily: null,
          openrouter: null,
          dashscope: null,
        },
        balancesLastUpdated: {
          dajiala: null,
          twitter: null,
          moonshot: null,
          deepseek: null,
          tavily: null,
          openrouter: null,
          dashscope: null,
        },
      }),
    }),
    {
      name: 'knowflow-app-store',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        theme: state.theme,
        viewMode: state.viewMode,
        sidebarWidth: state.sidebarWidth,
        aiSidebarWidth: state.aiSidebarWidth,
        balances: state.balances,
        balancesLastUpdated: state.balancesLastUpdated,
      }),
    }
  )
);
