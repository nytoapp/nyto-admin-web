import { describe, expect, it } from "vitest";
import type { BookingRow } from "./mappers";
import {
  bookingTiming,
  buildVenueVisitSummaries,
  buildVisitHistoryGroups,
  countByBookingStatus,
  groupGuestBookings,
  mealPeriodFromStartsAt,
  mealPeriodLabel,
  physicalAttendanceLabel,
  reconnectPreferenceLabel,
} from "./guest-details";

function row(over: Partial<BookingRow> = {}): BookingRow {
  return {
    id: "b1",
    guest: "Asha",
    userId: "u1",
    phone: "—",
    email: "—",
    venue: "Jubilee Supper Club",
    venueId: "v1",
    area: "—",
    when: "—",
    startsAtIso: "2026-10-25T13:30:00.000Z",
    seats: 1,
    status: "CONFIRMED",
    amount: "₹2,499",
    amountValue: 2499,
    paymentId: null,
    paymentStatus: null,
    paymentMethod: null,
    paymentRef: null,
    checkInCode: null,
    bookingType: null,
    tableType: "COUPLES",
    capacity: null,
    seatsLeft: null,
    hostedBy: "NYTO",
    cancelReason: null,
    createdAt: null,
    tableId: "t1",
    experienceName: "Tasting",
    menuId: null,
    inclusions: [],
    paymentType: null,
    seatPrice: null,
    ...over,
  };
}

const NOW = Date.parse("2026-10-20T12:00:00.000Z");

describe("buildVisitHistoryGroups", () => {
  it("puts past cancelled bookings in past visits, not a separate dinners list", () => {
    const { pastVisits, upcoming, cancelledUpcoming } = buildVisitHistoryGroups(
      [
        row({
          id: "past-cancelled",
          status: "CANCELLED",
          startsAtIso: "2026-10-10T13:30:00.000Z",
        }),
        row({
          id: "past-attended",
          status: "ATTENDED",
          startsAtIso: "2026-10-08T13:30:00.000Z",
        }),
      ],
      NOW,
    );
    expect(pastVisits.map((r) => r.id)).toEqual([
      "past-cancelled",
      "past-attended",
    ]);
    expect(upcoming).toHaveLength(0);
    expect(cancelledUpcoming).toHaveLength(0);
  });

  it("keeps future cancelled out of upcoming", () => {
    const { upcoming, cancelledUpcoming } = buildVisitHistoryGroups(
      [
        row({
          id: "future-cancelled",
          status: "CANCELLED",
          startsAtIso: "2026-10-25T13:30:00.000Z",
        }),
        row({
          id: "future-ok",
          status: "CONFIRMED",
          startsAtIso: "2026-10-26T13:30:00.000Z",
        }),
      ],
      NOW,
    );
    expect(upcoming.map((r) => r.id)).toEqual(["future-ok"]);
    expect(cancelledUpcoming.map((r) => r.id)).toEqual(["future-cancelled"]);
  });
});

describe("groupGuestBookings", () => {
  it("puts future confirmed bookings in upcoming", () => {
    const { upcoming, past, cancelled } = groupGuestBookings(
      [
        row({
          id: "future-confirmed",
          status: "CONFIRMED",
          startsAtIso: "2026-10-25T13:30:00.000Z",
        }),
      ],
      NOW,
    );
    expect(upcoming.map((r) => r.id)).toEqual(["future-confirmed"]);
    expect(past).toHaveLength(0);
    expect(cancelled).toHaveLength(0);
  });

  it("never lists future cancelled bookings as upcoming", () => {
    const { upcoming, cancelled } = groupGuestBookings(
      [
        row({
          id: "future-cancelled",
          status: "CANCELLED",
          startsAtIso: "2026-10-25T13:30:00.000Z",
        }),
      ],
      NOW,
    );
    expect(upcoming).toHaveLength(0);
    expect(cancelled.map((r) => r.id)).toEqual(["future-cancelled"]);
  });

  it("keeps past cancelled bookings in cancelled (not discarded)", () => {
    const { past, cancelled } = groupGuestBookings(
      [
        row({
          id: "past-cancelled",
          status: "CANCELLED",
          startsAtIso: "2026-10-10T13:30:00.000Z",
        }),
      ],
      NOW,
    );
    expect(past).toHaveLength(0);
    expect(cancelled.map((r) => r.id)).toEqual(["past-cancelled"]);
  });

  it("puts past attended bookings in past", () => {
    const { past, upcoming, cancelled } = groupGuestBookings(
      [
        row({
          id: "past-attended",
          status: "ATTENDED",
          startsAtIso: "2026-10-10T13:30:00.000Z",
        }),
      ],
      NOW,
    );
    expect(past.map((r) => r.id)).toEqual(["past-attended"]);
    expect(upcoming).toHaveLength(0);
    expect(cancelled).toHaveLength(0);
  });

  it("handles missing experience start time safely", () => {
    const { unknown, upcoming, past, cancelled } = groupGuestBookings(
      [
        row({
          id: "no-date-confirmed",
          status: "CONFIRMED",
          startsAtIso: null,
        }),
        row({
          id: "no-date-cancelled",
          status: "CANCELLED",
          startsAtIso: null,
        }),
      ],
      NOW,
    );
    expect(unknown.map((r) => r.id)).toEqual(["no-date-confirmed"]);
    expect(cancelled.map((r) => r.id)).toEqual(["no-date-cancelled"]);
    expect(upcoming).toHaveLength(0);
    expect(past).toHaveLength(0);
    expect(bookingTiming(row({ startsAtIso: null }), NOW)).toBe("unknown");
  });

  it("keeps active statuses distinct across groups", () => {
    const groups = groupGuestBookings(
      [
        row({
          id: "u-confirmed",
          status: "CONFIRMED",
          startsAtIso: "2026-10-25T13:30:00.000Z",
        }),
        row({
          id: "u-pending",
          status: "PENDING_PAYMENT",
          startsAtIso: "2026-10-26T13:30:00.000Z",
        }),
        row({
          id: "p-noshow",
          status: "NO_SHOW",
          startsAtIso: "2026-10-10T13:30:00.000Z",
        }),
        row({
          id: "c1",
          status: "CANCELLED",
          startsAtIso: "2026-10-28T13:30:00.000Z",
        }),
      ],
      NOW,
    );
    expect(groups.upcoming.map((r) => r.id)).toEqual([
      "u-confirmed",
      "u-pending",
    ]);
    expect(groups.past.map((r) => r.id)).toEqual(["p-noshow"]);
    expect(groups.cancelled.map((r) => r.id)).toEqual(["c1"]);
  });
});

describe("mealPeriodFromStartsAt", () => {
  it("uses Kolkata clock time, not category names", () => {
    expect(mealPeriodFromStartsAt("2026-10-25T13:30:00.000Z")).toBe("dinner");
    expect(mealPeriodFromStartsAt("2026-10-25T05:30:00.000Z")).toBe("lunch");
    expect(mealPeriodLabel("lunch")).toBe("Lunch window");
  });

  it("returns null when start time is missing", () => {
    expect(mealPeriodFromStartsAt(null)).toBeNull();
  });
});

describe("buildVenueVisitSummaries", () => {
  it("counts booking records per venue without treating seats as bookings", () => {
    const summaries = buildVenueVisitSummaries([
      row({ id: "1", seats: 2, status: "ATTENDED" }),
      row({ id: "2", seats: 1, status: "CANCELLED" }),
      row({
        id: "3",
        venueId: "v2",
        venue: "Other",
        status: "NO_SHOW",
      }),
    ]);
    const jubilee = summaries.find((s) => s.venueId === "v1");
    expect(jubilee?.bookingRecords).toBe(2);
    expect(jubilee?.bookingAttended).toBe(1);
    expect(jubilee?.cancelled).toBe(1);
    expect(summaries.find((s) => s.venueId === "v2")?.noShow).toBe(1);
  });

  it("returns empty list when no venues", () => {
    expect(buildVenueVisitSummaries([])).toEqual([]);
  });
});

describe("countByBookingStatus", () => {
  it("counts booking records by status", () => {
    expect(
      countByBookingStatus([
        row({ status: "ATTENDED" }),
        row({ id: "2", status: "CONFIRMED" }),
        row({ id: "3", status: "NO_SHOW" }),
      ]),
    ).toEqual({
      confirmed: 1,
      pendingPayment: 0,
      attended: 1,
      noShow: 1,
      cancelled: 0,
    });
  });
});

describe("unavailable labels", () => {
  it("does not invent attendance or reconnect preference", () => {
    expect(physicalAttendanceLabel()).toBe("Arrival data unavailable");
    expect(reconnectPreferenceLabel()).toBe("Not available");
  });
});
