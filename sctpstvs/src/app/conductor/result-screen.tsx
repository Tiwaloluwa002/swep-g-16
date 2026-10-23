"use client";

import { useEffect, useRef } from "react";
import { formatTime } from "@/lib/time";
import type { VerifyOutcome, VerifyResult } from "@/lib/types";

// Fixed colours (not theme tokens) so each outcome looks the same on every phone. All pass WCAG AA.
const LOOK: Record<VerifyOutcome, { box: string; icon: string }> = {
  valid: { box: "bg-[#166534] text-white", icon: "✓" },
  already_used: { box: "bg-[#b91c1c] text-white", icon: "✕" },
  invalid: { box: "bg-[#1c1917] text-white ring-[12px] ring-inset ring-[#dc2626]", icon: "✕" },
  expired: { box: "bg-[#fbbf24] text-black", icon: "!" },
  wrong_route: { box: "bg-[#fb923c] text-black", icon: "!" },
};

export function ResultScreen({ result, onDismiss }: { result: VerifyResult; onDismiss: () => void }) {
  const button = useRef<HTMLButtonElement>(null);
  const look = LOOK[result.outcome];

  useEffect(() => {
    button.current?.focus();
    // A different buzz for good and bad, for conductors not looking at the screen.
    navigator.vibrate?.(result.outcome === "valid" ? 150 : [120, 80, 120, 80, 400]);
  }, [result]);

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`fixed inset-0 z-40 flex flex-col items-center justify-between gap-6 overflow-y-auto p-6 text-center ${look.box}`}
    >
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <p aria-hidden className="text-8xl font-black leading-none">
          {look.icon}
        </p>
        <h2 className="text-5xl font-black leading-tight tracking-tight sm:text-7xl">{result.headline}</h2>
        <p className="max-w-xl text-xl font-semibold">{result.detail}</p>
        {result.ticket && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-left text-lg">
            <dt className="font-semibold">Route</dt>
            <dd>{result.ticket.routeName}</dd>
            {result.holderName && (
              <>
                <dt className="font-semibold">Holder</dt>
                <dd>{result.holderName}</dd>
              </>
            )}
            <dt className="font-semibold">Code</dt>
            <dd className="font-mono">{result.ticket.shortCode}</dd>
            <dt className="font-semibold">Expires</dt>
            <dd>{formatTime(result.ticket.expiresAt)}</dd>
          </dl>
        )}
      </div>
      <button
        ref={button}
        type="button"
        onClick={onDismiss}
        className="w-full max-w-md shrink-0 rounded-lg border-4 border-current px-6 py-4 text-2xl font-black"
      >
        Next passenger
      </button>
    </div>
  );
}
