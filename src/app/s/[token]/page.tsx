import { ShareView } from "@/components/ShareView";

// Server component wrapper — the token is awaited here instead of `use()`d in
// a client page, which can hang the route's loading boundary on a hard load.
export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <ShareView token={token} />;
}
