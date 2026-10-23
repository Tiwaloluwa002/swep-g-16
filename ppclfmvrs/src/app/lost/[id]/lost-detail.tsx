"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Badge, Button, Card, Loading, NeedsSignIn, PageShell } from "@/components/ui";
import { api, useApi } from "@/lib/api";
import { formatDate, itemTitle, LOST_STATUS } from "@/lib/format";
import { WEIGHTS } from "@/lib/matching";
import type { Candidate, ClaimView, OwnLost } from "@/lib/public-types";

const FACTORS: { key: keyof typeof WEIGHTS; label: string }[] = [
  { key: "colour", label: "Colour" },
  { key: "location", label: "Place" },
  { key: "date", label: "Date" },
  { key: "keywords", label: "Description" },
];

function ScoreBar({ label, value, weight }: { label: string; value: number; weight: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="grid grid-cols-[8.5rem_1fr_3rem] items-center gap-2 text-sm">
      <span>
        {label} <span className="text-muted">({Math.round(weight * 100)}%)</span>
      </span>
      <span aria-hidden className="h-2 overflow-hidden rounded-full bg-accent-bg">
        <span className="block h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </span>
      <span className="text-right tabular-nums">{pct}%</span>
    </div>
  );
}

export function LostDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, error, reload } = useApi<{ item: OwnLost; candidates: Candidate[] }>(`/api/lost/${id}`);
  const [actionError, setActionError] = useState("");

  if (error) {
    return (
      <PageShell title="Lost report" back={{ href: "/dashboard", label: "My reports" }}>
        <NeedsSignIn status={error.status} message={error.message} />
      </PageShell>
    );
  }
  if (!data) return <Loading />;
  const { item, candidates } = data;
  const details = Object.entries({
    "Serial/IMEI last digits": item.privateDetails.serialLastDigits,
    "Lock screen": item.privateDetails.lockScreen,
    Contents: item.privateDetails.contents,
    "Unique marks": item.privateDetails.uniqueMarks,
  }).filter(([, v]) => v);

  async function claim(foundId: string) {
    setActionError("");
    try {
      const c = await api<ClaimView>("/api/claims", { body: { lostId: item.id, foundId } });
      router.push(`/claims/${c.id}`);
    } catch (err) {
      setActionError((err as Error).message);
    }
  }

  async function close() {
    if (!window.confirm("Close this report? It will stop matching new found items.")) return;
    try {
      await api(`/api/lost/${item.id}`, { method: "PATCH", body: { status: "closed" } });
      reload();
    } catch (err) {
      setActionError((err as Error).message);
    }
  }

  return (
    <PageShell title={itemTitle(item)} back={{ href: "/dashboard", label: "My reports" }}>
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{LOST_STATUS[item.status]}</Badge>
          <span className="text-sm text-muted">
            Last seen {formatDate(item.lostDate)}, {item.timeFrom}–{item.timeTo}, at {item.locationName}
          </span>
        </div>
        <p>{item.description}</p>
        {details.length > 0 && (
          <div className="rounded-md bg-accent-bg p-3">
            <h2 className="text-sm font-bold">Private details (only you can see these)</h2>
            <dl className="mt-1 grid gap-x-3 text-sm sm:grid-cols-[auto_1fr]">
              {details.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="font-semibold">{k}</dt>
                  <dd className="mb-1">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
        {item.status === "open" && (
          <Button variant="secondary" onClick={close} className="self-start text-sm">
            I found it myself, close this report
          </Button>
        )}
      </Card>

      <Alert>{actionError}</Alert>

      {item.status === "open" && (
        <section aria-labelledby="candidates" className="flex flex-col gap-3">
          <div>
            <h2 id="candidates" className="text-xl font-bold">
              Possible matches
            </h2>
            <p className="text-sm text-muted">
              Best match first. Scores use public details only. To claim an item you must answer the finder&apos;s
              questions: 3 tries per claim and 5 per day in total, so only claim what you believe is yours.
            </p>
          </div>
          {candidates.length === 0 ? (
            <p className="text-muted">No likely matches yet. You will get a notification when a matching item is reported.</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {candidates.map((c, i) => (
                <Card as="li" key={c.found.id}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-bold">
                      <span className="sr-only">Rank {i + 1}: </span>
                      {itemTitle(c.found)}
                    </h3>
                    <span className="text-lg font-bold tabular-nums">{Math.round(c.score * 100)}% match</span>
                  </div>
                  <p className="text-sm text-muted">
                    Found {formatDate(c.found.foundDate)} near {c.found.locationName} ·{" "}
                    {c.found.custody === "desk" ? "at a collection desk" : "held by the finder"}
                  </p>
                  <p>{c.found.description}</p>
                  <div className="flex flex-col gap-1" aria-label="Score breakdown">
                    {FACTORS.map((f) => (
                      <ScoreBar key={f.key} label={f.label} value={c.breakdown[f.key]} weight={WEIGHTS[f.key]} />
                    ))}
                  </div>
                  {c.claimId ? (
                    <Link href={`/claims/${c.claimId}`} className="self-start font-semibold underline">
                      Open my claim
                    </Link>
                  ) : (
                    <Button onClick={() => claim(c.found.id)} className="self-start">
                      This is mine, claim it
                    </Button>
                  )}
                </Card>
              ))}
            </ol>
          )}
        </section>
      )}
    </PageShell>
  );
}
