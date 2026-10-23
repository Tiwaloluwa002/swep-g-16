"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";
import { DemoBanner } from "@/components/demo-banner";
import { api } from "@/lib/client/api";
import { formatNaira } from "@/lib/money";
import type { StudentWallet } from "@/lib/types";
import { ErrorText, TableBox, buttonClass, inputClass } from "./ui";

export function WalletsTab() {
  const [wallets, setWallets] = useState<StudentWallet[] | null>(null);
  const [matric, setMatric] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(() => {
    api<{ wallets: StudentWallet[] }>("/api/admin/wallets")
      .then((r) => setWallets(r.wallets))
      .catch((err: Error) => setError(err.message));
  }, []);
  useEffect(load, [load]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      const { balanceKobo } = await api<{ balanceKobo: number }>("/api/admin/credit", {
        body: { matric, amountNaira: Number(amount), note },
      });
      setMessage(`Credited ${formatNaira(Number(amount) * 100)} to ${matric}. New balance ${formatNaira(balanceKobo)}.`);
      setAmount("");
      setNote("");
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <>
      <form onSubmit={submit} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <h2 className="text-lg font-bold">Credit a wallet</h2>
        <DemoBanner>for example, cash paid at the transport office. Each credit is a new ledger entry; nothing is ever edited or deleted.</DemoBanner>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="credit-matric" className="text-sm font-semibold">
              Student
            </label>
            <select id="credit-matric" value={matric} onChange={(e) => setMatric(e.target.value)} required className={inputClass}>
              <option value="">Choose…</option>
              {wallets?.map((w) => (
                <option key={w.userId} value={w.matric}>
                  {w.matric} · {w.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="credit-amount" className="text-sm font-semibold">
              Amount (₦, up to 20,000)
            </label>
            <input
              id="credit-amount"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
              required
              className={`${inputClass} tabular-nums`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="credit-note" className="text-sm font-semibold">
              Note (optional)
            </label>
            <input id="credit-note" value={note} maxLength={100} onChange={(e) => setNote(e.target.value)} className={inputClass} />
          </div>
        </div>
        <button type="submit" disabled={!matric || !amount} className={`${buttonClass} self-start`}>
          Credit wallet
        </button>
        <ErrorText message={error} />
        {message && (
          <p role="status" className="text-ok">
            {message}
          </p>
        )}
      </form>

      {wallets === null ? (
        <p role="status">Loading…</p>
      ) : (
        <TableBox label="Student wallets">
          <thead>
            <tr>
              <th scope="col">Matric number</th>
              <th scope="col">Name</th>
              <th scope="col" className="text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {wallets.map((w) => (
              <tr key={w.userId}>
                <td className="font-mono">{w.matric}</td>
                <td>{w.name}</td>
                <td className="text-right font-bold tabular-nums">{formatNaira(w.balanceKobo)}</td>
              </tr>
            ))}
          </tbody>
        </TableBox>
      )}
    </>
  );
}
