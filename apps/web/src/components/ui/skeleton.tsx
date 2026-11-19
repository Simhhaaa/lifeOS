import { cn } from "./cn";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-full bg-well", className)} />;
}

/** Generic module skeleton: a few lines plus an optional block. */
export function SkeletonRows({ rows = 3, block = false }: { rows?: number; block?: boolean }) {
  return (
    <div className="flex flex-col gap-3" role="status" aria-label="Loading">
      {block && <Skeleton className="h-32 w-full rounded-box" />}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-4 w-4" />
          <Skeleton className={cn("h-2.5", i % 2 ? "w-2/5" : "w-3/5")} />
          <Skeleton className="ml-auto h-2.5 w-10" />
        </div>
      ))}
    </div>
  );
}
