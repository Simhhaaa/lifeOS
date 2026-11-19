"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { buildSampleWorld, type World } from "./world";

/**
 * Phase 0 preview data source. No backend: sample data is generated in the
 * browser from the viewer's clock. `?state=loading|empty|error` forces a UI
 * state for design review.
 */
export type PreviewState = "ready" | "loading" | "empty" | "error";
export const PREVIEW_STATES: PreviewState[] = ["ready", "loading", "empty", "error"];

interface Ctx {
  data: World | null;
  /** effective state (loading until the client clock is available) */
  state: PreviewState;
  forced: PreviewState;
  setForced: (s: PreviewState) => void;
  retry: () => void;
}

const PreviewContext = createContext<Ctx | null>(null);

function readStateParam(): PreviewState {
  const v = new URLSearchParams(window.location.search).get("state");
  return PREVIEW_STATES.includes(v as PreviewState) ? (v as PreviewState) : "ready";
}

export function PreviewProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<World | null>(null);
  const [forced, setForcedState] = useState<PreviewState>("ready");

  useEffect(() => {
    // Client-only: dates come from the viewer's clock, never from the build.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForcedState(readStateParam());
    setData(buildSampleWorld(new Date()));
    const onPop = () => setForcedState(readStateParam());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const setForced = useCallback((s: PreviewState) => {
    const url = new URL(window.location.href);
    if (s === "ready") url.searchParams.delete("state");
    else url.searchParams.set("state", s);
    window.history.replaceState(null, "", url);
    setForcedState(s);
  }, []);

  const retry = useCallback(() => {
    setForced("ready");
    setData(buildSampleWorld(new Date()));
  }, [setForced]);

  const state: PreviewState = data === null ? "loading" : forced;
  return <PreviewContext.Provider value={{ data, state, forced, setForced, retry }}>{children}</PreviewContext.Provider>;
}

export function usePreview(): Ctx {
  const ctx = useContext(PreviewContext);
  if (!ctx) throw new Error("usePreview must be used inside <PreviewProvider>");
  return ctx;
}
