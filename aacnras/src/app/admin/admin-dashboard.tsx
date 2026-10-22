"use client";

import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { campus } from "@/data/campus";
import { edgeName } from "@/lib/graph";
import { REPORT_STATUSES, REPORT_TYPES } from "@/lib/reports";
import type { Report, ReportStatus } from "@/lib/types";

const SESSION_KEY = "aacnras-admin-passcode";

const ACTIONS: { status: ReportStatus; label: string }[] = [
  { status: "verified", label: "Verify" },
  { status: "rejected", label: "Reject" },
  { status: "resolved", label: "Mark resolved" },
];

function readSavedPasscode(): string {
  try {
    return sessionStorage.getItem(SESSION_KEY) ?? "";
  } catch {
    return "";
  }
}

async function checkPasscode(code: string): Promise<boolean> {
  const res = await fetch("/api/admin/login", { method: "POST", headers: { "x-admin-passcode": code } });
  return res.ok;
}

export function AdminDashboard() {
  const [passcode, setPasscode] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [reports, setReports] = useState<Report[]>([]);
  const [filter, setFilter] = useState<ReportStatus | "all">("pending");

  async function login(code: string) {
    if (!(await checkPasscode(code))) {
      setError("Wrong passcode.");
      return;
    }
    try {
      sessionStorage.setItem(SESSION_KEY, code);
    } catch {
      // Not remembered for this tab; the admin just signs in again.
    }
    setError("");
    setPasscode(code);
  }

  // Stay signed in across reloads within the same tab.
  useEffect(() => {
    const saved = readSavedPasscode();
    if (!saved) return;
    checkPasscode(saved).then((ok) => ok && setPasscode(saved));
  }, []);

  const loadReports = useCallback(() => {
    fetch("/api/reports")
      .then((res) => res.json())
      .then((data: Report[]) => setReports(data.toReversed()))
      .catch(() => setError("Could not load reports."));
  }, []);
  useEffect(() => {
    if (passcode) loadReports();
  }, [passcode, loadReports]);

  async function setStatus(id: string, status: ReportStatus) {
    const res = await fetch(`/api/reports/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-admin-passcode": passcode ?? "" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      setError((await res.json().catch(() => null))?.error ?? "Update failed.");
      return;
    }
    loadReports();
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void login(input);
  }

  if (!passcode) {
    return (
      <main id="main" className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 p-4">
        <h1 className="text-2xl font-bold">Admin sign in</h1>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label htmlFor="passcode" className="text-sm font-semibold">
            Passcode
          </label>
          <input
            id="passcode"
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoComplete="current-password"
            className="rounded-md border border-border bg-surface px-3 py-2"
          />
          <button type="submit" className="rounded-md bg-primary px-4 py-2.5 font-semibold text-primary-fg">
            Sign in
          </button>
          <p role="alert" className="text-danger">
            {error}
          </p>
        </form>
        <Link href="/" className="text-sm underline">
          ← Back to the route planner
        </Link>
      </main>
    );
  }

  const counts = Object.fromEntries(
    Object.keys(REPORT_STATUSES).map((s) => [s, reports.filter((r) => r.status === s).length]),
  ) as Record<ReportStatus, number>;
  const shown = filter === "all" ? reports : reports.filter((r) => r.status === filter);

  return (
    <main id="main" className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Obstacle reports</h1>
          <p className="text-sm text-muted">
            Verified path reports are avoided by routing. Resolve them once the obstacle is cleared.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/" className="rounded-md border border-border px-3 py-2 text-sm">
            Route planner
          </Link>
          <button
            type="button"
            onClick={() => {
              try {
                sessionStorage.removeItem(SESSION_KEY);
              } catch {}
              setPasscode(null);
            }}
            className="rounded-md border border-border px-3 py-2 text-sm"
          >
            Sign out
          </button>
        </div>
      </div>

      <div role="tablist" aria-label="Filter by status" className="flex flex-wrap gap-2">
        {(["pending", "verified", "resolved", "rejected", "all"] as const).map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={filter === s}
            onClick={() => setFilter(s)}
            className="rounded-full border border-border px-3 py-1.5 text-sm aria-selected:border-primary aria-selected:bg-primary aria-selected:text-primary-fg"
          >
            {s === "all" ? `All (${reports.length})` : `${REPORT_STATUSES[s]} (${counts[s]})`}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}

      {shown.length === 0 ? (
        <p className="text-muted">No reports here.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((report) => (
            <li key={report.id} className="flex flex-col gap-2 rounded-md border border-border bg-surface p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-bold">{REPORT_TYPES[report.type]}</h2>
                <span className="text-sm text-muted">{new Date(report.createdAt).toLocaleString("en-NG")}</span>
              </div>
              <p className="text-sm">
                {report.edgeId && <>Path: {(campus.edges.has(report.edgeId) ? edgeName(campus.edges.get(report.edgeId)!) : report.edgeId)}</>}
                {report.placeId && <>Building: {campus.places.get(report.placeId)?.name ?? report.placeId}</>}
                {" · "}Status: <strong>{REPORT_STATUSES[report.status]}</strong>
              </p>
              {report.description && <p>{report.description}</p>}
              <div className="flex flex-wrap gap-2">
                {ACTIONS.filter((a) => a.status !== report.status).map((action) => (
                  <button
                    key={action.status}
                    type="button"
                    onClick={() => setStatus(report.id, action.status)}
                    className="rounded-md border border-border px-3 py-1.5 text-sm font-semibold"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
