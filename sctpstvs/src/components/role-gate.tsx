"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { api } from "@/lib/client/api";
import type { Role, SessionUser } from "@/lib/types";

export const HOME: Record<Role, string> = { student: "/student", conductor: "/conductor", admin: "/admin" };

/** Shows children only to a signed-in user with one of the given roles; sends everyone else away. */
export function RoleGate({ roles, children }: { roles: Role[]; children: (user: SessionUser) => ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const allowed = roles.join(",");

  useEffect(() => {
    api<{ user: SessionUser }>("/api/auth/me")
      .then(({ user }) => {
        if (allowed.split(",").includes(user.role)) setUser(user);
        else router.replace(HOME[user.role]);
      })
      .catch(() => router.replace("/"));
  }, [allowed, router]);

  if (!user) {
    return (
      <main id="main" className="flex flex-1 items-center justify-center p-6">
        <p role="status" className="text-muted">
          Loading…
        </p>
      </main>
    );
  }
  return (
    <>
      <AppHeader user={user} />
      {children(user)}
    </>
  );
}
