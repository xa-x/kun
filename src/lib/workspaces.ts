export const WORKSPACE_NAME_MAX = 40;

/** A workspace name, trimmed; null when it is empty after trimming. */
export function cleanWorkspaceName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.replace(/\s+/g, " ").trim().slice(0, WORKSPACE_NAME_MAX);
  return name.length >= 2 ? name : null;
}

/** Options for the cookie that remembers the active workspace. */
export const workspaceCookie = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
};
