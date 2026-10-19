import type { NetworkTable } from "@/lib/api/tables";
import {
  nightBookingStateLabel,
  nightBookingStateTone,
  resolveNightBookingState,
  type NightBookingState,
} from "@/lib/booking-window";
import { formatWhenWithYear } from "@/lib/format";
import { resolveHostedBy, type HostedBy } from "@/lib/hosted-by";

export type UpcomingNightRow = {
  id: string;
  venueId: string;
  venueName: string;
  whenLabel: string;
  startsAtMs: number;
  hostedBy: HostedBy;
  tableStatus: string;
  bookingState: NightBookingState;
  bookingStateLabel: string;
  bookingStateTone: ReturnType<typeof nightBookingStateTone>;
  capacity: number | null;
  seatsTaken: number | null;
  seatsLeft: number | null;
  experience: string | null;
};

/**
 * Upcoming dining nights: future start, not cancelled/completed.
 * Booking availability is separate from table lifecycle status.
 */
export function selectUpcomingNights(
  tables: NetworkTable[],
  now = new Date(),
): UpcomingNightRow[] {
  const nowMs = now.getTime();
  const rows: UpcomingNightRow[] = [];

  for (const t of tables) {
    const tableStatus = String(t.status ?? "").toUpperCase();
    if (tableStatus === "CANCELLED" || tableStatus === "COMPLETED") continue;

    const startsAt = new Date(t.startsAt);
    if (Number.isNaN(startsAt.getTime())) continue;
    if (startsAt.getTime() <= nowMs) continue;

    const seatsLeft =
      t.seatsLeft != null && Number.isFinite(t.seatsLeft) ? t.seatsLeft : null;
    const bookingState = resolveNightBookingState({
      status: tableStatus,
      startsAt,
      bookingOpensAt: t.bookingOpensAt,
      seatsLeft,
      now,
    });

    rows.push({
      id: t.id,
      venueId: t.venueId,
      venueName: t.venue?.name || "—",
      whenLabel: formatWhenWithYear(t.startsAt),
      startsAtMs: startsAt.getTime(),
      hostedBy: resolveHostedBy(t.hostedBy ?? t.venue?.hostedBy),
      tableStatus,
      bookingState,
      bookingStateLabel: nightBookingStateLabel(bookingState),
      bookingStateTone: nightBookingStateTone(bookingState),
      capacity: Number.isFinite(t.capacity) ? t.capacity : null,
      seatsTaken:
        t.seatsTaken != null && Number.isFinite(t.seatsTaken)
          ? t.seatsTaken
          : null,
      seatsLeft,
      experience: t.menu?.name ?? null,
    });
  }

  rows.sort((a, b) => a.startsAtMs - b.startsAtMs);
  return rows;
}

export function seatsLine(night: UpcomingNightRow): string | null {
  if (night.capacity == null || night.capacity <= 0) return null;
  if (night.seatsLeft != null) {
    return `${night.seatsLeft} left · ${night.capacity} seats`;
  }
  if (night.seatsTaken != null) {
    return `${night.seatsTaken} of ${night.capacity} seats`;
  }
  return null;
}
