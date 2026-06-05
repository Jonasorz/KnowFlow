import { useState, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { aiApi } from '@/lib/api';
import type { AIRequest, AIResultInfo } from '@knowflow/shared';

export function useAiResults(articleId: string) {
  return useQuery({
    queryKey: ['ai-results', articleId],
    queryFn: () => aiApi.getResults(articleId),
    enabled: !!articleId,
  });
}

export function useAiStream() {
  const [content, setContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(false);

  const startStream = useCallback(async (request: AIRequest) => {
    setContent('');
    setError(null);
    setIsStreaming(true);
    abortRef.current = false;

    try {
      const stream = aiApi.stream(request);
      for await (const chunk of stream) {
        if (abortRef.current) break;
        setContent((prev) => prev + chunk);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Stream failed');
    } finally {
      setIsStreaming(false);
    }
  }, []);

  const stopStream = useCallback(() => {
    abortRef.current = true;
    setIsStreaming(false);
  }, []);

  const reset = useCallback(() => {
    setContent('');
    setError(null);
    setIsStreaming(false);
    abortRef.current = false;
  }, []);

  return { content, isStreaming, error, startStream, stopStream, reset };
}

export function useAiRun() {
  const [result, setResult] = useState<AIResultInfo | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (request: AIRequest) => {
    setResult(null);
    setError(null);
    setIsRunning(true);

    try {
      const res = await aiApi.run(request);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI request failed');
    } finally {
      setIsRunning(false);
    }
  }, []);

  return { result, isRunning, error, run };
}
