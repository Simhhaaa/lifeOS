"use client";

import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Dialog } from "radix-ui";
import { CornerDownLeft, Eye, PenLine, Search, Smartphone } from "lucide-react";
import { ALL_NAV, LOG_ACTIONS } from "./nav";
import { PREVIEW_STATES, usePreview } from "@/lib/preview-store";

const itemCls =
  "flex h-10 cursor-pointer items-center gap-3 rounded-ctl px-3 text-sm text-ink-2 data-[selected=true]:bg-well data-[selected=true]:text-ink data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-45";
const groupCls =
  "[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-2xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-ink-3";

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const { forced, setForced } = usePreview();

  const run = (fn: () => void) => {
    onOpenChange(false);
    fn();
  };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Command palette"
      overlayClassName="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm animate-fade-in"
      contentClassName="fixed top-[13vh] left-1/2 z-50 w-[min(580px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-slab border border-edge-strong bg-slab shadow-2xl shadow-black/70 animate-fade-in"
    >
      <Dialog.Title className="sr-only">Command palette</Dialog.Title>
      <Dialog.Description className="sr-only">Search pages and actions</Dialog.Description>
      <div className="flex items-center gap-3 border-b border-edge px-5">
        <Search size={17} className="text-saffron" aria-hidden />
        <Command.Input
          placeholder="Jump to a module or action…"
          className="h-14 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3"
        />
        <kbd className="num rounded-md bg-well px-1.5 text-2xs text-ink-3">esc</kbd>
      </div>
      <Command.List className="max-h-[min(440px,60vh)] overflow-y-auto p-2">
        <Command.Empty className="py-10 text-center text-sm text-ink-3">No matching modules or actions.</Command.Empty>

        <Command.Group heading="Go to" className={groupCls}>
          {ALL_NAV.map((item) => (
            <Command.Item key={item.href} value={`go ${item.label}`} onSelect={() => run(() => router.push(item.href))} className={itemCls}>
              <item.icon size={16} strokeWidth={1.75} aria-hidden />
              {item.label}
              {!item.ready && <span className="ml-auto text-2xs text-ink-3">Not designed yet</span>}
            </Command.Item>
          ))}
        </Command.Group>

        <Command.Group heading="Log" className={groupCls}>
          {LOG_ACTIONS.map((a) => (
            <Command.Item key={a} value={`log ${a}`} disabled className={itemCls}>
              <PenLine size={16} strokeWidth={1.75} aria-hidden />
              Log {a.toLowerCase()}
              <span className="ml-auto text-2xs text-ink-3">Not in Phase 0</span>
            </Command.Item>
          ))}
        </Command.Group>

        <Command.Group heading="Design review" className={groupCls}>
          <Command.Item value="design mobile frames" onSelect={() => run(() => router.push("/mobile"))} className={itemCls}>
            <Smartphone size={16} strokeWidth={1.75} aria-hidden />
            Mobile design frames
          </Command.Item>
        </Command.Group>

        <Command.Group heading="Design review · preview state" className={groupCls}>
          {PREVIEW_STATES.map((s) => (
            <Command.Item key={s} value={`preview state ${s}`} onSelect={() => run(() => setForced(s))} className={itemCls}>
              <Eye size={16} strokeWidth={1.75} aria-hidden />
              Show {s} state
              {forced === s && <span className="ml-auto text-2xs text-saffron">Current</span>}
            </Command.Item>
          ))}
        </Command.Group>
      </Command.List>
      <div className="flex items-center gap-4 border-t border-edge px-5 py-2.5 text-2xs text-ink-3">
        <span className="inline-flex items-center gap-1">
          <CornerDownLeft size={11} aria-hidden /> open
        </span>
        <span>↑ ↓ move</span>
      </div>
    </Command.Dialog>
  );
}
