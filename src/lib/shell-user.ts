import type { Actor } from "./auth";
import { isPlatformAdmin } from "./admin";
import type { ShellUser } from "@/components/shell/AppShell";

/** What the signed-in frame shows about the person and their active workspace. */
export function shellUser(actor: Actor): ShellUser {
  return {
    name: actor.user.name,
    email: actor.user.email,
    plan: actor.org.plan,
    isAdmin: isPlatformAdmin(actor.user.email),
    workspace: { id: actor.org.id, name: actor.org.name, plan: actor.org.plan },
  };
}
