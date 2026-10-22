import { describe, expect, it } from "vitest";
import { UNNAMED_EXPERIENCE } from "./booking-experience";
import type { AdminTable } from "./types";
import {
  dietaryDisplayLabel,
  experienceEditFormValues,
  isUpcomingDiningNight,
  kolkataDatetimeLocalToIso,
  mapTableToNightExperience,
  nightCapacityLabel,
  parseDietaryType,
  selectOverviewDiningNights,
  toDatetimeLocalInKolkata,
  uniqueInclusions,
} from "./venue-experience-form";

function table(over: Partial<AdminTable> = {}): AdminTable {
  return {
    id: "t1",
    venueId: "v1",
    menuId: null,
    startsAt: "2026-12-10T14:30:00.000Z", // 20:00 IST
    bookingOpensAt: "2026-12-01T00:00:00.000Z",
    priceTier: "EVENING",
    seatPrice: 1199,
    capacity: 6,
    tableType: "COUPLES",
    paymentType: "ALL_INCLUSIVE",
    inclusions: ["Dinner for two", "Shared dessert"],
    status: "OPEN",
    ...over,
  };
}

describe("parseDietaryType / dietaryDisplayLabel", () => {
  it("maps enum values for table and form consistently", () => {
    expect(parseDietaryType("NON_VEGETARIAN")).toBe("NON_VEGETARIAN");
    expect(dietaryDisplayLabel("NON_VEGETARIAN")).toBe("Non-vegetarian");
    expect(parseDietaryType("VEGETARIAN")).toBe("VEGETARIAN");
    expect(dietaryDisplayLabel("VEGAN")).toBe("Vegan");
  });

  it("does not default missing dietary values to Non-vegetarian", () => {
    expect(parseDietaryType(null)).toBeNull();
    expect(parseDietaryType(undefined)).toBeNull();
    expect(parseDietaryType("")).toBeNull();
    expect(parseDietaryType("Diet unavailable")).toBeNull();
    expect(dietaryDisplayLabel(null)).toBe("Diet unavailable");
  });
});

describe("toDatetimeLocalInKolkata / kolkataDatetimeLocalToIso", () => {
  it("initializes datetime-local from an existing startsAt without shifting IST wall time", () => {
    // 10 Dec 2026 20:00 Asia/Kolkata = 14:30 UTC
    expect(toDatetimeLocalInKolkata("2026-12-10T14:30:00.000Z")).toBe(
      "2026-12-10T20:00",
    );
  });

  it("round-trips Kolkata wall time without unintended day shift", () => {
    const local = "2026-12-20T13:00";
    const iso = kolkataDatetimeLocalToIso(local);
    expect(toDatetimeLocalInKolkata(iso)).toBe(local);
  });

  it("returns empty string for missing or invalid timestamps", () => {
    expect(toDatetimeLocalInKolkata(null)).toBe("");
    expect(toDatetimeLocalInKolkata("")).toBe("");
    expect(toDatetimeLocalInKolkata("not-a-date")).toBe("");
  });
});

describe("mapTableToNightExperience + experienceEditFormValues", () => {
  it("uses Unnamed experience when no menu name exists and never uses inclusions", () => {
    const row = mapTableToNightExperience(table(), null);
    expect(row.name).toBe(UNNAMED_EXPERIENCE);
    expect(row.menuId).toBeNull();
    expect(row.dietaryType).toBeNull();
    expect(row.diet).toBe("Diet unavailable");
    expect(row.inclusions).toEqual(["Dinner for two", "Shared dessert"]);
  });

  it("displays a real menu name when available", () => {
    const row = mapTableToNightExperience(table({ menuId: "m1" }), {
      id: "m1",
      name: "Jubilee couples menu",
      description: "Notes",
      dietaryType: "VEGETARIAN",
      costPerHead: 1199,
    });
    expect(row.name).toBe("Jubilee couples menu");
    expect(row.dietaryType).toBe("VEGETARIAN");
    expect(row.diet).toBe("Vegetarian");
  });

  it("initializes edit form from the selected night, including startsAt", () => {
    const row = mapTableToNightExperience(table(), {
      id: "m1",
      name: "Tasting",
      description: null,
      dietaryType: "VEGAN",
      costPerHead: 999,
    });
    const form = experienceEditFormValues(row);
    expect(form.name).toBe("Tasting");
    expect(form.dietaryType).toBe("VEGAN");
    expect(form.startsAt).toBe("2026-12-10T20:00");
    expect(form.capacity).toBe("6");
    expect(form.categories).toEqual(["COUPLES"]);
  });

  it("resets form values when switching selected experiences", () => {
    const a = experienceEditFormValues(
      mapTableToNightExperience(table({ id: "t-a", startsAt: "2026-12-10T14:30:00.000Z" }), {
        id: "m1",
        name: "Night A",
        description: null,
        dietaryType: "VEGETARIAN",
        costPerHead: 100,
      }),
    );
    const b = experienceEditFormValues(
      mapTableToNightExperience(
        table({
          id: "t-b",
          startsAt: "2026-12-20T07:30:00.000Z", // 13:00 IST
          tableType: "WOMEN_LED",
          capacity: 4,
        }),
        {
          id: "m2",
          name: "Night B",
          description: null,
          dietaryType: "NON_VEGETARIAN",
          costPerHead: 200,
        },
      ),
    );
    expect(a.name).toBe("Night A");
    expect(a.startsAt).toBe("2026-12-10T20:00");
    expect(a.dietaryType).toBe("VEGETARIAN");
    expect(b.name).toBe("Night B");
    expect(b.startsAt).toBe("2026-12-20T13:00");
    expect(b.dietaryType).toBe("NON_VEGETARIAN");
    expect(b.capacity).toBe("4");
    expect(a).not.toEqual(b);
  });

  it("leaves dietaryType empty when missing so the form does not invent Non-vegetarian", () => {
    const form = experienceEditFormValues(mapTableToNightExperience(table(), null));
    expect(form.dietaryType).toBe("");
    expect(form.name).toBe(UNNAMED_EXPERIENCE);
  });

  it("keeps night-level price and inclusions separate from the name", () => {
    const row = mapTableToNightExperience(table({ seatPrice: 1199 }), null);
    expect(row.name).toBe(UNNAMED_EXPERIENCE);
    expect(row.cost).toBe("₹1,199");
    expect(row.inclusions).toEqual(["Dinner for two", "Shared dessert"]);
    expect(row.diet).toBe("Diet unavailable");
  });

  it("exposes seats only when the API provides them", () => {
    const withSeats = mapTableToNightExperience(
      table({ seatsTaken: 2, seatsLeft: 4, capacity: 6 }),
      null,
    );
    expect(nightCapacityLabel(withSeats)).toBe("2 booked · 4 left of 6");
    const capacityOnly = mapTableToNightExperience(table({ capacity: 6 }), null);
    expect(nightCapacityLabel(capacityOnly)).toBe("6 seats");
    const none = mapTableToNightExperience(
      table({ capacity: undefined as unknown as number }),
      null,
    );
    // capacity may still be set from default fixture — force missing
    expect(nightCapacityLabel({ ...none, capacity: undefined })).toBeNull();
  });
});

describe("uniqueInclusions", () => {
  it("keeps real inclusion text and drops duplicates", () => {
    expect(
      uniqueInclusions([
        "Premium dinner",
        "Welcome drink",
        "premium dinner",
        "  ",
      ]),
    ).toEqual(["Premium dinner", "Welcome drink"]);
  });
});

describe("selectOverviewDiningNights", () => {
  const now = Date.parse("2026-12-01T00:00:00.000Z");

  it("excludes cancelled nights from upcoming and sorts by start", () => {
    const rows = [
      mapTableToNightExperience(
        table({
          id: "later",
          startsAt: "2026-12-20T07:30:00.000Z",
          status: "OPEN",
        }),
        { id: "m1", name: "Later", dietaryType: "VEGAN", costPerHead: 1 },
      ),
      mapTableToNightExperience(
        table({
          id: "soon",
          startsAt: "2026-12-10T14:30:00.000Z",
          status: "OPEN",
        }),
        { id: "m2", name: "Soon", dietaryType: "VEGAN", costPerHead: 1 },
      ),
      mapTableToNightExperience(
        table({
          id: "cancelled",
          startsAt: "2026-12-05T14:30:00.000Z",
          status: "CANCELLED",
        }),
        null,
      ),
    ];
    expect(isUpcomingDiningNight(rows[2], now)).toBe(false);
    const { nights, totalUpcoming } = selectOverviewDiningNights(rows, {
      nowMs: now,
      limit: 6,
    });
    expect(totalUpcoming).toBe(2);
    expect(nights.map((n) => n.id)).toEqual(["soon", "later"]);
    expect(nights.every((n) => n.status !== "CANCELLED")).toBe(true);
  });

  it("returns an empty list when there are no upcoming nights", () => {
    const past = mapTableToNightExperience(
      table({ startsAt: "2026-11-01T14:30:00.000Z" }),
      null,
    );
    const { nights, totalUpcoming, truncated } = selectOverviewDiningNights(
      [past],
      { nowMs: now },
    );
    expect(nights).toEqual([]);
    expect(totalUpcoming).toBe(0);
    expect(truncated).toBe(false);
  });
});
