import type { ReactNode } from "react";
import { RotateCw, TriangleAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "./button";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-box border border-dashed border-edge-strong p-4">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-well text-ink-3">
        <Icon size={16} strokeWidth={1.75} aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="font-display text-[15px] font-semibold text-ink">{title}</p>
        <p className="mt-0.5 text-xs text-ink-2">{description}</p>
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}

export function ErrorState({ what, onRetry }: { what: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-box border border-dashed border-error/40 p-4">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-error-soft text-error">
        <TriangleAlert size={16} strokeWidth={1.75} aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="font-display text-[15px] font-semibold text-ink">Couldn’t load {what}</p>
        <p className="mt-0.5 text-xs text-ink-2">The rest of the dashboard is unaffected. Your data is safe.</p>
        {onRetry && (
          <Button size="sm" variant="secondary" onClick={onRetry} className="mt-3">
            <RotateCw size={12} aria-hidden /> Retry
          </Button>
        )}
      </div>
    </div>
  );
}
