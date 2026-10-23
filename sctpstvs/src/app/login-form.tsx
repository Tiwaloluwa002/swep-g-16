"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { HOME } from "@/components/role-gate";
import { api } from "@/lib/client/api";
import type { SessionUser } from "@/lib/types";

export function LoginForm() {
  const router = useRouter();
  const [matric, setMatric] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Already signed in: go straight to the right screen.
  useEffect(() => {
    api<{ user: SessionUser }>("/api/auth/me")
      .then(({ user }) => router.replace(HOME[user.role]))
      .catch(() => undefined);
  }, [router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { user } = await api<{ user: SessionUser }>("/api/auth/login", { body: { matric, password } });
      router.replace(HOME[user.role]);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4" noValidate>
      <h2 className="text-xl font-bold">Sign in</h2>
      <label htmlFor="matric" className="font-semibold">
        Matric or staff number
      </label>
      <input
        id="matric"
        name="username"
        value={matric}
        onChange={(e) => setMatric(e.target.value)}
        autoComplete="username"
        autoCapitalize="characters"
        placeholder="e.g. CSC/2021/001"
        required
        className="rounded-md border border-border bg-bg px-3 py-2.5 font-mono"
      />
      <label htmlFor="password" className="font-semibold">
        Password
      </label>
      <input
        id="password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
        required
        className="rounded-md border border-border bg-bg px-3 py-2.5"
      />
      <button
        type="submit"
        disabled={busy}
        className="mt-1 rounded-md bg-primary px-4 py-3 font-bold text-primary-fg disabled:opacity-60"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
      <p role="alert" className="min-h-6 text-danger">
        {error}
      </p>
    </form>
  );
}
