import type { Metadata } from "next";
import { AdminApp } from "./admin-app";

export const metadata: Metadata = { title: "Admin · Campus Ride Pass" };

export default function AdminPage() {
  return <AdminApp />;
}
