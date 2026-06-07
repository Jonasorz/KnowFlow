import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Send, User, Sparkles, Globe, AlertCircle, Loader2 } from 'lucide-react';
import { useAiStream } from '@/hooks/use-ai';
import type { AIModel } from '@knowflow/shared';

interface QAChatProps {
  articleId: string;
  model: AIModel;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'error';
  content: string;
}

export function QAChat({ articleId, model }: QAChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [webSearch, setWebSearch] = useState(false);
  const { content: streamContent, isStreaming, error, startStream, reset } = useAiStream();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevStreamContent = useRef('');

  // Reset QA state when articleId changes
  useEffect(() => {
    setMessages([]);
    setInput('');
    setWebSearch(false);
    reset();
  }, [articleId, reset]);

  // When streaming finishes, add the full message or error
  useEffect(() => {
    if (!isStreaming && prevStreamContent.current && streamContent) {
      setMessages((prev) => [...prev, { role: 'assistant', content: streamContent }]);
      prevStreamContent.current = '';
    }
    if (isStreaming) {
      prevStreamContent.current = streamContent;
    }
  }, [isStreaming, streamContent]);

  // Show errors as chat messages
  useEffect(() => {
    if (error && !isStreaming) {
      setMessages((prev) => [...prev, { role: 'error', content: error }]);
    }
  }, [error, isStreaming]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamContent]);

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;
    const question = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: question }]);
    startStream({
      articleId,
      skill: 'qa',
      model,
      question,
      webSearch,
    });
  };

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-4">
        {messages.length === 0 && !isStreaming && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Sparkles className="h-8 w-8 mb-3 opacity-40" />
            <p className="text-sm text-center">
              Ask any question about this article.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              'flex gap-2.5',
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            {msg.role === 'assistant' && (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
              </div>
            )}
            {msg.role === 'error' && (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                <AlertCircle className="h-3.5 w-3.5 text-destructive" />
              </div>
            )}
            <div
              className={cn(
                'max-w-[85%] min-w-0 rounded-xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words',
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-br-sm'
                  : msg.role === 'error'
                  ? 'bg-destructive/10 text-destructive border border-destructive/20 rounded-bl-sm'
                  : 'bg-muted text-foreground rounded-bl-sm'
              )}
            >
              {msg.role === 'error' && <span className="font-medium">请求失败: </span>}
              {msg.content}
            </div>
            {msg.role === 'user' && (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            )}
          </div>
        ))}

        {/* Streaming message */}
        {isStreaming && streamContent && (
          <div className="flex gap-2.5 justify-start">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse-subtle" />
            </div>
            <div className="max-w-[85%] min-w-0 rounded-xl rounded-bl-sm bg-muted px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words">
              {streamContent}
              <span className="inline-block w-1.5 h-3.5 bg-primary ml-0.5 animate-pulse-subtle rounded-sm" />
            </div>
          </div>
        )}

        {/* Loading indicator when streaming but no content yet */}
        {isStreaming && !streamContent && (
          <div className="flex gap-2.5 justify-start">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
            </div>
            <div className="max-w-[85%] min-w-0 rounded-xl rounded-bl-sm bg-muted px-3.5 py-2.5 text-sm leading-relaxed text-muted-foreground">
              正在思考...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-3 space-y-2 bg-surface">
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <button
            type="button"
            onClick={() => setWebSearch(!webSearch)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all cursor-pointer",
              webSearch
                ? "bg-primary/10 text-primary font-medium border border-primary/20"
                : "hover:bg-muted hover:text-foreground border border-transparent"
            )}
          >
            <Globe className={cn("h-3.5 w-3.5", webSearch && "animate-pulse")} />
            {webSearch ? '联网搜索已开启' : '联网搜索'}
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={webSearch ? "通过搜索联网回答..." : "向 AI 提问..."}
            disabled={isStreaming}
            className="flex-1 text-sm"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isStreaming}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
