import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoading } from "@/components/ui";
import { FoundDetail } from "./found-detail";

export const metadata: Metadata = { title: "Found report · OAU Lost & Found" };

export default function FoundPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <FoundDetail />
    </Suspense>
  );
}
