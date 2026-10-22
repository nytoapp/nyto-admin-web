import { listTableBookings } from "@/lib/api/tables";
import { guestName } from "@/lib/format";
import type { EnrichedBookingRow } from "@/lib/booking-experience";
import type { BookingRow } from "@/lib/mappers";

const KOLKATA = "Asia/Kolkata";

export type BookingTiming = "upcoming" | "past" | "unknown";

export type MealPeriod = "lunch" | "dinner" | "other";

export type VenueVisitSummary = {
  venueId: string;
  venueName: string;
  /** Booking records at this venue in the loaded feed. */
  bookingRecords: number;
  /** Booking status = ATTENDED (not physical door check-in). */
  bookingAttended: number;
  cancelled: number;
  noShow: number;
  other: number;
};

export type SharedTablePeer = {
  bookingId: string;
  userId: string | null;
  guest: string;
  seats: number;
  bookingStatus: string;
};

export type SharedTableContext = {
  tableId: string;
  startsAtIso: string | null;
  when: string;
  venue: string;
  venueId: string;
  experienceName: string | null;
  guestBookingId: string;
  guestBookingStatus: string;
  peers: SharedTablePeer[];
};

/** Hour in Asia/Kolkata (0–23), or null if unparseable. */
export function kolkataHour(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    hourCycle: "h23",
    timeZone: KOLKATA,
  }).formatToParts(d);
  const hour = parts.find((p) => p.type === "hour")?.value;
  if (hour == null) return null;
  const n = Number(hour);
  return Number.isFinite(n) ? n : null;
}

/**
 * Lunch/dinner from scheduled start time in Asia/Kolkata only.
 * Does not use experience category names.
 * Lunch: 11:00–15:59 · Dinner: 16:00–22:59 · else other.
 */
export function mealPeriodFromStartsAt(
  iso: string | null | undefined,
): MealPeriod | null {
  const hour = kolkataHour(iso);
  if (hour == null) return null;
  if (hour >= 11 && hour < 16) return "lunch";
  if (hour >= 16 && hour < 23) return "dinner";
  return "other";
}

export function mealPeriodLabel(period: MealPeriod | null): string {
  if (period === "lunch") return "Lunch window";
  if (period === "dinner") return "Dinner window";
  if (period === "other") return "Other time";
  return "Time unknown";
}

export function isCancelledStatus(status: string | null | undefined): boolean {
  return String(status ?? "").toUpperCase() === "CANCELLED";
}

export function bookingTiming(
  row: Pick<BookingRow, "startsAtIso">,
  nowMs: number = Date.now(),
): BookingTiming {
  if (!row.startsAtIso) return "unknown";
  const t = new Date(row.startsAtIso).getTime();
  if (!Number.isFinite(t)) return "unknown";
  return t > nowMs ? "upcoming" : "past";
}

function byStartAsc<T extends Pick<BookingRow, "startsAtIso">>(a: T, b: T) {
  const am = a.startsAtIso ? new Date(a.startsAtIso).getTime() : 0;
  const bm = b.startsAtIso ? new Date(b.startsAtIso).getTime() : 0;
  return am - bm;
}

export type GuestBookingGroups<T> = {
  /** Future start, still active (not CANCELLED). */
  upcoming: T[];
  /** Start time before now, excluding CANCELLED (status shown on each row). */
  past: T[];
  /** All CANCELLED bookings (future or past) — never listed as upcoming. */
  cancelled: T[];
  /** Active bookings with missing/unparseable start time. */
  unknown: T[];
};

/**
 * Group guest bookings for history UI.
 * Cancelled is never treated as an active upcoming booking and is never dropped.
 */
export function groupGuestBookings<
  T extends Pick<BookingRow, "startsAtIso" | "status">,
>(rows: T[], nowMs: number = Date.now()): GuestBookingGroups<T> {
  const upcoming: T[] = [];
  const past: T[] = [];
  const cancelled: T[] = [];
  const unknown: T[] = [];

  for (const row of rows) {
    if (isCancelledStatus(row.status)) {
      cancelled.push(row);
      continue;
    }
    const timing = bookingTiming(row, nowMs);
    if (timing === "upcoming") upcoming.push(row);
    else if (timing === "past") past.push(row);
    else unknown.push(row);
  }

  upcoming.sort(byStartAsc);
  past.sort((a, b) => byStartAsc(b, a));
  cancelled.sort((a, b) => byStartAsc(b, a));
  return { upcoming, past, cancelled, unknown };
}

export function buildVenueVisitSummaries(
  rows: BookingRow[],
): VenueVisitSummary[] {
  const map = new Map<string, VenueVisitSummary>();

  for (const row of rows) {
    const key = row.venueId || row.venue;
    if (!key || key === "—") continue;
    const existing = map.get(key) ?? {
      venueId: row.venueId || key,
      venueName: row.venue !== "—" ? row.venue : key,
      bookingRecords: 0,
      bookingAttended: 0,
      cancelled: 0,
      noShow: 0,
      other: 0,
    };
    existing.bookingRecords += 1;
    const status = String(row.status ?? "").toUpperCase();
    if (status === "ATTENDED") existing.bookingAttended += 1;
    else if (status === "CANCELLED") existing.cancelled += 1;
    else if (status === "NO_SHOW") existing.noShow += 1;
    else existing.other += 1;
    map.set(key, existing);
  }

  return [...map.values()].sort(
    (a, b) =>
      b.bookingRecords - a.bookingRecords ||
      a.venueName.localeCompare(b.venueName),
  );
}

export function countByBookingStatus(rows: BookingRow[]): {
  confirmed: number;
  pendingPayment: number;
  attended: number;
  noShow: number;
  cancelled: number;
} {
  const out = {
    confirmed: 0,
    pendingPayment: 0,
    attended: 0,
    noShow: 0,
    cancelled: 0,
  };
  for (const row of rows) {
    const s = String(row.status ?? "").toUpperCase();
    if (s === "CONFIRMED") out.confirmed += 1;
    else if (s === "PENDING_PAYMENT") out.pendingPayment += 1;
    else if (s === "ATTENDED") out.attended += 1;
    else if (s === "NO_SHOW") out.noShow += 1;
    else if (s === "CANCELLED") out.cancelled += 1;
  }
  return out;
}

/** Physical door attendance is not on admin booking payloads. */
export function physicalAttendanceLabel(): string {
  return "Arrival data unavailable";
}

/** Reconnect / meet-again preference is not on admin guest/booking APIs. */
export function reconnectPreferenceLabel(): string {
  return "Not available";
}

const MAX_SHARED_TABLES = 20;

/**
 * Other bookings on the same dining night/table via `/admin/tables/:id/bookings`.
 * Same table ≠ verified co-attendance or personal relationship.
 */
export async function loadSharedTableContexts(
  token: string,
  rows: EnrichedBookingRow[],
  guestId: string,
): Promise<SharedTableContext[]> {
  const byTable = new Map<string, EnrichedBookingRow>();
  for (const row of rows) {
    if (!row.tableId) continue;
    if (!byTable.has(row.tableId)) byTable.set(row.tableId, row);
  }

  const tableIds = [...byTable.keys()].slice(0, MAX_SHARED_TABLES);

  const results = await Promise.all(
    tableIds.map(async (tableId) => {
      const guestRow = byTable.get(tableId)!;
      try {
        const res = await listTableBookings(token, tableId);
        const peers: SharedTablePeer[] = res.bookings
          .filter((b) => b.user?.id !== guestId && b.id !== guestRow.id)
          .map((b) => ({
            bookingId: b.id,
            userId: b.user?.id ?? null,
            guest: guestName(b.user),
            seats: b.seatsBooked,
            bookingStatus: b.status,
          }));

        return {
          tableId,
          startsAtIso: guestRow.startsAtIso,
          when: guestRow.when,
          venue: guestRow.venue,
          venueId: guestRow.venueId,
          experienceName: guestRow.experienceName,
          guestBookingId: guestRow.id,
          guestBookingStatus: guestRow.status,
          peers,
        } satisfies SharedTableContext;
      } catch {
        return {
          tableId,
          startsAtIso: guestRow.startsAtIso,
          when: guestRow.when,
          venue: guestRow.venue,
          venueId: guestRow.venueId,
          experienceName: guestRow.experienceName,
          guestBookingId: guestRow.id,
          guestBookingStatus: guestRow.status,
          peers: [],
        } satisfies SharedTableContext;
      }
    }),
  );

  return results.sort((a, b) => {
    const am = a.startsAtIso ? new Date(a.startsAtIso).getTime() : 0;
    const bm = b.startsAtIso ? new Date(b.startsAtIso).getTime() : 0;
    return bm - am;
  });
}
