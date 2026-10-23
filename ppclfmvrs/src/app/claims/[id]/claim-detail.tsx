"use client";

import Image from "next/image";
import { useParams } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Alert, Badge, Button, Card, Field, inputClass, NeedsSignIn, PageLoading, PageShell } from "@/components/ui";
import { api, useApi } from "@/lib/api";
import { CLAIM_STATUS, formatDate, formatDateTime, itemTitle } from "@/lib/format";
import type { ClaimView } from "@/lib/public-types";

type Issued = { handoverCode: string; expiresAt: string; qr: string };
type VerifyResponse = ({ outcome: "verified" } & Issued) | { outcome: "wrong"; attemptsLeft: number; locked: boolean };

export function ClaimDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, error, reload } = useApi<ClaimView>(`/api/claims/${id}`);
  const [answers, setAnswers] = useState<string[]>([]);
  const [message, setMessage] = useState<{ kind: "error" | "ok"; text: string } | null>(null);
  const [issued, setIssued] = useState<Issued | null>(null);
  const [busy, setBusy] = useState(false);

  if (error) {
    return (
      <PageShell title="Claim" back={{ href: "/dashboard", label: "My reports" }}>
        <NeedsSignIn status={error.status} message={error.message} />
      </PageShell>
    );
  }
  if (!data) return <PageLoading />;
  const claim = data;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const filled = claim.questions.map((_, i) => answers[i] ?? "");
      const result = await api<VerifyResponse>(`/api/claims/${claim.id}/verify`, { body: { answers: filled } });
      if (result.outcome === "verified") {
        setIssued(result);
        setMessage({ kind: "ok", text: "Ownership verified. Show the code below to collect your item." });
      } else {
        setMessage({
          kind: "error",
          text: result.locked
            ? "Those answers were not right, and this claim is now locked. Visit a collection desk if you believe the item is yours."
            : `Those answers did not match. ${result.attemptsLeft} ${result.attemptsLeft === 1 ? "try" : "tries"} left on this claim.`,
        });
      }
      setAnswers([]);
      reload();
    } catch (err) {
      setMessage({ kind: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function newCode() {
    if (!window.confirm("Get a new code? Any earlier code will stop working.")) return;
    try {
      setIssued(await api<Issued>(`/api/claims/${claim.id}/code`, { body: {} }));
      reload();
    } catch (err) {
      setMessage({ kind: "error", text: (err as Error).message });
    }
  }

  return (
    <PageShell title={`Claim: ${itemTitle(claim.found)}`} back={{ href: `/lost/${claim.lost.id}`, label: "Back to my lost report" }}>
      <Card>
        <Badge>{CLAIM_STATUS[claim.status]}</Badge>
        <p>
          Found {formatDate(claim.found.foundDate)} near {claim.found.locationName}: {claim.found.description}
        </p>
      </Card>

      {message && <Alert kind={message.kind}>{message.text}</Alert>}

      {claim.status === "open" && (
        <Card>
          <h2 className="text-lg font-bold">Prove it is yours</h2>
          <p className="text-sm text-muted">
            The finder set these questions from what they can see. All answers must be right. Capitals and extra spaces
            do not matter. You have {claim.attemptsLeft} {claim.attemptsLeft === 1 ? "try" : "tries"} left on this claim.
          </p>
          <form onSubmit={submit} className="flex flex-col gap-4">
            {claim.questions.map((q, i) => (
              <Field key={i} id={`answer-${i}`} label={q}>
                <input
                  id={`answer-${i}`}
                  value={answers[i] ?? ""}
                  onChange={(e) => setAnswers((a) => Object.assign([...a], { [i]: e.target.value }))}
                  required
                  autoComplete="off"
                  className={inputClass}
                />
              </Field>
            ))}
            <Button type="submit" disabled={busy} className="self-start">
              {busy ? "Checking…" : "Check my answers"}
            </Button>
          </form>
        </Card>
      )}

      {claim.status === "verified" && claim.handover && (
        <Card className="border-l-4 border-l-primary">
          <h2 className="text-lg font-bold">Collect your item</h2>
          <p>
            <strong>Where:</strong> {claim.handover.place}
          </p>
          <p>{claim.handover.instructions}</p>
          {issued ? (
            <div className="flex flex-col items-start gap-3">
              <p>
                Your one-time handover code:
                <span className="mt-1 block font-mono text-3xl font-bold tracking-widest" aria-label={issued.handoverCode.split("").join(" ")}>
                  {issued.handoverCode}
                </span>
              </p>
              <Image src={issued.qr} alt={`QR code for handover code ${issued.handoverCode}`} width={200} height={200} unoptimized className="rounded bg-white p-2" />
              <p className="text-sm text-muted">
                Valid until {formatDateTime(issued.expiresAt)}. It works once. Save it now (a screenshot is fine): it
                is not stored in readable form, so it cannot be shown again.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted">
              {claim.handover.codeExpiresAt
                ? `Your code is valid until ${formatDateTime(claim.handover.codeExpiresAt)}. Codes are shown only once; if you lost it, get a new one.`
                : "Your code has expired or was replaced. Get a new one."}
            </p>
          )}
          <Button variant="secondary" onClick={newCode} className="self-start text-sm">
            Get a new code
          </Button>
        </Card>
      )}

      {claim.status === "completed" && <Alert kind="ok">Handover confirmed. This item is marked as recovered.</Alert>}
      {claim.status === "locked" && (
        <Alert>This claim is locked after too many wrong answers. If the item is yours, go to a collection desk with proof of ownership.</Alert>
      )}
      {claim.status === "cancelled" && <Alert>Another person proved ownership of this item first.</Alert>}
    </PageShell>
  );
}
