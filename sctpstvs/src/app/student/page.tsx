import type { Metadata } from "next";
import { StudentApp } from "./student-app";

export const metadata: Metadata = { title: "My wallet and tickets · Campus Ride Pass" };

export default function StudentPage() {
  return <StudentApp />;
}
