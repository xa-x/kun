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
