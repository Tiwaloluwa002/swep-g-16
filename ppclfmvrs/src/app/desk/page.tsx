import type { Metadata } from "next";
import { DeskDashboard } from "./desk-dashboard";

export const metadata: Metadata = { title: "Desk · OAU Lost & Found" };

export default function DeskPage() {
  return <DeskDashboard />;
}
