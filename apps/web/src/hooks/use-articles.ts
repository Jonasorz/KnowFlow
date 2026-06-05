import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { articlesApi } from '@/lib/api';
import type { ArticleFilter, UpdateArticleInput } from '@knowflow/shared';
import { useAppStore } from '@/stores/app-store';

export function useArticles(overrides?: Partial<ArticleFilter>) {
  const { currentView, selectedSourceId, searchQuery, sortBy, sortOrder } = useAppStore();

  const filter: Partial<ArticleFilter> = {
    sortBy,
    sortOrder,
    ...overrides,
  };

  if (searchQuery) filter.search = searchQuery;
  if (selectedSourceId) filter.sourceId = selectedSourceId;
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
