import type { Metadata } from "next";
import { ConductorApp } from "./conductor-app";

export const metadata: Metadata = { title: "Verify tickets · Campus Ride Pass" };

export default function ConductorPage() {
  return <ConductorApp />;
}
