"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DropdownMenu } from "radix-ui";
import { ChevronDown, Plus, Search, User } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/info";
import { Ring } from "@/components/ui/progress";
import { usePreview } from "@/lib/preview-store";
import { useIsMac } from "@/lib/use-media-query";
import { Brand } from "./brand";
import { ALL_NAV, LOG_ACTIONS, PRIMARY_NAV, activeNav } from "./nav";

const menuCls =
  "z-50 min-w-60 animate-fade-in rounded-box border border-edge-strong bg-slab p-1.5 shadow-2xl shadow-black/60";
const itemCls =
  "flex h-9 cursor-pointer items-center gap-2.5 rounded-ctl px-2.5 text-sm text-ink-2 outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-45 data-[highlighted]:bg-well data-[highlighted]:text-ink";

/** Module tabs at ≥1280px. */
function Tabs() {
  const pathname = usePathname();
  const current = activeNav(pathname);
  return (
    <nav aria-label="Modules" className="hidden items-center gap-0.5 xl:flex">
      {PRIMARY_NAV.map((n) => {
        const active = current?.href === n.href;
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex h-9 items-center rounded-full px-3.5 text-sm transition",
              active ? "bg-well text-ink" : "text-ink-2 hover:text-ink",
            )}
          >
            {active && <span aria-hidden className="mr-2 h-1.5 w-1.5 rounded-full bg-saffron" />}
            {n.short}
          </Link>
        );
      })}
    </nav>
  );
}

/** Module switcher below 1280px. */
function ModuleMenu() {
  const pathname = usePathname();
  const current = activeNav(pathname);
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="flex h-9 items-center gap-2 rounded-full bg-well px-3.5 text-sm text-ink transition hover:bg-well-strong xl:hidden"
        >
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-saffron" />
          {current?.label ?? "Modules"}
          <ChevronDown size={14} className="text-ink-3" aria-hidden />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="start" sideOffset={8} className={menuCls}>
          {ALL_NAV.map((n) => (
            <DropdownMenu.Item key={n.href} asChild className={itemCls}>
              <Link href={n.href}>
                <n.icon size={15} strokeWidth={1.75} aria-hidden />
                {n.label}
                {!n.ready && <span className="ml-auto text-2xs text-ink-3">Not designed</span>}
              </Link>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/** Persistent level indicator (replaces a sidebar level card). */
function LevelPill() {
  const { data, state } = usePreview();
  if (state !== "ready" || !data) return null;
  const p = data.profile.progress;
  return (
    <Tooltip content={`Level ${p.level} · ${p.toNext.toLocaleString()} XP to level ${p.level + 1} (sample data)`}>
      <span
        tabIndex={0}
        aria-label={`Level ${p.level}, ${Math.floor(p.ratio * 100)} percent to next`}
        className="hidden h-9 items-center gap-2 rounded-full bg-well pr-3.5 pl-1 md:flex"
      >
        <Ring value={p.ratio} />
        <span className="num text-xs text-ink">
          Lv <span className="text-saffron">{p.level}</span>
        </span>
      </span>
    </Tooltip>
  );
}

export function TopNav({ onOpenPalette }: { onOpenPalette: () => void }) {
  const isMac = useIsMac();
  return (
    <header className="sticky top-0 z-30 border-b border-edge/70 bg-base/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1520px] items-center gap-4 px-5 md:px-8 xl:gap-6">
        <Brand />
        <Tabs />
        <ModuleMenu />

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenPalette}
            aria-label="Search or jump to"
            aria-keyshortcuts={isMac ? "Meta+K" : "Control+K"}
            className="flex h-9 items-center gap-2 rounded-full bg-well px-3 text-sm text-ink-3 transition hover:bg-well-strong hover:text-ink-2"
          >
            <Search size={15} strokeWidth={1.75} aria-hidden />
            <span className="hidden lg:inline">Search</span>
            <kbd className="num hidden rounded-md bg-base/60 px-1.5 text-2xs text-ink-3 sm:inline">
              {isMac ? "⌘K" : "Ctrl K"}
            </kbd>
          </button>

          <LevelPill />

          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button variant="primary" size="md" className="px-3.5">
                <Plus size={15} strokeWidth={2.5} aria-hidden />
                <span className="hidden sm:inline">Log</span>
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content align="end" sideOffset={8} className={menuCls}>
                <DropdownMenu.Label className="px-2.5 pt-1.5 pb-1 text-2xs font-medium text-ink-3">Quick log</DropdownMenu.Label>
                {LOG_ACTIONS.map((a) => (
                  <DropdownMenu.Item key={a} disabled className={itemCls}>
                    {a}
                  </DropdownMenu.Item>
                ))}
                <DropdownMenu.Separator className="my-1.5 h-px bg-edge" />
                <p className="px-2.5 pb-1 text-2xs text-ink-3">Logging is designed after the dashboard is approved.</p>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>

          <Tooltip content="Profile — not available in Phase 0. Local preview, nothing is synced.">
            <span
              tabIndex={0}
              aria-label="Profile (local preview, not synced)"
              className="grid h-9 w-9 place-items-center rounded-full border border-edge-strong text-ink-3"
            >
              <User size={15} strokeWidth={1.75} aria-hidden />
            </span>
          </Tooltip>
        </div>
      </div>
    </header>
  );
}
