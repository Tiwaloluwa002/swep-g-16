import type { Metadata } from "next";
import { Dashboard } from "./dashboard";

export const metadata: Metadata = { title: "My reports · OAU Lost & Found" };

export default function DashboardPage() {
  return <Dashboard />;
}
