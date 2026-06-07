import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '@/lib/api';
import type { Settings } from '@knowflow/shared';
import { useAppStore } from '@/stores/app-store';

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.get,
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Settings>) => settingsApi.update(data),
    onSuccess: (updated, variables) => {
      queryClient.setQueryData(['settings'], updated);
      
      const keys = Object.keys(variables) as Array<keyof Settings>;
      const store = useAppStore.getState();
      if (keys.includes('dajialaApiKey')) store.setBalance('dajiala', null);
      if (keys.includes('twitterApiKey')) store.setBalance('twitter', null);
      if (keys.includes('moonshotApiKey')) store.setBalance('moonshot', null);
      if (keys.includes('deepseekApiKey')) store.setBalance('deepseek', null);
      if (keys.includes('tavilyApiKey')) store.setBalance('tavily', null);
      if (keys.includes('openrouterApiKey')) store.setBalance('openrouter', null);
      if (keys.includes('dashscopeApiKey')) store.setBalance('dashscope', null);
    },
  });
}

export function useTestApiKey() {
  return useMutation({
    mutationFn: ({ provider, key }: { provider: string; key: string }) =>
      settingsApi.testApiKey(provider, key),
  });
}

export function useDajialaBalance(initialData?: any) {
  return useQuery({
    queryKey: ['dajiala-balance'],
    queryFn: settingsApi.getDajialaBalance,
    enabled: false,
    retry: false,
    initialData,
  });
}

export function useTwitterBalance(initialData?: any) {
  return useQuery({
    queryKey: ['twitter-balance'],
    queryFn: settingsApi.getTwitterBalance,
    enabled: false,
    retry: false,
    initialData,
  });
}

export function useMoonshotBalance(initialData?: any) {
  return useQuery({
    queryKey: ['moonshot-balance'],
    queryFn: settingsApi.getMoonshotBalance,
    enabled: false,
    retry: false,
    initialData,
  });
}

export function useDeepSeekBalance(initialData?: any) {
  return useQuery({
    queryKey: ['deepseek-balance'],
    queryFn: settingsApi.getDeepSeekBalance,
    enabled: false,
    retry: false,
    initialData,
  });
}

export function useTavilyBalance(initialData?: any) {
  return useQuery({
    queryKey: ['tavily-balance'],
    queryFn: settingsApi.getTavilyBalance,
    enabled: false,
    retry: false,
    initialData,
  });
}

export function useOpenRouterBalance(initialData?: any) {
  return useQuery({
    queryKey: ['openrouter-balance'],
    queryFn: settingsApi.getOpenRouterBalance,
    enabled: false,
    retry: false,
    initialData,
  });
}

export function useDashScopeBalance(initialData?: any) {
  return useQuery({
    queryKey: ['dashscope-balance'],
    queryFn: settingsApi.getDashScopeBalance,
    enabled: false,
    retry: false,
    initialData,
  });
}

export function useOpenRouterModels() {
  return useQuery({
    queryKey: ['openrouter-models'],
    queryFn: settingsApi.getOpenRouterModels,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
  });
}
