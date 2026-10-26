"use client";

import { FormEvent, useEffect, useState } from "react";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FieldError, Input, Label } from "@/components/ui/Field";
import { ModuleHero } from "@/components/ui/ModuleShell";
import { ErrorBanner, Skeleton } from "@/components/ui/Page";
import { ApiError } from "@/lib/api/client";
import {
  inviteAdmin,
  listTeam,
  revokeAdmin,
  type TeamMember,
} from "@/lib/api/team";
import { statusLabel } from "@/lib/format";
import { useAdminResource } from "@/lib/hooks/useAdminResource";
import { teamKpis } from "@/lib/kpi";
import { MOCK_TEAM } from "@/lib/mock/data";
import { useAuth } from "@/providers/auth-provider";

export default function TeamPage() {
  const { mockMode, getToken, user } = useAuth();
  const [rows, setRows] = useState<TeamMember[] | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const {
    data,
    loading,
    error: loadError,
    reload,
  } = useAdminResource(!mockMode, async (token) => {
    const res = await listTeam(token);
    return res.members;
  });

  useEffect(() => {
    if (data) setRows(data);
  }, [data]);

  const members = mockMode ? (rows ?? MOCK_TEAM) : (rows ?? data ?? []);
  const kpi = teamKpis(members);

  async function onInvite(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !name.trim()) {
      setError("Name and email are required.");
      return;
    }
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (mockMode) {
        setRows([
          ...members,
          {
            id: `t-${Date.now()}`,
            name: name.trim(),
            email: email.trim().toLowerCase(),
            role: "ADMIN",
            status: "INVITED",
          },
        ]);
        setEmail("");
        setName("");
        setNotice(
          "Demo invite only — no email is sent in mock mode. Live invite reports real delivery.",
        );
        return;
      }
      const token = await getToken();
      if (!token) throw new ApiError("Session expired.", 401);
      const res = await inviteAdmin(token, {
        email: email.trim().toLowerCase(),
        name: name.trim(),
      });
      setNotice(
        res.notification?.nextStep ??
          "Admin access granted. They sign in with email OTP — no magic link.",
      );
      setEmail("");
      setName("");
      await reload();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not invite admin.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function onRevoke(memberId: string) {
    if (
      !window.confirm(
        "Revoke admin access? They will lose console access immediately.",
      )
    ) {
      return;
    }
    setError(null);
    setRevokingId(memberId);
    try {
      if (mockMode) {
        setRows(members.filter((m) => m.id !== memberId));
        return;
      }
      const token = await getToken();
      if (!token) throw new ApiError("Session expired.", 401);
      await revokeAdmin(token, memberId);
      await reload();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not revoke admin.",
      );
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <div className="nyto-fade">
      <ModuleHero
        eyebrow="Console"
        title="Team"
        description="People with full NYTO Admin access — invite by work email, revoke anytime."
        stats={[
          {
            label: "Active admins",
            value: String(kpi.activeAdmins),
            hint: "ADMIN · signed in at least once",
          },
          {
            label: "Pending invitations",
            value: String(kpi.pendingInvitations),
            soft: true,
            hint: "Invited · not yet active",
          },
          {
            label: "Team size",
            value: String(kpi.teamSize),
            soft: true,
            hint: "Active admins + pending invitations",
          },
          {
            label: "Signed in as",
            value: user?.email?.split("@")[0] ?? "—",
            soft: true,
            hint: "Session identity · not a KPI",
          },
        ]}
      />

      {loadError ? (
        <ErrorBanner message={loadError} onRetry={() => void reload()} />
      ) : null}

      <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section
          className="overflow-hidden rounded-2xl border border-border bg-bg-elevated/60 shadow-[var(--shadow-sm)] nyto-rise"
          style={{ animationDelay: "80ms" }}
        >
          <div className="border-b border-border-subtle px-5 py-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-faint">
              Console access
            </p>
            <p className="mt-1 text-[13px] text-text-muted">
              Every member here is an Admin — full ops console.
            </p>
          </div>

          {loading && !mockMode && !data ? (
            <div className="space-y-0">
              <Skeleton className="h-[72px] rounded-none" />
              <Skeleton className="h-[72px] rounded-none opacity-60" />
            </div>
          ) : members.length === 0 ? (
            <p className="px-5 py-10 text-center text-[13px] text-text-muted">
              No team members yet.
            </p>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {members.map((m, i) => {
                const isSelf = Boolean(user?.id && m.id === user.id);
                const canRevoke = !isSelf && members.length > 1;
                return (
                  <li
                    key={m.id}
                    className="nyto-step-in flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                    style={{ animationDelay: `${120 + Math.min(i, 8) * 40}ms` }}
                  >
                    <div className="min-w-0 flex items-start gap-3">
                      <span
                        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-wash)] text-[13px] font-semibold text-accent-soft"
                        aria-hidden
                      >
                        {(m.name || "?").charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-semibold tracking-[-0.02em] text-ink">
                          {m.name}
                          {isSelf ? (
                            <span className="ml-2 rounded-md bg-bg-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-text-faint">
                              you
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 truncate text-[13px] text-text-faint">
                          {m.email || "—"}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <Badge tone="accent">{statusLabel(m.role)}</Badge>
                      <Badge tone={statusTone(m.status)}>
                        {statusLabel(m.status)}
                      </Badge>
                      {canRevoke ? (
                        <button
                          type="button"
                          disabled={revokingId === m.id}
                          onClick={() => void onRevoke(m.id)}
                          className="ml-1 text-[12px] font-semibold text-text-muted transition hover:text-ink disabled:opacity-50"
                        >
                          {revokingId === m.id ? "…" : "Revoke"}
                        </button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <form
          onSubmit={onInvite}
          className="h-fit overflow-hidden rounded-2xl border border-border bg-bg-elevated/70 shadow-[var(--shadow-sm)] nyto-rise"
          style={{ animationDelay: "120ms" }}
        >
          <div className="border-b border-border-subtle px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-faint">
              Invite
            </p>
            <h3 className="mt-1 text-[15px] font-semibold tracking-[-0.02em] text-ink">
              Grant admin access
            </h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-text-faint">
              Role is granted immediately. Invite email only goes out when Resend
              is configured — otherwise tell them to OTP in.
            </p>
          </div>

          <div className="space-y-3.5 px-5 py-4">
            <div>
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
              />
            </div>
            <div>
              <Label>Work email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ops@nyto.app"
              />
            </div>
            <FieldError message={error} />
            {notice ? (
              <p className="rounded-lg border border-border bg-bg-soft/80 px-3 py-2 text-[12px] leading-relaxed text-text-muted">
                {notice}
              </p>
            ) : null}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Inviting…" : "Grant admin access"}
            </Button>
            <ol className="space-y-1.5 border-t border-border-subtle pt-3 text-[12px] leading-relaxed text-text-faint">
              <li>1. You grant Admin on that work email</li>
              <li>2. Email is sent only if Resend is live</li>
              <li>3. They sign in with OTP — no magic link</li>
            </ol>
          </div>
        </form>
      </div>
    </div>
  );
}
