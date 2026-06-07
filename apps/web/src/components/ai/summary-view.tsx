import { cn } from '@/lib/utils';

interface SummaryViewProps {
  content: string;
  isStreaming?: boolean;
}

export function SummaryView({ content, isStreaming }: SummaryViewProps) {
  const parseInlineMarkdown = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} className="font-bold text-foreground">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  if (!content) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p className="text-sm">Click "Generate" to create a summary.</p>
      </div>
    );
  }

  return (
    <div className="prose-reader text-sm leading-relaxed">
      {content.split('\n').map((line, i) => {
        if (!line.trim()) return <br key={i} />;

        // Simple markdown rendering
        if (line.startsWith('### ')) {
          return (
            <h3 key={i} className="mt-4 mb-2 text-sm font-semibold text-foreground">
              {parseInlineMarkdown(line.slice(4))}
            </h3>
          );
        }
        if (line.startsWith('## ')) {
          return (
            <h2 key={i} className="mt-4 mb-2 text-base font-semibold text-foreground">
              {parseInlineMarkdown(line.slice(3))}
            </h2>
          );
        }
        if (line.startsWith('# ')) {
          return (
            <h1 key={i} className="mt-4 mb-2 text-lg font-bold text-foreground">
              {parseInlineMarkdown(line.slice(2))}
            </h1>
          );
        }
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return (
            <div key={i} className="flex gap-2 ml-1 my-0.5">
              <span className="text-muted-foreground mt-1 shrink-0">•</span>
              <span className="text-muted-foreground">{parseInlineMarkdown(line.slice(2))}</span>
            </div>
          );
        }
        if (/^\d+\.\s/.test(line)) {
          const match = line.match(/^(\d+)\.\s(.*)$/);
          if (match) {
            return (
              <div key={i} className="flex gap-2 ml-1 my-0.5">
                <span className="text-muted-foreground shrink-0 tabular-nums">{match[1]}.</span>
                <span className="text-muted-foreground">{parseInlineMarkdown(match[2])}</span>
              </div>
            );
          }
        }
        if (line.startsWith('> ')) {
          return (
            <blockquote key={i} className="border-l-2 border-primary/30 pl-3 my-2 text-muted-foreground italic">
              {parseInlineMarkdown(line.slice(2))}
            </blockquote>
          );
        }
        if (line.startsWith('**') && line.endsWith('**')) {
          return (
            <p key={i} className="font-semibold text-foreground my-1">
              {parseInlineMarkdown(line.slice(2, -2))}
            </p>
          );
        }

        return (
          <p key={i} className="text-muted-foreground my-1">
            {parseInlineMarkdown(line)}
          </p>
        );
      })}

      {/* Streaming cursor */}
      {isStreaming && (
        <span className="inline-block w-1.5 h-4 bg-primary ml-0.5 animate-pulse-subtle rounded-sm" />
      )}
    </div>
  );
}
