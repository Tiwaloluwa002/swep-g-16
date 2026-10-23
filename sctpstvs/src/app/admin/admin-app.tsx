"use client";

import { type KeyboardEvent, useRef } from "react";
import { RoleGate } from "@/components/role-gate";
import { useLocalSetting } from "@/lib/client/use-local-setting";
import { FraudTab } from "./fraud-tab";
import { OverviewTab } from "./overview-tab";
import { RoutesTab } from "./routes-tab";
import { TicketsTab } from "./tickets-tab";
import { VehiclesTab } from "./vehicles-tab";
import { WalletsTab } from "./wallets-tab";

const TABS = [
  { id: "overview", label: "Overview", Panel: OverviewTab },
  { id: "tickets", label: "Tickets", Panel: TicketsTab },
  { id: "fraud", label: "Fraud log", Panel: FraudTab },
  { id: "routes", label: "Routes & fares", Panel: RoutesTab },
  { id: "wallets", label: "Wallets", Panel: WalletsTab },
  { id: "vehicles", label: "Vehicles", Panel: VehiclesTab },
] as const;

export function AdminApp() {
  return <RoleGate roles={["admin"]}>{() => <Dashboard />}</RoleGate>;
}

function Dashboard() {
  const [saved, setTab] = useLocalSetting("sct-admin-tab");
  const tab = TABS.find((t) => t.id === saved) ?? TABS[0];
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Arrow keys move between tabs, as in the WAI-ARIA tabs pattern.
  function onKeyDown(e: KeyboardEvent, index: number) {
    const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (index + delta + TABS.length) % TABS.length;
    setTab(TABS[next].id);
    tabRefs.current[next]?.focus();
  }

  return (
    <main id="main" className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6">
      <h1 className="text-2xl font-bold">Transport admin</h1>
      <div role="tablist" aria-label="Admin sections" className="flex flex-wrap gap-2">
        {TABS.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            id={`tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={tab.id === t.id}
            aria-controls={`panel-${t.id}`}
            tabIndex={tab.id === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className="rounded-full border border-border px-3.5 py-2 text-sm font-semibold aria-selected:border-primary aria-selected:bg-primary aria-selected:text-primary-fg"
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab.id}`} aria-labelledby={`tab-${tab.id}`} className="flex flex-col gap-4">
        <tab.Panel />
      </div>
    </main>
  );
}
