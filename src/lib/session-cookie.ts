/**
 * Supabase stores the session in `sb-<project-ref>-auth-token` (chunked into
 * `.0`, `.1`, ... when large). `localhost` cookies are shared by every dev
 * server on the machine, so matching any `sb-*` cookie mistakes another
 * project's session for ours. Match this project's cookie exactly.
 */
function projectRef(): string | null {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  if (!url) return null;
  try {
    return new URL(url).hostname.split(".")[0] || null;
  } catch {
    return null;
  }
}

export function hasSessionCookie(cookies: { name: string }[]): boolean {
  const ref = projectRef();
  const name = ref
    ? new RegExp(`^sb-${ref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-auth-token(\\.\\d+)?$`)
    : /^sb-.+-auth-token(\.\d+)?$/;
  return cookies.some((c) => name.test(c.name));
}
