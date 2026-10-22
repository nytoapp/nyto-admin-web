import { experienceDisplayName } from "@/lib/booking-experience";
import type { ExperienceCategory } from "@/lib/categories";
import { statusLabel } from "@/lib/format";
import type { AdminTable, VenueMenu } from "@/lib/types";

export type DietaryType = "VEGETARIAN" | "NON_VEGETARIAN" | "VEGAN";

const DIETARY_TYPES: DietaryType[] = [
  "VEGETARIAN",
  "NON_VEGETARIAN",
  "VEGAN",
];

/** Parse a persisted dietary enum. Never invents NON_VEGETARIAN for missing data. */
export function parseDietaryType(raw: unknown): DietaryType | null {
  if (raw == null) return null;
  const s = String(raw).trim().toUpperCase().replace(/[\s-]+/g, "_");
  if ((DIETARY_TYPES as string[]).includes(s)) return s as DietaryType;
  return null;
}

export function dietaryDisplayLabel(raw: unknown): string {
  const parsed = parseDietaryType(raw);
  return parsed ? statusLabel(parsed) : "Diet unavailable";
}

/**
 * Convert an API ISO timestamp to `datetime-local` wall time in Asia/Kolkata.
 * Returns "" when the value is missing or invalid.
 */
export function toDatetimeLocalInKolkata(
  iso: string | null | undefined,
): string {
  if (!iso || !String(iso).trim()) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  let hour = get("hour");
  // Some engines emit "24" for midnight.
  if (hour === "24") hour = "00";

  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}

/**
 * Interpret a `datetime-local` value as Asia/Kolkata wall time → UTC ISO.
 */
export function kolkataDatetimeLocalToIso(local: string): string {
  const trimmed = local.trim();
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?::\d{2})?/.exec(trimmed);
  if (!match) {
    const d = new Date(trimmed);
    if (Number.isNaN(d.getTime())) {
      throw new Error("Invalid start time");
    }
    return d.toISOString();
  }
  const d = new Date(`${match[1]}:00+05:30`);
  if (Number.isNaN(d.getTime())) {
    throw new Error("Invalid start time");
  }
  return d.toISOString();
}

export type NightExperienceRow = {
  id: string;
  menuId: string | null;
  name: string;
  description: string | null;
  /** Persisted enum when known; null when API has no dietary value. */
  dietaryType: DietaryType | null;
  /** Human label for the table (`Diet unavailable` when missing). */
  diet: string;
  cost: string;
  costPerHead?: number;
  categories: ExperienceCategory[];
  inclusions: string[];
  when: string;
  startsAtIso: string | null;
  capacity?: number;
  /** From table seat allocation when the API provides it. */
  seatsTaken?: number | null;
  seatsLeft?: number | null;
  status?: "OPEN" | "FULL" | "CANCELLED";
  tableId?: string;
  fromVenueDashboard?: boolean;
  /**
   * Raw menu object from the API (for future dish-level fields).
   * Not used to invent dishes from description text.
   */
  menuPayload?: unknown;
};

type MenuLike = {
  id?: string;
  name?: string | null;
  description?: string | null;
  dietaryType?: VenueMenu["dietaryType"] | string | null;
  /** Some mappers expose the enum on `diet` instead of `dietaryType`. */
  diet?: string | null;
  cost?: string;
  costPerHead?: number;
};

/**
 * Map a scheduled table (+ optional venue menu) into a night experience row.
 * Does not invent names from inclusions or default dietary type.
 */
export function mapTableToNightExperience(
  t: AdminTable,
  menu: MenuLike | null | undefined,
  opts?: { fromVenueDashboard?: boolean },
): NightExperienceRow {
  const menuName =
    (typeof menu?.name === "string" && menu.name.trim()) ||
    t.menu?.name?.trim() ||
    null;
  const dietaryType = parseDietaryType(
    menu?.dietaryType ?? menu?.diet ?? t.menu?.dietaryType,
  );

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
  const tableType = String(t.tableType ?? "").toUpperCase();
  const categories = (
    ["WEEKLY", "WOMEN_LED", "COUPLES", "SINGLES"].includes(tableType)
      ? [tableType as ExperienceCategory]
      : []
  ) as ExperienceCategory[];

  const inclusions = Array.isArray(t.inclusions)
    ? t.inclusions.filter((s) => typeof s === "string" && s.trim())
    : [];

  const menuId =
    (t.menuId != null && String(t.menuId).trim()) ||
    (t.menu?.id != null && String(t.menu.id).trim()) ||
    (menu?.id != null && String(menu.id).trim()) ||
    null;

  return {
    id: t.id,
    menuId,
    name: experienceDisplayName(menuName),
    description:
      menu?.description?.trim() || t.menu?.description?.trim() || null,
    dietaryType,
    diet: dietaryDisplayLabel(dietaryType),
    cost: Number.isFinite(t.seatPrice)
      ? `₹${t.seatPrice.toLocaleString("en-IN")}`
      : (menu?.cost ?? "Price unavailable"),
    costPerHead: Number.isFinite(t.seatPrice)
      ? t.seatPrice
      : menu?.costPerHead,
    categories,
    inclusions,
    when: whenLabel,
    startsAtIso:
      t.startsAt && !Number.isNaN(new Date(t.startsAt).getTime())
        ? t.startsAt
        : null,
    capacity: Number.isFinite(t.capacity) ? t.capacity : undefined,
    seatsTaken: Number.isFinite(t.seatsTaken as number)
      ? (t.seatsTaken as number)
      : null,
    seatsLeft: Number.isFinite(t.seatsLeft as number)
      ? (t.seatsLeft as number)
      : null,
    status: status === "CANCELLED" ? "CANCELLED" : "OPEN",
    tableId: t.id,
    fromVenueDashboard: opts?.fromVenueDashboard,
    menuPayload: menu ?? t.menu ?? null,
  };
}

/** Upcoming = not cancelled and startsAt strictly in the future. */
export function isUpcomingDiningNight(
  row: NightExperienceRow,
  nowMs: number = Date.now(),
): boolean {
  if (String(row.status ?? "").toUpperCase() === "CANCELLED") return false;
  if (!row.startsAtIso) return false;
  const starts = new Date(row.startsAtIso).getTime();
  return Number.isFinite(starts) && starts > nowMs;
}

export function selectOverviewDiningNights(
  rows: NightExperienceRow[],
  opts?: { limit?: number; nowMs?: number },
): {
  nights: NightExperienceRow[];
  totalUpcoming: number;
  truncated: boolean;
} {
  const nowMs = opts?.nowMs ?? Date.now();
  const limit = opts?.limit ?? 6;
  const upcoming = rows
    .filter((r) => isUpcomingDiningNight(r, nowMs))
    .slice()
    .sort((a, b) => {
      const ta = a.startsAtIso ? new Date(a.startsAtIso).getTime() : 0;
      const tb = b.startsAtIso ? new Date(b.startsAtIso).getTime() : 0;
      return ta - tb;
    });
  return {
    nights: upcoming.slice(0, limit),
    totalUpcoming: upcoming.length,
    truncated: upcoming.length > limit,
  };
}

/** Deduplicate inclusion labels while preserving first-seen order. */
export function uniqueInclusions(items: string[] | null | undefined): string[] {
  if (!Array.isArray(items)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    if (typeof raw !== "string") continue;
    const label = raw.trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  return out;
}

/** Capacity / seats line — never invent remaining seats. */
export function nightCapacityLabel(row: NightExperienceRow): string | null {
  if (row.capacity == null || !Number.isFinite(row.capacity)) return null;
  if (
    row.seatsLeft != null &&
    Number.isFinite(row.seatsLeft) &&
    row.seatsTaken != null &&
    Number.isFinite(row.seatsTaken)
  ) {
    return `${row.seatsTaken} booked · ${row.seatsLeft} left of ${row.capacity}`;
  }
  if (row.seatsLeft != null && Number.isFinite(row.seatsLeft)) {
    return `${row.seatsLeft} left of ${row.capacity}`;
  }
  return `${row.capacity} seats`;
}

/** Form init values for Edit experience — never invent dietary or start time. */
export function experienceEditFormValues(row: NightExperienceRow): {
  name: string;
  cost: string;
  dietaryType: DietaryType | "";
  categories: ExperienceCategory[];
  startsAt: string;
  capacity: string;
} {
  return {
    name: row.name,
    cost:
      row.costPerHead != null && Number.isFinite(row.costPerHead)
        ? String(row.costPerHead)
        : "",
    dietaryType: row.dietaryType ?? "",
    categories:
      row.categories.length > 0 ? [...row.categories] : (["WEEKLY"] as ExperienceCategory[]),
    startsAt: toDatetimeLocalInKolkata(row.startsAtIso),
    capacity: row.capacity != null ? String(row.capacity) : "",
  };
}
