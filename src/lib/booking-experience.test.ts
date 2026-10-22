import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BookingRow } from "./mappers";

const listVenueMenus = vi.fn();
const listVenueTables = vi.fn();
const listTableBookings = vi.fn();

vi.mock("@/lib/api/venues", () => ({
  listVenueMenus: (...args: unknown[]) => listVenueMenus(...args),
  listVenueTables: (...args: unknown[]) => listVenueTables(...args),
}));

vi.mock("@/lib/api/tables", () => ({
  listTableBookings: (...args: unknown[]) => listTableBookings(...args),
}));

import {
  enrichBookingsWithMenus,
  experienceDisplayName,
  resolveMenuForBooking,
  UNNAMED_EXPERIENCE,
} from "./booking-experience";

function baseRow(over: Partial<BookingRow> = {}): BookingRow {
  return {
    id: "b1",
    guest: "Guest",
    userId: "u1",
    phone: "—",
    email: "—",
    venue: "Venue",
    venueId: "v1",
    area: "—",
    when: "—",
    startsAtIso: null,
    seats: 2,
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
    capacity: 6,
    seatsLeft: null,
    hostedBy: "NYTO",
    cancelReason: null,
    createdAt: null,
    tableId: "t1",
    experienceName: null,
    menuId: "m1",
    inclusions: ["Dinner for two", "Shared dessert"],
    paymentType: "ALL_INCLUSIVE",
    seatPrice: 2499,
    ...over,
  };
}

beforeEach(() => {
  listVenueMenus.mockReset();
  listVenueTables.mockReset();
  listTableBookings.mockReset();

  listVenueMenus.mockResolvedValue({ ok: true, menus: [] });
  listVenueTables.mockResolvedValue({ ok: true, tables: [] });
  listTableBookings.mockResolvedValue({
    ok: true,
    table: { id: "t1", startsAt: "", capacity: 6, status: "OPEN", seatPrice: 0, menu: null },
    bookings: [],
  });
});

describe("enrichBookingsWithMenus", () => {
  it("resolves a matching menu by menuId from listVenueMenus", async () => {
    listVenueMenus.mockResolvedValue({
      ok: true,
      menus: [
        {
          id: "m1",
          venueId: "v1",
          name: "Couples tasting",
          description: "Shared plates",
          dietaryType: "NON_VEGETARIAN",
          costPerHead: 2499,
          createdAt: "",
        },
      ],
    });

    const [row] = await enrichBookingsWithMenus("tok", [baseRow()]);
    expect(row.experienceName).toBe("Couples tasting");
    expect(row.menuDescription).toBe("Shared plates");
    expect(row.inclusions).toEqual(["Dinner for two", "Shared dessert"]);
  });

  it("resolves via venue tables nested menu when menuId lookup misses", async () => {
    listVenueMenus.mockResolvedValue({ ok: true, menus: [] });
    listVenueTables.mockResolvedValue({
      ok: true,
      tables: [
        {
          id: "t1",
          venueId: "v1",
          menuId: "m9",
          startsAt: "",
          bookingOpensAt: "",
          priceTier: "EVENING",
          seatPrice: 1199,
          capacity: 6,
          tableType: "COUPLES",
          paymentType: "ALL_INCLUSIVE",
          inclusions: [],
          status: "OPEN",
          menu: {
            id: "m9",
            venueId: "v1",
            name: "Jubilee couples menu",
            description: "Course notes",
            dietaryType: "NON_VEGETARIAN",
            costPerHead: 1199,
            createdAt: "",
          },
        },
      ],
    });

    const [row] = await enrichBookingsWithMenus("tok", [
      baseRow({ menuId: null, experienceName: null }),
    ]);
    expect(row.experienceName).toBe("Jubilee couples menu");
    expect(row.menuDescription).toBe("Course notes");
  });

  it("falls back to listTableBookings menu name when venue lists lack it", async () => {
    listVenueMenus.mockResolvedValue({ ok: true, menus: [] });
    listVenueTables.mockResolvedValue({ ok: true, tables: [] });
    listTableBookings.mockResolvedValue({
      ok: true,
      table: {
        id: "t1",
        startsAt: "",
        capacity: 6,
        status: "OPEN",
        seatPrice: 0,
        menu: { id: "m2", name: "From table bookings" },
      },
      bookings: [],
    });

    const [row] = await enrichBookingsWithMenus("tok", [
      baseRow({ menuId: null }),
    ]);
    expect(row.experienceName).toBe("From table bookings");
    expect(listTableBookings).toHaveBeenCalledWith("tok", "t1");
  });

  it("returns null when menuId is missing and no table menu exists", async () => {
    const [row] = await enrichBookingsWithMenus("tok", [
      baseRow({ menuId: null, tableId: "t-alone", experienceName: null }),
    ]);
    expect(row.experienceName).toBeNull();
    expect(row.menuDescription).toBeNull();
  });

  it("returns null when menuId is not present in the menus response", async () => {
    listVenueMenus.mockResolvedValue({
      ok: true,
      menus: [
        {
          id: "other-menu",
          venueId: "v1",
          name: "Different package",
          description: null,
          dietaryType: "VEGAN",
          costPerHead: 500,
          createdAt: "",
        },
      ],
    });

    const [row] = await enrichBookingsWithMenus("tok", [
      baseRow({ menuId: "missing-menu", tableId: null }),
    ]);
    expect(row.experienceName).toBeNull();
  });

  it("matches menu ids after normalizing identifier types to strings", async () => {
    listVenueMenus.mockResolvedValue({
      ok: true,
      menus: [
        {
          id: "42",
          venueId: "v1",
          name: "Numeric-looking id menu",
          description: null,
          dietaryType: "VEGETARIAN",
          costPerHead: 100,
          createdAt: "",
        },
      ],
    });

    const [row] = await enrichBookingsWithMenus("tok", [
      baseRow({
        // Simulate a non-string id that still stringifies to the menu key.
        menuId: 42 as unknown as string,
        tableId: null,
      }),
    ]);
    expect(row.experienceName).toBe("Numeric-looking id menu");
  });

  it("does not invent a name from inclusions", async () => {
    const [row] = await enrichBookingsWithMenus("tok", [
      baseRow({
        menuId: null,
        tableId: null,
        experienceName: null,
        inclusions: ["Dinner for two", "Shared dessert"],
      }),
    ]);
    expect(row.experienceName).toBeNull();
  });

  it("keeps an existing experienceName from the booking payload", async () => {
    const [row] = await enrichBookingsWithMenus("tok", [
      baseRow({ experienceName: "Already set" }),
    ]);
    expect(row.experienceName).toBe("Already set");
  });
});

describe("resolveMenuForBooking", () => {
  it("uses the shared enricher for a single booking", async () => {
    listVenueMenus.mockResolvedValue({
      ok: true,
      menus: [
        {
          id: "m1",
          venueId: "v1",
          name: "Single resolve",
          description: "Desc",
          dietaryType: "NON_VEGETARIAN",
          costPerHead: 1,
          createdAt: "",
        },
      ],
    });

    const meta = await resolveMenuForBooking("tok", baseRow());
    expect(meta).toEqual({ name: "Single resolve", description: "Desc" });
  });
});

describe("experienceDisplayName", () => {
  it("keeps a valid experience name unchanged", () => {
    expect(experienceDisplayName("Couples tasting")).toBe("Couples tasting");
    expect(experienceDisplayName("  Trimmed  ")).toBe("Trimmed");
  });

  it("uses Unnamed experience for null or missing names", () => {
    expect(experienceDisplayName(null)).toBe(UNNAMED_EXPERIENCE);
    expect(experienceDisplayName(undefined)).toBe(UNNAMED_EXPERIENCE);
  });

  it("uses Unnamed experience for empty or whitespace-only names", () => {
    expect(experienceDisplayName("")).toBe(UNNAMED_EXPERIENCE);
    expect(experienceDisplayName("   ")).toBe(UNNAMED_EXPERIENCE);
  });

  it("does not treat inclusions as the experience name", async () => {
    const [row] = await enrichBookingsWithMenus("tok", [
      baseRow({
        menuId: null,
        tableId: null,
        experienceName: null,
        inclusions: ["Dinner for two", "Shared dessert"],
      }),
    ]);
    expect(row.experienceName).toBeNull();
    expect(experienceDisplayName(row.experienceName)).toBe(UNNAMED_EXPERIENCE);
    expect(row.inclusions).toEqual(["Dinner for two", "Shared dessert"]);
  });

  it("matches Booking Details and Guest Details fallback text", () => {
    const bookingDetailsLabel = experienceDisplayName(null);
    const guestHistoryLabel = experienceDisplayName(null);
    expect(bookingDetailsLabel).toBe("Unnamed experience");
    expect(guestHistoryLabel).toBe(bookingDetailsLabel);
  });
});

