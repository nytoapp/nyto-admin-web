"use client";

import { FormEvent, useEffect, useState } from "react";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FieldError, Input, Label } from "@/components/ui/Field";
import { ErrorBanner, PageHeader, Skeleton } from "@/components/ui/Page";
import { ApiError } from "@/lib/api/client";
import { inviteAdmin, listTeam, type TeamMember } from "@/lib/api/team";
import { statusLabel } from "@/lib/format";
import { useAdminResource } from "@/lib/hooks/useAdminResource";
import { MOCK_TEAM } from "@/lib/mock/data";
import { useAuth } from "@/providers/auth-provider";

export default function TeamPage() {
  const { mockMode, getToken } = useAuth();
  const [rows, setRows] = useState<TeamMember[] | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  async function onInvite(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !name.trim()) {
      setError("Name and email are required.");
      return;
    }
    setError(null);
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
        return;
      }
      const token = await getToken();
      if (!token) throw new ApiError("Session expired.", 401);
      await inviteAdmin(token, {
        email: email.trim().toLowerCase(),
        name: name.trim(),
      });
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

  return (
    <div>
      <PageHeader
        title="Team"
        description="Founders and ops who can access the NYTO admin console."
      />

      {loadError ? (
        <ErrorBanner message={loadError} onRetry={() => void reload()} />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        {loading && !mockMode && !data ? (
          <Skeleton className="h-64" />
        ) : (
          <div className="nyto-panel overflow-hidden">
            <div className="nyto-table-wrap">
              <table className="nyto-table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.id}>
                      <td className="font-medium text-ink">{m.name}</td>
                      <td className="text-text-muted">{m.email}</td>
                      <td>
                        <Badge tone="accent">{statusLabel(m.role)}</Badge>
                      </td>
                      <td>
                        <Badge tone={statusTone(m.status)}>
                          {statusLabel(m.status)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <form onSubmit={onInvite} className="nyto-panel h-fit space-y-3.5 p-5">
          <h3 className="text-[15px] font-semibold text-ink">Invite admin</h3>
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
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Inviting…" : "Grant admin access"}
          </Button>
          <p className="text-[12px] text-text-faint">
            Promotes the account to ADMIN. They sign in with email OTP.
          </p>
        </form>
      </div>
    </div>
  );
}
