import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sourcesApi } from '@/lib/api';
import { useAppStore } from '@/stores/app-store';
import type { CreateSourceInput } from '@knowflow/shared';

export function useSources() {
  return useQuery({
    queryKey: ['sources'],
    queryFn: sourcesApi.list,
  });
}

export function useSource(id: string) {
  return useQuery({
    queryKey: ['sources', id],
    queryFn: () => sourcesApi.get(id),
    enabled: !!id,
  });
}

export function useCreateSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateSourceInput) => sourcesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] });
    },
  });
}

export function useBulkImportSources() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      type: string;
      identifiers?: string[];
      sources?: Array<{ name: string; identifier: string; description?: string; avatarUrl?: string }>;
    }) => sourcesApi.bulkImport(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] });
    },
  });
}


export function useDeleteSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sourcesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] });
    },
  });
}

export function useSyncSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sourcesApi.sync(id),
    onSuccess: (data, id) => {
      queryClient.invalidateQueries({ queryKey: ['sources'] });
      queryClient.invalidateQueries({ queryKey: ['articles'] });
    },
  });
}

export function useSyncAllSources() {
  const queryClient = useQueryClient();
  const setSyncProgress = useAppStore((s) => s.setSyncProgress);

  return useMutation({
    mutationFn: async (targetSourceIds?: string[]) => {
      // 1. Get all sources
      const allSources = await sourcesApi.list();
      let activeSources = allSources.filter((s) => s.isActive);

      if (targetSourceIds && targetSourceIds.length > 0) {
        activeSources = activeSources.filter((s) => targetSourceIds.includes(s.id));
      }

      const total = activeSources.length;

      if (total === 0) {
        return { newArticles: 0 };
      }

      // Initialize progress
      setSyncProgress({
        isSyncing: true,
        total,
        current: 0,
        currentName: 'Starting sync...',
        newArticlesCount: 0,
      });

      let totalNewArticles = 0;

      // 2. Sync sequentially to show individual progress
      for (let i = 0; i < total; i++) {
        const source = activeSources[i];
        
        // Update progress before starting this source
        setSyncProgress({
          isSyncing: true,
          total,
          current: i,
          currentName: `Syncing ${source.name}...`,
          newArticlesCount: totalNewArticles,
        });

        try {
          const res = await sourcesApi.sync(source.id);
          totalNewArticles += res.synced;
        } catch (err) {
          console.error(`Failed to sync source ${source.name}:`, err);
        }
      }

      // Final progress update
      setSyncProgress({
        isSyncing: false,
        total,
        current: total,
        currentName: `Sync completed! Found ${totalNewArticles} new articles.`,
        newArticlesCount: totalNewArticles,
      });

      // Clear progress toast after 4 seconds
      setTimeout(() => {
        setSyncProgress(null);
      }, 4000);

      return { newArticles: totalNewArticles };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] });
      queryClient.invalidateQueries({ queryKey: ['articles'] });
    },
    onError: () => {
      setSyncProgress(null);
    }
  });
}

export function useSearchWechat(query: string, enabled = true) {
  return useQuery({
    queryKey: ['wechat-search', query],
    queryFn: () => sourcesApi.searchWechat(query),
    enabled: enabled && query.trim().length >= 2,
    staleTime: 5 * 60 * 1000, // 5 mins
  });
}

export function useSearchTwitter(query: string, enabled = true) {
  return useQuery({
    queryKey: ['twitter-search', query],
    queryFn: () => sourcesApi.searchTwitter(query),
    enabled: enabled && query.trim().length >= 2,
    staleTime: 5 * 60 * 1000, // 5 mins
  });
}

export function useSearchPodcast(query: string, enabled = true) {
  return useQuery({
    queryKey: ['podcast-search', query],
    queryFn: () => sourcesApi.searchPodcast(query),
    enabled: enabled && query.trim().length >= 2,
    staleTime: 5 * 60 * 1000, // 5 mins
  });
}

export function useParseWechatBiz() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (url: string) => sourcesApi.parseWechatBiz(url),
  });
}

export function useUpdateSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateSourceInput> & { isActive?: boolean } }) =>
      sourcesApi.update(id, data),
    onSuccess: (updatedSource) => {
      queryClient.invalidateQueries({ queryKey: ['sources'] });
      queryClient.invalidateQueries({ queryKey: ['sources', updatedSource.id] });
      queryClient.invalidateQueries({ queryKey: ['articles'] });
    },
  });
}

export function useBulkUpdateTags() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { ids: string[]; tags: string[]; action: 'append' | 'overwrite' }) =>
      sourcesApi.bulkUpdateTags(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] });
      queryClient.invalidateQueries({ queryKey: ['articles'] });
    },
  });
}

export function useBulkDeleteSources() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => sourcesApi.bulkDelete(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] });
      queryClient.invalidateQueries({ queryKey: ['articles'] });
    },
  });
}

