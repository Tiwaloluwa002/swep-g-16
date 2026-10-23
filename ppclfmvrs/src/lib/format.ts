import { CATEGORIES } from "./catalog";
import type { Category, ClaimStatus, FoundStatus, LostStatus } from "./types";

export function itemTitle(item: { colour: string; category: Category; brand?: string }): string {
  const colour = item.colour === "multicolour" ? "Multicoloured" : item.colour[0].toUpperCase() + item.colour.slice(1);
  // Lowercase the label for mid-sentence use, but keep acronyms such as "ID".
  const label = CATEGORIES[item.category].replace(/^[A-Z](?=[a-z])/, (c) => c.toLowerCase());
  return [colour, item.brand, label].filter(Boolean).join(" ");
}

export function formatDate(iso: string): string {
  return new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export const LOST_STATUS: Record<LostStatus, string> = { open: "Still looking", recovered: "Recovered", closed: "Closed" };

export const FOUND_STATUS: Record<FoundStatus, string> = {
  open: "Waiting for owner",
  pending_handover: "Owner verified, awaiting handover",
  recovered: "Returned to owner",
  closed: "Closed",
};

export const CLAIM_STATUS: Record<ClaimStatus, string> = {
  open: "Answer the questions",
  verified: "Verified, collect your item",
  locked: "Locked after wrong answers",
  completed: "Handed over",
  cancelled: "Given to another verified owner",
};

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
