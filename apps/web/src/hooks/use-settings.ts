import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '@/lib/api';
import type { Settings } from '@knowflow/shared';

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
    onSuccess: (updated) => {
      queryClient.setQueryData(['settings'], updated);
    },
  });
}

export function useTestApiKey() {
  return useMutation({
    mutationFn: ({ provider, key }: { provider: string; key: string }) =>
      settingsApi.testApiKey(provider, key),
  });
}

export function useDajialaBalance() {
  return useQuery({
    queryKey: ['dajiala-balance'],
    queryFn: settingsApi.getDajialaBalance,
    enabled: false,
    retry: false,
  });
}
