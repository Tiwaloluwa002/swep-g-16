"use client";

import Link from "next/link";
import { Alert, Badge, Button, ButtonLink, Card, Loading, NeedsSignIn, PageShell } from "@/components/ui";
import { announceSessionChange, api, useApi } from "@/lib/api";
import { CLAIM_STATUS, formatDate, formatDateTime, FOUND_STATUS, itemTitle, LOST_STATUS } from "@/lib/format";
import type { ClaimView, OwnFound, OwnLost } from "@/lib/public-types";
import type { Notification } from "@/lib/types";

type MyLost = OwnLost & { candidateCount: number };
type MyFound = OwnFound & { matchCount: number };

export function Dashboard() {
  const notifications = useApi<Notification[]>("/api/notifications");
  const lost = useApi<MyLost[]>("/api/lost");
  const found = useApi<MyFound[]>("/api/found");
  const claims = useApi<ClaimView[]>("/api/claims");

  if (notifications.error) {
    return (
      <PageShell title="My reports">
        <NeedsSignIn status={notifications.error.status} message={notifications.error.message} />
      </PageShell>
    );
  }

  async function markRead() {
    await api("/api/notifications", { body: {} });
    notifications.reload();
    announceSessionChange();
  }

  const unread = notifications.data?.filter((n) => !n.read).length ?? 0;

  return (
    <PageShell title="My reports">
      <div className="flex flex-wrap gap-3">
        <ButtonLink href="/lost/new">Report a lost item</ButtonLink>
        <ButtonLink href="/found/new" variant="secondary">
          Report a found item
        </ButtonLink>
      </div>

      <section aria-labelledby="notes" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="notes" className="text-xl font-bold">
            Notifications {unread > 0 && <Badge>{unread} new</Badge>}
          </h2>
          {unread > 0 && (
            <Button variant="secondary" onClick={markRead} className="text-sm">
              Mark all as read
            </Button>
          )}
        </div>
        {!notifications.data ? (
          <Loading />
        ) : notifications.data.length === 0 ? (
          <p className="text-muted">Nothing yet. You will be told here when a report matches.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {notifications.data.slice(0, 8).map((n) => (
              <li key={n.id} className={`rounded-md border border-border bg-surface px-3 py-2 ${n.read ? "" : "border-l-4 border-l-primary"}`}>
                <p>
                  {!n.read && <span className="sr-only">New: </span>}
                  {n.link ? (
                    <Link href={n.link} className="underline">
                      {n.message}
                    </Link>
                  ) : (
                    n.message
                  )}
                </p>
                <p className="text-xs text-muted">{formatDateTime(n.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="lost" className="flex flex-col gap-3">
        <h2 id="lost" className="text-xl font-bold">
          Items I lost
        </h2>
        {lost.error && <Alert>{lost.error.message}</Alert>}
        {!lost.data ? (
          <Loading />
        ) : lost.data.length === 0 ? (
          <p className="text-muted">No lost reports.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {lost.data.map((item) => (
              <Card as="li" key={item.id} className="gap-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-bold">
                    <Link href={`/lost/${item.id}`} className="underline">
                      {itemTitle(item)}
                    </Link>
                  </h3>
                  <Badge>{LOST_STATUS[item.status]}</Badge>
                </div>
                <p className="text-sm text-muted">
                  Last seen {formatDate(item.lostDate)} at {item.locationName}
                </p>
                {item.status === "open" && (
                  <p className="text-sm">
                    {item.candidateCount === 0
                      ? "No likely matches yet."
                      : `${item.candidateCount} possible match${item.candidateCount === 1 ? "" : "es"}. Open to review.`}
                  </p>
                )}
              </Card>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="claims" className="flex flex-col gap-3">
        <h2 id="claims" className="text-xl font-bold">
          My claims
        </h2>
        {!claims.data ? (
          <Loading />
        ) : claims.data.length === 0 ? (
          <p className="text-muted">No claims. Claim a candidate from one of your lost reports.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {claims.data.map((c) => (
              <Card as="li" key={c.id} className="gap-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-bold">
                    <Link href={`/claims/${c.id}`} className="underline">
                      {itemTitle(c.found)} found near {c.found.locationName}
                    </Link>
                  </h3>
                  <Badge>{CLAIM_STATUS[c.status]}</Badge>
                </div>
              </Card>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="found" className="flex flex-col gap-3">
        <h2 id="found" className="text-xl font-bold">
          Items I found
        </h2>
        {!found.data ? (
          <Loading />
        ) : found.data.length === 0 ? (
          <p className="text-muted">No found reports.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {found.data.map((item) => (
              <Card as="li" key={item.id} className="gap-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-bold">
                    <Link href={`/found/${item.id}`} className="underline">
                      {itemTitle(item)}
                    </Link>
                  </h3>
                  <Badge>{FOUND_STATUS[item.status]}</Badge>
                </div>
                <p className="text-sm text-muted">
                  Found {formatDate(item.foundDate)} at {item.locationName} ·{" "}
                  {item.custody === "desk" ? `Handed to ${item.deskName}` : "Held by you"}
                </p>
                {item.status === "open" && item.matchCount > 0 && (
                  <p className="text-sm">Matches a lost report. The owner must answer your questions first.</p>
                )}
              </Card>
            ))}
          </ul>
        )}
      </section>
    </PageShell>
  );
}
