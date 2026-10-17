"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FieldError, Input, Label, Select } from "@/components/ui/Field";
import {
  HostedByBadge,
  NytoCuratedCreateNote,
} from "@/components/ui/HostedBy";
import {
  ErrorBanner,
  PageHeader,
  Skeleton,
  StatCard,
} from "@/components/ui/Page";
import { ApiError } from "@/lib/api/client";
import {
  createVenueMenu,
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
import { loadConsoleSettings } from "@/lib/console-settings";
import { statusLabel } from "@/lib/format";
import { resolveHostedBy, type HostedBy } from "@/lib/hosted-by";
import { useAdminResource } from "@/lib/hooks/useAdminResource";
import { mapExperienceRow } from "@/lib/mappers";
import { MOCK_EXPERIENCES, MOCK_VENUE_CONTACTS, MOCK_VENUES } from "@/lib/mock/data";
import {
  formatShiftRange,
  loadVenueContacts,
  saveVenueContacts,
  type VenueContact,
} from "@/lib/venue-contacts";
import { useAuth } from "@/providers/auth-provider";

type Tab = "overview" | "experiences" | "contacts";

export default function VenueDetailPage() {
  const params = useParams<{ id: string }>();
  const venueId = params.id;
  const { mockMode, getToken } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");
  const [toggling, setToggling] = useState(false);
  const [localHostedBy, setLocalHostedBy] = useState<HostedBy | null>(null);

  const mockVenue =
    MOCK_VENUES.find((v) => v.id === venueId) ?? MOCK_VENUES[0]!;

  const { data, loading, error, reload } = useAdminResource(
    !mockMode && Boolean(venueId),
    async (token) => {
      const [venueRes, menusRes, tablesRes] = await Promise.all([
        getVenue(token, venueId),
        listVenueMenus(token, venueId),
        listVenueTables(token, venueId),
      ]);
      return {
        venue: venueRes.venue,
        menus: menusRes.menus.map(mapExperienceRow),
        openNights: tablesRes.tables.filter((t) => t.status === "OPEN").length,
        nightCount: tablesRes.tables.filter((t) => t.status !== "CANCELLED")
          .length,
      };
    },
    [venueId],
  );

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

  const hostedBy: HostedBy = resolveHostedBy(
    localHostedBy ?? venue?.hostedBy ?? (mockMode ? mockVenue.hostedBy : "NYTO"),
  );

  async function toggleActive() {
    if (!venue || mockMode) return;
    setToggling(true);
    try {
      const token = await getToken();
      if (!token) throw new ApiError("Session expired.", 401);
      await patchVenue(token, venue.id, { isActive: !venue.isActive });
      await reload();
    } catch {
      /* reload will surface state */
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

  const experiences = mockMode
    ? MOCK_EXPERIENCES.map((e) => ({
        id: e.id,
        name: e.name,
        diet: e.diet,
        cost: e.cost,
        costPerHead: e.costPerHead,
        categories: [...e.categories] as ExperienceCategory[],
        when: e.when,
        capacity: e.capacity,
      }))
    : (data?.menus ?? []).map((m) => ({
        ...m,
        categories: [] as ExperienceCategory[],
        when: "—",
        capacity: undefined as number | undefined,
      }));

  const active = Boolean(venue.isActive);
  const isNyto = hostedBy === "NYTO";

  return (
    <div>
      <PageHeader
        title={venue.name}
        description={`${venue.area || "—"} · ${venue.city} · ${venue.address}`}
        actions={
          <>
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
          </>
        }
      />

      {error ? <ErrorBanner message={error} onRetry={() => void reload()} /> : null}

      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-border">
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
            className={`shrink-0 border-b-2 px-3 py-2.5 text-[14px] font-semibold transition ${
              tab === id
                ? "border-accent text-ink"
                : "border-transparent text-text-muted hover:text-text"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="Experiences" value={String(experiences.length)} />
            <StatCard
              label="Organised by"
              value={hostedBy === "NYTO" ? "NYTO" : "Venue"}
              hint={
                isNyto
                  ? "Admin publishes nights here"
                  : "Venue publishes · NYTO platform share"
              }
            />
            <StatCard
              label="Open nights"
              value={String(
                mockMode
                  ? experiences.filter((e) => e.when !== "—").length
                  : (data?.openNights ?? 0),
              )}
            />
          </div>
          <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
            <EditVenueForm
              venueId={venueId}
              mockMode={mockMode}
              hostedBy={hostedBy}
              onHostedByChange={setLocalHostedBy}
              initial={{
                name: venue.name,
                address: venue.address,
                city: venue.city,
                area: venue.area || "",
              }}
              onSaved={() => void reload()}
            />
            <div className="nyto-panel h-fit p-5">
              <h3 className="text-[15px] font-semibold text-ink">Quick actions</h3>
              <p className="mt-1 text-[14px] text-text-muted">
                {isNyto
                  ? "Publish NYTO curated nights and keep floor contacts current."
                  : "Partner venue — packages live on their side. Keep contacts ready."}
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <Button
                  className="w-full"
                  onClick={() => setTab("experiences")}
                >
                  {isNyto ? "Manage experiences" : "View experiences"}
                </Button>
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => setTab("contacts")}
                >
                  Venue contacts
                </Button>
              </div>
            </div>
          </div>
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
  onHostedByChange,
  initial,
  onSaved,
}: {
  venueId: string;
  mockMode: boolean;
  hostedBy: HostedBy;
  onHostedByChange: (next: HostedBy) => void;
  initial: { name: string; address: string; city: string; area: string };
  onSaved: () => void;
}) {
  const { getToken } = useAuth();
  const [name, setName] = useState(initial.name);
  const [address, setAddress] = useState(initial.address);
  const [city, setCity] = useState(initial.city);
  const [area, setArea] = useState(initial.area);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(initial.name);
    setAddress(initial.address);
    setCity(initial.city);
    setArea(initial.area);
  }, [initial.name, initial.address, initial.city, initial.area]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !address.trim() || !city.trim()) {
      setError("Name, address, and city are required.");
      setOk(null);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      if (mockMode) {
        setOk("Venue details saved (mock).");
        return;
      }
      const token = await getToken();
      if (!token) throw new ApiError("Session expired.", 401);
      // hostedBy persists on frontend until backend field ships
      await patchVenue(token, venueId, {
        name: name.trim(),
        address: address.trim(),
        city: city.trim(),
        area: area.trim() || undefined,
      });
      setOk("Venue details saved.");
      onSaved();
    } catch (err) {
      setOk(null);
      setError(err instanceof Error ? err.message : "Could not save venue.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSave} className="nyto-panel space-y-3.5 p-5">
      <div>
        <h3 className="text-[15px] font-semibold text-ink">Venue details</h3>
        <p className="mt-1 text-[13px] text-text-muted">
          Name, location, and who organises nights here.
        </p>
      </div>
      <div>
        <Label>Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <Label>Address</Label>
        <Input value={address} onChange={(e) => setAddress(e.target.value)} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>City</Label>
          <Input value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
        <div>
          <Label>Area</Label>
          <Input value={area} onChange={(e) => setArea(e.target.value)} />
        </div>
      </div>
      <div>
        <Label>Organised by</Label>
        <Select
          value={hostedBy}
          onChange={(e) => onHostedByChange(e.target.value as HostedBy)}
        >
          <option value="NYTO">NYTO curated</option>
          <option value="PARTNER">Partner venue</option>
        </Select>
        <p className="mt-1.5 text-[12px] leading-relaxed text-text-faint">
          {hostedBy === "NYTO"
            ? "Admin creates experiences and nights for this venue."
            : "Venue publishes packages on the platform. NYTO takes a share."}
        </p>
      </div>
      <FieldError message={error} />
      {ok ? <p className="text-[13px] font-medium text-success">{ok}</p> : null}
      <Button type="submit" disabled={busy}>
        {busy ? "Saving…" : "Save details"}
      </Button>
    </form>
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
  const defaults = loadConsoleSettings();
  const [rows, setRows] = useState(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [cost, setCost] = useState(String(defaults.defaultSeatPrice));
  const [diet, setDiet] = useState("NON_VEGETARIAN");
  const [categories, setCategories] = useState<ExperienceCategory[]>([
    "WEEKLY",
  ]);
  const [startsAt, setStartsAt] = useState("");
  const [capacity, setCapacity] = useState(String(defaults.defaultCapacity));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canEdit = hostedBy === "NYTO";

  useEffect(() => setRows(initial), [initial]);

  function resetForm() {
    setEditingId(null);
    setName("");
    setCost(String(defaults.defaultSeatPrice));
    setDiet("NON_VEGETARIAN");
    setCategories(["WEEKLY"]);
    setStartsAt("");
    setCapacity(String(defaults.defaultCapacity));
    setError(null);
  }

  function startEdit(row: ExperienceRow) {
    if (!canEdit) return;
    setEditingId(row.id);
    setName(row.name);
    setCost(String(row.costPerHead ?? defaults.defaultSeatPrice));
    setDiet(row.diet);
    setCategories(
      row.categories.length > 0 ? [...row.categories] : ["WEEKLY"],
    );
    setCapacity(String(row.capacity ?? defaults.defaultCapacity));
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
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
      .replace(",", " ·");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
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
    setError(null);
    setBusy(true);
    try {
      const whenLabel = startsAt ? formatWhenLabel(startsAt) : undefined;
      const cap = Number(capacity) || defaults.defaultCapacity;
      if (mockMode) {
        if (editingId) {
          setRows((prev) =>
            prev.map((r) =>
              r.id === editingId
                ? {
                    ...r,
                    name: name.trim(),
                    diet,
                    cost: `₹${Number(cost).toLocaleString("en-IN")}`,
                    costPerHead: Number(cost) || 0,
                    categories: [...categories],
                    when: whenLabel ?? r.when,
                    capacity: cap,
                  }
                : r,
            ),
          );
        } else {
          setRows((prev) => [
            {
              id: `e-${Date.now()}`,
              name: name.trim(),
              diet,
              cost: `₹${Number(cost).toLocaleString("en-IN")}`,
              costPerHead: Number(cost) || 0,
              categories: [...categories],
              when: whenLabel || "—",
              capacity: cap,
            },
            ...prev,
          ]);
        }
        resetForm();
        return;
      }
      const token = await getToken();
      if (!token) throw new ApiError("Session expired.", 401);
      const body = {
        name: name.trim(),
        dietaryType: diet as "VEGETARIAN" | "NON_VEGETARIAN" | "VEGAN",
        costPerHead: Number(cost) || 0,
      };
      if (editingId) await patchVenueMenu(token, editingId, body);
      else await createVenueMenu(token, venueId, body);
      // Categories + schedule persist when backend ships; refresh core menu list.
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

  async function onDelete(id: string) {
    if (!canEdit) return;
    if (!window.confirm("Delete this experience?")) return;
    setError(null);
    try {
      if (mockMode) {
        setRows((prev) => prev.filter((r) => r.id !== id));
        if (editingId === id) resetForm();
        return;
      }
      const token = await getToken();
      if (!token) throw new ApiError("Session expired.", 401);
      await deleteVenueMenu(token, id);
      if (editingId === id) resetForm();
      onChanged();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not delete experience.",
      );
    }
  }

  return (
    <div
      className={`grid gap-6 ${canEdit ? "lg:grid-cols-[1fr_340px]" : ""}`}
    >
      <div className="space-y-4">
        {!canEdit ? (
          <div className="rounded-xl border border-border bg-bg-elevated px-4 py-3.5 text-[13px] leading-relaxed text-text-muted">
            <p className="font-semibold text-ink">Partner hosted venue</p>
            <p className="mt-1">
              This venue organises its own nights on NYTO. Experiences and
              pricing are managed by them — we take the platform share. Admin
              can view only.
            </p>
          </div>
        ) : null}

        <div className="nyto-panel overflow-hidden">
          {rows.length === 0 ? (
            <div className="px-5 py-10 text-center text-[14px] text-text-muted">
              {canEdit
                ? "No experiences yet. Publish a NYTO curated night to get started."
                : "No experiences synced yet. Packages appear here when the venue publishes."}
            </div>
          ) : (
            <div className="nyto-table-wrap">
              <table className="nyto-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Categories</th>
                    <th>Diet</th>
                    <th>When</th>
                    <th>Seats</th>
                    <th>Cost / head</th>
                    {canEdit ? <th /> : null}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((m) => (
                    <tr key={m.id}>
                      <td className="font-medium text-ink">{m.name}</td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {m.categories.length === 0 ? (
                            <span className="text-text-faint">—</span>
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
                      <td className="text-text-muted">{m.when}</td>
                      <td className="tabular-nums text-text-muted">
                        {m.capacity ?? "—"}
                      </td>
                      <td className="tabular-nums">{m.cost}</td>
                      {canEdit ? (
                        <td className="text-right">
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
                              onClick={() => void onDelete(m.id)}
                              className="text-[13px] font-semibold text-danger hover:underline"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      ) : null}
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
            {editingId ? "Edit NYTO experience" : "Publish NYTO curated night"}
          </h3>
          <NytoCuratedCreateNote />
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
            <p className="mb-2 text-[12px] text-text-faint">
              Multi-select — same types as the NYTO guest app.
            </p>
            <div className="flex flex-wrap gap-2">
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
                    className={`rounded-lg border px-3 py-1.5 text-[13px] font-semibold transition ${
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
            {editingId ? (
              <p className="mt-1 text-[12px] text-text-faint">
                Leave blank to keep the current start time.
              </p>
            ) : null}
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
              ? "Saving…"
              : editingId
                ? "Save changes"
                : "Publish night"}
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
  const [shiftStart, setShiftStart] = useState("11:00");
  const [shiftEnd, setShiftEnd] = useState("16:00");
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
      setRows(MOCK_VENUE_CONTACTS.map((c) => ({ ...c })));
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
    setShiftStart("11:00");
    setShiftEnd("16:00");
  }

  function onAdd(e: FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    if (!trimmedName || !trimmedPhone || !shiftStart || !shiftEnd) {
      setError("Name, mobile, and shift times are required.");
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
          <h3 className="text-[15px] font-semibold text-ink">Venue contacts</h3>
          <p className="mt-1 text-[13px] text-text-muted">
            Managers and floor leads by shift — mobile first, email optional.
          </p>
        </div>
        {rows.length === 0 ? (
          <div className="px-5 py-10 text-center text-[14px] text-text-muted">
            No contacts yet. Add who to call for each shift.
          </div>
        ) : (
          <div className="nyto-table-wrap">
            <table className="nyto-table">
              <thead>
                <tr>
                  <th>Name</th>
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
                      {formatShiftRange(c.shiftStart, c.shiftEnd)}
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
