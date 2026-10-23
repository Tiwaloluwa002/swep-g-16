"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { announceSessionChange, api, SESSION_EVENT, useApi } from "@/lib/api";
import type { SessionUser } from "@/lib/public-types";

type Me = { user: SessionUser | null; unread: number };

export function SiteHeader() {
  const { data, reload } = useApi<Me>("/api/me");
  const router = useRouter();

  useEffect(() => {
    window.addEventListener(SESSION_EVENT, reload);
    return () => window.removeEventListener(SESSION_EVENT, reload);
  }, [reload]);

  async function signOut() {
    await api("/api/auth/logout", { body: {} }).catch(() => undefined);
    announceSessionChange();
    router.push("/");
  }

  const user = data?.user;
  const link = "rounded px-2 py-1 underline-offset-4 hover:underline";
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
        <Link href="/" className="font-bold leading-tight">
          OAU Lost &amp; Found
          <span className="block text-xs font-normal text-muted">Verified recovery, private by design</span>
        </Link>
        <nav aria-label="Main">
          <ul className="flex flex-wrap items-center gap-1 text-sm">
            {user ? (
              <>
                <li>
                  <Link href="/dashboard" className={link}>
                    My reports
                    {data.unread > 0 && (
                      <span className="ml-1 rounded-full bg-primary px-1.5 text-xs font-bold text-primary-fg">
                        {data.unread}
                        <span className="sr-only"> unread notifications</span>
                      </span>
                    )}
                  </Link>
                </li>
                <li>
                  <Link href="/lost/new" className={link}>
                    Report lost
                  </Link>
                </li>
                <li>
                  <Link href="/found/new" className={link}>
                    Report found
                  </Link>
                </li>
                {(user.role === "desk" || user.role === "admin") && (
                  <li>
                    <Link href="/desk" className={link}>
                      {user.role === "admin" ? "Admin desk" : "Desk"}
                    </Link>
                  </li>
                )}
                <li>
                  <button type="button" onClick={signOut} className={`${link} underline`}>
                    Sign out <span className="sr-only">({user.ident})</span>
                  </button>
                </li>
              </>
            ) : (
              <li>
                <Link href="/login" className="rounded-md bg-primary px-3 py-1.5 font-semibold text-primary-fg">
                  Sign in
                </Link>
              </li>
            )}
          </ul>
        </nav>
      </div>
    </header>
  );
}
