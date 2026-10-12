"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/Page";
import { apiBaseUrl } from "@/lib/api/client";
import {
  CONSOLE_SETTINGS_DEFAULTS,
  loadConsoleSettings,
  saveConsoleSettings,
  type ConsoleSettings,
} from "@/lib/console-settings";
import { formatMoney, formatWhen } from "@/lib/format";
import { useAuth } from "@/providers/auth-provider";

type Section = "regional" | "operations" | "display" | "workspace";

const SECTIONS: { id: Section; label: string; hint: string }[] = [
  {
    id: "regional",
    label: "Regional",
    hint: "City, time, and money display",
  },
  {
    id: "operations",
    label: "Operations",
    hint: "Defaults when creating nights",
  },
  {
    id: "display",
    label: "Display",
    hint: "Console density and cues",
  },
  {
    id: "workspace",
    label: "Workspace",
    hint: "Environment and account",
  },
];

export default function SettingsPage() {
  const { user, mockMode } = useAuth();
  const [section, setSection] = useState<Section>("regional");
  const [form, setForm] = useState<ConsoleSettings>(CONSOLE_SETTINGS_DEFAULTS);
  const [ready, setReady] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const next = loadConsoleSettings();
    setForm(next);
    setReady(true);
  }, []);

  function patch<K extends keyof ConsoleSettings>(
    key: K,
    value: ConsoleSettings[K],
  ) {
    setDirty(true);
    setSavedAt(null);
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next = saveConsoleSettings(form);
    setForm(next);
    setDirty(false);
    setSavedAt(new Date().toISOString());
  }

  function onReset() {
    setForm(CONSOLE_SETTINGS_DEFAULTS);
    setDirty(true);
    setSavedAt(null);
  }

  const previewWhen = useMemo(
    () => formatWhen(new Date().toISOString()),
    // Recompute when regional knobs change (format reads localStorage after save;
    // preview uses live form values via temporary write-through display).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form.timezone, form.timeFormat, savedAt],
  );

  const previewMoney = useMemo(
    () => formatMoney(form.defaultSeatPrice, form.currency),
    [form.defaultSeatPrice, form.currency],
  );

  const livePreviewWhen = useMemo(() => {
    const d = new Date();
    const date = new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      timeZone: form.timezone,
    }).format(d);
    const time = new Intl.DateTimeFormat(
      form.timeFormat === "24h" ? "en-GB" : "en-US",
      {
        hour: "numeric",
        minute: "2-digit",
        hour12: form.timeFormat !== "24h",
        timeZone: form.timezone,
      },
    ).format(d);
    return `${date} · ${time}`;
  }, [form.timezone, form.timeFormat]);

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Console preferences for how NYTO Admin formats nights, money, and ops defaults across this browser."
        actions={
          dirty ? (
            <Badge tone="warning">Unsaved changes</Badge>
          ) : savedAt ? (
            <Badge tone="success">Saved</Badge>
          ) : null
        }
      />

      <div className="grid gap-6 xl:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="nyto-panel h-fit overflow-hidden p-2">
          <nav className="flex flex-col gap-0.5">
            {SECTIONS.map((item) => {
              const active = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  className={`rounded-xl px-3.5 py-3 text-left transition ${
                    active
                      ? "nyto-nav-active"
                      : "text-text-muted hover:bg-bg-soft hover:text-text"
                  }`}
                >
                  <div className="text-[14px] font-semibold tracking-[-0.01em]">
                    {item.label}
                  </div>
                  <div className="mt-0.5 text-[12px] text-text-faint">
                    {item.hint}
                  </div>
                </button>
              );
            })}
          </nav>
        </aside>

        <form onSubmit={onSubmit} className="space-y-5">
          {section === "regional" ? (
            <section className="nyto-panel space-y-5 p-5 sm:p-6">
              <header>
                <h2 className="font-display text-[22px] font-medium tracking-[-0.02em] text-ink">
                  Regional
                </h2>
                <p className="mt-1 text-[14px] text-text-muted">
                  Controls how times and currency appear across Sessions,
                  Bookings, and Payments.
                </p>
              </header>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label>Primary city</Label>
                  <Input
                    value={form.city}
                    disabled={!ready}
                    onChange={(e) => patch("city", e.target.value)}
                    placeholder="Hyderabad"
                  />
                </div>
                <div>
                  <Label>Timezone</Label>
                  <Select
                    value={form.timezone}
                    disabled={!ready}
                    onChange={(e) => patch("timezone", e.target.value)}
                  >
                    <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                    <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                    <option value="Asia/Singapore">Asia/Singapore</option>
                    <option value="UTC">UTC</option>
                  </Select>
                </div>
                <div>
                  <Label>Time format</Label>
                  <Select
                    value={form.timeFormat}
                    disabled={!ready}
                    onChange={(e) =>
                      patch(
                        "timeFormat",
                        e.target.value === "24h" ? "24h" : "12h",
                      )
                    }
                  >
                    <option value="12h">12-hour (8:00 PM)</option>
                    <option value="24h">24-hour (20:00)</option>
                  </Select>
                </div>
                <div>
                  <Label>Currency</Label>
                  <Select
                    value={form.currency}
                    disabled={!ready}
                    onChange={(e) =>
                      patch(
                        "currency",
                        e.target.value as ConsoleSettings["currency"],
                      )
                    }
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                    <option value="AED">AED (د.إ)</option>
                  </Select>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-bg-soft/50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-faint">
                  Live preview
                </p>
                <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-[14px]">
                  <p>
                    <span className="text-text-faint">Now · </span>
                    <span className="font-medium text-ink">{livePreviewWhen}</span>
                  </p>
                  <p>
                    <span className="text-text-faint">Seat · </span>
                    <span className="font-medium text-ink">{previewMoney}</span>
                  </p>
                  <p>
                    <span className="text-text-faint">City · </span>
                    <span className="font-medium text-ink">
                      {form.city.trim() || "—"}
                    </span>
                  </p>
                </div>
              </div>
            </section>
          ) : null}

          {section === "operations" ? (
            <section className="nyto-panel space-y-5 p-5 sm:p-6">
              <header>
                <h2 className="font-display text-[22px] font-medium tracking-[-0.02em] text-ink">
                  Operations
                </h2>
                <p className="mt-1 text-[14px] text-text-muted">
                  Defaults used when you create a session from a venue. Confirm
                  prompts protect money actions.
                </p>
              </header>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Default seat price</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.defaultSeatPrice}
                    disabled={!ready}
                    onChange={(e) =>
                      patch("defaultSeatPrice", Number(e.target.value) || 0)
                    }
                  />
                </div>
                <div>
                  <Label>Default capacity</Label>
                  <Input
                    type="number"
                    min={2}
                    max={12}
                    value={form.defaultCapacity}
                    disabled={!ready}
                    onChange={(e) =>
                      patch("defaultCapacity", Number(e.target.value) || 6)
                    }
                  />
                </div>
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-bg-soft/40 px-4 py-3.5">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-[var(--accent)]"
                  checked={form.confirmDestructive}
                  disabled={!ready}
                  onChange={(e) =>
                    patch("confirmDestructive", e.target.checked)
                  }
                />
                <span>
                  <span className="block text-[14px] font-semibold text-ink">
                    Confirm cancel & refund actions
                  </span>
                  <span className="mt-0.5 block text-[13px] text-text-muted">
                    Ask before cancelling bookings/sessions or issuing refunds.
                  </span>
                </span>
              </label>
            </section>
          ) : null}

          {section === "display" ? (
            <section className="nyto-panel space-y-5 p-5 sm:p-6">
              <header>
                <h2 className="font-display text-[22px] font-medium tracking-[-0.02em] text-ink">
                  Display
                </h2>
                <p className="mt-1 text-[14px] text-text-muted">
                  How dense the console feels while you scan nights and money.
                </p>
              </header>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-bg-soft/40 px-4 py-3.5">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-[var(--accent)]"
                  checked={form.compactTables}
                  disabled={!ready}
                  onChange={(e) => patch("compactTables", e.target.checked)}
                />
                <span>
                  <span className="block text-[14px] font-semibold text-ink">
                    Compact tables
                  </span>
                  <span className="mt-0.5 block text-[13px] text-text-muted">
                    Tighter row padding on Sessions, Bookings, Payments, and
                    Guests.
                  </span>
                </span>
              </label>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-bg-soft/40 px-4 py-3.5">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-[var(--accent)]"
                  checked={form.highlightPending}
                  disabled={!ready}
                  onChange={(e) => patch("highlightPending", e.target.checked)}
                />
                <span>
                  <span className="block text-[14px] font-semibold text-ink">
                    Highlight pending payments
                  </span>
                  <span className="mt-0.5 block text-[13px] text-text-muted">
                    Keep unpaid holds visible in Overview attention cues.
                  </span>
                </span>
              </label>
            </section>
          ) : null}

          {section === "workspace" ? (
            <section className="space-y-5">
              <div className="nyto-panel space-y-5 p-5 sm:p-6">
                <header>
                  <h2 className="font-display text-[22px] font-medium tracking-[-0.02em] text-ink">
                    Workspace
                  </h2>
                  <p className="mt-1 text-[14px] text-text-muted">
                    Read-only view of how this console is connected. Change
                    these via env / deploy — not from this form.
                  </p>
                </header>

                <dl className="grid gap-3 sm:grid-cols-2">
                  <InfoTile
                    label="Signed in"
                    value={user?.email || user?.fullName || "—"}
                  />
                  <InfoTile
                    label="Role"
                    value={user?.role || "ADMIN"}
                    badge
                  />
                  <InfoTile
                    label="Auth mode"
                    value={mockMode ? "Mock" : "Live"}
                  />
                  <InfoTile label="API base" value={apiBaseUrl()} mono />
                  <InfoTile
                    label="Primary city"
                    value={form.city.trim() || "—"}
                  />
                  <InfoTile
                    label="Prefs storage"
                    value="This browser only"
                  />
                </dl>
              </div>

              <div className="nyto-panel p-5 sm:p-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-faint">
                  Scope
                </p>
                <p className="mt-2 text-[14px] leading-relaxed text-text-muted">
                  These preferences stay on this device. Venues, sessions,
                  bookings, and payments are live on the shared NYTO database —
                  managed from Operations, not here.
                </p>
              </div>
            </section>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={!ready || !dirty}>
              {dirty ? "Save changes" : "Saved"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={!ready}
              onClick={onReset}
            >
              Reset defaults
            </Button>
            {savedAt ? (
              <p className="text-[13px] text-success">
                Saved · applied to console formatting
                {previewWhen ? ` · sample ${previewWhen}` : ""}
              </p>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}

function InfoTile({
  label,
  value,
  mono,
  badge,
}: {
  label: string;
  value: string;
  mono?: boolean;
  badge?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-bg-soft/40 px-4 py-3.5">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-faint">
        {label}
      </dt>
      <dd
        className={`mt-1.5 text-[14px] font-medium text-ink ${
          mono ? "truncate font-mono text-[12px] text-text-muted" : ""
        }`}
      >
        {badge ? <Badge tone="accent">{value}</Badge> : value}
      </dd>
    </div>
  );
}
