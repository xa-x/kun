export type Role = "owner" | "admin" | "editor" | "viewer";

/** Roles someone can be given. Ownership is not handed out. */
export const ASSIGNABLE_ROLES: Role[] = ["admin", "editor", "viewer"];

export const ROLE_HELP: Record<Role, string> = {
  owner: "Everything, including billing and deleting the workspace.",
  admin: "Manage members, settings, keys and automation.",
  editor: "Create and run projects.",
  viewer: "Look around and run what's already built; no changes.",
};

export function isAssignable(role: unknown): role is Role {
  return ASSIGNABLE_ROLES.includes(role as Role);
}

/** Whether `actor` may change or remove a member holding `target`. */
export function canManageMember(actor: string, target: string, isSelf: boolean): boolean {
  if (target === "owner") return false;
  if (isSelf) return true; // leaving
  return actor === "owner" || actor === "admin";
}

/** Invite links last a week. */
export const INVITE_DAYS = 7;
