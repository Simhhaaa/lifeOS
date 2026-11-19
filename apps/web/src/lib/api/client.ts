/**
 * Browser API client (docs/api-contracts.md §1).
 * - Same-origin `/api/v1` (proxied to FastAPI); httpOnly cookies carry the session.
 * - Mutations send `X-CSRF-Token` (from the readable `lifeos_csrf` cookie) and a fresh `Idempotency-Key`.
 * - A 401 triggers one refresh (shared by concurrent callers), then the request is retried once.
 * - Errors are thrown as `ApiError` carrying the problem+json body.
 */

import type { Problem } from "./types";

export class ApiError extends Error {
  constructor(public problem: Problem) {
    super(problem.detail ?? problem.title);
  }
  get status() {
    return this.problem.status;
  }
  get code() {
    return this.problem.code;
  }
}

const BASE = "/api/v1";
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function csrfToken(): string {
  const m = document.cookie.match(/(?:^|;\s*)lifeos_csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

export function newKey(): string {
  return crypto.randomUUID();
}

let refreshing: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  refreshing ??= fetch(`${BASE}/auth/refresh`, { method: "POST", credentials: "same-origin" })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => setTimeout(() => (refreshing = null), 0));
  return refreshing;
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** record version for If-Match */
  version?: number;
  /** reuse a key to retry the same logical action; a new one is generated otherwise */
  idempotencyKey?: string;
  query?: Record<string, string | number | undefined>;
}

export async function api<T>(path: string, opts: RequestOptions = {}, retried = false): Promise<T> {
  const method = opts.method ?? "GET";
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (MUTATING.has(method)) {
    headers["X-CSRF-Token"] = csrfToken(); // required for every cookie-authenticated mutation, logout included
    if (!path.startsWith("/auth/")) headers["Idempotency-Key"] = opts.idempotencyKey ?? newKey();
  }
  if (opts.version !== undefined) headers["If-Match"] = String(opts.version);

  const qs = opts.query
    ? "?" +
      new URLSearchParams(
        Object.entries(opts.query).filter((e): e is [string, string | number] => e[1] !== undefined).map(([k, v]) => [k, String(v)]),
      ).toString()
    : "";

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}${qs}`, {
      method,
      headers,
      credentials: "same-origin",
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
  } catch {
    throw new ApiError({ type: "about:blank", title: "Can’t reach the server", status: 0, code: "network_error" });
  }

  if (res.status === 401 && !retried && !path.startsWith("/auth/")) {
    if (await refreshSession()) return api<T>(path, opts, true);
  }
  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = undefined; // e.g. a proxy error page when the API is down
  }
  if (!res.ok) {
    throw new ApiError(
      data && typeof data === "object" && "code" in data
        ? (data as Problem)
        : {
            type: "about:blank",
            title: res.status >= 500 ? "The server had a problem" : res.statusText || "Request failed",
            status: res.status,
            code: res.status >= 500 ? "server_error" : "error",
          },
    );
  }
  return data as T;
}
