"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { CodeEntry } from "@/components/code-entry";
import { Alert, Badge, Button, Card, Loading, NeedsSignIn, PageShell } from "@/components/ui";
import { api, useApi } from "@/lib/api";
import { formatDate, FOUND_STATUS, itemTitle } from "@/lib/format";
import type { OwnFound } from "@/lib/public-types";

export function FoundDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: item, error, reload } = useApi<OwnFound>(`/api/found/${id}`);
  const [actionError, setActionError] = useState("");

  if (error) {
    return (
      <PageShell title="Found report" back={{ href: "/dashboard", label: "My reports" }}>
        <NeedsSignIn status={error.status} message={error.message} />
      </PageShell>
    );
  }
  if (!item) return <Loading />;

  async function close() {
    if (!window.confirm("Close this report? Owners will no longer be able to claim it.")) return;
    try {
      await api(`/api/found/${item!.id}`, { method: "PATCH", body: { status: "closed" } });
      reload();
    } catch (err) {
      setActionError((err as Error).message);
    }
  }

  return (
    <PageShell title={itemTitle(item)} back={{ href: "/dashboard", label: "My reports" }}>
      <Card>
        <Badge>{FOUND_STATUS[item.status]}</Badge>
        <p className="text-sm text-muted">
          Found {formatDate(item.foundDate)} at {item.locationName}
        </p>
        <p>{item.description}</p>
        <p className="text-sm">
          {item.custody === "desk" ? (
            <>
              Handed to the <strong>{item.deskName}</strong>
              {item.receivedAt ? " (received by the desk)." : ". Please drop it off if you have not yet."}
            </>
          ) : (
            <>
              You are holding it. Meeting place for the verified owner: <strong>{item.meetLocationName}</strong>.
            </>
          )}
        </p>
        <div>
          <h2 className="font-bold">Your verification questions</h2>
          <ol className="list-decimal pl-5 text-sm">
            {item.questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ol>
          <p className="text-sm text-muted">The answers are stored only as hashes and cannot be shown.</p>
        </div>
        {item.status === "open" && (
          <Button variant="secondary" onClick={close} className="self-start text-sm">
            Close this report
          </Button>
        )}
      </Card>
      <Alert>{actionError}</Alert>

      {item.status === "open" && (
        <Alert kind="info">
          Waiting for the owner. They must answer your questions correctly before they get a handover code. You will be
          notified. Please do not share the item&apos;s details anywhere else.
        </Alert>
      )}

      {item.pendingHandover && (
        <Card className="border-l-4 border-l-primary">
          <h2 className="text-lg font-bold">An owner has been verified</h2>
          <p>
            <strong>Handover:</strong> {item.pendingHandover.place}
          </p>
          <p>{item.pendingHandover.instructions}</p>
          {item.custody === "finder" && <CodeEntry onConfirmed={reload} />}
        </Card>
      )}

      {item.status === "recovered" && <Alert kind="ok">Returned to its owner. Thank you for doing the right thing!</Alert>}
    </PageShell>
  );
}
