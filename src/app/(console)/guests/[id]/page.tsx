"use client";

import { useMemo, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { HostedByBadge } from "@/components/ui/HostedBy";
import {
  EmptyState,
  ErrorBanner,
  PageHeader,
  Skeleton,
} from "@/components/ui/Page";
import { listBookings } from "@/lib/api/bookings";
import {
  getGuest,
  type GuestTableGroup,
} from "@/lib/api/guests";
import {
  enrichBookingsWithMenus,
  experienceDisplayName,
  type EnrichedBookingRow,
} from "@/lib/booking-experience";
import { categoryLabel } from "@/lib/categories";
import {
  billTypeLabel,
  formatWhen,
  paymentMethodLabel,
  statusLabel,
} from "@/lib/format";
import {
  buildVisitHistoryGroups,
  countByBookingStatus,
  loadSharedTableContexts,
  mealPeriodFromStartsAt,
  physicalAttendanceLabel,
  reconnectPreferenceLabel,
  type SharedTableContext,
} from "@/lib/guest-details";
import {
  conversationStyleLabel,
  datingIntentLabel,
  formatGuestAge,
  genderLabel,
  hasAnyGuestPreferences,
  interestLabel,
  socialEnergyLabel,
  type GuestPreferences,
} from "@/lib/guest-preferences";
import { useAdminResource } from "@/lib/hooks/useAdminResource";
import { mapBookingRow } from "@/lib/mappers";
import { MOCK_GUESTS } from "@/lib/mock/data";
import { useAuth } from "@/providers/auth-provider";

/**
 * Guest Details — profile prefs from guest app + visit history from bookings.
 * Physical arrival, reconnect preference, and lifetime ledger need backend work.
 */

const CONTACT_FALLBACK = "Not provided";

type GuestIdentity = {
  id: string;
  name: string;
  phone: string;
  email: string;
  guestListBookings: number | null;
  lastVenue: string | null;
} & GuestPreferences;

function contactOrFallback(raw: string | null | undefined): string {
  const v = (raw ?? "").trim();
  if (!v || v === "—") return CONTACT_FALLBACK;
  return v;
}

export default function GuestDetailPage() {
  const params = useParams<{ id: string }>();
  const guestId = params.id;
  const router = useRouter();
  const { mockMode } = useAuth();

  const {
    data: guestBundle,
    loading: guestLoading,
    error: guestError,
    reload: reloadGuest,
  } = useAdminResource(
    !mockMode && Boolean(guestId),
    async (token) => {
      const res = await getGuest(token, guestId);
      const row = res.guest;
      const identity: GuestIdentity = {
        id: row.id,
        name: row.name?.trim() || "Guest",
        phone: contactOrFallback(row.phone),
        email: contactOrFallback(row.email),
        guestListBookings: Number.isFinite(row.bookings) ? row.bookings : null,
        lastVenue: row.lastVenue?.trim() || null,
        gender: row.gender ?? null,
        dateOfBirth: row.dateOfBirth ?? null,
        socialEnergy: row.socialEnergy ?? null,
        conversationStyle: row.conversationStyle ?? null,
        tableOneLiner: row.tableOneLiner ?? null,
        datingIntent: row.datingIntent ?? null,
        interests: row.interests ?? [],
      };
      return {
        identity,
        tableGroups: res.tableGroups ?? [],
      };
    },
    [guestId],
  );

  const {
    data: history,
    loading: historyLoading,
    error: historyError,
    reload: reloadHistory,
  } = useAdminResource(
    !mockMode && Boolean(guestId),
    async (token) => {
      const res = await listBookings(token);
      const mapped = res.bookings
        .filter((b) => b.user?.id === guestId)
        .map(mapBookingRow);
      return enrichBookingsWithMenus(token, mapped);
    },
    [guestId],
  );

  const rows: EnrichedBookingRow[] = useMemo(() => {
    if (mockMode) return [];
    return (history ?? []).map((r) => ({
      ...r,
      menuDescription: r.menuDescription ?? null,
    }));
  }, [mockMode, history]);

  const tableKey = rows
    .map((r) => r.tableId)
    .filter(Boolean)
    .join(",");

  const {
    data: sharedTables,
    loading: sharedLoading,
    error: sharedError,
    reload: reloadShared,
  } = useAdminResource(
    !mockMode && Boolean(guestId) && rows.length > 0 && Boolean(tableKey),
    async (token) => loadSharedTableContexts(token, rows, guestId),
    [guestId, tableKey],
  );

  const mockGuest = useMemo<GuestIdentity | null>(() => {
    if (!mockMode) return null;
    const g = MOCK_GUESTS.find((row) => row.id === guestId);
    if (!g) return null;
    return {
      id: g.id,
      name: g.name,
      phone: contactOrFallback(g.phone),
      email: contactOrFallback(g.email),
      guestListBookings: g.bookings,
      lastVenue: g.lastVenue === "—" ? null : g.lastVenue,
      gender: g.gender ?? null,
      dateOfBirth: g.dateOfBirth ?? null,
      socialEnergy: g.socialEnergy ?? null,
      conversationStyle: g.conversationStyle ?? null,
      tableOneLiner: g.tableOneLiner ?? null,
      datingIntent: g.datingIntent ?? null,
      interests: g.interests ?? [],
    };
  }, [mockMode, guestId]);

  const mockTableGroups = useMemo<GuestTableGroup[]>(() => {
    if (!mockMode || !mockGuest) return [];
    if (mockGuest.guestListBookings === 0) return [];
    const starts = new Date();
    starts.setDate(starts.getDate() + 2);
    starts.setHours(20, 0, 0, 0);
    return [
      {
        tableId: `mock-table-${mockGuest.id}`,
        venueId: "v-mock",
        venueName: mockGuest.lastVenue || "Demo Venue",
        city: "Hyderabad",
        area: null,
        startsAt: starts.toISOString(),
        tableType: "WEEKLY",
        paymentType: "ALL_INCLUSIVE",
        tableStatus: "OPEN",
        menuName: "Hyderabadi long table",
        capacity: 6,
        memberCount: 4,
        activeInApp: true,
        chatState: "ACTIVE",
        attended: false,
        joinedAt: new Date().toISOString(),
        members: [
          {
            userId: mockGuest.id,
            name: mockGuest.name,
            isSelf: true,
            attended: false,
          },
          {
            userId: "peer-1",
            name: "Ananya K",
            isSelf: false,
            attended: false,
          },
          {
            userId: "peer-2",
            name: "Rahul M",
            isSelf: false,
            attended: false,
          },
          {
            userId: "peer-3",
            name: "Priya Nair",
            isSelf: false,
            attended: false,
          },
        ],
      },
    ];
  }, [mockMode, mockGuest]);

  const identity = mockMode ? mockGuest : (guestBundle?.identity ?? null);
  const tableGroups = mockMode
    ? mockTableGroups
    : (guestBundle?.tableGroups ?? []);
  const guestSettled = mockMode || !guestLoading;
  const historySettled = mockMode || !historyLoading;
  const loading = !mockMode && guestLoading;
  const error = guestError || historyError || sharedError;

  const { upcoming, pastVisits, cancelledUpcoming, undated } = useMemo(
    () => buildVisitHistoryGroups(rows),
    [rows],
  );
  const statusCounts = useMemo(() => countByBookingStatus(rows), [rows]);
  const nightsCount = useMemo(
    () => new Set(rows.map((r) => r.tableId).filter(Boolean)).size,
    [rows],
  );
  const tablesWithPeers = useMemo(
    () => (sharedTables ?? []).filter((t) => t.peers.length > 0),
    [sharedTables],
  );

  if (loading) {
    return (
      <div className="nyto-fade mx-auto max-w-4xl space-y-4">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-40 w-full rounded-[22px]" />
        <div className="grid gap-3 sm:grid-cols-4">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
        <Skeleton className="h-56 w-full rounded-2xl" />
      </div>
    );
  }

  if (guestSettled && !identity) {
    return (
      <div className="nyto-fade mx-auto max-w-4xl">
        <PageHeader
          title="Guest not found"
          description="This account is not in the loaded guest list."
          actions={
            <Button variant="secondary" onClick={() => router.push("/guests")}>
              Back to guests
            </Button>
          }
        />
        {error ? (
          <ErrorBanner
            message={error}
            onRetry={() => {
              void reloadGuest();
              void reloadHistory();
            }}
          />
        ) : null}
      </div>
    );
  }

  if (!identity) return null;

  return (
    <div className="nyto-fade mx-auto max-w-4xl">
      <Link
        href="/guests"
        className="inline-flex text-[13px] font-semibold text-text-muted transition hover:text-accent"
      >
        ← Guests
      </Link>

      <header className="nyto-bookings-hero relative mt-5 overflow-hidden rounded-[22px] border border-border bg-bg-elevated shadow-[var(--shadow-md)]">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_420px_at_0%_-10%,rgba(77,139,255,0.14),transparent_55%)] opacity-90"
          aria-hidden
        />
        <div className="relative z-[2] px-5 py-6 sm:px-7 sm:py-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-faint">
            Guest
          </p>
          <h1 className="mt-2 font-display text-[36px] font-medium leading-[1.05] tracking-[-0.04em] text-ink sm:text-[42px]">
            {identity.name}
          </h1>

          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-faint">
                Phone
              </dt>
              <dd className="mt-1 text-[14px] font-medium text-ink">
                {identity.phone}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-faint">
                Email
              </dt>
              <dd className="mt-1 truncate text-[14px] font-medium text-ink">
                {identity.email}
              </dd>
            </div>
          </dl>

          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border-subtle pt-4 text-[12px] text-text-faint">
            <span>
              Reconnect ·{" "}
              <span className="text-text-muted">
                {reconnectPreferenceLabel()}
              </span>
            </span>
            {identity.lastVenue ? (
              <span>
                Last venue ·{" "}
                <span className="text-text-muted">{identity.lastVenue}</span>
              </span>
            ) : null}
            <span>Feed only · not lifetime</span>
          </div>
        </div>
      </header>

      {error ? (
        <div className="mt-4">
          <ErrorBanner
            message={error}
            onRetry={() => {
              void reloadGuest();
              void reloadHistory();
              void reloadShared();
            }}
          />
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Bookings in feed"
          hint="Records shown below"
          value={historySettled ? String(rows.length) : "—"}
        />
        <Stat
          label="Guest total"
          hint="From guest list"
          value={
            identity.guestListBookings != null
              ? String(identity.guestListBookings)
              : "—"
          }
        />
        <Stat
          label="Dining nights"
          hint="Tables in feed"
          value={historySettled ? String(nightsCount) : "—"}
        />
        <Stat
          label="Booking · Attended"
          hint="Status in feed"
          value={historySettled ? String(statusCounts.attended) : "—"}
        />
      </div>

      <SectionCard title="Interests & preferences">
        <GuestPreferencesPanel guest={identity} />
      </SectionCard>

      <SectionCard title="Table groups">
        <TableGroupsPanel groups={tableGroups} />
      </SectionCard>

      {/* Primary: visit timeline */}
      <SectionCard title="Visit history">
        {!historySettled ? (
          <div>
            <Skeleton className="h-[72px] rounded-none" />
            <Skeleton className="h-[72px] rounded-none opacity-70" />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="No visits in feed"
            description="No bookings for this guest in the current bookings feed."
          />
        ) : (
          <div>
            {upcoming.length > 0 ? (
              <VisitGroup label="Upcoming" rows={upcoming} />
            ) : null}
            {pastVisits.length > 0 ? (
              <VisitGroup label="Past visits" rows={pastVisits} />
            ) : null}
            {cancelledUpcoming.length > 0 ? (
              <VisitGroup
                label="Cancelled before night"
                rows={cancelledUpcoming}
              />
            ) : null}
            {undated.length > 0 ? (
              <VisitGroup label="Date unknown" rows={undated} />
            ) : null}
          </div>
        )}
      </SectionCard>

      {/* Table mates — only when we have peers */}
      <SectionCard title="People at the same table">
        {mockMode ? (
          <p className="px-5 py-4 text-[13px] text-text-faint">Not available</p>
        ) : !historySettled || (sharedLoading && !sharedTables) ? (
          <Skeleton className="mx-5 my-4 h-14 rounded-xl" />
        ) : !tableKey ? (
          <p className="px-5 py-4 text-[13px] text-text-faint">
            No dining-night links on these bookings.
          </p>
        ) : tablesWithPeers.length === 0 ? (
          <p className="px-5 py-4 text-[13px] text-text-faint">
            No other guests found on the same table.
          </p>
        ) : (
          <ul>
            {tablesWithPeers.map((t) => (
              <SharedTableBlock key={t.tableId} table={t} />
            ))}
          </ul>
        )}
      </SectionCard>

      <p className="mt-5 text-[12px]">
        <Link
          href="/guest-experience"
          className="font-semibold text-accent hover:underline"
        >
          Guest Experience
        </Link>
      </p>
    </div>
  );
}

function VisitGroup({
  label,
  rows,
}: {
  label: string;
  rows: EnrichedBookingRow[];
}) {
  return (
    <div>
      <div className="border-b border-border-subtle bg-bg/30 px-5 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-faint">
          {label}
          <span className="ml-2 tabular-nums text-text-muted">{rows.length}</span>
        </p>
      </div>
      <ul>
        {rows.map((b) => (
          <li key={b.id} className="border-b border-border-subtle last:border-0">
            <VisitRow booking={b} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function VisitRow({ booking: b }: { booking: EnrichedBookingRow }) {
  const router = useRouter();
  const meal = mealPeriodFromStartsAt(b.startsAtIso);
  const mealTag =
    meal === "lunch" ? "Lunch" : meal === "dinner" ? "Dinner" : null;

  function openBooking() {
    router.push(`/bookings/${b.id}`);
  }

  function onKeyActivate(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openBooking();
    }
  }

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={openBooking}
      onKeyDown={onKeyActivate}
      className="flex cursor-pointer flex-col gap-2 px-5 py-3.5 hover:bg-bg-hover/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)] sm:flex-row sm:items-center sm:justify-between sm:gap-4"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[15px] font-semibold tracking-[-0.02em] text-ink">
            {b.when && b.when !== "—" ? b.when : "Date unknown"}
          </p>
          {mealTag ? (
            <span className="rounded-md border border-border-subtle bg-bg/50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">
              {mealTag}
            </span>
          ) : null}
          <HostedByBadge value={b.hostedBy} short />
        </div>

        <p className="mt-1 truncate text-[14px] font-medium text-ink">
          {b.venueId && b.venue !== "—" ? (
            <Link
              href={`/venues/${b.venueId}`}
              className="hover:text-accent hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {b.venue}
            </Link>
          ) : b.venue !== "—" ? (
            b.venue
          ) : (
            "Venue unavailable"
          )}
        </p>

        <p className="mt-0.5 text-[13px] text-text-muted">
          {[
            experienceDisplayName(b.experienceName),
            b.tableType ? categoryLabel(b.tableType) : null,
            billTypeLabel(b.paymentType),
            b.seats != null
              ? `${b.seats} seat${b.seats === 1 ? "" : "s"}`
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-start gap-1.5 sm:items-end">
        <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
          <Badge tone={statusTone(b.status)}>
            Booking · {statusLabel(b.status)}
          </Badge>
          {b.paymentStatus ? (
            <Badge tone={statusTone(b.paymentStatus)}>
              Payment · {statusLabel(b.paymentStatus)}
            </Badge>
          ) : null}
          {b.paymentType ? (
            <Badge
              tone={
                b.paymentType.toUpperCase() === "PAY_OWN_BILL"
                  ? "warning"
                  : "accent"
              }
            >
              {billTypeLabel(b.paymentType)}
            </Badge>
          ) : null}
        </div>
        <p className="text-[11px] text-text-faint">
          Arrival · {physicalAttendanceLabel()}
        </p>
        <p className="text-[14px] font-semibold tabular-nums text-ink">
          {b.amount}
        </p>
        {b.paymentMethod ? (
          <p className="text-[11px] text-text-faint">
            {paymentMethodLabel(b.paymentMethod)}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function SharedTableBlock({ table: t }: { table: SharedTableContext }) {
  return (
    <li className="border-b border-border-subtle px-5 py-3 last:border-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-ink">
            {t.when !== "—" ? t.when : experienceDisplayName(t.experienceName)}
          </p>
          <p className="mt-0.5 text-[12px] text-text-muted">
            {[
              t.venue !== "—" ? t.venue : null,
              experienceDisplayName(t.experienceName),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <Badge tone={statusTone(t.guestBookingStatus)}>
          Booking · {statusLabel(t.guestBookingStatus)}
        </Badge>
      </div>
      <ul className="mt-2 space-y-1.5">
        {t.peers.map((p) => (
          <li
            key={p.bookingId}
            className="flex flex-wrap items-center justify-between gap-2 text-[13px]"
          >
            <span className="min-w-0 truncate font-medium text-ink">
              {p.userId ? (
                <Link
                  href={`/guests/${p.userId}`}
                  className="hover:text-accent hover:underline"
                >
                  {p.guest}
                </Link>
              ) : (
                p.guest
              )}
            </span>
            <div className="flex items-center gap-2">
              <Badge tone={statusTone(p.bookingStatus)}>
                Booking · {statusLabel(p.bookingStatus)}
              </Badge>
              <Link
                href={`/bookings/${p.bookingId}`}
                className="text-[12px] font-semibold text-accent hover:underline"
              >
                Open
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </li>
  );
}

function PrefRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-faint">
        {label}
      </dt>
      <dd className="mt-1 text-[14px] font-medium leading-snug text-ink">
        {value}
      </dd>
    </div>
  );
}

function chatStateLabel(state: string): string {
  const s = state.toUpperCase();
  if (s === "ACTIVE") return "Active in app";
  if (s === "GRACE_PERIOD") return "Active · grace";
  if (s === "DISABLED") return "Closed";
  return state;
}

function TableGroupsPanel({ groups }: { groups: GuestTableGroup[] }) {
  if (groups.length === 0) {
    return (
      <div className="px-5 py-8 text-center">
        <p className="text-[15px] font-semibold text-ink">No table groups yet</p>
        <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-text-muted">
          After this guest pays for a night, they join that table’s group in the
          NYTO app with the other booked guests. Those groups show up here.
        </p>
      </div>
    );
  }

  const activeCount = groups.filter((g) => g.activeInApp).length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle px-5 py-3">
        <p className="text-[13px] text-text-muted">
          {groups.length} group{groups.length === 1 ? "" : "s"}
          {activeCount > 0 ? (
            <>
              {" "}
              ·{" "}
              <span className="font-semibold text-success">
                {activeCount} active in app
              </span>
            </>
          ) : null}
        </p>
        <p className="text-[11px] text-text-faint">
          Same groups as table chat in the guest app
        </p>
      </div>
      <ul>
        {groups.map((g) => (
          <li
            key={g.tableId}
            className="border-b border-border-subtle px-5 py-4 last:border-0"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[15px] font-semibold tracking-[-0.02em] text-ink">
                  {formatWhen(g.startsAt)}
                </p>
                <p className="mt-0.5 text-[14px] font-medium text-ink">
                  <Link
                    href={`/venues/${g.venueId}`}
                    className="hover:text-accent hover:underline"
                  >
                    {g.venueName}
                  </Link>
                </p>
                <p className="mt-0.5 text-[13px] text-text-muted">
                  {[
                    g.menuName,
                    categoryLabel(g.tableType),
                    billTypeLabel(g.paymentType),
                    `${g.memberCount}/${g.capacity} in group`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {g.paymentType ? (
                  <Badge
                    tone={
                      g.paymentType.toUpperCase() === "PAY_OWN_BILL"
                        ? "warning"
                        : "accent"
                    }
                  >
                    {billTypeLabel(g.paymentType)}
                  </Badge>
                ) : null}
                <Badge tone={g.activeInApp ? "success" : "neutral"}>
                  {chatStateLabel(g.chatState)}
                </Badge>
              </div>
            </div>

            <ul className="mt-3 flex flex-wrap gap-2">
              {g.members.map((m) => (
                <li key={m.userId}>
                  {m.isSelf ? (
                    <Badge tone="accent">
                      {m.name}
                      {" · you"}
                    </Badge>
                  ) : m.userId ? (
                    <Link href={`/guests/${m.userId}`}>
                      <Badge tone="neutral">{m.name}</Badge>
                    </Link>
                  ) : (
                    <Badge tone="neutral">{m.name}</Badge>
                  )}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}

function GuestPreferencesPanel({ guest }: { guest: GuestIdentity }) {
  const energy = socialEnergyLabel(guest.socialEnergy);
  const style = conversationStyleLabel(guest.conversationStyle);
  const dating = datingIntentLabel(guest.datingIntent);
  const gender = genderLabel(guest.gender);
  const age = formatGuestAge(guest.dateOfBirth);
  const interests = guest.interests ?? [];
  const filled = hasAnyGuestPreferences(guest);

  if (!filled) {
    return (
      <div className="px-5 py-8 text-center">
        <p className="text-[15px] font-semibold text-ink">
          No preferences on file
        </p>
        <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-text-muted">
          This guest hasn’t completed onboarding choices in the NYTO app yet
          (energy, interests, table vibe).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 px-5 py-5">
      {guest.tableOneLiner?.trim() ? (
        <p className="rounded-xl border border-border-subtle bg-bg/40 px-4 py-3 text-[15px] leading-relaxed text-ink">
          “{guest.tableOneLiner.trim()}”
        </p>
      ) : null}

      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {energy ? <PrefRow label="Social energy" value={energy} /> : null}
        {style ? <PrefRow label="At the table" value={style} /> : null}
        {dating ? <PrefRow label="Dating intent" value={dating} /> : null}
        {gender ? <PrefRow label="Gender" value={gender} /> : null}
        {age ? <PrefRow label="Age" value={age} /> : null}
      </dl>

      {interests.length > 0 ? (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-faint">
            Interests
          </p>
          <ul className="mt-2.5 flex flex-wrap gap-2">
            {interests.map((id) => (
              <li key={id}>
                <Badge tone="accent">{interestLabel(id)}</Badge>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-[13px] text-text-faint">No interests selected yet.</p>
      )}

      <p className="text-[11px] text-text-faint">
        Synced from the guest app account · shown for every guest with a
        profile (booked or not).
      </p>
    </div>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-border bg-bg-elevated/70 shadow-[var(--shadow-sm)]">
      <div className="border-b border-border-subtle px-5 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-faint">
          {title}
        </p>
      </div>
      {children}
    </section>
  );
}

function Stat({
  label,
  hint,
  value,
}: {
  label: string;
  hint: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border-subtle bg-bg/40 px-3.5 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-faint">
        {label}
      </p>
      <p className="mt-1 font-display text-[24px] font-medium tabular-nums tracking-[-0.03em] text-ink">
        {value}
      </p>
      <p className="mt-1 text-[11px] leading-snug text-text-faint">{hint}</p>
    </div>
  );
}
