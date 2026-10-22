import type { Metadata } from "next";
import { AdminDashboard } from "./admin-dashboard";

export const metadata: Metadata = { title: "Admin · AACNRAS" };

export default function AdminPage() {
  return <AdminDashboard />;
}
