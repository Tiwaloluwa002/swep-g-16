"use client";

import { useCallback, useEffect, useState } from "react";
import { RoleGate } from "@/components/role-gate";
import { api } from "@/lib/client/api";
import type { LedgerEntry, OwnTicket, Route } from "@/lib/types";
import { BuyTicket } from "./buy-ticket";
import { TicketDialog } from "./ticket-dialog";
import { TicketList } from "./ticket-list";
import { WalletCard } from "./wallet-card";

export function StudentApp() {
  return <RoleGate roles={["student"]}>{() => <StudentHome />}</RoleGate>;
}

function StudentHome() {
  const [balance, setBalance] = useState<number | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [tickets, setTickets] = useState<OwnTicket[]>([]);
  const [error, setError] = useState("");
  const [shownTicket, setShownTicket] = useState<OwnTicket | null>(null);

  const load = useCallback(() => {
    Promise.all([
      api<{ balanceKobo: number; ledger: LedgerEntry[] }>("/api/wallet"),
      api<{ routes: Route[] }>("/api/routes"),
      api<{ tickets: OwnTicket[] }>("/api/tickets"),
    ])
      .then(([wallet, r, t]) => {
        setBalance(wallet.balanceKobo);
        setLedger(wallet.ledger);
        setRoutes(r.routes);
        setTickets(t.tickets);
        setError("");
      })
      .catch((err: Error) => setError(err.message));
  }, []);
  useEffect(load, [load]);

  return (
    <main id="main" className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6">
      <h1 className="sr-only">My wallet and tickets</h1>
      {error && (
        <p role="alert" className="rounded-md border border-danger px-3 py-2 text-danger">
          {error}
        </p>
      )}
      {/* Phones: wallet, tickets, then buying. Wider screens: wallet and buying left, tickets right. */}
      <div className="grid gap-6 md:grid-cols-2 md:items-start">
        <WalletCard balanceKobo={balance} ledger={ledger} onChange={load} />
        <div className="md:col-start-2 md:row-span-2 md:row-start-1">
          <TicketList tickets={tickets} onShow={setShownTicket} />
        </div>
        <BuyTicket
          routes={routes}
          balanceKobo={balance}
          onBought={(ticket) => {
            load();
            setShownTicket(ticket);
          }}
        />
      </div>
      <TicketDialog ticket={shownTicket} onClose={() => setShownTicket(null)} />
    </main>
  );
}
