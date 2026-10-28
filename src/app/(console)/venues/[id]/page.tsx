"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FieldError, Input, Label, Select } from "@/components/ui/Field";
import {
  HostedByBadge,
  VenueOrganizedReadNote,
} from "@/components/ui/HostedBy";
import {
  ErrorBanner,
  PageHeader,
  Skeleton,
  StatCard,
} from "@/components/ui/Page";
import { ApiError } from "@/lib/api/client";
import {
  assignVenueStaff,
  cancelTable,
  createVenueMenu,
  createVenueTable,
  deleteVenueMenu,
  getVenue,
  listVenueMenus,
  listVenueStaff,
  listVenueTables,
  patchTable,
  patchVenue,
  patchVenueMenu,
  removeVenueStaff,
  type VenueStaffRow,
} from "@/lib/api/venues";
import {
  EXPERIENCE_CATEGORIES,
  categoryLabel,
  toggleCategory,
  type ExperienceCategory,
} from "@/lib/categories";
import { confirmDestructive } from "@/lib/console-settings";
import { billTypeLabel, statusLabel } from "@/lib/format";
import { resolveHostedBy, type HostedBy } from "@/lib/hosted-by";
import { useAdminResource } from "@/lib/hooks/useAdminResource";
import { experienceDisplayName } from "@/lib/booking-experience";
import { mapExperienceRow } from "@/lib/mappers";
import {
  experienceEditFormValues,
  kolkataDatetimeLocalToIso,
  mapTableToNightExperience,
  nightCapacityLabel,
  parseDietaryType,
  selectOverviewDiningNights,
  type BillPaymentType,
  type DietaryType,
  type NightExperienceRow,
} from "@/lib/venue-experience-form";
import { resolveNightMenuDisplay } from "@/lib/night-menu-display";
import {
  loadVenueNights,
  saveVenueNights,
  upsertVenueNight,
  type StoredNight,
} from "@/lib/venue-experiences";
import {
  MOCK_EXPERIENCES,
  MOCK_PARTNER_EXPERIENCES,
  MOCK_VENUE_CONTACTS,
  MOCK_VENUES,
} from "@/lib/mock/data";
import {
  loadVenueContacts,
  saveVenueContacts,
  type VenueContact,
} from "@/lib/venue-contacts";
import {
  contactCountForVenue,
  loadVenueHostedBy,
  saveVenueHostedBy,
} from "@/lib/venue-meta";
import { useAuth } from "@/providers/auth-provider";

type Tab = "overview" | "experiences" | "contacts";

export default function VenueDetailPage() {
  const params = useParams<{ id: string }>();
  const venueId = params.id;
  const { mockMode, getToken } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");
  const [toggling, setToggling] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [localHostedBy, setLocalHostedBy] = useState<HostedBy | null>(null);

  const mockVenue =
    MOCK_VENUES.find((v) => v.id === venueId) ?? MOCK_VENUES[0]!;

  useEffect(() => {
    // Demo fallback only — live API hostedBy is authoritative below.
    setLocalHostedBy(loadVenueHostedBy(venueId));
  }, [venueId]);

  const { data, loading, error, reload } = useAdminResource(
    !mockMode && Boolean(venueId),
    async (token) => {
      const [venueRes, menusRes, tablesRes] = await Promise.all([
        getVenue(token, venueId),
        listVenueMenus(token, venueId),
        listVenueTables(token, venueId),
      ]);
      const nowMs = Date.now();
      const upcomingDiningNights = tablesRes.tables.filter((t) => {
        const status = String(t.status ?? "").toUpperCase();
        if (status === "CANCELLED" || status === "COMPLETED") return false;
        const starts = new Date(t.startsAt).getTime();
        return Number.isFinite(starts) && starts > nowMs;
      }).length;
      return {
        venue: venueRes.venue,
        menus: menusRes.menus.map(mapExperienceRow),
        tables: tablesRes.tables,
        upcomingDiningNights,
        experiencesCount: menusRes.menus.length,
      };
    },
    [venueId],
  );

  // Keep localStorage aligned with server so a stale NYTO flag cannot unlock publish.
  useEffect(() => {
    if (mockMode || !data?.venue?.hostedBy) return;
    const server = resolveHostedBy(data.venue.hostedBy);
    saveVenueHostedBy(venueId, server);
    setLocalHostedBy(server);
  }, [mockMode, data?.venue?.hostedBy, venueId]);

  const venue = mockMode
    ? {
        id: mockVenue.id,
        name: mockVenue.name,
        area: mockVenue.area,
        city: mockVenue.city,
        address: mockVenue.address,
        isActive: mockVenue.active,
        hostedBy: mockVenue.hostedBy as HostedBy,
      }
    : data?.venue;

  // Live API wins — never let a stale localStorage flip override Venue-organized → NYTO.
  const hostedBy: HostedBy = resolveHostedBy(
    mockMode
      ? (localHostedBy ?? mockVenue.hostedBy)
      : (venue?.hostedBy ?? localHostedBy),
  );

  async function toggleActive() {
    if (!venue || mockMode || toggling) return;
    const nextActive = !venue.isActive;
    const confirmed = nextActive
      ? confirmDestructive(
          "Enable this venue? It will appear as active on the network.",
        )
      : confirmDestructive(
          "Disable this venue? It will stop appearing as active. This does not cancel existing dining nights.",
        );
    if (!confirmed) return;
    setToggling(true);
    setToggleError(null);
    try {
      const token = await getToken();
      if (!token) throw new ApiError("Session expired.", 401);
      await patchVenue(token, venue.id, { isActive: nextActive });
      await reload();
    } catch (err) {
      setToggleError(
        err instanceof Error ? err.message : "Could not update venue status.",
      );
    } finally {
      setToggling(false);
    }
  }

  if (!mockMode && loading && !data) {
    return (
      <div>
        <Skeleton className="mb-6 h-16 w-2/3" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!venue) {
    return (
      <div>
        <PageHeader title="Venue not found" />
        {error ? <ErrorBanner message={error} onRetry={() => void reload()} /> : null}
        <Link href="/venues" className="font-semibold text-accent hover:underline">
          ← Back to venues
        </Link>
      </div>
    );
  }

  const active = Boolean(venue.isActive);
  const isNyto = hostedBy === "NYTO";

  const experiences: NightExperienceRow[] = mockMode
    ? (isNyto ? MOCK_EXPERIENCES : MOCK_PARTNER_EXPERIENCES).map((e, i) => {
        const dietaryType = parseDietaryType(e.diet);
        return {
          id: e.id,
          menuId: e.id,
          name: experienceDisplayName(e.name),
          description: null,
          dietaryType,
          diet: dietaryType ? statusLabel(dietaryType) : "Diet unavailable",
          cost: e.cost,
          costPerHead: e.costPerHead,
          categories: [...e.categories] as ExperienceCategory[],
          inclusions: [],
          when: e.when,
          // Demo nights are treated as upcoming for Overview preview.
          startsAtIso: new Date(
            Date.now() + (i + 1) * 24 * 60 * 60 * 1000,
          ).toISOString(),
          capacity: e.capacity,
          paymentType: null,
          seatsTaken: null,
          seatsLeft: null,
          status: "OPEN" as const,
          fromVenueDashboard: !isNyto,
        };
      })
    : (() => {
        const menus = data?.menus ?? [];
        const tables = data?.tables ?? [];
        if (tables.length > 0) {
          return tables.map((t) => {
            const menu = t.menuId
              ? menus.find((m) => m.id === t.menuId)
              : undefined;
            return mapTableToNightExperience(t, menu ?? t.menu ?? null, {
              fromVenueDashboard: !isNyto,
            });
          });
        }
        return menus.map((m) => {
          const dietaryType = parseDietaryType(m.diet);
          return {
            id: m.id,
            menuId: m.id,
            name: experienceDisplayName(m.name),
            description: m.description ?? null,
            dietaryType,
            diet: dietaryType ? statusLabel(dietaryType) : "Diet unavailable",
            cost: m.cost,
            costPerHead: m.costPerHead,
            categories: [] as ExperienceCategory[],
            inclusions: [] as string[],
            when: "No dining nights scheduled",
            startsAtIso: null as string | null,
            capacity: undefined as number | undefined,
            paymentType: null,
            seatsTaken: null,
            seatsLeft: null,
            status: "OPEN" as const,
            fromVenueDashboard: !isNyto,
          };
        });
      })();

  return (
    <div className="nyto-fade">
      <div className="nyto-bookings-hero relative mb-6 overflow-hidden rounded-[22px] border border-border bg-bg-elevated shadow-[var(--shadow-md)]">
        <div
          className={`pointer-events-none absolute inset-0 ${
            isNyto
              ? "bg-[radial-gradient(900px_420px_at_0%_-10%,rgba(77,139,255,0.16),transparent_55%)]"
              : "bg-[radial-gradient(900px_420px_at_0%_-10%,rgba(52,211,153,0.12),transparent_55%)]"
          }`}
          aria-hidden
        />
        <div className="relative z-[2] px-5 py-6 sm:px-7 sm:py-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-faint">
                Venue
              </p>
              <h1 className="mt-2 font-display text-[32px] font-medium leading-none tracking-[-0.04em] text-ink sm:text-[38px]">
                {venue.name}
              </h1>
              <p className="mt-2.5 text-[14px] text-text-muted">
                {venue.area || "—"} · {venue.city} · {venue.address}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <HostedByBadge value={hostedBy} />
              <Badge tone={active ? "success" : "neutral"}>
                {active ? "Active" : "Inactive"}
              </Badge>
              {!mockMode ? (
                <Button
                  variant="secondary"
                  disabled={toggling}
                  onClick={() => void toggleActive()}
                >
                  {active ? "Disable" : "Enable"}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {error ? <ErrorBanner message={error} onRetry={() => void reload()} /> : null}
      {toggleError ? (
        <ErrorBanner
          message={toggleError}
          onRetry={() => setToggleError(null)}
        />
      ) : null}

      {!isNyto ? (
        <div className="mb-5">
          <VenueOrganizedReadNote />
        </div>
      ) : null}

      <p className="mb-5 rounded-xl border border-border-subtle bg-bg/30 px-4 py-3 text-[12px] leading-relaxed text-text-faint">
        Venue-related guest complaints will appear in{" "}
        <Link
          href="/guest-experience"
          className="font-semibold text-accent hover:underline"
        >
          Guest Experience
        </Link>{" "}
        once report APIs are connected.
      </p>

      <div className="mb-6 flex flex-wrap gap-1 rounded-xl border border-border bg-bg-elevated/80 p-1">
        {(
          [
            ["overview", "Overview"],
            ["experiences", "Experiences"],
            ["contacts", "Contacts"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-lg px-3.5 py-2 text-[13px] font-semibold transition ${
              tab === id
                ? "bg-ink text-bg"
                : "text-text-muted hover:bg-bg-soft hover:text-text"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard
              label="Experiences"
              value={String(
                mockMode
                  ? experiences.length
                  : (data?.experiencesCount ?? experiences.length),
              )}
              accent="accent"
            />
            <StatCard
              label="Upcoming dining nights"
              value={String(
                mockMode
                  ? selectOverviewDiningNights(experiences).totalUpcoming
                  : (data?.upcomingDiningNights ??
                    selectOverviewDiningNights(experiences).totalUpcoming),
              )}
              accent="neutral"
            />
            <StatCard
              label="Contacts"
              value={String(
                mockMode
                  ? contactCountForVenue(venueId, MOCK_VENUE_CONTACTS.length)
                  : (data?.venue?._count?.staff ?? 0),
              )}
              accent="success"
            />
          </div>

          <OverviewDiningNights
            nights={experiences}
            mockMode={mockMode}
            loading={!mockMode && loading && !data}
            error={error}
            onRetry={() => void reload()}
            onViewAll={() => setTab("experiences")}
          />

          <EditVenueForm
            venueId={venueId}
            mockMode={mockMode}
            hostedBy={hostedBy}
            initial={{
              name: venue.name,
              address: venue.address,
              city: venue.city,
              area: venue.area || "",
            }}
            onSaved={() => void reload()}
          />
        </div>
      ) : null}

      {tab === "experiences" ? (
        <ExperiencesPanel
          venueId={venueId}
          mockMode={mockMode}
          hostedBy={hostedBy}
          initial={experiences}
          onChanged={() => void reload()}
        />
      ) : null}

      {tab === "contacts" ? (
        <ContactsPanel
          venueId={venueId}
          mockMode={mockMode}
          onChanged={() => void reload()}
        />
      ) : null}

      <p className="mt-8 text-[13px] text-text-faint">
        <Link
          href="/venues"
          className="font-semibold text-accent hover:underline"
        >
          ← Back to venues
        </Link>
      </p>
    </div>
  );
}

function InclusionCheckIcon() {
  return (
    <span
      className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border bg-bg-soft text-accent"
      aria-hidden
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path
          d="M2.5 6.2 4.8 8.5 9.5 3.5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function OverviewDiningNights({
  nights,
  mockMode,
  loading,
  error,
  onRetry,
  onViewAll,
}: {
  nights: NightExperienceRow[];
  mockMode: boolean;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onViewAll: () => void;
}) {
  const { nights: preview, totalUpcoming, truncated } =
    selectOverviewDiningNights(nights, { limit: 6 });

  return (
    <section className="nyto-panel overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border-subtle px-5 py-4">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-ink">
            Upcoming Dining Nights
          </h3>
          <p className="mt-1 text-[13px] text-text-muted">
            See what guests can book at this venue and what each seat includes.
          </p>
        </div>
        <button
          type="button"
          onClick={onViewAll}
          className="shrink-0 text-[13px] font-semibold text-accent hover:underline"
        >
          Open Experiences →
        </button>
      </div>

      {error && !loading && preview.length === 0 ? (
        <div className="px-5 py-4">
          <ErrorBanner
            message="Dining nights could not be loaded."
            onRetry={onRetry}
          />
        </div>
      ) : loading ? (
        <div className="space-y-0">
          <Skeleton className="h-28 rounded-none" />
          <Skeleton className="h-28 rounded-none opacity-70" />
        </div>
      ) : preview.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="text-[15px] font-semibold text-ink">
            No dining nights published yet
          </p>
          <p className="mx-auto mt-1.5 max-w-md text-[13px] text-text-muted">
            Publish a night on the Experiences tab to show guests what they can
            book here.
          </p>
          <button
            type="button"
            onClick={onViewAll}
            className="mt-4 text-[13px] font-semibold text-accent hover:underline"
          >
            Go to Experiences →
          </button>
        </div>
      ) : (
        <ul className="divide-y divide-border-subtle">
          {preview.map((n) => {
            const capacityLine = nightCapacityLabel(n);
            const menuDisplay = resolveNightMenuDisplay({
              mockMode,
              inclusions: n.inclusions,
              menu: n.menuPayload,
            });
            return (
              <li key={n.id} className="px-5 py-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[16px] font-semibold tracking-[-0.02em] text-ink">
                        {n.name}
                      </p>
                      {n.categories.map((c) => (
                        <Badge key={c} tone="neutral">
                          {categoryLabel(c)}
                        </Badge>
                      ))}
                      {n.status ? (
                        <Badge tone={statusTone(n.status)}>
                          {statusLabel(n.status)}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <div className="shrink-0 sm:min-w-[7.5rem] sm:text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-faint">
                      Per seat
                    </p>
                    <p className="mt-0.5 font-display text-[26px] font-medium tabular-nums leading-none tracking-[-0.03em] text-ink">
                      {n.costPerHead != null && Number.isFinite(n.costPerHead)
                        ? n.cost
                        : "Price unavailable"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 border-t border-border-subtle pt-4">
                  {menuDisplay.source === "demo" ||
                  menuDisplay.source === "api_dishes" ? (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[13px] font-semibold tracking-[-0.01em] text-ink">
                          What&apos;s on the menu
                        </p>
                        {menuDisplay.source === "demo" ? (
                          <span className="rounded-md border border-warning/35 bg-warning/[0.08] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-warning">
                            Demo menu
                          </span>
                        ) : null}
                      </div>
                      {menuDisplay.source === "demo" ? (
                        <p className="mt-1.5 text-[12px] leading-snug text-text-faint">
                          Illustrative dishes for demo only — not a confirmed
                          venue offering.
                        </p>
                      ) : null}
                      <div className="mt-3 space-y-4">
                        {menuDisplay.courses.map((group) => (
                          <div key={group.course}>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-faint">
                              {group.course}
                            </p>
                            <ul className="mt-2 space-y-2">
                              {group.items.map((item) => (
                                <li
                                  key={`${group.course}-${item}`}
                                  className="flex items-start gap-3"
                                >
                                  <InclusionCheckIcon />
                                  <span className="min-w-0 pt-0.5 text-[15px] font-medium leading-snug tracking-[-0.01em] text-ink">
                                    {item}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : menuDisplay.source === "generic_inclusions" ? (
                    <>
                      <p className="text-[13px] font-semibold tracking-[-0.01em] text-ink">
                        What&apos;s included in your seat
                      </p>
                      <ul className="mt-3 space-y-2.5">
                        {menuDisplay.genericInclusions.map((item) => (
                          <li key={item} className="flex items-start gap-3">
                            <InclusionCheckIcon />
                            <span className="min-w-0 pt-0.5 text-[15px] font-medium leading-snug tracking-[-0.01em] text-ink">
                              {item}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <>
                      <p className="text-[13px] font-semibold tracking-[-0.01em] text-ink">
                        What&apos;s on the menu
                      </p>
                      <p className="mt-2.5 text-[14px] leading-snug text-text-muted">
                        Detailed menu not provided
                      </p>
                    </>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-text-muted">
                  <span>{n.when}</span>
                  <span>
                    {n.dietaryType
                      ? n.diet
                      : "Dietary information unavailable"}
                  </span>
                  {capacityLine ? <span>{capacityLine}</span> : null}
                  {billTypeLabel(n.paymentType) ? (
                    <span>{billTypeLabel(n.paymentType)}</span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {truncated ? (
        <div className="border-t border-border-subtle px-5 py-3 text-[12px] text-text-faint">
          Showing {preview.length} of {totalUpcoming} upcoming nights.{" "}
          <button
            type="button"
            onClick={onViewAll}
            className="font-semibold text-accent hover:underline"
          >
            View all on Experiences
          </button>
        </div>
      ) : null}
    </section>
  );
}

function EditVenueForm({
  venueId,
  mockMode,
  hostedBy,
  initial,
  onSaved,
}: {
  venueId: string;
  mockMode: boolean;
  hostedBy: HostedBy;
  initial: { name: string; address: string; city: string; area: string };
  onSaved: () => void;
}) {
  const { getToken } = useAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initial.name);
  const [address, setAddress] = useState(initial.address);
  const [city, setCity] = useState(initial.city);
  const [area, setArea] = useState(initial.area);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (editing) return;
    setName(initial.name);
    setAddress(initial.address);
    setCity(initial.city);
    setArea(initial.area);
  }, [initial.name, initial.address, initial.city, initial.area, editing]);

  function startEdit() {
    setName(initial.name);
    setAddress(initial.address);
    setCity(initial.city);
    setArea(initial.area);
    setError(null);
    setOk(null);
    setEditing(true);
  }

  function cancelEdit() {
    setName(initial.name);
    setAddress(initial.address);
    setCity(initial.city);
    setArea(initial.area);
    setError(null);
    setOk(null);
    setEditing(false);
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!name.trim() || !address.trim() || !city.trim()) {
      setError("Name, address, and city are required.");
      setOk(null);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      if (mockMode) {
        setOk("Details saved.");
        setEditing(false);
        onSaved();
        return;
      }
      const token = await getToken();
      if (!token) throw new ApiError("Session expired.", 401);
      // hostedBy is never sent — organizing model is immutable here.
      await patchVenue(token, venueId, {
        name: name.trim(),
        address: address.trim(),
        city: city.trim(),
        area: area.trim() || undefined,
      });
      setOk("Details saved.");
      setEditing(false);
      onSaved();
    } catch (err) {
      setOk(null);
      setError(err instanceof Error ? err.message : "Could not save venue.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="nyto-panel space-y-3.5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold text-ink">Venue details</h3>
          <p className="mt-1 text-[13px] text-text-muted">
            Name and location. Organizing model cannot be changed here.
          </p>
        </div>
        {!editing ? (
          <Button variant="secondary" onClick={startEdit}>
            Edit details
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-bg-elevated px-3 py-2.5">
        <span className="text-[12px] text-text-faint">Organized by</span>
        <HostedByBadge value={hostedBy} />
      </div>

      {editing ? (
        <form onSubmit={onSave} className="space-y-3.5">
          <div>
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <Label>Address</Label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>City</Label>
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                required
              />
            </div>
            <div>
              <Label>Area</Label>
              <Input value={area} onChange={(e) => setArea(e.target.value)} />
            </div>
          </div>
          <FieldError message={error} />
          {ok ? (
            <p className="text-[13px] font-medium text-success">{ok}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save changes"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={cancelEdit}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <dt className="text-[11px] text-text-faint">Name</dt>
            <dd className="mt-0.5 text-[14px] font-medium text-ink">
              {initial.name}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-[11px] text-text-faint">Address</dt>
            <dd className="mt-0.5 text-[14px] text-text">{initial.address}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-text-faint">City</dt>
            <dd className="mt-0.5 text-[14px] text-text">{initial.city}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-text-faint">Area</dt>
            <dd className="mt-0.5 text-[14px] text-text">
              {initial.area.trim() ? initial.area : "—"}
            </dd>
          </div>
          {ok ? (
            <p className="sm:col-span-2 text-[13px] font-medium text-success">
              {ok}
            </p>
          ) : null}
        </dl>
      )}
    </div>
  );
}

function toStoredNight(r: NightExperienceRow): StoredNight {
  return {
    id: r.id,
    menuId: r.menuId ?? undefined,
    tableId: r.tableId,
    name: r.name,
    diet: r.diet,
    dietaryType: r.dietaryType,
    cost: r.cost,
    costPerHead: r.costPerHead ?? 0,
    categories: r.categories,
    when: r.when,
    startsAtIso: r.startsAtIso ?? undefined,
    capacity: r.capacity ?? 6,
    paymentType: r.paymentType,
    status: r.status ?? "OPEN",
  };
}

function ExperiencesPanel({
  venueId,
  mockMode,
  hostedBy,
  initial,
  onChanged,
}: {
  venueId: string;
  mockMode: boolean;
  hostedBy: HostedBy;
  initial: NightExperienceRow[];
  onChanged: () => void;
}) {
  const { getToken } = useAuth();
  const [rows, setRows] = useState(initial);
  const [syncNote, setSyncNote] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [cost, setCost] = useState("");
  /** Empty string = no persisted dietary value (edit). Default for publish only. */
  const [diet, setDiet] = useState<DietaryType | "">("NON_VEGETARIAN");
  const [categories, setCategories] = useState<ExperienceCategory[]>([
    "WEEKLY",
  ]);
  const [startsAt, setStartsAt] = useState("");
  const [capacity, setCapacity] = useState("");
  const [paymentType, setPaymentType] =
    useState<BillPaymentType>("ALL_INCLUSIVE");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Venue-organized: never publish / cancel from admin — venue portal only.
  const canEdit = hostedBy === "NYTO";

  useEffect(() => {
    const byTable = new Map(
      initial
        .filter((r) => r.tableId)
        .map((r) => [r.tableId as string, r] as const),
    );
    const byId = new Map(initial.map((r) => [r.id, r] as const));
    const stored = loadVenueNights(venueId);

    // Live API is authoritative — never invent nights from localStorage.
    if (initial.length > 0) {
      setRows(initial);
      saveVenueNights(venueId, initial.map(toStoredNight));
      return;
    }

    // Demo / mock-only fallback when API returned nothing.
    if (mockMode && stored.length > 0) {
      setRows(
        stored.map((n) => {
          const live =
            (n.tableId ? byTable.get(n.tableId) : undefined) ?? byId.get(n.id);
          const dietaryType =
            live?.dietaryType ??
            parseDietaryType(n.dietaryType) ??
            parseDietaryType(n.diet);
          return {
            id: n.id,
            menuId: live?.menuId ?? n.menuId ?? null,
            name: live?.name || experienceDisplayName(n.name),
            description: live?.description ?? null,
            dietaryType,
            diet: dietaryType
              ? statusLabel(dietaryType)
              : live?.diet || "Diet unavailable",
            cost: live?.cost || n.cost,
            costPerHead: live?.costPerHead ?? n.costPerHead,
            categories: live?.categories?.length
              ? live.categories
              : n.categories,
            inclusions: live?.inclusions ?? [],
            when: live?.when || n.when,
            startsAtIso: live?.startsAtIso ?? n.startsAtIso ?? null,
            capacity: live?.capacity ?? n.capacity,
            paymentType: live?.paymentType ?? n.paymentType ?? null,
            status: live?.status ?? n.status,
            tableId: n.tableId ?? live?.tableId,
            fromVenueDashboard: hostedBy === "PARTNER",
          } satisfies NightExperienceRow;
        }),
      );
      return;
    }

    setRows(initial);
  }, [initial, venueId, hostedBy, mockMode]);

  function persistRows(next: NightExperienceRow[]) {
    setRows(next);
    saveVenueNights(venueId, next.map(toStoredNight));
  }

  function resetForm() {
    setEditingId(null);
    setName("");
    setCost("");
    setDiet("NON_VEGETARIAN");
    setCategories(["WEEKLY"]);
    setStartsAt("");
    setCapacity("");
    setPaymentType("ALL_INCLUSIVE");
    setError(null);
  }

  function startEdit(row: NightExperienceRow) {
    if (!canEdit || row.status === "CANCELLED") return;
    const values = experienceEditFormValues(row);
    setEditingId(row.id);
    setName(values.name);
    setCost(values.cost);
    setDiet(values.dietaryType);
    setCategories(values.categories);
    setCapacity(values.capacity);
    setStartsAt(values.startsAt);
    setPaymentType(values.paymentType);
    setError(null);
  }

  function formatWhenLabel(isoOrLocal: string) {
    const iso = isoOrLocal.includes("T")
      ? isoOrLocal.includes("+") || isoOrLocal.endsWith("Z")
        ? isoOrLocal
        : kolkataDatetimeLocalToIso(isoOrLocal)
      : isoOrLocal;
    const when = new Date(iso);
    if (Number.isNaN(when.getTime())) return "—";
    return when
      .toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Asia/Kolkata",
      })
      .replace(",", " ·");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (hostedBy !== "NYTO") {
      setError(
        "Venue-organized venues publish dining nights in their own portal — not from admin.",
      );
      return;
    }
    if (!canEdit) return;
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (categories.length === 0) {
      setError("Pick at least one category.");
      return;
    }
    if (!editingId && !startsAt) {
      setError("Pick a start time for this night.");
      return;
    }
    if (!editingId && !parseDietaryType(diet)) {
      setError("Pick a dietary type for this night.");
      return;
    }
    const costPerHead = Number(cost);
    if (!Number.isFinite(costPerHead) || costPerHead < 0) {
      setError("Seat price must be a valid number.");
      return;
    }
    const cap = Number(capacity);
    if (!Number.isFinite(cap) || cap < 2 || cap > 12) {
      setError("Capacity must be between 2 and 12.");
      return;
    }
    setError(null);
    setSyncNote(null);
    setBusy(true);
    try {
      const startsAtIso = startsAt ? kolkataDatetimeLocalToIso(startsAt) : null;
      const whenLabel = startsAtIso ? formatWhenLabel(startsAtIso) : undefined;
      const costLabel = `₹${costPerHead.toLocaleString("en-IN")}`;
      const dietaryType = parseDietaryType(diet);
      const dietLabel = dietaryType
        ? statusLabel(dietaryType)
        : "Diet unavailable";

      if (mockMode) {
        if (editingId) {
          persistRows(
            rows.map((r) =>
              r.id === editingId
                ? {
                    ...r,
                    name: name.trim() || experienceDisplayName(null),
                    dietaryType: dietaryType ?? r.dietaryType,
                    diet: dietaryType ? dietLabel : r.diet,
                    cost: costLabel,
                    costPerHead,
                    categories: [...categories],
                    when: whenLabel ?? r.when,
                    startsAtIso: startsAtIso ?? r.startsAtIso,
                    capacity: cap,
                    paymentType,
                  }
                : r,
            ),
          );
        } else {
          const night: NightExperienceRow = {
            id: `e-${Date.now()}`,
            menuId: null,
            name: name.trim() || experienceDisplayName(null),
            description: null,
            dietaryType,
            diet: dietLabel,
            cost: costLabel,
            costPerHead,
            categories: [...categories],
            inclusions: [],
            when: whenLabel || "—",
            startsAtIso,
            capacity: cap,
            paymentType,
            status: "OPEN",
          };
          persistRows([night, ...rows]);
        }
        setSyncNote("Synced to guest app (demo).");
        resetForm();
        return;
      }

      const token = await getToken();
      if (!token) throw new ApiError("Session expired.", 401);
      const existing = editingId
        ? rows.find((r) => r.id === editingId)
        : undefined;
      const menuPatchId = existing?.menuId ?? null;

      if (editingId) {
        // Only patch a real menu id — never send invented dietary defaults.
        if (menuPatchId && (name.trim() || dietaryType != null || costPerHead >= 0)) {
          const body: {
            name?: string;
            dietaryType?: DietaryType;
            costPerHead?: number;
          } = { costPerHead };
          if (name.trim()) body.name = name.trim();
          if (dietaryType) body.dietaryType = dietaryType;
          await patchVenueMenu(token, menuPatchId, body);
        }
        if (existing?.tableId) {
          const hour = startsAt
            ? Number(startsAt.slice(11, 13))
            : Number.NaN;
          await patchTable(token, existing.tableId, {
            seatPrice: costPerHead,
            capacity: cap,
            paymentType,
            ...(startsAtIso ? { startsAt: startsAtIso } : {}),
            ...(Number.isFinite(hour)
              ? { priceTier: hour < 16 ? "DAYTIME" : "EVENING" }
              : {}),
            ...(categories[0] ? { tableType: categories[0] } : {}),
          });
        }
        upsertVenueNight(venueId, {
          id: editingId,
          name: name.trim() || existing?.name || experienceDisplayName(null),
          diet: dietaryType ? dietLabel : (existing?.diet ?? "Diet unavailable"),
          dietaryType: dietaryType ?? existing?.dietaryType ?? null,
          cost: costLabel,
          costPerHead,
          categories: [...categories],
          when: whenLabel ?? existing?.when ?? "—",
          startsAtIso: startsAtIso ?? existing?.startsAtIso ?? undefined,
          capacity: cap,
          paymentType,
          status: existing?.status ?? "OPEN",
          tableId: existing?.tableId,
          menuId: menuPatchId ?? undefined,
        });
        setSyncNote("Saved — live on the NYTO app.");
        resetForm();
        onChanged();
        return;
      }

      if (!dietaryType || !startsAtIso) {
        setError("Dietary type and start time are required to publish.");
        return;
      }

      const hour = Number(startsAt.slice(11, 13));
      const priceTier =
        Number.isFinite(hour) && hour < 16 ? "DAYTIME" : "EVENING";

      const menuRes = await createVenueMenu(token, venueId, {
        name: name.trim(),
        dietaryType,
        costPerHead,
      });
      const tableRes = await createVenueTable(token, venueId, {
        startsAt: startsAtIso,
        seatPrice: costPerHead,
        capacity: cap,
        priceTier,
        tableType: categories[0],
        paymentType,
        menuId: menuRes.menu.id,
        status: "OPEN",
        hostedBy: "NYTO",
        inclusions: categories.map(categoryLabel),
      });

      upsertVenueNight(venueId, {
        id: tableRes.table.id,
        menuId: menuRes.menu.id,
        tableId: tableRes.table.id,
        name: name.trim(),
        diet: dietLabel,
        dietaryType,
        cost: costLabel,
        costPerHead,
        categories: [...categories],
        when: whenLabel || "—",
        startsAtIso,
        capacity: cap,
        paymentType,
        status: "OPEN",
      });

      setSyncNote("Published — synced to the NYTO guest app.");
      resetForm();
      onChanged();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : editingId
            ? "Could not update experience."
            : "Could not create experience.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function onCancelNight(row: NightExperienceRow) {
    if (hostedBy !== "NYTO" || !canEdit) return;
    if (row.status === "CANCELLED") return;
    if (
      !confirmDestructive(
        "Cancel this NYTO night? Open bookings will be cancelled where the API supports it.",
      )
    ) {
      return;
    }
    setError(null);
    try {
      if (mockMode) {
        persistRows(
          rows.map((r) =>
            r.id === row.id ? { ...r, status: "CANCELLED" } : r,
          ),
        );
        setSyncNote("Night cancelled — guest app updated (demo).");
        return;
      }
      const token = await getToken();
      if (!token) throw new ApiError("Session expired.", 401);
      if (row.tableId) {
        await cancelTable(token, row.tableId, "Cancelled by NYTO admin");
      } else {
        await deleteVenueMenu(token, row.id);
      }
      persistRows(
        rows.map((r) =>
          r.id === row.id ? { ...r, status: "CANCELLED" } : r,
        ),
      );
      setSyncNote("Night cancelled — synced to the guest app.");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel night.");
    }
  }

  return (
    <div
      className={`grid gap-5 ${canEdit ? "lg:grid-cols-[minmax(0,1fr)_320px]" : ""}`}
    >
      <div className="space-y-3">
        {!canEdit ? <VenueOrganizedReadNote /> : null}
        {syncNote ? (
          <p className="rounded-xl border border-success/25 bg-success/[0.07] px-3.5 py-2.5 text-[13px] font-medium text-success">
            {syncNote}
          </p>
        ) : null}

        <div className="nyto-panel overflow-hidden">
          {rows.length === 0 ? (
            <div className="px-5 py-12 text-center text-[14px] text-text-muted">
              {canEdit
                ? "No dining nights scheduled. Publish one on the right."
                : "No dining nights synced yet."}
            </div>
          ) : (
            <div className="nyto-table-wrap">
              <table className="nyto-table">
                <thead>
                  <tr>
                    <th>Experience</th>
                    <th>Category</th>
                    <th>Diet</th>
                    <th>Dining night</th>
                    <th>Capacity</th>
                    <th>Bill type</th>
                    <th>Seat price</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <div className="font-medium text-ink">{m.name}</div>
                        {m.description ? (
                          <p className="mt-0.5 max-w-[240px] text-[12px] leading-snug text-text-faint">
                            {m.description}
                          </p>
                        ) : null}
                        {m.inclusions && m.inclusions.length > 0 ? (
                          <p className="mt-1 max-w-[240px] text-[11px] leading-snug text-text-muted">
                            Includes · {m.inclusions.join(" · ")}
                          </p>
                        ) : (
                          <p className="mt-1 text-[11px] text-text-faint">
                            Inclusions unavailable
                          </p>
                        )}
                        {m.status === "CANCELLED" ? (
                          <Badge tone="danger">Cancelled</Badge>
                        ) : m.status ? (
                          <span className="text-[11px] text-text-faint">
                            {statusLabel(m.status)}
                          </span>
                        ) : null}
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {m.categories.length === 0 ? (
                            <span className="text-text-faint">
                              Category unavailable
                            </span>
                          ) : (
                            m.categories.map((c) => (
                              <Badge key={c} tone="neutral">
                                {categoryLabel(c)}
                              </Badge>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="text-text-muted">
                        {statusLabel(m.diet)}
                      </td>
                      <td className="whitespace-nowrap text-text-muted">
                        {m.when || "No dining nights scheduled"}
                      </td>
                      <td className="tabular-nums text-text-muted">
                        {m.capacity != null
                          ? `${m.capacity} seats`
                          : "Capacity unavailable"}
                      </td>
                      <td className="text-text-muted">
                        {billTypeLabel(m.paymentType) ?? "—"}
                      </td>
                      <td className="tabular-nums">
                        {m.cost}
                        {m.cost !== "Price unavailable" && m.cost !== "—" ? (
                          <span className="block text-[11px] text-text-faint">
                            per seat
                          </span>
                        ) : null}
                      </td>
                      <td className="text-right">
                        {canEdit ? (
                          m.status !== "CANCELLED" ? (
                            <div className="flex justify-end gap-3">
                              <button
                                type="button"
                                onClick={() => startEdit(m)}
                                className="text-[13px] font-semibold text-accent hover:underline"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => void onCancelNight(m)}
                                className="text-[13px] font-semibold text-danger hover:underline"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <span className="text-[12px] text-text-faint">
                              Cancelled
                            </span>
                          )
                        ) : (
                          <span className="text-[12px] text-text-faint">
                            View only
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {canEdit ? (
        <form onSubmit={onSubmit} className="nyto-panel h-fit space-y-3.5 p-5">
          <h3 className="text-[15px] font-semibold text-ink">
            {editingId ? "Edit experience" : "Publish dining night"}
          </h3>
          <div>
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="3-course dinner"
            />
          </div>
          <div>
            <Label>Cost per head (₹)</Label>
            <Input
              type="number"
              min={0}
              value={cost}
              onChange={(e) => setCost(e.target.value)}
            />
          </div>
          <div>
            <Label>Dietary</Label>
            <Select
              value={diet}
              onChange={(e) =>
                setDiet(e.target.value as DietaryType | "")
              }
            >
              {diet === "" ? (
                <option value="">Diet unavailable</option>
              ) : null}
              <option value="NON_VEGETARIAN">Non-vegetarian</option>
              <option value="VEGETARIAN">Vegetarian</option>
              <option value="VEGAN">Vegan</option>
            </Select>
          </div>
          <div>
            <Label>Categories</Label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {EXPERIENCE_CATEGORIES.map((c) => {
                const on = categories.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    title={c.hint}
                    onClick={() =>
                      setCategories((prev) => toggleCategory(prev, c.id))
                    }
                    className={`rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold transition ${
                      on
                        ? "border-accent bg-[var(--accent-wash)] text-accent-soft"
                        : "border-border bg-bg-elevated text-text-muted hover:text-text"
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <Label>Starts at</Label>
            <Input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </div>
          <div>
            <Label>Capacity</Label>
            <Input
              type="number"
              min={2}
              max={12}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
            />
          </div>
          <div>
            <Label>Bill type</Label>
            <Select
              value={paymentType}
              onChange={(e) =>
                setPaymentType(e.target.value as BillPaymentType)
              }
            >
              <option value="ALL_INCLUSIVE">All-inclusive</option>
              <option value="PAY_OWN_BILL">Pay as you go</option>
            </Select>
          </div>
          <FieldError message={error} />
          <Button type="submit" className="w-full" disabled={busy}>
            {busy
              ? "Publishing…"
              : editingId
                ? "Save + sync"
                : "Publish + sync to app"}
          </Button>
          {editingId ? (
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={resetForm}
            >
              Cancel edit
            </Button>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}

type StaffRole = "OWNER" | "MANAGER" | "STAFF";

type ContactRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  staffRole: StaffRole | string;
};

function staffToContact(s: VenueStaffRow): ContactRow {
  const name =
    s.user.fullName?.trim() ||
    s.user.firstName?.trim() ||
    s.user.email?.split("@")[0] ||
    "Staff";
  return {
    id: s.id,
    name,
    email: s.user.email?.trim() || "",
    phone: s.user.phone?.trim() || "",
    staffRole: s.staffRole,
  };
}

function mockContactToRow(c: VenueContact): ContactRow {
  return {
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    staffRole: "STAFF",
  };
}

function roleLabel(role: string): string {
  const u = role.toUpperCase();
  if (u === "OWNER") return "Owner";
  if (u === "MANAGER") return "Manager";
  return "Staff";
}

function ContactsPanel({
  venueId,
  mockMode,
  onChanged,
}: {
  venueId: string;
  mockMode: boolean;
  onChanged?: () => void;
}) {
  const { getToken } = useAuth();
  const [rows, setRows] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(!mockMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [staffRole, setStaffRole] = useState<StaffRole>("STAFF");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function reloadLive() {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new ApiError("Session expired.", 401);
      const res = await listVenueStaff(token, venueId);
      setRows(res.staff.map(staffToContact));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load contacts.",
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (mockMode) {
      const stored = loadVenueContacts(venueId);
      if (stored && stored.length > 0) {
        setRows(stored.map(mockContactToRow));
      } else {
        const seeded = MOCK_VENUE_CONTACTS.map((c) => ({ ...c }));
        saveVenueContacts(venueId, seeded);
        setRows(seeded.map(mockContactToRow));
      }
      setLoading(false);
      return;
    }
    void reloadLive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueId, mockMode]);

  function resetForm() {
    setName("");
    setEmail("");
    setStaffRole("STAFF");
  }

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedName || !trimmedEmail) {
      setError("Name and email are required.");
      setOk(null);
      return;
    }
    if (!trimmedEmail.includes("@")) {
      setError("Enter a valid email.");
      setOk(null);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      if (mockMode) {
        const nextStored: VenueContact[] = [
          {
            id: `c-${Date.now()}`,
            name: trimmedName,
            phone: "",
            email: trimmedEmail,
            shiftStart: "18:00",
            shiftEnd: "23:00",
          },
          ...(loadVenueContacts(venueId) ?? []),
        ];
        saveVenueContacts(venueId, nextStored);
        setRows(nextStored.map(mockContactToRow));
        setOk("Contact saved (demo — local only).");
        resetForm();
        return;
      }
      const token = await getToken();
      if (!token) throw new ApiError("Session expired.", 401);
      await assignVenueStaff(token, venueId, {
        email: trimmedEmail,
        name: trimmedName,
        staffRole,
      });
      setOk("Contact added — they sign in with email OTP on the venue portal.");
      resetForm();
      await reloadLive();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add contact.");
      setOk(null);
    } finally {
      setBusy(false);
    }
  }

  async function onRemove(id: string) {
    if (!window.confirm("Remove this contact from the venue?")) return;
    setBusy(true);
    setError(null);
    try {
      if (mockMode) {
        const next = (loadVenueContacts(venueId) ?? []).filter(
          (c) => c.id !== id,
        );
        saveVenueContacts(venueId, next);
        setRows(next.map(mockContactToRow));
        setOk("Contact removed.");
        return;
      }
      const token = await getToken();
      if (!token) throw new ApiError("Session expired.", 401);
      await removeVenueStaff(token, venueId, id);
      setOk("Contact removed.");
      await reloadLive();
      onChanged?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not remove contact.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="nyto-panel overflow-hidden">
        <div className="border-b border-border-subtle px-5 py-3.5">
          <h3 className="text-[15px] font-semibold text-ink">Contacts</h3>
          <p className="mt-1 text-[13px] text-text-muted">
            Venue portal access — {rows.length} contact
            {rows.length === 1 ? "" : "s"}
            {mockMode ? " · demo" : ""}
          </p>
        </div>
        {loading ? (
          <div className="px-5 py-10 text-center text-[14px] text-text-muted">
            Loading…
          </div>
        ) : error && rows.length === 0 ? (
          <div className="space-y-3 px-5 py-8">
            <ErrorBanner message={error} />
            {!mockMode ? (
              <Button type="button" onClick={() => void reloadLive()}>
                Retry
              </Button>
            ) : null}
          </div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-10 text-center text-[14px] text-text-muted">
            No contacts yet — add someone with a work email.
          </div>
        ) : (
          <div className="nyto-table-wrap">
            <table className="nyto-table">
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Role</th>
                  <th>Email</th>
                  <th>Mobile</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td className="font-medium text-ink">{c.name}</td>
                    <td className="text-text-muted">{roleLabel(c.staffRole)}</td>
                    <td className="text-text-muted">
                      {c.email ? (
                        <a
                          href={`mailto:${c.email}`}
                          className="hover:underline"
                        >
                          {c.email}
                        </a>
                      ) : (
                        <span className="text-text-faint">—</span>
                      )}
                    </td>
                    <td>
                      {c.phone ? (
                        <a
                          href={`tel:${c.phone.replace(/\s/g, "")}`}
                          className="font-medium tabular-nums text-accent hover:underline"
                        >
                          {c.phone}
                        </a>
                      ) : (
                        <span className="text-text-faint">—</span>
                      )}
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void onRemove(c.id)}
                        className="text-[13px] font-semibold text-danger hover:underline disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <form onSubmit={(e) => void onAdd(e)} className="nyto-panel h-fit space-y-3.5 p-5">
        <h3 className="text-[15px] font-semibold text-ink">Add contact</h3>
        <p className="text-[12px] leading-relaxed text-text-muted">
          Grants venue-portal login. They sign in with email OTP — same as Team
          invites for Admin.
        </p>
        <div>
          <Label>Person name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Floor manager"
            required
          />
        </div>
        <div>
          <Label>Work email</Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="venue@example.com"
            required
          />
        </div>
        <div>
          <Label>Role</Label>
          <Select
            value={staffRole}
            onChange={(e) => setStaffRole(e.target.value as StaffRole)}
          >
            <option value="STAFF">Staff</option>
            <option value="MANAGER">Manager</option>
            <option value="OWNER">Owner</option>
          </Select>
        </div>
        <FieldError message={error && rows.length > 0 ? error : null} />
        {ok ? <p className="text-[13px] font-medium text-success">{ok}</p> : null}
        <Button type="submit" className="w-full" disabled={busy || loading}>
          {busy ? "Saving…" : "Add contact"}
        </Button>
      </form>
    </div>
  );
}
