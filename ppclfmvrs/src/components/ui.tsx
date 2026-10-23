import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export const inputClass =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-fg placeholder:text-muted";

export function PageShell({ title, intro, back, children }: { title: string; intro?: ReactNode; back?: { href: string; label: string }; children: ReactNode }) {
  return (
    <main id="main" className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6">
      <div className="flex flex-col gap-2">
        {back && (
          <Link href={back.href} className="self-start text-sm underline">
            ← {back.label}
          </Link>
        )}
        <h1 className="text-2xl font-bold leading-tight sm:text-3xl">{title}</h1>
        {intro && <div className="text-muted">{intro}</div>}
      </div>
      {children}
    </main>
  );
}

export function Card({ children, className = "", as: Tag = "section" }: { children: ReactNode; className?: string; as?: "section" | "li" | "div" | "article" }) {
  return <Tag className={`flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 ${className}`}>{children}</Tag>;
}

export function Button({ variant = "primary", className = "", ...props }: ComponentProps<"button"> & { variant?: "primary" | "secondary" | "danger" }) {
  const styles = {
    primary: "bg-primary text-primary-fg border-primary",
    secondary: "bg-surface text-fg border-border",
    danger: "bg-surface text-danger border-danger",
  }[variant];
  return (
    <button
      type="button"
      {...props}
      className={`rounded-md border px-4 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${styles} ${className}`}
    />
  );
}

export function ButtonLink({ variant = "primary", className = "", ...props }: ComponentProps<typeof Link> & { variant?: "primary" | "secondary" }) {
  const styles = variant === "primary" ? "bg-primary text-primary-fg border-primary" : "bg-surface text-fg border-border";
  return <Link {...props} className={`inline-block rounded-md border px-4 py-2 text-center font-semibold ${styles} ${className}`} />;
}

export function Field({ id, label, hint, children }: { id: string; label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-semibold">
        {label}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {children}
    </div>
  );
}

export function Alert({ kind = "error", children }: { kind?: "error" | "ok" | "info"; children: ReactNode }) {
  if (!children) return null;
  const styles = {
    error: "border-danger text-danger",
    ok: "border-ok text-ok",
    info: "border-border bg-warn-bg text-warn-fg",
  }[kind];
  return (
    <p role={kind === "error" ? "alert" : "status"} className={`rounded-md border-l-4 bg-surface px-3 py-2 ${styles}`}>
      {children}
    </p>
  );
}

export function Badge({ children }: { children: ReactNode }) {
  return <span className="inline-block rounded-full bg-accent-bg px-2.5 py-0.5 text-sm font-semibold text-fg">{children}</span>;
}

export function Loading() {
  return (
    <p role="status" className="text-muted">
      Loading…
    </p>
  );
}

/** Suspense fallback for whole pages, padded like PageShell. */
export function PageLoading() {
  return (
    <main id="main" className="mx-auto w-full max-w-3xl px-4 py-6">
      <Loading />
    </main>
  );
}

/** Shown when an API call says the user is not signed in or not allowed. */
export function NeedsSignIn({ status, message }: { status: number; message: string }) {
  if (status === 401) {
    return (
      <Card>
        <p>You need to sign in to see this page.</p>
        <ButtonLink href="/login" className="self-start">
          Sign in
        </ButtonLink>
      </Card>
    );
  }
  return <Alert>{message}</Alert>;
}
