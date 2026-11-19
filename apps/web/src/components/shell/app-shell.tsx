"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Tooltip } from "radix-ui";
import { CloudOff } from "lucide-react";
import { PreviewProvider } from "@/lib/preview-store";
import { SessionProvider, useSession } from "@/lib/session";
import { BrandMark } from "./brand";
import { TopNav } from "./top-nav";
import { CommandPalette } from "./command-palette";

/**
 * Desktop shell: a top navigation bar (module tabs at ≥1280px, a module
 * menu below that) over a centred content column. No sidebar.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <Gate>{children}</Gate>
    </SessionProvider>
  );
}

/** Everything except /login needs a session (Phase 3). */
function Gate({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === "/login";

  useEffect(() => {
    if (!isLogin && status === "anonymous") {
      router.replace(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    }
  }, [isLogin, status, router]);

  if (isLogin) return <>{children}</>;
  if (status === "authenticated") return <Shell>{children}</Shell>;
  return (
    <div className="grid min-h-dvh place-items-center px-5" role="status">
      {status === "offline" ? (
        <div className="max-w-sm text-center">
          <CloudOff size={22} className="mx-auto text-coral" aria-hidden />
          <p className="mt-3 font-display text-lg font-semibold text-ink">Can’t reach the LIFEOS server</p>
          <p className="mt-1 text-sm text-ink-2">Check that the API is running, then reload.</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-4 h-10 rounded-full bg-well px-4 text-sm text-ink">
            Reload
          </button>
        </div>
      ) : (
        <span className="animate-pulse" aria-label="Loading">
          <BrandMark size={32} />
        </span>
      )}
    </div>
  );
}

function Shell({ children }: { children: ReactNode }) {
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
