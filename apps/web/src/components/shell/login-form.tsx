"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, LockKeyhole } from "lucide-react";
import { ApiError } from "@/lib/api/client";
import { useSession } from "@/lib/session";
import { BrandMark } from "./brand";

/** Private login (no sign-up). Errors never say whether the username exists. */
export function LoginForm() {
  const { login, status } = useSession();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const next = () => {
    const n = new URLSearchParams(window.location.search).get("next");
    return n && n.startsWith("/") && !n.startsWith("//") ? n : "/";
  };

  useEffect(() => {
    if (status === "authenticated") router.replace(next());
  }, [status, router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(username.trim(), password);
      router.replace(next());
    } catch (err) {
      const api = err instanceof ApiError ? err : null;
      setError(
        api?.code === "rate_limited"
          ? (api.problem.detail ?? "Too many attempts. Wait a few minutes.")
          : api?.status === 401
            ? "That username and password don’t match."
            : api?.code === "network_error" || (api && api.status >= 500)
              ? "Can’t reach the LIFEOS server. Is the API running?"
              : "Couldn’t log in. Try again.",
      );
      setPassword("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center px-5">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 flex items-center gap-3">
          <BrandMark size={36} />
          <div>
            <p className="font-display text-[26px] leading-none font-semibold tracking-[-0.03em] text-ink">
              life<span className="text-saffron">os</span>
            </p>
            <p className="mt-1 text-xs text-ink-3">Private system · one owner</p>
          </div>
        </div>
        <form onSubmit={submit} className="rounded-slab border border-edge bg-slab p-6" aria-describedby={error ? "login-error" : undefined}>
          <h1 className="font-display text-[22px] font-semibold tracking-[-0.02em] text-ink">Log in</h1>
          <label className="mt-5 block text-xs text-ink-2" htmlFor="username">
            Username
          </label>
          <input
            id="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mt-1.5 h-11 w-full rounded-ctl border border-edge-strong bg-base px-3.5 text-[15px] text-ink outline-none focus:border-saffron-line"
          />
          <label className="mt-4 block text-xs text-ink-2" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1.5 h-11 w-full rounded-ctl border border-edge-strong bg-base px-3.5 text-[15px] text-ink outline-none focus:border-saffron-line"
          />
          {error && (
            <p id="login-error" role="alert" className="mt-3 rounded-ctl bg-coral-soft px-3 py-2 text-xs text-coral">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy || !username || !password}
            className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-saffron text-[15px] font-semibold text-saffron-ink transition disabled:opacity-50"
          >
            {busy ? <LoaderCircle size={16} className="animate-spin" aria-hidden /> : <LockKeyhole size={15} aria-hidden />}
            {busy ? "Checking…" : "Log in"}
          </button>
          {status === "offline" && <p className="mt-3 text-center text-2xs text-coral">The API isn’t reachable right now.</p>}
        </form>
        <p className="mt-4 text-center text-2xs text-ink-3">
          No sign-up. The owner account is created on the server with <code className="num">app.cli create-owner</code>.
        </p>
      </div>
    </main>
  );
}
