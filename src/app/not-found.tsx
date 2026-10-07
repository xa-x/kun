import Link from "next/link";
import { StatusScreen } from "@/components/StatusScreen";

export default function NotFound() {
  return (
    <StatusScreen
      kicker="404"
      title="This page isn’t here"
      body="It may have been moved or deleted, or the link is out of date."
      action={
        <Link
          href="/"
          className="kun-btn-primary inline-flex h-11 items-center rounded-full px-6 text-[14px] font-medium"
        >
          Go to Kun
        </Link>
      }
    />
  );
}
