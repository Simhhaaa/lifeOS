"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { ApiError, api } from "./api/client";
import type { User } from "./api/types";

type Status = "checking" | "authenticated" | "anonymous" | "offline";

interface SessionCtx {
  status: Status;
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<SessionCtx | null>(null);

/** Who is logged in. The session itself lives in httpOnly cookies set by the API. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("checking");
  const [user, setUser] = useState<User | null>(null);

  const check = useCallback(async () => {
    try {
      setUser(await api<User>("/me"));
      setStatus("authenticated");
    } catch (e) {
      setUser(null);
      setStatus(e instanceof ApiError && (e.code === "network_error" || e.code === "server_error") ? "offline" : "anonymous");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void check();
  }, [check]);

  const login = useCallback(
    async (username: string, password: string) => {
      await api("/auth/login", { method: "POST", body: { username, password, client: "web" } });
      await check();
    },
    [check],
  );

  const logout = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
      setStatus("anonymous");
    }
  }, []);

  return <Ctx.Provider value={{ status, user, login, logout }}>{children}</Ctx.Provider>;
}

export function useSession(): SessionCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}
