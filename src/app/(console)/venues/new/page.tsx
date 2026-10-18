"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { FieldError, Input, Label, Select } from "@/components/ui/Field";
import { HostedByBadge } from "@/components/ui/HostedBy";
import { ApiError } from "@/lib/api/client";
import {
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
import {
  priceTierFromLocalDatetime,
  toIsoFromLocalDatetime,
} from "@/lib/mappers";
import { saveVenueHostedBy } from "@/lib/venue-meta";
import { useAuth } from "@/providers/auth-provider";

export default function NewVenuePage() {
  const router = useRouter();
  const { getToken, mockMode } = useAuth();

  const [hostedBy, setHostedBy] = useState<HostedBy>("NYTO");

  // Place
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("Hyderabad");
  const [area, setArea] = useState("");

  // First NYTO night — price & capacity set per venue/night
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

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPartner = hostedBy === "PARTNER";
  const previewName = name.trim() || "New venue";
  const previewPlace = [area.trim() || "Area", city.trim() || "City"].join(
    " · ",
  );
  const priceLabel = `₹${Number(seatPrice || 0).toLocaleString("en-IN")}`;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (isPartner) return;

    if (!name.trim() || !address.trim() || !city.trim()) {
      setError("Venue name, address, and city are required.");
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
              NYTO curated publish from admin. Partner kitchens onboard via host
              applications.
            </p>
          </div>
          <Link href="/venues">
            <Button variant="secondary">Cancel</Button>
          </Link>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-2 sm:max-w-md">
        {(
          [
            ["NYTO", "NYTO curated"],
            ["PARTNER", "Partner"],
          ] as const
        ).map(([id, label]) => {
          const on = hostedBy === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                setHostedBy(id);
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

      {isPartner ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.85fr)]">
          <div className="nyto-panel space-y-5 p-6 sm:p-8">
            <HostedByBadge value="PARTNER" />
            <h2 className="font-display text-[24px] font-medium tracking-[-0.02em] text-ink">
              Partners onboard themselves
            </h2>
            <p className="max-w-lg text-[14px] leading-relaxed text-text-muted">
              Name, address, menus, categories, price, and schedule are filled
              in the <span className="font-semibold text-ink">venue portal</span>{" "}
              (or via a host application). Admin does not create that shell
              here — you approve, then watch packages sync view-only and take
              the platform share.
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <Link href="/host-applications">
                <Button>Open host applications</Button>
              </Link>
              <Link href="/venues">
                <Button variant="secondary">Back to venues</Button>
              </Link>
            </div>
          </div>
          <aside className="nyto-panel p-6 text-[13px] leading-relaxed text-text-muted">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-faint">
              Flow
            </p>
            <ol className="mt-4 list-decimal space-y-3 pl-4">
              <li>Venue applies / signs up on the portal</li>
              <li>Admin approves in Host applications</li>
              <li>They publish nights → syncs to admin + NYTO app</li>
            </ol>
          </aside>
        </div>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
          <form onSubmit={onSubmit} className="nyto-panel space-y-6 p-5 sm:p-7">
            <section className="space-y-4">
              <h2 className="text-[14px] font-semibold text-ink">Place</h2>
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

            <div className="h-px bg-border-subtle" />

            <section className="space-y-4">
              <div>
                <h2 className="text-[14px] font-semibold text-ink">
                  First night
                </h2>
                <p className="mt-1 text-[12px] text-text-faint">
                  Published with the venue — guests can book in the NYTO app.
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
                  <Label>Dietary</Label>
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
                  <Label>Starts at</Label>
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
            </section>

            <FieldError message={error} />

            <Button type="submit" disabled={busy} className="w-full sm:w-auto">
              {busy ? "Publishing…" : "Create venue + publish night"}
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
              Network preview
            </p>
            <div className="relative mt-6 space-y-4">
              <HostedByBadge value="NYTO" />
              <div>
                <h2 className="font-display text-[26px] font-medium leading-tight tracking-[-0.03em] text-ink">
                  {previewName}
                </h2>
                <p className="mt-1.5 text-[14px] text-text-muted">
                  {previewPlace}
                </p>
              </div>
              <div className="rounded-xl border border-border-subtle bg-bg-soft/80 px-4 py-3.5 space-y-2">
                <p className="text-[13px] font-semibold text-ink">
                  {experienceName.trim() || "Experience"}
                </p>
                <p className="text-[12px] text-text-muted">
                  {categories.map(categoryLabel).join(" · ") || "—"}
                  {" · "}
                  {diet === "NON_VEGETARIAN"
                    ? "Non-veg"
                    : diet === "VEGETARIAN"
                      ? "Veg"
                      : "Vegan"}
                </p>
                <p className="text-[14px] font-semibold tabular-nums text-accent-soft">
                  {priceLabel}
                  <span className="ml-2 text-[12px] font-medium text-text-faint">
                    · {capacity || "—"} seats
                  </span>
                </p>
                {startsAt ? (
                  <p className="text-[12px] text-text-faint">
                    {new Date(startsAt).toLocaleString("en-GB", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                      timeZone: "Asia/Kolkata",
                    })}
                  </p>
                ) : (
                  <p className="text-[12px] text-text-faint">Set a start time</p>
                )}
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
