"use client";

import { type FormEvent, useState } from "react";
import { DemoBanner } from "@/components/demo-banner";
import { api } from "@/lib/client/api";
import { LEDGER_LABELS } from "@/lib/labels";
import { formatNaira } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import type { LedgerEntry } from "@/lib/types";

const QUICK_AMOUNTS = [500, 1000, 2000];

export function WalletCard({
  balanceKobo,
  ledger,
  onChange,
}: {
  balanceKobo: number | null;
  ledger: LedgerEntry[];
  onChange: () => void;
}) {
  const [custom, setCustom] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function topUp(amountNaira: number | string) {
    setBusy(true);
    setMessage("");
    try {
      const { balanceKobo: next } = await api<{ balanceKobo: number }>("/api/wallet/topup", { body: { amountNaira } });
      setMessage(`Added. New balance ${formatNaira(next)}.`);
      setCustom("");
      onChange();
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void topUp(custom);
  }

  return (
    <section aria-labelledby="wallet-heading" className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
      <div>
        <h2 id="wallet-heading" className="text-lg font-bold">
          Wallet balance
        </h2>
        <p className="text-4xl font-bold tabular-nums" aria-live="polite">
          {balanceKobo === null ? "…" : formatNaira(balanceKobo)}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="font-semibold">Top up (demo)</h3>
        <DemoBanner>no payment is taken and no real money moves. A real system would add money only after a payment provider confirms it.</DemoBanner>
        <div className="flex flex-wrap gap-2">
          {QUICK_AMOUNTS.map((amount) => (
            <button
              key={amount}
              type="button"
              disabled={busy}
              onClick={() => topUp(amount)}
              className="rounded-md border-2 border-primary px-4 py-2 font-semibold text-primary disabled:opacity-60"
            >
              + {formatNaira(amount * 100)}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="topup-amount" className="text-sm font-semibold">
              Other amount (₦, up to 20,000)
            </label>
            <input
              id="topup-amount"
              inputMode="numeric"
              pattern="[0-9]*"
              value={custom}
              onChange={(e) => setCustom(e.target.value.replace(/\D/g, ""))}
              className="w-40 rounded-md border border-border bg-bg px-3 py-2 tabular-nums"
            />
          </div>
          <button
            type="submit"
            disabled={busy || !custom}
            className="rounded-md bg-primary px-4 py-2 font-semibold text-primary-fg disabled:opacity-60"
          >
            Add demo credit
          </button>
        </form>
        <p role="status" className="text-sm empty:hidden">
          {message}
        </p>
      </div>

      <details>
        <summary className="cursor-pointer font-semibold">Wallet history ({ledger.length})</summary>
        {ledger.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No transactions yet.</p>
        ) : (
          <ul className="mt-2 flex flex-col divide-y divide-border text-sm">
            {ledger.map((entry) => (
              <li key={entry.id} className="flex items-baseline justify-between gap-3 py-2">
                <span>
                  <span className="font-semibold">{LEDGER_LABELS[entry.kind]}</span>
                  {entry.note && entry.note !== LEDGER_LABELS[entry.kind] && (
                    <span className="block text-muted">{entry.note}</span>
                  )}
                  <span className="block text-muted">{formatDateTime(entry.createdAt)}</span>
                </span>
                <span className={`font-bold tabular-nums ${entry.amountKobo < 0 ? "" : "text-ok"}`}>
                  {entry.amountKobo < 0 ? "−" : "+"}
                  {formatNaira(Math.abs(entry.amountKobo))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </details>
    </section>
  );
}
