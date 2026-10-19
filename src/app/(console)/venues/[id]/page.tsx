"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
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
  cancelTable,
  createVenueMenu,
  createVenueTable,
  deleteVenueMenu,
  getVenue,
  listVenueMenus,
  listVenueTables,
  patchVenue,
  patchVenueMenu,
} from "@/lib/api/venues";
import {
  EXPERIENCE_CATEGORIES,
  categoryLabel,
  toggleCategory,
  type ExperienceCategory,
} from "@/lib/categories";
import { confirmDestructive } from "@/lib/console-settings";
import { statusLabel } from "@/lib/format";
import { resolveHostedBy, type HostedBy } from "@/lib/hosted-by";
import { useAdminResource } from "@/lib/hooks/useAdminResource";
import {
  mapExperienceRow,
  priceTierFromLocalDatetime,
  toIsoFromLocalDatetime,
} from "@/lib/mappers";
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
  formatShiftRange,
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

  const experiences: ExperienceRow[] = mockMode
    ? (isNyto ? MOCK_EXPERIENCES : MOCK_PARTNER_EXPERIENCES).map((e) => ({
        id: e.id,
        name: e.name,
        diet: e.diet,
        cost: e.cost,
        costPerHead: e.costPerHead,
        categories: [...e.categories] as ExperienceCategory[],
        when: e.when,
        capacity: e.capacity,
        status: "OPEN" as const,
        fromVenueDashboard: !isNyto,
      }))
    : (() => {
        const menus = data?.menus ?? [];
        const tables = data?.tables ?? [];
        if (tables.length > 0) {
          return tables.map((t) => {
            const menu = menus.find((m) => m.id === t.menuId);
            const starts = new Date(t.startsAt);
            const whenLabel = Number.isNaN(starts.getTime())
              ? "Start time unavailable"
              : starts
                  .toLocaleString("en-GB", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                    timeZone: "Asia/Kolkata",
                  })
                  .replace(",", " ·");
            const status = String(t.status ?? "").toUpperCase();
            return {
              id: t.menuId || t.id,
              name: menu?.name || t.menu?.name || "Experience",
              diet:
                menu?.diet ||
                (t.menu?.dietaryType
                  ? statusLabel(t.menu.dietaryType)
                  : "Diet unavailable"),
              cost: Number.isFinite(t.seatPrice)
                ? `₹${t.seatPrice.toLocaleString("en-IN")}`
                : (menu?.cost ?? "Price unavailable"),
              costPerHead: Number.isFinite(t.seatPrice)
                ? t.seatPrice
                : menu?.costPerHead,
              categories: [] as ExperienceCategory[],
              when: whenLabel,
              capacity: Number.isFinite(t.capacity) ? t.capacity : undefined,
              status:
                status === "CANCELLED"
                  ? ("CANCELLED" as const)
                  : ("OPEN" as const),
              tableId: t.id,
              fromVenueDashboard: !isNyto,
            };
          });
        }
        return menus.map((m) => ({
          ...m,
          categories: [] as ExperienceCategory[],
          when: "No dining nights scheduled",
          capacity: undefined as number | undefined,
          status: "OPEN" as const,
          fromVenueDashboard: !isNyto,
        }));
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
                  ? experiences.filter(
                      (e) => e.when !== "—" && e.status !== "CANCELLED",
                    ).length
                  : (data?.upcomingDiningNights ?? 0),
              )}
              accent="neutral"
            />
            <StatCard
              label="Contacts"
              value={String(contactCountForVenue(venueId, 0))}
              accent="success"
            />
          </div>

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
        <ContactsPanel venueId={venueId} mockMode={mockMode} />
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

type ExperienceRow = {
  id: string;
  name: string;
  diet: string;
  cost: string;
  costPerHead?: number;
  categories: ExperienceCategory[];
  when: string;
  capacity?: number;
  status?: "OPEN" | "FULL" | "CANCELLED";
  tableId?: string;
  fromVenueDashboard?: boolean;
};

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
  initial: ExperienceRow[];
  onChanged: () => void;
}) {
  const { getToken } = useAuth();
  const [rows, setRows] = useState(initial);
  const [syncNote, setSyncNote] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [cost, setCost] = useState("");
  const [diet, setDiet] = useState("NON_VEGETARIAN");
  const [categories, setCategories] = useState<ExperienceCategory[]>([
    "WEEKLY",
  ]);
  const [startsAt, setStartsAt] = useState("");
  const [capacity, setCapacity] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Venue-organized: never publish / cancel from admin — venue portal only.
  const canEdit = hostedBy === "NYTO";

  useEffect(() => {
    const stored = loadVenueNights(venueId);
    if (stored.length > 0) {
      setRows(
        stored.map((n) => ({
          id: n.id,
          name: n.name,
          diet: n.diet,
          cost: n.cost,
          costPerHead: n.costPerHead,
          categories: n.categories,
          when: n.when,
          capacity: n.capacity,
          status: n.status,
          tableId: n.tableId,
          fromVenueDashboard: hostedBy === "PARTNER",
        })),
      );
      return;
    }
    setRows(initial);
    if (initial.length > 0) {
      saveVenueNights(
        venueId,
        initial.map(
          (r): StoredNight => ({
            id: r.id,
            name: r.name,
            diet: r.diet,
            cost: r.cost,
            costPerHead: r.costPerHead ?? 0,
            categories: r.categories,
            when: r.when,
            capacity: r.capacity ?? 6,
            status: r.status ?? "OPEN",
            tableId: r.tableId,
          }),
        ),
      );
    }
  }, [initial, venueId, hostedBy]);

  function persistRows(next: ExperienceRow[]) {
    setRows(next);
    saveVenueNights(
      venueId,
      next.map(
        (r): StoredNight => ({
          id: r.id,
          name: r.name,
          diet: r.diet,
          cost: r.cost,
          costPerHead: r.costPerHead ?? 0,
          categories: r.categories,
          when: r.when,
          capacity: r.capacity ?? 6,
          status: r.status ?? "OPEN",
          tableId: r.tableId,
        }),
      ),
    );
  }

  function resetForm() {
    setEditingId(null);
    setName("");
    setCost("");
    setDiet("NON_VEGETARIAN");
    setCategories(["WEEKLY"]);
    setStartsAt("");
    setCapacity("");
    setError(null);
  }

  function startEdit(row: ExperienceRow) {
    if (!canEdit || row.status === "CANCELLED") return;
    setEditingId(row.id);
    setName(row.name);
    setCost(
      row.costPerHead != null && Number.isFinite(row.costPerHead)
        ? String(row.costPerHead)
        : "",
    );
    setDiet(row.diet);
    setCategories(
      row.categories.length > 0 ? [...row.categories] : ["WEEKLY"],
    );
    setCapacity(row.capacity != null ? String(row.capacity) : "");
    setStartsAt("");
    setError(null);
  }

  function formatWhenLabel(value: string) {
    const when = new Date(value);
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
      const whenLabel = startsAt ? formatWhenLabel(startsAt) : undefined;
      const costLabel = `₹${costPerHead.toLocaleString("en-IN")}`;

      if (mockMode) {
        if (editingId) {
          persistRows(
            rows.map((r) =>
              r.id === editingId
                ? {
                    ...r,
                    name: name.trim(),
                    diet,
                    cost: costLabel,
                    costPerHead,
                    categories: [...categories],
                    when: whenLabel ?? r.when,
                    capacity: cap,
                  }
                : r,
            ),
          );
        } else {
          const night: ExperienceRow = {
            id: `e-${Date.now()}`,
            name: name.trim(),
            diet,
            cost: costLabel,
            costPerHead,
            categories: [...categories],
            when: whenLabel || "—",
            capacity: cap,
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
      const body = {
        name: name.trim(),
        dietaryType: diet as "VEGETARIAN" | "NON_VEGETARIAN" | "VEGAN",
        costPerHead,
      };

      if (editingId) {
        await patchVenueMenu(token, editingId, body);
        const existing = rows.find((r) => r.id === editingId);
        upsertVenueNight(venueId, {
          id: editingId,
          name: name.trim(),
          diet,
          cost: costLabel,
          costPerHead,
          categories: [...categories],
          when: whenLabel ?? existing?.when ?? "—",
          startsAtIso: startsAt
            ? toIsoFromLocalDatetime(startsAt)
            : undefined,
          capacity: cap,
          status: existing?.status ?? "OPEN",
          tableId: existing?.tableId,
          menuId: editingId,
        });
        setSyncNote("Saved — live on the NYTO app.");
        resetForm();
        onChanged();
        return;
      }

      const menuRes = await createVenueMenu(token, venueId, body);
      const tableRes = await createVenueTable(token, venueId, {
        startsAt: toIsoFromLocalDatetime(startsAt),
        seatPrice: costPerHead,
        capacity: cap,
        priceTier: priceTierFromLocalDatetime(startsAt),
        tableType: categories[0],
        menuId: menuRes.menu.id,
        status: "OPEN",
        hostedBy: "NYTO",
        inclusions: categories.map(categoryLabel),
      });

      upsertVenueNight(venueId, {
        id: menuRes.menu.id,
        menuId: menuRes.menu.id,
        tableId: tableRes.table.id,
        name: name.trim(),
        diet,
        cost: costLabel,
        costPerHead,
        categories: [...categories],
        when: whenLabel || "—",
        startsAtIso: toIsoFromLocalDatetime(startsAt),
        capacity: cap,
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

  async function onCancelNight(row: ExperienceRow) {
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
                    <th>Seat price</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <div className="font-medium text-ink">{m.name}</div>
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
            <Select value={diet} onChange={(e) => setDiet(e.target.value)}>
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

function ContactsPanel({
  venueId,
  mockMode,
}: {
  venueId: string;
  mockMode: boolean;
}) {
  const [rows, setRows] = useState<VenueContact[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [shiftStart, setShiftStart] = useState("");
  const [shiftEnd, setShiftEnd] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const stored = loadVenueContacts(venueId);
    if (stored && stored.length > 0) {
      setRows(stored);
      return;
    }
    if (mockMode) {
      const seeded = MOCK_VENUE_CONTACTS.map((c) => ({ ...c }));
      setRows(seeded);
      saveVenueContacts(venueId, seeded);
      return;
    }
    setRows([]);
  }, [venueId, mockMode]);

  function persist(next: VenueContact[]) {
    setRows(next);
    saveVenueContacts(venueId, next);
  }

  function resetForm() {
    setName("");
    setPhone("");
    setEmail("");
    setShiftStart("");
    setShiftEnd("");
  }

  function onAdd(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    const digits = trimmedPhone.replace(/\D/g, "");
    if (!trimmedName || !trimmedPhone || !shiftStart || !shiftEnd) {
      setError("Name, mobile, and shift times are required.");
      setOk(null);
      return;
    }
    if (digits.length < 10) {
      setError("Enter a valid mobile number.");
      setOk(null);
      return;
    }
    if (shiftStart >= shiftEnd) {
      setError("Shift end must be after shift start.");
      setOk(null);
      return;
    }
    setError(null);
    setBusy(true);
    const next: VenueContact[] = [
      {
        id: `c-${Date.now()}`,
        name: trimmedName,
        phone: trimmedPhone,
        email: email.trim(),
        shiftStart,
        shiftEnd,
      },
      ...rows,
    ];
    persist(next);
    setOk("Contact saved.");
    resetForm();
    setBusy(false);
  }

  function onRemove(id: string) {
    if (!window.confirm("Remove this contact?")) return;
    persist(rows.filter((r) => r.id !== id));
    setOk("Contact removed.");
    setError(null);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="nyto-panel overflow-hidden">
        <div className="border-b border-border-subtle px-5 py-3.5">
          <h3 className="text-[15px] font-semibold text-ink">Contacts</h3>
          <p className="mt-1 text-[13px] text-text-muted">
            {rows.length} contact{rows.length === 1 ? "" : "s"}
          </p>
        </div>
        {rows.length === 0 ? (
          <div className="px-5 py-10 text-center text-[14px] text-text-muted">
            No contacts added yet.
          </div>
        ) : (
          <div className="nyto-table-wrap">
            <table className="nyto-table">
              <thead>
                <tr>
                  <th>Person name</th>
                  <th>Shift</th>
                  <th>Mobile</th>
                  <th>Email</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td className="font-medium text-ink">{c.name}</td>
                    <td className="text-text-muted">
                      {formatShiftRange(c.shiftStart, c.shiftEnd, false)}
                    </td>
                    <td>
                      <a
                        href={`tel:${c.phone.replace(/\s/g, "")}`}
                        className="font-medium tabular-nums text-accent hover:underline"
                      >
                        {c.phone}
                      </a>
                    </td>
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
                    <td className="text-right">
                      <button
                        type="button"
                        onClick={() => onRemove(c.id)}
                        className="text-[13px] font-semibold text-danger hover:underline"
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

      <form onSubmit={onAdd} className="nyto-panel h-fit space-y-3.5 p-5">
        <h3 className="text-[15px] font-semibold text-ink">Add contact</h3>
        <div>
          <Label>Person name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Floor manager"
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Shift starts</Label>
            <Input
              type="time"
              value={shiftStart}
              onChange={(e) => setShiftStart(e.target.value)}
              required
            />
          </div>
          <div>
            <Label>Shift ends</Label>
            <Input
              type="time"
              value={shiftEnd}
              onChange={(e) => setShiftEnd(e.target.value)}
              required
            />
          </div>
        </div>
        <div>
          <Label>Mobile number</Label>
          <Input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 98765 43210"
            required
          />
        </div>
        <div>
          <Label>
            Email{" "}
            <span className="font-normal text-text-faint">(optional)</span>
          </Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="venue@example.com"
          />
        </div>
        <FieldError message={error} />
        {ok ? <p className="text-[13px] font-medium text-success">{ok}</p> : null}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Saving…" : "Add contact"}
        </Button>
      </form>
    </div>
  );
}
