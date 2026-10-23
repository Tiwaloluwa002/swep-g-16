import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoading } from "@/components/ui";
import { ClaimDetail } from "./claim-detail";

export const metadata: Metadata = { title: "Claim · OAU Lost & Found" };

export default function ClaimPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <ClaimDetail />
    </Suspense>
  );
}
