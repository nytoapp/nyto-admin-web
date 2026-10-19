/**
 * Default booking unlock windows (Asia/Kolkata) — mirrors backend
 * `defaultBookingOpensAt` / `isBookingOpen`.
 *
 * - Sat nights → Thursday 09:00 IST (2 days before)
 * - Sun nights → Thursday 09:00 IST (3 days before)
 * - Weekday nights → 3 days before at 09:00 IST
 *
 * Persisted `bookingOpensAt` on a night always wins when present.
 */

export function istCalendarDate(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export function istWeekdayShort(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "Asia/Kolkata",
  });
}

/** 09:00 Asia/Kolkata on YYYY-MM-DD + dayOffset → UTC Date */
export function istNineAmOn(isoDate: string, dayOffset = 0): Date {
  const [y, m, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, day! + dayOffset, 3, 30, 0));
}

export function defaultBookingOpensAt(startsAt: Date): Date {
  const dateStr = istCalendarDate(startsAt);
  const weekday = istWeekdayShort(startsAt);

  if (weekday === "Sat") {
    return istNineAmOn(dateStr, -2);
  }
  if (weekday === "Sun") {
    return istNineAmOn(dateStr, -3);
  }
  return istNineAmOn(dateStr, -3);
}

export function resolveBookingOpensAt(
  startsAt: Date,
  bookingOpensAtRaw?: string | null,
): Date | null {
  if (bookingOpensAtRaw) {
    const explicit = new Date(bookingOpensAtRaw);
    if (!Number.isNaN(explicit.getTime())) return explicit;
  }
  if (Number.isNaN(startsAt.getTime())) return null;
  return defaultBookingOpensAt(startsAt);
}

export type NightBookingState =
  | "cancelled"
  | "completed"
  | "not_yet_open"
  | "open"
  | "sold_out"
  | "unavailable";

export function nightBookingStateLabel(state: NightBookingState): string {
  switch (state) {
    case "cancelled":
      return "Cancelled";
    case "completed":
      return "Completed";
    case "not_yet_open":
      return "Booking not yet open";
    case "open":
      return "Open for booking";
    case "sold_out":
      return "Sold out";
    default:
      return "Booking status unavailable";
  }
}

export function nightBookingStateTone(
  state: NightBookingState,
): "accent" | "success" | "warning" | "danger" | "neutral" {
  switch (state) {
    case "open":
      return "success";
    case "not_yet_open":
      return "warning";
    case "sold_out":
      return "neutral";
    case "cancelled":
      return "danger";
    case "completed":
      return "neutral";
    default:
      return "neutral";
  }
}

/**
 * Determine guest-facing booking availability for a scheduled night.
 * Event date and booking-open date are separate concepts.
 */
export function resolveNightBookingState(input: {
  status: string;
  startsAt: Date;
  bookingOpensAt?: string | null;
  seatsLeft?: number | null;
  now?: Date;
}): NightBookingState {
  const now = input.now ?? new Date();
  const status = String(input.status ?? "").toUpperCase();

  if (status === "CANCELLED") return "cancelled";
  if (status === "COMPLETED") return "completed";
  if (Number.isNaN(input.startsAt.getTime())) return "unavailable";
  if (input.startsAt.getTime() <= now.getTime()) return "completed";

  const opensAt = resolveBookingOpensAt(input.startsAt, input.bookingOpensAt);
  if (!opensAt) return "unavailable";

  if (
    input.seatsLeft != null &&
    Number.isFinite(input.seatsLeft) &&
    input.seatsLeft <= 0 &&
    now >= opensAt
  ) {
    return "sold_out";
  }

  if (now < opensAt) return "not_yet_open";
  if (now >= opensAt && now < input.startsAt) return "open";
  return "unavailable";
}
