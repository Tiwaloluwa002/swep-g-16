"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/client/api";
import type { SessionUser } from "@/lib/types";

const ROLE_LABEL = { student: "Student", conductor: "Conductor", admin: "Admin" } as const;

const NAV: Record<SessionUser["role"], { href: string; label: string }[]> = {
  student: [],
  conductor: [],
  admin: [
    { href: "/admin", label: "Dashboard" },
    { href: "/conductor", label: "Verify tickets" },
  ],
};

export function AppHeader({ user }: { user: SessionUser }) {
  const router = useRouter();
  const pathname = usePathname();

  async function signOut() {
    await api("/api/auth/logout", { method: "POST", body: {} }).catch(() => undefined);
    router.replace("/");
  }

  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
        <div className="min-w-0">
          <p className="font-bold leading-tight">Campus Ride Pass</p>
          <p className="truncate text-sm text-muted">
            {user.name} · {ROLE_LABEL[user.role]} · {user.matric}
          </p>
        </div>
        <nav aria-label="Main" className="flex flex-wrap items-center gap-2">
          {NAV[user.role].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname === item.href ? "page" : undefined}
              className="rounded-md border border-border px-3 py-2 text-sm font-semibold aria-[current=page]:border-primary aria-[current=page]:bg-primary aria-[current=page]:text-primary-fg"
            >
              {item.label}
            </Link>
          ))}
          <button type="button" onClick={signOut} className="rounded-md border border-border px-3 py-2 text-sm font-semibold">
            Sign out
          </button>
        </nav>
      </div>
    </header>
  );
}
