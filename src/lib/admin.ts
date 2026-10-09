/**
 * Platform admins — the humans who operate this كُن instance. Distinct from
 * the org-scoped membership roles (owner/admin/editor/viewer): everyone owns
 * their personal org, but only ADMIN_EMAILS reach the /(admin) console and
 * the /api/admin/* surface.
 */
export function platformAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isPlatformAdmin(email?: string | null): boolean {
  if (!email) return false;
  return platformAdminEmails().includes(email.trim().toLowerCase());
}

/**
 * While sign-up is closed, only these emails may get an account here:
 * platform admins plus INVITED_EMAILS. Supabase's publishable key is public,
 * so anyone can create an Auth user — this is what keeps them out of the app.
 */
export function isInvited(email?: string | null): boolean {
  if (!email) return false;
  const e = email.trim().toLowerCase();
  if (isPlatformAdmin(e)) return true;
  return (process.env.INVITED_EMAILS ?? "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)
    .includes(e);
}
