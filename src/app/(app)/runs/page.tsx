import type { Metadata } from "next";
import { Suspense } from "react";
import { RunsHistory } from "@/components/RunsHistory";

export const metadata: Metadata = { title: "Runs" };

export default function RunsPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-5xl px-5 py-12 md:px-10">
          <div className="kun-skeleton h-9 w-40" />
          <div className="mt-10 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="kun-skeleton h-[68px]" />
            ))}
          </div>
        </div>
      }
    >
      <RunsHistory />
    </Suspense>
  );
}
