import { TICKET_STATUS_LABELS } from "@/lib/labels";
import type { TicketStatus } from "@/lib/types";

const STYLE: Record<TicketStatus, string> = {
  active: "border-ok text-ok",
  redeemed: "border-muted text-muted",
  expired: "border-danger text-danger",
  refunded: "border-muted text-muted",
};

export function StatusBadge({ status }: { status: TicketStatus }) {
  return (
    <span className={`inline-block rounded-full border-2 px-2.5 py-0.5 text-sm font-bold ${STYLE[status]}`}>
      {TICKET_STATUS_LABELS[status]}
    </span>
  );
}
