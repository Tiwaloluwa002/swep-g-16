import type { Metadata } from "next";
import { LostForm } from "./lost-form";

export const metadata: Metadata = { title: "Report a lost item · OAU Lost & Found" };

export default function NewLostPage() {
  return <LostForm />;
}
