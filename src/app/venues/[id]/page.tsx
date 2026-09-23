"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  assignVenueStaff,
  createVenueMenu,
  createVenueTable,
  listVenueMenus,
  listVenueTables,
  listVenues,
  patchTable,
  patchVenue,
} from "@/lib/api/venues";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/providers/auth-provider";
import type { AdminTable, Venue, VenueMenu } from "@/lib/types";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FieldError, Input, Label, Select } from "@/components/ui/Field";
import {
  EmptyState,
  ErrorBanner,
  PageHeader,
  Skeleton,
  StatCard,
} from "@/components/ui/Page";
import {
  formatMoneyInr,
  formatSeats,
  formatWhen,
  statusLabel,
} from "@/lib/format";

type Tab = "overview" | "experiences" | "sessions" | "staff";

export default function VenueDetailPage() {
  const params = useParams<{ id: string }>();
  const venueId = params.id;
  const { getToken } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");
  const [venue, setVenue] = useState<Venue | null>(null);
  const [menus, setMenus] = useState<VenueMenu[]>([]);
  const [tables, setTables] = useState<AdminTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      const [venuesRes, menusRes, tablesRes] = await Promise.all([
        listVenues(token),
        listVenueMenus(token, venueId),
        listVenueTables(token, venueId),
      ]);
      const found = venuesRes.venues.find((v) => v.id === venueId) ?? null;
      if (!found) throw new ApiError("Venue not found", 404);
      setVenue(found);
      setMenus(menusRes.menus);
      setTables(tablesRes.tables);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load venue.");
    } finally {
      setLoading(false);
    }
  }, [getToken, venueId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCount = useMemo(
    () => tables.filter((t) => t.status === "OPEN").length,
    [tables],
  );

  async function toggleActive() {
    if (!venue) return;
    setBusy(true);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await patchVenue(token, venue.id, {
        isActive: !venue.isActive,
      });
      setVenue(res.venue);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div>
        <Skeleton className="mb-4 h-10 w-64" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (!venue) {
    return (
      <EmptyState
        title="Venue not found"
        description="It may have been removed, or the id is invalid."
        action={
          <Link href="/venues">
            <Button variant="secondary">Back to venues</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div>
      <PageHeader
        title={venue.name}
        description={[venue.area, venue.city, venue.address]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <>
            <Badge tone={venue.isActive ? "success" : "neutral"}>
              {venue.isActive ? "Active" : "Inactive"}
            </Badge>
            <Button variant="secondary" disabled={busy} onClick={() => void toggleActive()}>
              {venue.isActive ? "Disable" : "Enable"}
            </Button>
          </>
        }
      />

      {error ? <div className="mb-4"><ErrorBanner message={error} onRetry={() => void load()} /></div> : null}

      <div className="mb-5 flex gap-1 border-b border-border-subtle">
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
            className={`border-b-2 px-3 py-2 text-[13px] font-medium transition ${
              tab === id
                ? "border-accent text-text"
                : "border-transparent text-text-muted hover:text-text"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Experiences" value={String(menus.length)} />
          <StatCard label="Sessions" value={String(tables.length)} />
          <StatCard label="Open sessions" value={String(openCount)} />
        </div>
      ) : null}

      {tab === "experiences" ? (
        <ExperiencesPanel
          venueId={venue.id}
          menus={menus}
          onChanged={() => void load()}
        />
      ) : null}

      {tab === "sessions" ? (
        <SessionsPanel
          venueId={venue.id}
          menus={menus}
          tables={tables}
          onChanged={() => void load()}
        />
      ) : null}

      {tab === "staff" ? (
        <StaffPanel venueId={venue.id} staffCount={venue._count?.staff ?? 0} />
      ) : null}
    </div>
  );
}

function ExperiencesPanel({
  venueId,
  menus,
  onChanged,
}: {
  venueId: string;
  menus: VenueMenu[];
  onChanged: () => void;
}) {
  const { getToken } = useAuth();
  const [name, setName] = useState("");
  const [cost, setCost] = useState("1299");
  const [dietary, setDietary] = useState<
    "VEGETARIAN" | "NON_VEGETARIAN" | "VEGAN"
  >("NON_VEGETARIAN");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      await createVenueMenu(token, venueId, {
        name: name.trim(),
        costPerHead: Number(cost),
        dietaryType: dietary,
      });
      setName("");
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="nyto-panel">
        <table className="nyto-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Diet</th>
              <th>Cost / head</th>
            </tr>
          </thead>
          <tbody>
            {menus.map((m) => (
              <tr key={m.id}>
                <td className="font-medium">{m.name}</td>
                <td className="text-text-muted">{m.dietaryType}</td>
                <td className="tabular-nums">{formatMoneyInr(m.costPerHead)}</td>
              </tr>
            ))}
            {menus.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-10 text-center text-text-muted">
                  No experiences yet. Add a menu package (e.g. 3-course dinner).
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <form onSubmit={onCreate} className="nyto-panel h-fit space-y-3 p-4">
        <h3 className="text-[13px] font-semibold">Add experience</h3>
        <div>
          <Label>Name</Label>
          <Input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="3-course dinner"
          />
        </div>
        <div>
          <Label>Cost per head (₹)</Label>
          <Input
            required
            type="number"
            min={0}
            value={cost}
            onChange={(e) => setCost(e.target.value)}
          />
        </div>
        <div>
          <Label>Dietary</Label>
          <Select
            value={dietary}
            onChange={(e) =>
              setDietary(e.target.value as typeof dietary)
            }
          >
            <option value="NON_VEGETARIAN">Non-vegetarian</option>
            <option value="VEGETARIAN">Vegetarian</option>
            <option value="VEGAN">Vegan</option>
          </Select>
        </div>
        <FieldError message={error} />
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "Saving…" : "Create"}
        </Button>
      </form>
    </div>
  );
}

function SessionsPanel({
  venueId,
  menus,
  tables,
  onChanged,
}: {
  venueId: string;
  menus: VenueMenu[];
  tables: AdminTable[];
  onChanged: () => void;
}) {
  const { getToken } = useAuth();
  const [startsAt, setStartsAt] = useState("");
  const [seatPrice, setSeatPrice] = useState("1299");
  const [capacity, setCapacity] = useState("6");
  const [tableType, setTableType] = useState("WEEKLY");
  const [paymentType, setPaymentType] = useState("ALL_INCLUSIVE");
  const [menuId, setMenuId] = useState("");
  const [inclusions, setInclusions] = useState("3-course dinner, Welcome drink");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      const when = new Date(startsAt);
      if (Number.isNaN(when.getTime())) {
        throw new ApiError("Invalid date/time", 400);
      }
      const hour = when.getHours();
      await createVenueTable(token, venueId, {
        startsAt: when.toISOString(),
        seatPrice: Number(seatPrice),
        capacity: Number(capacity),
        priceTier: hour < 16 ? "DAYTIME" : "EVENING",
        tableType: tableType as "WEEKLY",
        paymentType: paymentType as "ALL_INCLUSIVE",
        menuId: menuId || undefined,
        inclusions: inclusions
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        status: "OPEN",
      });
      setStartsAt("");
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create session.");
    } finally {
      setBusy(false);
    }
  }

  async function cancelSession(tableId: string) {
    if (!window.confirm("Cancel this session? Guests will no longer book it.")) {
      return;
    }
    setBusy(true);
    try {
      const token = await getToken();
      if (!token) return;
      await patchTable(token, tableId, { status: "CANCELLED" });
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Cancel failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="nyto-panel">
        <table className="nyto-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Price</th>
              <th>Seats</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {tables.map((t) => (
              <tr key={t.id}>
                <td className="font-medium">{formatWhen(t.startsAt)}</td>
                <td className="tabular-nums">{formatMoneyInr(t.seatPrice)}</td>
                <td className="text-text-muted">
                  {formatSeats(t.seatsLeft, t.capacity)}
                </td>
                <td>
                  <Badge tone={statusTone(t.status)}>
                    {statusLabel(t.status)}
                  </Badge>
                </td>
                <td className="text-right">
                  {t.status !== "CANCELLED" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void cancelSession(t.id)}
                      className="text-[12px] font-semibold text-danger hover:underline"
                    >
                      Cancel
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
            {tables.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-10 text-center text-text-muted">
                  No sessions yet. Create a night to publish to the app.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <form onSubmit={onCreate} className="nyto-panel h-fit space-y-3 p-4">
        <h3 className="text-[13px] font-semibold">Create session</h3>
        <div>
          <Label>Starts at</Label>
          <Input
            required
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Seat price (₹)</Label>
            <Input
              required
              type="number"
              min={0}
              value={seatPrice}
              onChange={(e) => setSeatPrice(e.target.value)}
            />
          </div>
          <div>
            <Label>Capacity</Label>
            <Input
              required
              type="number"
              min={2}
              max={12}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
            />
          </div>
        </div>
        <div>
          <Label>Table type</Label>
          <Select value={tableType} onChange={(e) => setTableType(e.target.value)}>
            <option value="WEEKLY">Weekly</option>
            <option value="WOMEN_LED">Women-led</option>
            <option value="COUPLES">Couples</option>
            <option value="SINGLES">Singles</option>
          </Select>
        </div>
        <div>
          <Label>Payment</Label>
          <Select
            value={paymentType}
            onChange={(e) => setPaymentType(e.target.value)}
          >
            <option value="ALL_INCLUSIVE">All-inclusive</option>
            <option value="PAY_OWN_BILL">Pay own bill</option>
          </Select>
        </div>
        <div>
          <Label>Experience (optional)</Label>
          <Select value={menuId} onChange={(e) => setMenuId(e.target.value)}>
            <option value="">None</option>
            {menus.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Inclusions (comma-separated)</Label>
          <Input
            value={inclusions}
            onChange={(e) => setInclusions(e.target.value)}
          />
        </div>
        <FieldError message={error} />
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "Creating…" : "Create session"}
        </Button>
      </form>
    </div>
  );
}

function StaffPanel({
  venueId,
  staffCount,
}: {
  venueId: string;
  staffCount: number;
}) {
  const { getToken } = useAuth();
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<"OWNER" | "MANAGER" | "STAFF">("STAFF");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function onAssign(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const token = await getToken();
      if (!token) return;
      await assignVenueStaff(token, venueId, {
        userId: userId.trim(),
        staffRole: role,
      });
      setOk("Staff assigned. They can use the venue portal once it ships.");
      setUserId("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not assign staff.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="nyto-panel p-5">
        <h3 className="text-[14px] font-semibold">Venue staff</h3>
        <p className="mt-1 text-[13px] text-text-muted">
          Currently linked: <span className="text-text">{staffCount}</span>{" "}
          account(s). Assign an existing user id (from seed or DB) to grant
          venue access.
        </p>
        <p className="mt-3 text-[12px] text-text-faint">
          Seed example: create/login as venue@nyto.app, then paste that user id
          here — or approve a host application which elevates the user.
        </p>
      </div>
      <form onSubmit={onAssign} className="nyto-panel h-fit space-y-3 p-4">
        <h3 className="text-[13px] font-semibold">Assign staff</h3>
        <div>
          <Label>User id</Label>
          <Input
            required
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="cuid…"
          />
        </div>
        <div>
          <Label>Role</Label>
          <Select
            value={role}
            onChange={(e) => setRole(e.target.value as typeof role)}
          >
            <option value="OWNER">Owner</option>
            <option value="MANAGER">Manager</option>
            <option value="STAFF">Staff</option>
          </Select>
        </div>
        <FieldError message={error} />
        {ok ? <p className="text-[12px] text-success">{ok}</p> : null}
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "Saving…" : "Assign"}
        </Button>
      </form>
    </div>
  );
}
