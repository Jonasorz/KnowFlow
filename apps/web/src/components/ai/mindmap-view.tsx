import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Network, Loader2, Clock } from 'lucide-react';

interface MindMapNode {
  id: string;
  label: string;
  children?: MindMapNode[];
}

interface MindmapViewProps {
  content: string;
  isStreaming?: boolean;
  onSeek?: (time: number) => void;
  transcriptText?: string;
  shownotes?: string;
}

const colors = [
  { border: 'border-orange-500', text: 'text-orange-500', bg: 'bg-orange-500/10', line: '#f97316' },
  { border: 'border-pink-500', text: 'text-pink-500', bg: 'bg-pink-500/10', line: '#ec4899' },
  { border: 'border-emerald-500', text: 'text-emerald-500', bg: 'bg-emerald-500/10', line: '#10b981' },
  { border: 'border-blue-500', text: 'text-blue-500', bg: 'bg-blue-500/10', line: '#3b82f6' },
  { border: 'border-amber-500', text: 'text-amber-500', bg: 'bg-amber-500/10', line: '#f59e0b' },
  { border: 'border-indigo-500', text: 'text-indigo-500', bg: 'bg-indigo-500/10', line: '#6366f1' },
];

function parseTimestamp(label: string): { timestamp: string | null; cleanLabel: string } {
  // Support both bracketed [02:09] and unbracketed 02:09 formats at the start of the label
  const match = label.match(/^(?:\[)?(\d{1,2}:\d{2}(?::\d{2})?)(?:\])?\s*(.*)/);
  if (match) {
    return {
      timestamp: match[1],
      cleanLabel: match[2].trim()
    };
  }
  return {
    timestamp: null,
    cleanLabel: label
  };
}

function parseTimestampToSeconds(ts: string): number {
  const parts = ts.split(':').map(Number);
  if (parts.length === 2) {
    const [m, s] = parts;
    return m * 60 + s;
  } else if (parts.length === 3) {
    const [h, m, s] = parts;
    return h * 3600 + m * 60 + s;
  }
  return 0;
}

function findBestTimestampMatch(
  label: string, 
  shownotes?: string, 
  transcriptText?: string
): string | null {
  const cleanLabel = label.replace(/[^\w\u4e00-\u9fa5]/g, '').trim();
  if (cleanLabel.length < 2) return null;

  const lines: string[] = [];
  if (shownotes) lines.push(...shownotes.split('\n'));
  if (transcriptText) lines.push(...transcriptText.split('\n'));

  let bestTs: string | null = null;
  let bestScore = 0;

  for (const line of lines) {
    const tsMatch = line.match(/(?:\[)?(\d{1,2}:\d{2}(?::\d{2})?)(?:\])?/);
    if (!tsMatch) continue;

    const ts = tsMatch[1];
    const lineText = line.replace(tsMatch[0], '').replace(/[^\w\u4e00-\u9fa5]/g, '').trim();
    if (lineText.length < 2) continue;

    let score = 0;
    if (lineText.includes(cleanLabel) || cleanLabel.includes(lineText)) {
      score = Math.min(lineText.length, cleanLabel.length) * 2;
    } else {
      const labelChars = new Set(cleanLabel.split(''));
      for (const char of lineText) {
        if (labelChars.has(char)) {
          score += 1;
        }
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestTs = ts;
    }
  }

  const threshold = Math.max(3, cleanLabel.length * 0.3);
  if (bestScore >= threshold) {
    return bestTs;
  }

  return null;
}

export function MindmapView({ content, isStreaming, onSeek, transcriptText, shownotes }: MindmapViewProps) {
  const [positions, setPositions] = useState<Record<string, { left: number; right: number; bottom: number; centerY: number }>>({});
  const parentRef = useRef<HTMLDivElement>(null);

  // Parse JSON
  let parsed: MindMapNode | null = null;
  let errorMsg = '';

  try {
    let cleanJson = content.trim();
    // Strip markdown code block wrappers
    if (cleanJson.startsWith('```json')) {
      cleanJson = cleanJson.slice(7);
    } else if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.slice(3);
    }
    if (cleanJson.endsWith('```')) {
      cleanJson = cleanJson.slice(0, -3);
    }
    cleanJson = cleanJson.trim();

    parsed = JSON.parse(cleanJson) as MindMapNode;
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : String(err);
  }

  const updatePositions = () => {
    if (!parentRef.current || !parsed) return;
    const parentRect = parentRef.current.getBoundingClientRect();
    const newPositions: Record<string, { left: number; right: number; bottom: number; centerY: number }> = {};

    const measure = (id: string) => {
      const el = document.getElementById(id);
      if (el) {
        const rect = el.getBoundingClientRect();
        newPositions[id] = {
          left: rect.left - parentRect.left,
          right: rect.right - parentRect.left,
          bottom: rect.bottom - parentRect.top,
          centerY: rect.top - parentRect.top + rect.height / 2,
        };
      }
    };

    measure('node-root');
    parsed.children?.forEach((chapter) => {
      measure(`node-chapter-${chapter.id}`);
      chapter.children?.forEach((leaf) => {
        measure(`node-leaf-${leaf.id}`);
      });
    });

    setPositions(newPositions);
  };

  useEffect(() => {
    updatePositions();

    if (!parentRef.current) return;
    const observer = new ResizeObserver(() => {
      updatePositions();
    });
    observer.observe(parentRef.current);

    window.addEventListener('resize', updatePositions);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updatePositions);
    };
  }, [content, parsed]);

  if (!content) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground text-center space-y-3">
        <Network className="h-8 w-8 opacity-40 text-primary animate-pulse" />
        <p className="text-xs">点击右上角 “Generate” 生成脑图</p>
      </div>
    );
  }

  if (isStreaming && !parsed) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground text-center space-y-4 animate-pulse">
        <Loader2 className="h-6 w-6 text-primary animate-spin" />
        <div className="space-y-1">
          <p className="text-xs font-semibold text-foreground">思维导图构建中...</p>
          <p className="text-[10px] text-muted-foreground">正在使用大模型对文章/播客结构进行多级树状建模</p>
        </div>
      </div>
    );
  }

  if (!parsed) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-destructive text-center space-y-2">
        <p className="text-xs font-semibold">生成脑图解析失败</p>
        <p className="text-[10px] text-muted-foreground max-w-[200px] truncate" title={errorMsg}>
          非合法 JSON 格式或生成被中断。请重试。
        </p>
        <pre className="text-[8px] font-mono p-2 bg-muted rounded border border-border text-left overflow-x-auto max-w-full max-h-32">
          {content}
        </pre>
      </div>
    );
  }

  return (
    <div className="py-2">
      <div className="mb-4 text-[10px] text-muted-foreground font-medium flex items-center gap-1.5 select-none">
        <Network className="h-3 w-3 text-primary" />
        <span>结构化脑图已渲染 (可左右滑动，支持点击时间戳跳转)</span>
      </div>
      
      {/* Scrollable Container with premium aesthetics */}
      <div className="border border-border/60 rounded-2xl p-6 bg-card overflow-x-auto min-w-full shadow-sm hover:shadow-md transition-all duration-300">
        <div ref={parentRef} className="relative py-6 min-w-[900px]">
          
          {/* SVG Connection Lines Overlay */}
          {Object.keys(positions).length > 0 && (
            <svg 
              className="absolute inset-0 pointer-events-none z-0" 
              style={{ width: '100%', height: '100%' }}
            >
              {/* Root Underline & Circle */}
              {(() => {
                const rootPos = positions['node-root'];
                if (!rootPos) return null;
                const y = rootPos.bottom - 4;
                return (
                  <g>
                    <line 
                      x1={rootPos.left} 
                      y1={y} 
                      x2={rootPos.right} 
                      y2={y} 
                      stroke="#3b82f6" 
                      strokeWidth="2" 
                      strokeLinecap="round"
                    />
                    <circle 
                      cx={rootPos.right} 
                      cy={y} 
                      r="4.5" 
                      fill="#ffffff" 
                      stroke="#3b82f6" 
                      strokeWidth="2"
                    />
                  </g>
                );
              })()}

              {/* Chapters and Sub-branches */}
              {parsed.children?.map((chapter, idx) => {
                const color = colors[idx % colors.length];
                const rootPos = positions['node-root'];
                const chapPos = positions[`node-chapter-${chapter.id}`];
                if (!chapPos || !rootPos) return null;

                const startX = rootPos.right;
                const startY = rootPos.bottom - 4;
                const endX = chapPos.left;
                const endY = chapPos.bottom - 4;

                const cp1x = startX + (endX - startX) * 0.45;
                const cp1y = startY;
                const cp2x = startX + (endX - startX) * 0.55;
                const cp2y = endY;

                return (
                  <g key={chapter.id}>
                    {/* Curve from root circle to chapter start */}
                    <path 
                      d={`M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`} 
                      fill="none" 
                      stroke={color.line} 
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    {/* Chapter Underline */}
                    <line 
                      x1={chapPos.left} 
                      y1={endY} 
                      x2={chapPos.right} 
                      y2={endY} 
                      stroke={color.line} 
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    {/* Chapter End Circle */}
                    <circle 
                      cx={chapPos.right} 
                      cy={endY} 
                      r="4.5" 
                      fill="#ffffff" 
                      stroke={color.line} 
                      strokeWidth="2"
                    />

                    {/* Curves and underlines for leaf nodes */}
                    {chapter.children?.map((child) => {
                      const leafPos = positions[`node-leaf-${child.id}`];
                      if (!leafPos) return null;

                      const lx = leafPos.left;
                      const ly = leafPos.bottom - 3;
                      const cx = chapPos.right;
                      const cy = chapPos.bottom - 4;

                      const lcp1x = cx + (lx - cx) * 0.45;
                      const lcp1y = cy;
                      const lcp2x = cx + (lx - cx) * 0.55;
                      const lcp2y = ly;

                      return (
                        <g key={child.id}>
                          {/* Curve from chapter circle to leaf start */}
                          <path 
                            d={`M ${cx} ${cy} C ${lcp1x} ${lcp1y}, ${lcp2x} ${lcp2y}, ${lx} ${ly}`} 
                            fill="none" 
                            stroke={color.line} 
                            strokeWidth="1.25"
                            strokeLinecap="round"
                          />
                          {/* Leaf Underline */}
                          <line 
                            x1={lx} 
                            y1={ly} 
                            x2={leafPos.right} 
                            y2={ly} 
                            stroke={color.line} 
                            strokeWidth="1.25"
                            strokeLinecap="round"
                          />
                          {/* Leaf End Dot */}
                          <circle 
                            cx={leafPos.right} 
                            cy={ly} 
                            r="2.5" 
                            fill={color.line}
                          />
                        </g>
                      );
                    })}
                  </g>
                );
              })}
            </svg>
          )}

          {/* HTML Node Elements (z-10 to enable pointer events like hover/clicks) */}
          <div className="relative z-10 flex items-center gap-16 select-none pl-4">
            
            {/* Root Column */}
            <div className="flex items-center shrink-0">
              <div 
                id="node-root" 
                className="pb-2.5 text-xs font-bold text-foreground max-w-[170px] leading-relaxed select-text"
              >
                {parsed.label}
              </div>
            </div>

            {/* Chapters & Leaves Column */}
            <div className="flex flex-col gap-6 justify-center">
              {parsed.children?.map((chapter, idx) => {
                const color = colors[idx % colors.length];
                const { timestamp, cleanLabel } = parseTimestamp(chapter.label);
                const matchedTimestamp = timestamp || findBestTimestampMatch(cleanLabel, shownotes, transcriptText);

                return (
                  <div key={chapter.id} className="flex items-center gap-16">
                    
                    {/* Chapter Node Text */}
                    <div 
                      id={`node-chapter-${chapter.id}`}
                      className="pb-2.5 text-xs font-semibold text-foreground max-w-[230px] flex flex-col items-start gap-1 select-text"
                    >
                      {matchedTimestamp && (
                        <span 
                          onClick={() => {
                            if (onSeek) {
                              onSeek(parseTimestampToSeconds(matchedTimestamp));
                            }
                          }}
                          className={cn(
                            "cursor-pointer text-[9px] font-mono px-1.5 py-0.5 rounded transition-all select-none font-bold flex items-center gap-1 hover:opacity-80",
                            color.bg, color.text
                          )}
                        >
                          <Clock className="h-2.5 w-2.5" />
                          {matchedTimestamp}
                        </span>
                      )}
                      <span className="break-words w-full">{cleanLabel}</span>
                    </div>

                    {/* Chapter Children (Leaves) */}
                    {chapter.children && chapter.children.length > 0 && (
                      <div className="flex flex-col gap-3 justify-center">
                        {chapter.children.map((child) => (
                          <div 
                            key={child.id}
                            id={`node-leaf-${child.id}`}
                            className="pb-2 text-[10px] text-muted-foreground hover:text-foreground transition-colors max-w-[250px] break-words select-text"
                          >
                            {child.label}
                          </div>
                        ))}
                      </div>
                    )}

                  </div>
                );
              })}
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
