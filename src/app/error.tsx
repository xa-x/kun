"use client";

import { useEffect } from "react";
import { StatusScreen } from "@/components/StatusScreen";

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusScreen
      kicker="Error"
      title="Something broke"
      body={error.message || "An unexpected error stopped this page."}
      action={
        <button
          onClick={() => retry()}
          className="kun-btn-primary inline-flex h-11 items-center rounded-full px-6 text-[14px] font-medium"
        >
          Try again
        </button>
      }
    />
  );
}
