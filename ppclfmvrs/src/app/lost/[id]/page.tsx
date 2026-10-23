import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoading } from "@/components/ui";
import { LostDetail } from "./lost-detail";

export const metadata: Metadata = { title: "Lost report · OAU Lost & Found" };

export default function LostPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <LostDetail />
    </Suspense>
  );
}
