"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FieldError, Input, Label, Select } from "@/components/ui/Field";
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
  patchVenue,
  patchVenueMenu,
  removeVenueStaff,
  type VenueStaffRow,
} from "@/lib/api/venues";
import {
  confirmDestructive,
  loadConsoleSettings,
} from "@/lib/console-settings";
import { statusLabel } from "@/lib/format";
import { useAdminResource } from "@/lib/hooks/useAdminResource";
import {
  mapExperienceRow,
  mapSessionRow,
  priceTierFromLocalDatetime,
  toIsoFromLocalDatetime,
} from "@/lib/mappers";
import {
  MOCK_EXPERIENCES,
  MOCK_VENUE_SESSIONS,
  MOCK_VENUE_STAFF,
  MOCK_VENUES,
} from "@/lib/mock/data";
import { useAuth } from "@/providers/auth-provider";

type Tab = "overview" | "experiences" | "sessions" | "staff";

export default function VenueDetailPage() {
  const params = useParams<{ id: string }>();
  const venueId = params.id;
  const { mockMode, getToken } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");
  const [toggling, setToggling] = useState(false);

  const mockVenue = MOCK_VENUES.find((v) => v.id === venueId) ?? MOCK_VENUES[0]!;

  const { data, loading, error, reload } = useAdminResource(
    !mockMode && Boolean(venueId),
    async (token) => {
      const [venueRes, menusRes, tablesRes, staffRes] = await Promise.all([
        getVenue(token, venueId),
        listVenueMenus(token, venueId),
        listVenueTables(token, venueId),
        listVenueStaff(token, venueId),
      ]);
      return {
        venue: venueRes.venue,
        menus: menusRes.menus.map(mapExperienceRow),
        sessions: tablesRes.tables.map(mapSessionRow),
        staff: staffRes.staff.map(mapStaffRow),
        menuOptions: menusRes.menus,
        rawTables: tablesRes.tables,
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
      }
    : data?.venue;

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
    ? MOCK_EXPERIENCES
    : (data?.menus ?? []);
  const sessions = mockMode
    ? MOCK_VENUE_SESSIONS
    : (data?.sessions ?? []);
  const staff = mockMode ? MOCK_VENUE_STAFF : (data?.staff ?? []);
  const active = Boolean(venue.isActive);

  return (
    <div>
      <PageHeader
        title={venue.name}
        description={`${venue.area || "—"} · ${venue.city} · ${venue.address}`}
        actions={
          <>
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
            ["sessions", "Sessions"],
            ["staff", "Staff"],
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
            <StatCard label="Sessions" value={String(sessions.length)} />
            <StatCard
              label="Open sessions"
              value={String(sessions.filter((s) => s.status === "OPEN").length)}
            />
          </div>
          <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
            <EditVenueForm
              venueId={venueId}
              mockMode={mockMode}
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
                Keep this venue publishing nights.
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => setTab("experiences")}
                >
                  Manage experiences
                </Button>
                <Button className="w-full" onClick={() => setTab("sessions")}>
                  Create session
                </Button>
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => setTab("staff")}
                >
                  Assign staff
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
          initial={experiences}
          onChanged={() => void reload()}
        />
      ) : null}
      {tab === "sessions" ? (
        <SessionsPanel
          venueId={venueId}
          mockMode={mockMode}
          initial={sessions}
          menuOptions={
            mockMode
              ? MOCK_EXPERIENCES.map((m) => ({ id: m.id, name: m.name }))
              : (data?.menuOptions ?? []).map((m) => ({
                  id: m.id,
                  name: m.name,
                }))
          }
          onChanged={() => void reload()}
        />
      ) : null}
      {tab === "staff" ? (
        <StaffPanel
          venueId={venueId}
          mockMode={mockMode}
          initial={staff}
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

function mapStaffRow(s: VenueStaffRow) {
  return {
    id: s.id,
    name: s.user.fullName || s.user.firstName || "Staff",
    email: s.user.email || "—",
    role: s.staffRole,
    active: s.isActive,
  };
}

function EditVenueForm({
  venueId,
  mockMode,
  initial,
  onSaved,
}: {
  venueId: string;
  mockMode: boolean;
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
          Name and location shown across the network.
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
};
type SessionRow = {
  id: string;
  when: string;
  experience: string;
  price: string;
  seats: string;
  status: string;
};
type StaffRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  active?: boolean;
};

function ExperiencesPanel({
  venueId,
  mockMode,
  initial,
  onChanged,
}: {
  venueId: string;
  mockMode: boolean;
  initial: ExperienceRow[];
  onChanged: () => void;
}) {
  const { getToken } = useAuth();
  const [rows, setRows] = useState(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [cost, setCost] = useState("1299");
  const [diet, setDiet] = useState("NON_VEGETARIAN");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => setRows(initial), [initial]);

  function resetForm() {
    setEditingId(null);
    setName("");
    setCost("1299");
    setDiet("NON_VEGETARIAN");
    setError(null);
  }

  function startEdit(row: ExperienceRow) {
    setEditingId(row.id);
    setName(row.name);
    setCost(String(row.costPerHead ?? 1299));
    setDiet(row.diet);
    setError(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
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
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="nyto-panel overflow-hidden">
        {rows.length === 0 ? (
          <div className="px-5 py-10 text-center text-[14px] text-text-muted">
            No experiences yet. Add a menu package to start publishing nights.
          </div>
        ) : (
          <div className="nyto-table-wrap">
            <table className="nyto-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Diet</th>
                  <th>Cost / head</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id}>
                    <td className="font-medium text-ink">{m.name}</td>
                    <td className="text-text-muted">{statusLabel(m.diet)}</td>
                    <td className="tabular-nums">{m.cost}</td>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <form onSubmit={onSubmit} className="nyto-panel h-fit space-y-3.5 p-5">
        <h3 className="text-[15px] font-semibold text-ink">
          {editingId ? "Edit experience" : "Add experience"}
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
        <FieldError message={error} />
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Saving…" : editingId ? "Save changes" : "Create"}
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
    </div>
  );
}

function SessionsPanel({
  venueId,
  mockMode,
  initial,
  menuOptions,
  onChanged,
}: {
  venueId: string;
  mockMode: boolean;
  initial: SessionRow[];
  menuOptions: { id: string; name: string }[];
  onChanged: () => void;
}) {
  const { getToken } = useAuth();
  const defaults = loadConsoleSettings();
  const [rows, setRows] = useState(initial);
  const [startsAt, setStartsAt] = useState("");
  const [seatPrice, setSeatPrice] = useState(String(defaults.defaultSeatPrice));
  const [capacity, setCapacity] = useState(String(defaults.defaultCapacity));
  const [menuId, setMenuId] = useState(menuOptions[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => setRows(initial), [initial]);
  useEffect(() => {
    if (!menuId && menuOptions[0]) setMenuId(menuOptions[0].id);
  }, [menuOptions, menuId]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!startsAt) {
      setError("Pick a start time.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      if (mockMode) {
        const when = new Date(startsAt);
        const label = when
          .toLocaleString("en-GB", {
            day: "numeric",
            month: "short",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          })
          .replace(",", " ·");
        setRows((prev) => [
          {
            id: `s-${Date.now()}`,
            when: label,
            price: `₹${Number(seatPrice).toLocaleString("en-IN")}`,
            seats: `${capacity} left · ${capacity} seats`,
            status: "OPEN",
            experience:
              menuOptions.find((m) => m.id === menuId)?.name ||
              menuOptions[0]?.name ||
              "—",
          },
          ...prev,
        ]);
        setStartsAt("");
        return;
      }
      const token = await getToken();
      if (!token) throw new ApiError("Session expired.", 401);
      await createVenueTable(token, venueId, {
        startsAt: toIsoFromLocalDatetime(startsAt),
        seatPrice: Number(seatPrice) || 0,
        capacity: Number(capacity) || 6,
        priceTier: priceTierFromLocalDatetime(startsAt),
        menuId: menuId || undefined,
        status: "OPEN",
      });
      setStartsAt("");
      onChanged();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not create session.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function cancelSession(id: string) {
    if (
      !confirmDestructive(
        "Cancel this session? Open bookings will be cancelled and captured payments refunded.",
      )
    ) {
      return;
    }
    const reason =
      window.prompt("Cancel reason (optional)")?.trim() || undefined;
    if (mockMode) {
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: "CANCELLED" } : r)),
      );
      return;
    }
    try {
      const token = await getToken();
      if (!token) throw new ApiError("Session expired.", 401);
      await cancelTable(token, id, reason);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel.");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="nyto-panel overflow-hidden">
        <div className="nyto-table-wrap">
          <table className="nyto-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Experience</th>
                <th>Price</th>
                <th>Seats</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td className="font-medium text-ink">{t.when}</td>
                  <td className="text-text-muted">{t.experience}</td>
                  <td className="tabular-nums">{t.price}</td>
                  <td className="text-text-muted">{t.seats}</td>
                  <td>
                    <Badge tone={statusTone(t.status)}>
                      {statusLabel(t.status)}
                    </Badge>
                  </td>
                  <td className="text-right">
                    {t.status !== "CANCELLED" ? (
                      <button
                        type="button"
                        onClick={() => void cancelSession(t.id)}
                        className="text-[13px] font-semibold text-danger hover:underline"
                      >
                        Cancel
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <form onSubmit={onCreate} className="nyto-panel h-fit space-y-3.5 p-5">
        <h3 className="text-[15px] font-semibold text-ink">Create session</h3>
        <div>
          <Label>Starts at</Label>
          <Input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Seat price (₹)</Label>
            <Input
              type="number"
              min={0}
              value={seatPrice}
              onChange={(e) => setSeatPrice(e.target.value)}
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
        </div>
        <div>
          <Label>Experience</Label>
          <Select value={menuId} onChange={(e) => setMenuId(e.target.value)}>
            {menuOptions.length === 0 ? (
              <option value="">No experiences yet</option>
            ) : (
              menuOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))
            )}
          </Select>
        </div>
        <FieldError message={error} />
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Creating…" : "Create session"}
        </Button>
      </form>
    </div>
  );
}

function StaffPanel({
  venueId,
  mockMode,
  initial,
  onChanged,
}: {
  venueId: string;
  mockMode: boolean;
  initial: StaffRow[];
  onChanged: () => void;
}) {
  const { getToken } = useAuth();
  const [rows, setRows] = useState(initial);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("STAFF");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => setRows(initial), [initial]);

  async function onAssign(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setError("Name and email are required.");
      setOk(null);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      if (mockMode) {
        setRows((prev) => [
          ...prev,
          {
            id: `st-${Date.now()}`,
            name: name.trim(),
            email: email.trim().toLowerCase(),
            role,
            active: true,
          },
        ]);
        setOk("Staff assigned (mock).");
        setName("");
        setEmail("");
        return;
      }
      const token = await getToken();
      if (!token) throw new ApiError("Session expired.", 401);
      await assignVenueStaff(token, venueId, {
        email: email.trim().toLowerCase(),
        name: name.trim(),
        staffRole: role as "OWNER" | "MANAGER" | "STAFF",
      });
      setOk("Staff assigned.");
      setName("");
      setEmail("");
      onChanged();
    } catch (err) {
      setOk(null);
      setError(err instanceof Error ? err.message : "Could not assign staff.");
    } finally {
      setBusy(false);
    }
  }

  async function onRemove(staffId: string) {
    if (!window.confirm("Remove this staff member from the venue?")) return;
    setError(null);
    setOk(null);
    setRemovingId(staffId);
    try {
      if (mockMode) {
        setRows((prev) => prev.filter((r) => r.id !== staffId));
        setOk("Staff removed (mock).");
        return;
      }
      const token = await getToken();
      if (!token) throw new ApiError("Session expired.", 401);
      await removeVenueStaff(token, venueId, staffId);
      setOk("Staff removed.");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove staff.");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="nyto-panel overflow-hidden">
        <div className="border-b border-border-subtle px-5 py-3.5">
          <h3 className="text-[15px] font-semibold text-ink">Venue staff</h3>
          <p className="mt-1 text-[13px] text-text-muted">
            People who can run this venue when the venue portal ships.
          </p>
        </div>
        <div className="nyto-table-wrap">
          <table className="nyto-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td className="font-medium text-ink">{s.name}</td>
                  <td className="text-text-muted">{s.email}</td>
                  <td>
                    <Badge tone="accent">{statusLabel(s.role)}</Badge>
                  </td>
                  <td className="text-right">
                    <button
                      type="button"
                      disabled={removingId === s.id}
                      onClick={() => void onRemove(s.id)}
                      className="text-[13px] font-semibold text-danger hover:underline disabled:opacity-50"
                    >
                      {removingId === s.id ? "Removing…" : "Remove"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <form onSubmit={onAssign} className="nyto-panel h-fit space-y-3.5 p-5">
        <h3 className="text-[15px] font-semibold text-ink">Assign staff</h3>
        <div>
          <Label>Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
          />
        </div>
        <div>
          <Label>Email</Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="team@venue.com"
          />
        </div>
        <div>
          <Label>Role</Label>
          <Select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="OWNER">Owner</option>
            <option value="MANAGER">Manager</option>
            <option value="STAFF">Staff</option>
          </Select>
        </div>
        <FieldError message={error} />
        {ok ? <p className="text-[13px] font-medium text-success">{ok}</p> : null}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Assigning…" : "Assign"}
        </Button>
      </form>
    </div>
  );
}
