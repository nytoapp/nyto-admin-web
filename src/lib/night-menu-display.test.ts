import { describe, expect, it } from "vitest";
import { DEMO_MENU_COURSES } from "./demo-menu";
import {
  extractApiDishCourses,
  resolveNightMenuDisplay,
} from "./night-menu-display";

describe("resolveNightMenuDisplay", () => {
  it("uses the demo fixture only in mock mode and labels it as demo source", () => {
    const result = resolveNightMenuDisplay({
      mockMode: true,
      inclusions: ["Dinner", "Soft drinks"],
    });
    expect(result.source).toBe("demo");
    expect(result.courses).toEqual(DEMO_MENU_COURSES);
    expect(result.genericInclusions).toEqual([]);
  });

  it("does not invent dishes from generic live inclusions", () => {
    const result = resolveNightMenuDisplay({
      mockMode: false,
      inclusions: ["Dinner", "Soft drinks"],
      menu: { name: "Evening package", description: "3 courses" },
    });
    expect(result.source).toBe("generic_inclusions");
    expect(result.courses).toEqual([]);
    expect(result.genericInclusions).toEqual(["Dinner", "Soft drinks"]);
  });

  it("returns none when live data has no dishes and no inclusions", () => {
    const result = resolveNightMenuDisplay({
      mockMode: false,
      inclusions: [],
      menu: null,
    });
    expect(result.source).toBe("none");
    expect(result.courses).toEqual([]);
  });

  it("uses future API dish courses when present on the menu payload", () => {
    const result = resolveNightMenuDisplay({
      mockMode: false,
      inclusions: ["Dinner"],
      menu: {
        name: "Chef table",
        courses: [
          { course: "Mains", items: ["Chicken Biryani", "Fish Fry"] },
        ],
      },
    });
    expect(result.source).toBe("api_dishes");
    expect(result.courses).toEqual([
      { course: "Mains", items: ["Chicken Biryani", "Fish Fry"] },
    ]);
  });
});

describe("extractApiDishCourses", () => {
  it("returns null for current VenueMenu-shaped payloads", () => {
    expect(
      extractApiDishCourses({
        id: "m1",
        name: "3-course dinner",
        description: "I FIRST — Burrata…",
        dietaryType: "NON_VEGETARIAN",
        costPerHead: 1299,
      }),
    ).toBeNull();
  });
});
