import type { Metadata } from "next";
import { FoundForm } from "./found-form";

export const metadata: Metadata = { title: "Report a found item · OAU Lost & Found" };

export default function NewFoundPage() {
  return <FoundForm />;
}
