"use client";

import { useApi } from "@/lib/api";
import { formatDate, itemTitle } from "@/lib/format";
import type { PublicFound } from "@/lib/public-types";
import { Alert, Card, Loading } from "./ui";

/** Recently found items, generic fields only. */
export function FoundBoard() {
  const { data, error } = useApi<PublicFound[]>("/api/board");
  if (error) return <Alert>{error.message}</Alert>;
  if (!data) return <Loading />;
  if (data.length === 0) return <p className="text-muted">No found items waiting right now.</p>;
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {data.map((item) => (
        <Card as="li" key={item.id} className="gap-1">
          <h3 className="font-bold">{itemTitle(item)}</h3>
          <p className="text-sm text-muted">
            Found {formatDate(item.foundDate)} near {item.locationName}
          </p>
          <p>{item.description}</p>
          <p className="text-sm text-muted">{item.custody === "desk" ? "Held at a collection desk" : "Held by the finder"}</p>
        </Card>
      ))}
    </ul>
  );
}
