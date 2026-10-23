"use client";

import { useEffect, useRef } from "react";
import { TicketQr } from "@/components/ticket-qr";
import { liveStatus } from "@/lib/client/ticket-status";
import { useNow } from "@/lib/client/use-now";
import { formatNaira } from "@/lib/money";
import { formatDuration, formatTime } from "@/lib/time";
import type { OwnTicket } from "@/lib/types";

/** Full-screen ticket to hold up to the conductor. */
export function TicketDialog({ ticket, onClose }: { ticket: OwnTicket | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const now = useNow();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (ticket && !dialog.open) dialog.showModal();
    if (!ticket && dialog.open) dialog.close();
  }, [ticket]);

  const expired = ticket ? liveStatus(ticket, now) !== "active" : false;

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="ticket-dialog-title"
      className="m-auto max-h-[calc(100dvh-1rem)] w-[min(100vw-2rem,26rem)] overflow-y-auto rounded-xl border border-border bg-surface p-0 text-fg"
    >
      {ticket && (
        <div className="flex flex-col items-center gap-3 p-5 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-muted">Campus Ride Pass · single use</p>
          <h2 id="ticket-dialog-title" className="text-2xl font-bold">
            {ticket.routeName}
          </h2>
          {expired ? (
            <p className="text-xl font-bold text-danger">This ticket is no longer valid.</p>
          ) : (
            <TicketQr token={ticket.token} label={`QR code for your ${ticket.routeName} ticket`} />
          )}
          <div>
            <p className="text-sm text-muted">Backup code for manual entry</p>
            <p className="font-mono text-3xl font-bold tracking-widest">{ticket.shortCode}</p>
          </div>
          <p>
            {formatNaira(ticket.fareKobo)} · valid until <strong>{formatTime(ticket.expiresAt)}</strong>
            {now > 0 && !expired && <> ({formatDuration(ticket.expiresAt - now)} left)</>}
          </p>
          <p className="text-sm text-muted">
            Turn your screen brightness up. The conductor scans this once; after that it shows as used.
          </p>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            className="w-full rounded-md border-2 border-border px-4 py-3 font-bold"
          >
            Close
          </button>
        </div>
      )}
    </dialog>
  );
}
