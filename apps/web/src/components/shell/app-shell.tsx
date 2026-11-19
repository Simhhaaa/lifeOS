"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Tooltip } from "radix-ui";
import { PreviewProvider } from "@/lib/preview-store";
import { TopNav } from "./top-nav";
import { CommandPalette } from "./command-palette";

/**
 * Desktop shell: a top navigation bar (module tabs at ≥1280px, a module
 * menu below that) over a centred content column. No sidebar.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Cmd+K (macOS) and Ctrl+K (Windows/Linux) toggle the command palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <PreviewProvider>
      <Tooltip.Provider delayDuration={250}>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-full focus:bg-saffron focus:px-4 focus:py-2 focus:text-saffron-ink"
        >
          Skip to content
        </a>
        <TopNav onOpenPalette={() => setPaletteOpen(true)} />
        <main id="main" className="mx-auto w-full max-w-[1520px] px-5 pt-8 pb-16 md:px-8">
          {children}
        </main>
        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      </Tooltip.Provider>
    </PreviewProvider>
  );
}
