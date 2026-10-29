"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { FieldError, Input, Label, Select } from "@/components/ui/Field";
import { HostedByBadge } from "@/components/ui/HostedBy";
import { ApiError } from "@/lib/api/client";
import {
  assignVenueStaff,
  createVenue,
  createVenueMenu,
  createVenueTable,
} from "@/lib/api/venues";
import {
  EXPERIENCE_CATEGORIES,
  categoryLabel,
  toggleCategory,
  type ExperienceCategory,
} from "@/lib/categories";
import type { HostedBy } from "@/lib/hosted-by";
import { hostedByLabel } from "@/lib/hosted-by";
import {
  priceTierFromLocalDatetime,
  toIsoFromLocalDatetime,
} from "@/lib/mappers";
import { saveVenueHostedBy } from "@/lib/venue-meta";
import { useAuth } from "@/providers/auth-provider";

function previewStartLabel(startsAt: string): string {
  if (!startsAt) return "Start time not set";
  const d = new Date(startsAt);
  if (Number.isNaN(d.getTime())) return "Start time not set";
  return d
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

export default function NewVenuePage() {
  const router = useRouter();
  const { getToken, mockMode } = useAuth();

  const [path, setPath] = useState<HostedBy>("NYTO");

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("Hyderabad");
  const [area, setArea] = useState("");

  const [experienceName, setExperienceName] = useState("3-course dinner");
  const [diet, setDiet] = useState<"VEGETARIAN" | "NON_VEGETARIAN" | "VEGAN">(
    "NON_VEGETARIAN",
  );
  const [categories, setCategories] = useState<ExperienceCategory[]>([
    "WEEKLY",
  ]);
  const [seatPrice, setSeatPrice] = useState("");
  const [capacity, setCapacity] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [paymentType, setPaymentType] = useState<
    "ALL_INCLUSIVE" | "PAY_OWN_BILL"
  >("ALL_INCLUSIVE");

  const [staffEmail, setStaffEmail] = useState("venue@nyto.app");
  const [staffName, setStaffName] = useState("Venue Staff");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isVenueOrganized = path === "PARTNER";
  const previewName = name.trim() || "New venue";
  const previewPlace = [area.trim() || "Area", city.trim() || "City"].join(
    " · ",
  );
  const priceLabel =
    seatPrice.trim() === "" || !Number.isFinite(Number(seatPrice))
      ? "Price not set"
      : `₹${Number(seatPrice).toLocaleString("en-IN")}`;
  const capacityLabel =
    capacity.trim() === "" || !Number.isFinite(Number(capacity))
      ? "Capacity not set"
      : `${Number(capacity)} seats`;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;

    if (!name.trim() || !address.trim() || !city.trim()) {
      setError("Venue name, address, and city are required.");
      return;
    }

    if (isVenueOrganized) {
      if (!staffEmail.trim()) {
        setError("Staff email is required so the venue can sign in.");
        return;
      }

      setError(null);
      setBusy(true);
      try {
        if (mockMode) {
          await new Promise((r) => setTimeout(r, 400));
          saveVenueHostedBy("3", "PARTNER");
          router.push("/venues/3");
          return;
        }

        const token = await getToken();
        if (!token) throw new ApiError("Session expired. Sign in again.", 401);

        const venueRes = await createVenue(token, {
          name: name.trim(),
          address: address.trim(),
          city: city.trim(),
          area: area.trim() || undefined,
          isActive: true,
          hostedBy: "PARTNER",
        });
        const venueId = venueRes.venue.id;
        saveVenueHostedBy(venueId, "PARTNER");

        await assignVenueStaff(token, venueId, {
          email: staffEmail.trim().toLowerCase(),
          name: staffName.trim() || undefined,
          staffRole: "OWNER",
        });

        router.push(`/venues/${venueId}?tab=contacts`);
      } catch (err) {
        setError(
          err instanceof ApiError || err instanceof Error
            ? err.message
            : "Could not create venue.",
        );
        setBusy(false);
      }
      return;
    }

    if (!experienceName.trim()) {
      setError("Experience name is required.");
      return;
    }
    if (categories.length === 0) {
      setError("Pick at least one category.");
      return;
    }
    if (!startsAt) {
      setError("Pick a start time for the first night.");
      return;
    }
    const startMs = new Date(startsAt).getTime();
    if (Number.isNaN(startMs) || startMs <= Date.now()) {
      setError("Start time must be in the future.");
      return;
    }
    const price = Number(seatPrice);
    if (!Number.isFinite(price) || price < 0) {
      setError("Seat price must be a valid number.");
      return;
    }
    const seats = Number(capacity);
    if (!Number.isFinite(seats) || seats < 2 || seats > 12) {
      setError("Capacity must be between 2 and 12.");
      return;
    }

    setError(null);
    setBusy(true);
    try {
      if (mockMode) {
        await new Promise((r) => setTimeout(r, 400));
        saveVenueHostedBy("3", "NYTO");
        router.push("/venues/3");
        return;
      }

      const token = await getToken();
      if (!token) throw new ApiError("Session expired. Sign in again.", 401);

      const venueRes = await createVenue(token, {
        name: name.trim(),
        address: address.trim(),
        city: city.trim(),
        area: area.trim() || undefined,
        isActive: true,
        hostedBy: "NYTO",
      });
      const venueId = venueRes.venue.id;
      saveVenueHostedBy(venueId, "NYTO");

      const menuRes = await createVenueMenu(token, venueId, {
        name: experienceName.trim(),
        dietaryType: diet,
        costPerHead: price,
      });

      await createVenueTable(token, venueId, {
        startsAt: toIsoFromLocalDatetime(startsAt),
        seatPrice: price,
        capacity: seats,
        priceTier: priceTierFromLocalDatetime(startsAt),
        tableType: categories[0],
        paymentType,
        menuId: menuRes.menu.id,
        status: "OPEN",
        hostedBy: "NYTO",
        inclusions: categories.map(categoryLabel),
      });

      router.push(`/venues/${venueId}`);
    } catch (err) {
      setError(
        err instanceof ApiError || err instanceof Error
          ? err.message
          : "Could not create venue.",
      );
      setBusy(false);
    }
  }

  return (
    <div className="nyto-fade">
      <div className="nyto-bookings-hero relative mb-6 overflow-hidden rounded-[22px] border border-border bg-bg-elevated shadow-[var(--shadow-md)]">
        <div
          className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full bg-accent/14 blur-3xl nyto-drift"
          aria-hidden
        />
        <div className="relative z-[2] flex flex-col gap-4 px-5 py-6 sm:flex-row sm:items-end sm:justify-between sm:px-7 sm:py-7">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-faint">
              Venues
            </p>
            <h1 className="mt-2 font-display text-[32px] font-medium leading-none tracking-[-0.04em] text-ink sm:text-[38px]">
              Add venue
            </h1>
            <p className="mt-2.5 max-w-md text-[14px] text-text-muted">
              Create NYTO-organized or Venue-organized kitchens. Partner venues
              get staff access; they publish their own nights.
            </p>
          </div>
          <Link href="/venues">
            <Button variant="secondary">Cancel</Button>
          </Link>
        </div>
      </div>

      <div
        className="mb-5 grid grid-cols-2 gap-2 sm:max-w-md"
        role="group"
        aria-label="Organizing model"
      >
        {(
          [
            ["NYTO", "NYTO-organized"],
            ["PARTNER", "Venue-organized"],
          ] as const
        ).map(([id, label]) => {
          const on = path === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                setPath(id);
                setError(null);
              }}
              className={`rounded-xl border px-3 py-3 text-[13px] font-semibold transition ${
                on
                  ? "border-accent bg-[var(--accent-wash)] text-ink"
                  : "border-border bg-bg-elevated text-text-muted hover:text-text"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
        <form onSubmit={onSubmit} className="nyto-panel space-y-6 p-5 sm:p-7">
          <section className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[14px] font-semibold text-ink">Venue</h2>
              <HostedByBadge value={path} short />
            </div>
            <div>
              <Label>Venue name</Label>
              <Input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="SkyGarden Madhapur"
                autoFocus
              />
            </div>
            <div>
              <Label>Address</Label>
              <Input
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street / landmark"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>City</Label>
                <Input
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>
              <div>
                <Label>Area</Label>
                <Input
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder="Madhapur"
                />
              </div>
            </div>
          </section>

          {isVenueOrganized ? (
            <>
              <div className="h-px bg-border-subtle" />
              <section className="space-y-4">
                <div>
                  <h2 className="text-[14px] font-semibold text-ink">
                    Venue staff access
                  </h2>
                  <p className="mt-1 text-[12px] text-text-faint">
                    They sign into the Venue portal with this email, then publish
                    menus and nights. Admin watches inventory view-only.
                  </p>
                </div>
                <div>
                  <Label>Staff email</Label>
                  <Input
                    required
                    type="email"
                    value={staffEmail}
                    onChange={(e) => setStaffEmail(e.target.value)}
                    placeholder="venue@nyto.app"
                  />
                </div>
                <div>
                  <Label>Staff name</Label>
                  <Input
                    value={staffName}
                    onChange={(e) => setStaffName(e.target.value)}
                    placeholder="Kitchen lead"
                  />
                </div>
                <p className="text-[12px] text-text-muted">
                  Incoming applications still land in{" "}
                  <Link
                    href="/host-applications"
                    className="font-semibold text-accent-soft underline-offset-2 hover:underline"
                  >
                    Requests & Approvals
                  </Link>
                  .
                </p>
              </section>
            </>
          ) : (
            <>
              <div className="h-px bg-border-subtle" />
              <section className="space-y-4">
                <div>
                  <h2 className="text-[14px] font-semibold text-ink">
                    First dining night
                  </h2>
                  <p className="mt-1 text-[12px] text-text-faint">
                    Price and capacity apply to this NYTO-organized night only.
                  </p>
                </div>
                <div>
                  <Label>Experience name</Label>
                  <Input
                    required
                    value={experienceName}
                    onChange={(e) => setExperienceName(e.target.value)}
                    placeholder="3-course dinner"
                  />
                </div>
                <div>
                  <Label>Category</Label>
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
                          className={`rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition ${
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
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Dietary option</Label>
                    <Select
                      value={diet}
                      onChange={(e) =>
                        setDiet(
                          e.target.value as
                            | "VEGETARIAN"
                            | "NON_VEGETARIAN"
                            | "VEGAN",
                        )
                      }
                    >
                      <option value="NON_VEGETARIAN">Non-vegetarian</option>
                      <option value="VEGETARIAN">Vegetarian</option>
                      <option value="VEGAN">Vegan</option>
                    </Select>
                  </div>
                  <div>
                    <Label>Seat price (₹)</Label>
                    <Input
                      type="number"
                      min={0}
                      required
                      placeholder="For this night"
                      value={seatPrice}
                      onChange={(e) => setSeatPrice(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Start date/time</Label>
                    <Input
                      type="datetime-local"
                      required
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
                      required
                      placeholder="Seats"
                      value={capacity}
                      onChange={(e) => setCapacity(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label>Bill type</Label>
                  <Select
                    value={paymentType}
                    onChange={(e) =>
                      setPaymentType(
                        e.target.value as "ALL_INCLUSIVE" | "PAY_OWN_BILL",
                      )
                    }
                  >
                    <option value="ALL_INCLUSIVE">All-inclusive</option>
                    <option value="PAY_OWN_BILL">Pay as you go</option>
                  </Select>
                </div>
              </section>
            </>
          )}

          <FieldError message={error} />

          <Button type="submit" disabled={busy} className="w-full sm:w-auto">
            {busy
              ? isVenueOrganized
                ? "Creating…"
                : "Publishing…"
              : isVenueOrganized
                ? "Create venue-organized venue"
                : "Create venue and publish dining night"}
          </Button>
        </form>

        <aside className="nyto-panel relative overflow-hidden p-6 sm:sticky sm:top-8 sm:p-7">
          <div
            className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full opacity-50"
            style={{
              background:
                "radial-gradient(circle, rgba(77,139,255,0.28), transparent 70%)",
            }}
            aria-hidden
          />
          <p className="relative text-[11px] font-semibold uppercase tracking-[0.14em] text-text-faint">
            Preview
          </p>
          <div className="relative mt-6 space-y-4">
            <HostedByBadge value={path} />
            <div>
              <h2 className="font-display text-[26px] font-medium leading-tight tracking-[-0.03em] text-ink">
                {previewName}
              </h2>
              <p className="mt-1.5 text-[14px] text-text-muted">
                {previewPlace}
              </p>
            </div>
            {isVenueOrganized ? (
              <div className="space-y-2 rounded-xl border border-border-subtle bg-bg-soft/80 px-4 py-3.5">
                <p className="text-[13px] font-semibold text-ink">
                  Staff portal access
                </p>
                <p className="text-[12px] text-text-muted">
                  {staffEmail.trim() || "staff@venue.com"}
                </p>
                <p className="text-[12px] text-text-faint">
                  Menus and nights are published by the venue — not from Admin.
                </p>
              </div>
            ) : (
              <div className="space-y-2 rounded-xl border border-border-subtle bg-bg-soft/80 px-4 py-3.5">
                <p className="text-[13px] font-semibold text-ink">
                  {experienceName.trim() || "Experience"}
                </p>
                <p className="text-[12px] text-text-muted">
                  {categories.map(categoryLabel).join(" · ") ||
                    "Category not set"}
                  {" · "}
                  {diet === "NON_VEGETARIAN"
                    ? "Non-veg"
                    : diet === "VEGETARIAN"
                      ? "Veg"
                      : "Vegan"}
                </p>
                <p className="text-[14px] font-semibold tabular-nums text-accent-soft">
                  {priceLabel}
                </p>
                <p className="text-[12px] text-text-faint">{capacityLabel}</p>
                <p className="text-[12px] text-text-faint">
                  {previewStartLabel(startsAt)}
                </p>
              </div>
            )}
            <p className="text-[11px] text-text-faint">
              {hostedByLabel(path)} · illustrative only until you submit.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
