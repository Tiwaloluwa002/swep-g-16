"use client";

import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { RoleGate } from "@/components/role-gate";
import { api } from "@/lib/client/api";
import { useLocalSetting } from "@/lib/client/use-local-setting";
import { formatTime } from "@/lib/time";
import type { VerifyResult, Vehicle } from "@/lib/types";
import { QrScanner } from "./qr-scanner";
import { ResultScreen } from "./result-screen";

export function ConductorApp() {
  return <RoleGate roles={["conductor", "admin"]}>{() => <VerifyScreen />}</RoleGate>;
}

interface Check {
  at: number;
  result: VerifyResult;
}

// After dismissing a result, ignore the same QR for a moment so a held-up phone isn't re-read.
const SAME_CODE_COOLDOWN_MS = 4000;

function VerifyScreen() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useLocalSetting("sct-vehicle");
  const [code, setCode] = useState("");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<Check[]>([]);
  const last = useRef({ code: "", at: 0 });

  useEffect(() => {
    api<{ vehicles: Vehicle[] }>("/api/vehicles")
      .then(({ vehicles }) => setVehicles(vehicles))
      .catch((err: Error) => setError(err.message));
  }, []);
  const vehicle = vehicles.find((v) => String(v.id) === vehicleId);

  const check = useCallback(
    async (input: string) => {
      const text = input.trim();
      if (!text || busy) return;
      if (text === last.current.code && Date.now() - last.current.at < SAME_CODE_COOLDOWN_MS) return;
      last.current = { code: text, at: Date.now() };
      setBusy(true);
      setError("");
      try {
        const r = await api<VerifyResult>("/api/verify", { body: { code: text, vehicleId: vehicle?.id } });
        setResult(r);
        setHistory((h) => [{ at: Date.now(), result: r }, ...h].slice(0, 10));
        setCode("");
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [busy, vehicle],
  );

  function submit(e: FormEvent) {
    e.preventDefault();
    void check(code);
  }

  function dismiss() {
    last.current.at = Date.now();
    setResult(null);
  }

  return (
    <main id="main" className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6">
      <h1 className="text-2xl font-bold">Verify tickets</h1>

      <div className="flex flex-col gap-1">
        <label htmlFor="vehicle" className="font-semibold">
          Vehicle you are on
        </label>
        <select
          id="vehicle"
          value={vehicle ? vehicleId : ""}
          onChange={(e) => setVehicleId(e.target.value)}
          className="rounded-md border border-border bg-surface px-3 py-3 text-lg"
        >
          <option value="">Not set (no route check)</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name} — {v.routeName ?? "any route"}
            </option>
          ))}
        </select>
        <p className="text-sm text-muted">
          {vehicle?.routeName
            ? `Tickets for other routes will show WRONG ROUTE and stay unused.`
            : "Tickets for any route are accepted."}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 md:items-start">
        <section aria-labelledby="scan-heading" className="flex flex-col gap-3">
          <h2 id="scan-heading" className="text-lg font-bold">
            Scan QR code
          </h2>
          <QrScanner onCode={check} paused={busy || result !== null} />
        </section>

        <div className="flex flex-col gap-6">
          <section aria-labelledby="manual-heading" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
            <h2 id="manual-heading" className="text-lg font-bold">
              Type a backup code
            </h2>
            <form onSubmit={submit} className="flex flex-col gap-3">
              <label htmlFor="code" className="font-semibold">
                10-character code from the passenger&apos;s ticket
              </label>
              <input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                placeholder="XXXXX-XXXXX"
                className="rounded-md border border-border bg-bg px-3 py-3 font-mono text-2xl tracking-widest uppercase"
              />
              <button
                type="submit"
                disabled={busy || !code.trim()}
                className="rounded-md bg-primary px-4 py-3 text-lg font-bold text-primary-fg disabled:opacity-60"
              >
                {busy ? "Checking…" : "Check ticket"}
              </button>
            </form>
            <p role="alert" className="min-h-6 text-danger">
              {error}
            </p>
          </section>

          <section aria-labelledby="recent-heading" className="flex flex-col gap-2">
            <h2 id="recent-heading" className="text-lg font-bold">
              Recent checks on this phone
            </h2>
            {history.length === 0 ? (
              <p className="text-muted">None yet.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
                {history.map((h) => (
                  <li key={h.at} className="flex items-baseline justify-between gap-3 px-3 py-2">
                    <span>
                      <strong className={h.result.outcome === "valid" ? "text-ok" : "text-danger"}>{h.result.headline}</strong>
                      {h.result.ticket && <span className="block text-sm text-muted">{h.result.ticket.routeName}</span>}
                    </span>
                    <span className="shrink-0 text-sm text-muted">{formatTime(h.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {result && <ResultScreen result={result} onDismiss={dismiss} />}
    </main>
  );
}
