import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'rounded-md bg-muted',
        'bg-[length:400%_100%] bg-gradient-to-r from-muted via-muted-foreground/5 to-muted',
        'animate-shimmer',
        className
      )}
    />
  );
}

export { Skeleton };
