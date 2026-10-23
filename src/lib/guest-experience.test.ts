import { describe, expect, it } from "vitest";
import type { BookingRow } from "./mappers";
import {
  attendanceDisplayLabel,
  buildGuestJourneyBuckets,
  classifyGuestJourneyStage,
  GUEST_EXPERIENCE_API_GAPS,
  uniqueGuestCount,
  venuesFromJourneyBuckets,
} from "./guest-experience";

function row(over: Partial<BookingRow> = {}): BookingRow {
  return {
    id: "b1",
    guest: "Asha",
    userId: "u1",
    phone: "—",
    email: "—",
    venue: "Jubilee Hills",
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
    tableType: null,
    capacity: null,
    seatsLeft: null,
    hostedBy: "NYTO",
    cancelReason: null,
    createdAt: null,
    tableId: "t1",
    experienceName: null,
    menuId: null,
    inclusions: [],
    paymentType: null,
    seatPrice: null,
    ...over,
  };
}

const NOW = Date.parse("2026-10-20T12:00:00.000Z");

describe("classifyGuestJourneyStage", () => {
  it("puts future confirmed bookings before the night", () => {
    expect(
      classifyGuestJourneyStage(
        row({ startsAtIso: "2026-10-25T13:30:00.000Z", status: "CONFIRMED" }),
        NOW,
      ),
    ).toBe("before_night");
  });

  it("marks past confirmed bookings as awaiting attendance record", () => {
    expect(
      classifyGuestJourneyStage(
        row({ startsAtIso: "2026-10-18T13:30:00.000Z", status: "CONFIRMED" }),
        NOW,
      ),
    ).toBe("awaiting_attendance_record");
  });

  it("does not treat confirmed as attended", () => {
    const stage = classifyGuestJourneyStage(
      row({ startsAtIso: "2026-10-18T13:30:00.000Z", status: "CONFIRMED" }),
      NOW,
    );
    expect(stage).not.toBe("attended");
  });

  it("uses persisted attended and no-show statuses", () => {
    expect(classifyGuestJourneyStage(row({ status: "ATTENDED" }), NOW)).toBe(
      "attended",
    );
    expect(classifyGuestJourneyStage(row({ status: "NO_SHOW" }), NOW)).toBe(
      "no_show",
    );
  });

  it("puts cancelled bookings in cancelled, not a hidden other bucket", () => {
    expect(classifyGuestJourneyStage(row({ status: "CANCELLED" }), NOW)).toBe(
      "cancelled",
    );
  });

  it("handles missing guest/venue fields without throwing", () => {
    expect(
      classifyGuestJourneyStage(
        row({
          guest: "—",
          venue: "—",
          venueId: "",
          startsAtIso: null,
          status: "PENDING_PAYMENT",
        }),
        NOW,
      ),
    ).toBe("before_night");
  });
});

describe("buildGuestJourneyBuckets", () => {
  it("returns empty row lists when there are no bookings", () => {
    const buckets = buildGuestJourneyBuckets([], NOW);
    expect(buckets.every((b) => b.rows.length === 0)).toBe(true);
  });

  it("buckets mixed statuses correctly", () => {
    const buckets = buildGuestJourneyBuckets(
      [
        row({ id: "1", status: "ATTENDED" }),
        row({
          id: "2",
          status: "CONFIRMED",
          startsAtIso: "2026-10-25T13:30:00.000Z",
        }),
        row({ id: "3", status: "NO_SHOW" }),
      ],
      NOW,
    );
    expect(buckets.find((b) => b.stage === "attended")?.rows).toHaveLength(1);
    expect(buckets.find((b) => b.stage === "before_night")?.rows).toHaveLength(
      1,
    );
    expect(buckets.find((b) => b.stage === "no_show")?.rows).toHaveLength(1);
  });
});

describe("attendanceDisplayLabel", () => {
  it("labels booking status without claiming door arrival", () => {
    expect(attendanceDisplayLabel("CONFIRMED")).toBe("Booking · Confirmed");
    expect(attendanceDisplayLabel("ATTENDED")).toBe("Booking · Attended");
    expect(attendanceDisplayLabel("NO_SHOW")).toBe("Booking · No-show");
  });
});

describe("venuesFromJourneyBuckets", () => {
  it("only lists venues that appear on the journey board", () => {
    const buckets = buildGuestJourneyBuckets(
      [
        row({
          id: "1",
          status: "CANCELLED",
          venueId: "v1",
          venue: "Jubilee Supper Club",
        }),
        row({
          id: "2",
          status: "CONFIRMED",
          startsAtIso: "2026-10-25T13:30:00.000Z",
          venueId: "v2",
          venue: "Hitech Terrace",
        }),
      ],
      NOW,
    );
    const venues = venuesFromJourneyBuckets(buckets);
    expect(venues.map(([id]) => id).sort()).toEqual(["v1", "v2"]);
  });

  it("returns no venues when the board is empty", () => {
    expect(venuesFromJourneyBuckets(buildGuestJourneyBuckets([], NOW))).toEqual(
      [],
    );
  });
});

describe("uniqueGuestCount", () => {
  it("counts distinct guests, not seats or duplicate bookings", () => {
    expect(
      uniqueGuestCount([
        row({ id: "1", userId: "u1", seats: 2 }),
        row({ id: "2", userId: "u1", seats: 1 }),
        row({ id: "3", userId: "u2", seats: 1 }),
      ]),
    ).toBe(2);
  });

  it("falls back to booking id when userId is missing", () => {
    expect(
      uniqueGuestCount([
        row({ id: "a", userId: null }),
        row({ id: "b", userId: null }),
      ]),
    ).toBe(2);
  });
});

describe("GUEST_EXPERIENCE_API_GAPS", () => {
  it("documents complaints, follow-ups, and notifications", () => {
    const ids = GUEST_EXPERIENCE_API_GAPS.map((g) => g.id);
    expect(ids).toContain("complaints");
    expect(ids).toContain("followups");
    expect(ids).toContain("notifications");
  });
});
