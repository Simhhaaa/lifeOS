import { ALL_NAV } from "./nav";

/** Shown for modules whose screens are not designed yet (awaiting approval). */
export function ModulePlaceholder({ href }: { href: string }) {
  const item = ALL_NAV.find((n) => n.href === href);
  if (!item) return null;
  const Icon = item.icon;
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-[40px] leading-[1.05] font-semibold tracking-[-0.03em] text-ink">{item.label}</h1>
      <div className="grid min-h-96 place-items-center rounded-slab border border-dashed border-edge-strong bg-slab/60 p-8 text-center">
        <div className="flex max-w-sm flex-col items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-well text-ink-3">
            <Icon size={20} strokeWidth={1.5} aria-hidden />
          </span>
          <p className="font-display text-lg font-semibold text-ink">Not designed yet</p>
          <p className="text-sm text-ink-2">
            The {item.label} screen comes after the Overview dashboard is reviewed and approved (Phase 0, step 4).
          </p>
        </div>
      </div>
    </div>
  );
}
