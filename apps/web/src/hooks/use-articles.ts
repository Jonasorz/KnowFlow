import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { articlesApi } from '@/lib/api';
import type { ArticleFilter, UpdateArticleInput } from '@knowflow/shared';
import { useAppStore } from '@/stores/app-store';

export function useArticles(overrides?: Partial<ArticleFilter>) {
  const { currentView, selectedSourceId, selectedTag, searchQuery, sortBy, sortOrder } = useAppStore();

  const filter: Partial<ArticleFilter> = {
    sortBy,
    sortOrder,
    ...overrides,
  };

  if (searchQuery) filter.search = searchQuery;
  if (selectedSourceId) filter.sourceId = selectedSourceId;
  if (selectedTag) filter.tag = selectedTag;
  if (currentView === 'starred') filter.isStarred = true;
  if (currentView === 'read') filter.isRead = true;

  return useQuery({
    queryKey: ['articles', filter],
    queryFn: () => articlesApi.list(filter),
  });
}

export function useArticle(id: string) {
  return useQuery({
    queryKey: ['articles', id],
    queryFn: () => articlesApi.get(id),
    enabled: !!id,
  });
}

export function useUpdateArticle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateArticleInput }) =>
      articlesApi.update(id, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(['articles', updated.id], updated);
      queryClient.invalidateQueries({ queryKey: ['articles'] });
    },
  });
}

export function useToggleStar() {
  const updateArticle = useUpdateArticle();
  return (id: string, currentlyStarred: boolean) => {
    updateArticle.mutate({ id, data: { isStarred: !currentlyStarred } });
  };
}

export function useMarkAsRead() {
  const updateArticle = useUpdateArticle();
  return (id: string) => {
    updateArticle.mutate({ id, data: { isRead: true } });
  };
}

export function useTranscribeArticle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['transcribe-article'],
    mutationFn: (id: string) => articlesApi.transcribe(id),
    onSuccess: (data, id) => {
      // Invalidate the specific article to fetch the new contentText and contentHtml
      queryClient.invalidateQueries({ queryKey: ['articles', id] });
      queryClient.invalidateQueries({ queryKey: ['articles'] });
    },
  });
}

export function useIdentifySpeakers() {
  return useMutation({
    mutationFn: (id: string) => articlesApi.identifySpeakers(id),
  });
}

export function useApplySpeakerMapping() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, mapping }: { id: string; mapping: Record<string, string> }) =>
      articlesApi.applySpeakerMapping(id, mapping),
    onSuccess: (data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['articles', id] });
      queryClient.invalidateQueries({ queryKey: ['articles'] });
    },
  });
}
