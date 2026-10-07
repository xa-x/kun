import { requirePageActor } from "@/lib/guard";

/**
 * The canvas editor owns the whole viewport, so it sits outside the workspace
 * shell. It shares the same session guard.
 */
export default async function EditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePageActor();
  return <>{children}</>;
}
