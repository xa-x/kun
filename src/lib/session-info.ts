"use client";

import { readJson } from "./http";

export interface SessionInfo {
  user: { id: string; email: string } | null;
  platformAdmin?: boolean;
}

// One session fetch per page load, shared across header mounts.
let sessionPromise: Promise<SessionInfo> | null = null;

export function fetchSessionInfo(): Promise<SessionInfo> {
  sessionPromise ??= fetch("/api/auth/session")
    .then((r) => readJson<SessionInfo>(r))
    .catch(() => ({ user: null }) as SessionInfo);
  return sessionPromise;
}
