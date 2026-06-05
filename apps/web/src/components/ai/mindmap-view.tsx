import { cn } from '@/lib/utils';
import type { MindMapNode } from '@knowflow/shared';

interface MindmapViewProps {
  data: string | null;
}

function parseToTree(text: string): MindMapNode | null {
  try {
    return JSON.parse(text);
  } catch {
    // Try simple text parse: indentation-based
    const lines = text.split('\n').filter((l) => l.trim());
    if (lines.length === 0) return null;

    const root: MindMapNode = { id: '0', label: lines[0].trim(), children: [] };
    const stack: { node: MindMapNode; indent: number }[] = [{ node: root, indent: 0 }];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const indent = line.length - line.trimStart().length;
      const label = line.trim().replace(/^[-*•]\s*/, '');
      const newNode: MindMapNode = { id: String(i), label, children: [] };

      while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
        stack.pop();
      }

      const parent = stack[stack.length - 1].node;
      if (!parent.children) parent.children = [];
      parent.children.push(newNode);
      stack.push({ node: newNode, indent });
    }

    return root;
  }
}

function TreeNode({ node, depth = 0 }: { node: MindMapNode; depth?: number }) {
  const colors = [
    'border-primary/40 bg-primary/5',
    'border-blue-400/40 bg-blue-50/50',
    'border-emerald-400/40 bg-emerald-50/50',
    'border-amber-400/40 bg-amber-50/50',
    'border-rose-400/40 bg-rose-50/50',
    'border-violet-400/40 bg-violet-50/50',
  ];

  const colorClass = colors[depth % colors.length];
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="flex flex-col">
      <div
        className={cn(
          'relative rounded-lg border px-3 py-2 text-sm',
          'transition-all duration-200 hover:shadow-sm',
          depth === 0 ? 'font-semibold text-foreground border-primary bg-primary/10' : colorClass,
          depth > 0 && 'text-foreground/80'
        )}
      >
        {node.label}
      </div>
      {hasChildren && (
        <div className="ml-4 mt-1 flex flex-col gap-1 border-l-2 border-border/50 pl-4">
          {node.children!.map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function MindmapView({ data }: MindmapViewProps) {
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p className="text-sm">Click "Generate" to create a mind map.</p>
      </div>
    );
  }

  const tree = parseToTree(data);
  if (!tree) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        Could not parse mind map data.
      </div>
    );
  }

  return (
    <div className="p-2">
      <TreeNode node={tree} />
    </div>
  );
}
