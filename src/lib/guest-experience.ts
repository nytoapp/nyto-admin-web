import type { BookingRow } from "@/lib/mappers";

export type GuestJourneyStage =
  | "before_night"
  | "awaiting_attendance_record"
  | "attended"
  | "no_show"
  | "other";

export type GuestJourneyBucket = {
  stage: GuestJourneyStage;
  label: string;
  hint: string;
  rows: BookingRow[];
};

/**
 * Classify a booking into an operational journey stage using persisted
 * booking status + night start time only.
 * Does not infer physical door arrival (TableMember.attended is not on admin APIs).
 */
export function classifyGuestJourneyStage(
  row: BookingRow,
  nowMs: number = Date.now(),
): GuestJourneyStage {
  const status = String(row.status ?? "").toUpperCase();
  if (status === "ATTENDED") return "attended";
  if (status === "NO_SHOW") return "no_show";
  if (status === "CANCELLED") return "other";

  const startMs = row.startsAtIso
    ? new Date(row.startsAtIso).getTime()
    : Number.NaN;

  if (status === "CONFIRMED" || status === "PENDING_PAYMENT") {
    if (Number.isFinite(startMs)) {
      return startMs > nowMs
        ? "before_night"
        : "awaiting_attendance_record";
    }
    // No reliable start time — treat open bookings as pre-night (unknown timing).
    return "before_night";
  }

  return "other";
}

export function buildGuestJourneyBuckets(
  rows: BookingRow[],
  nowMs: number = Date.now(),
): GuestJourneyBucket[] {
  const buckets: Record<GuestJourneyStage, BookingRow[]> = {
    before_night: [],
    awaiting_attendance_record: [],
    attended: [],
    no_show: [],
    other: [],
  };

  for (const row of rows) {
    buckets[classifyGuestJourneyStage(row, nowMs)].push(row);
  }

  const sortByStart = (a: BookingRow, b: BookingRow) => {
    const am = a.startsAtIso ? new Date(a.startsAtIso).getTime() : 0;
    const bm = b.startsAtIso ? new Date(b.startsAtIso).getTime() : 0;
    return am - bm;
  };

  buckets.before_night.sort(sortByStart);
  buckets.awaiting_attendance_record.sort(sortByStart);
  buckets.attended.sort((a, b) => sortByStart(b, a));
  buckets.no_show.sort((a, b) => sortByStart(b, a));

  return [
    {
      stage: "before_night",
      label: "Before the night",
      hint: "",
      rows: buckets.before_night,
    },
    {
      stage: "awaiting_attendance_record",
      label: "Attendance pending",
      hint: "",
      rows: buckets.awaiting_attendance_record,
    },
    {
      stage: "attended",
      label: "Attended",
      hint: "",
      rows: buckets.attended,
    },
    {
      stage: "no_show",
      label: "No-show",
      hint: "",
      rows: buckets.no_show,
    },
  ];
}

/** Distinct guests in a booking list (falls back to booking id when userId missing). */
export function uniqueGuestCount(rows: BookingRow[]): number {
  const keys = new Set<string>();
  for (const row of rows) {
    keys.add(row.userId?.trim() || `booking:${row.id}`);
  }
  return keys.size;
}

/** Attendance label that never conflates booking confirmation with physical arrival. */
export function attendanceDisplayLabel(status: string): string {
  const s = status.toUpperCase();
  if (s === "ATTENDED") return "Booking · Attended";
  if (s === "NO_SHOW") return "Booking · No-show";
  if (s === "CONFIRMED") return "Booking · Confirmed";
  if (s === "PENDING_PAYMENT") return "Booking · Awaiting payment";
  if (s === "CANCELLED") return "Booking · Cancelled";
  return `Booking · ${status}`;
}

export const GUEST_EXPERIENCE_API_GAPS = [
  {
    id: "complaints",
    title: "Complaint / report records",
    detail:
      "No Complaint or Report model or admin API. Need persisted reports with guest, booking, venue, category, description, priority, status, and assignment.",
  },
  {
    id: "followups",
    title: "Follow-up case records",
    detail:
      "No FollowUp model or admin API. Need cases with due date, assignee, status workflow, and action history.",
  },
  {
    id: "feedback",
    title: "Guest feedback",
    detail:
      "No feedback/rating entity on admin APIs. Cannot show post-night scores without inventing them.",
  },
  {
    id: "arrival",
    title: "Physical arrival confirmation",
    detail:
      "TableMember.attended exists in the database but is not exposed on admin booking endpoints. Admin only has booking status.",
  },
  {
    id: "notifications",
    title: "Instant admin notifications",
    detail:
      "Socket.IO is used for guest table chat only. No admin complaint event channel or persisted notification inbox.",
  },
  {
    id: "reminders",
    title: "Reminder / confirmation send status",
    detail:
      "No admin-visible reminder delivery ledger. Do not claim a reminder was sent.",
  },
] as const;
