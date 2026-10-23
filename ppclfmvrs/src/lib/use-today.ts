"use client";

import { useSyncExternalStore } from "react";
import { todayISO } from "./format";

const noop = () => () => {};

/** Today's local date, read only in the browser so prerendering never bakes in a stale date. */
export function useToday(): string {
  return useSyncExternalStore(noop, todayISO, () => "");
}
