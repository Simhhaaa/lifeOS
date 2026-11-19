"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api } from "./client";

export type ResourceState<T> =
  | { status: "loading"; data: undefined; error: undefined }
  | { status: "ready"; data: T; error: undefined }
  | { status: "error"; data: T | undefined; error: ApiError };

/**
 * Minimal fetch-on-mount hook with reload and optimistic local updates.
 * `path = null` skips fetching (e.g. until the client clock is known).
 */
export function useResource<T>(path: string | null, query?: Record<string, string | number | undefined>) {
  const [state, setState] = useState<ResourceState<T>>({ status: "loading", data: undefined, error: undefined });
  const q = JSON.stringify(query ?? {});
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (path === null) return;
    const mine = ++seq.current;
    try {
      const data = await api<T>(path, { query: JSON.parse(q) });
      if (mine === seq.current) setState({ status: "ready", data, error: undefined });
    } catch (e) {
      if (mine === seq.current) {
        setState((s) => ({ status: "error", data: s.data, error: e instanceof ApiError ? e : new ApiError({ type: "", title: String(e), status: 0, code: "error" }) }));
      }
    }
  }, [path, q]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Replace local data immediately (optimistic), without refetching. */
  const mutate = useCallback((fn: (prev: T) => T) => {
    setState((s) => (s.data === undefined ? s : { status: "ready", data: fn(s.data), error: undefined }));
  }, []);

  return { ...state, reload: load, mutate };
}
