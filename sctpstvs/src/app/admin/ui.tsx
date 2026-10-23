import type { ReactNode } from "react";

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-2xl font-bold tabular-nums">{value}</dd>
      {hint && <dd className="text-xs text-muted">{hint}</dd>}
    </div>
  );
}

/** Wide tables scroll inside their own box, never the whole page. */
export function TableBox({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="region" aria-label={label} tabIndex={0} className="relative overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full min-w-[40rem] border-collapse text-left text-sm [&_td]:px-3 [&_td]:py-2 [&_th]:px-3 [&_th]:py-2 [&_thead]:bg-bg [&_tr]:border-b [&_tr]:border-border">
        {children}
      </table>
    </div>
  );
}

// role="alert" content inserted on change is announced, so nothing is rendered while there is no error.
export function ErrorText({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-danger">
      {message}
    </p>
  );
}

export const inputClass = "rounded-md border border-border bg-bg px-3 py-2";
export const buttonClass = "rounded-md bg-primary px-4 py-2 font-semibold text-primary-fg disabled:opacity-60";
export const secondaryButtonClass = "rounded-md border border-border px-3 py-1.5 text-sm font-semibold disabled:opacity-60";
