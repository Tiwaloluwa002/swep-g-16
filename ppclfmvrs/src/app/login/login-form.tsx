"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Alert, Button, Field, inputClass, PageShell } from "@/components/ui";
import { announceSessionChange, api } from "@/lib/api";
import type { SessionUser } from "@/lib/public-types";

export function LoginForm() {
  const router = useRouter();
  const [ident, setIdent] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { user } = await api<{ user: SessionUser }>("/api/auth/login", { body: { ident, password } });
      announceSessionChange();
      router.push(user.role === "member" ? "/dashboard" : "/desk");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <PageShell title="Sign in" intro="Use your matriculation number (students) or staff number.">
      <form onSubmit={submit} className="flex max-w-sm flex-col gap-4">
        <Field id="ident" label="Matriculation or staff number">
          <input
            id="ident"
            value={ident}
            onChange={(e) => setIdent(e.target.value)}
            autoComplete="username"
            autoCapitalize="characters"
            required
            placeholder="e.g. CSC/2021/045"
            className={inputClass}
          />
        </Field>
        <Field id="password" label="Password">
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            className={inputClass}
          />
        </Field>
        <Button type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
        <Alert>{error}</Alert>
      </form>
      <p className="text-sm text-muted">Demo accounts are listed in the project README.</p>
    </PageShell>
  );
}
