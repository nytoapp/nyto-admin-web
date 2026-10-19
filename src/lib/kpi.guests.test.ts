import { describe, expect, it } from "vitest";
import { guestHasBooked, guestListKpis } from "./kpi";

describe("guestHasBooked", () => {
  it("is true when booking records > 0", () => {
    expect(guestHasBooked({ bookings: 1 })).toBe(true);
    expect(guestHasBooked({ bookings: 3, status: "NEW" })).toBe(true);
  });

  it("is false when booking records are 0", () => {
    expect(guestHasBooked({ bookings: 0 })).toBe(false);
    expect(guestHasBooked({ bookings: 0, status: "ACTIVE" })).toBe(false);
  });
});

describe("guestListKpis", () => {
  it("splits mutually exclusive Has booked / Never booked cohorts", () => {
    const kpi = guestListKpis([
      { bookings: 2 },
      { bookings: 0 },
      { bookings: 1 },
      { bookings: 0 },
    ]);
    expect(kpi.guestAccounts).toBe(4);
    expect(kpi.hasBooked).toBe(2);
    expect(kpi.neverBooked).toBe(2);
    expect(kpi.hasBooked + kpi.neverBooked).toBe(kpi.guestAccounts);
  });

  it("classifies from booking counts, not status labels", () => {
    const kpi = guestListKpis([
      { bookings: 1, status: "NEW" },
      { bookings: 0, status: "ACTIVE" },
    ]);
    expect(kpi.hasBooked).toBe(1);
    expect(kpi.neverBooked).toBe(1);
  });
});
