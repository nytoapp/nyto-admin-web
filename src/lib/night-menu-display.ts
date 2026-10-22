import { DEMO_MENU_COURSES, type MenuCourseGroup } from "@/lib/demo-menu";
import { uniqueInclusions } from "@/lib/venue-experience-form";

export type NightMenuSource = "demo" | "api_dishes" | "generic_inclusions" | "none";

export type NightMenuDisplay = {
  source: NightMenuSource;
  /** Dish-level courses when demo or future API dish data exists. */
  courses: MenuCourseGroup[];
  /** Generic inclusion strings from the night (not invented dishes). */
  genericInclusions: string[];
};

/**
 * Best-effort parse of future dish-level shapes on a menu payload.
 * Current VenueMenu has only name/description/dietaryType/costPerHead —
 * this returns null until the shared API adds real dish arrays.
 */
export function extractApiDishCourses(menu: unknown): MenuCourseGroup[] | null {
  if (!menu || typeof menu !== "object") return null;
  const m = menu as Record<string, unknown>;

  const fromCourses = normalizeCourseGroups(m.courses);
  if (fromCourses) return fromCourses;

  const fromDishes = normalizeFlatItems(m.dishes, "Dishes");
  if (fromDishes) return fromDishes;

  const fromItems = normalizeFlatItems(m.items, "Menu");
  if (fromItems) return fromItems;

  return null;
}

function normalizeCourseGroups(raw: unknown): MenuCourseGroup[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const groups: MenuCourseGroup[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const course =
      (typeof e.course === "string" && e.course.trim()) ||
      (typeof e.name === "string" && e.name.trim()) ||
      (typeof e.category === "string" && e.category.trim()) ||
      "";
    const items = uniqueInclusions(
      Array.isArray(e.items)
        ? e.items.map((x) => (typeof x === "string" ? x : String((x as { name?: string })?.name ?? "")))
        : Array.isArray(e.dishes)
          ? e.dishes.map((x) =>
              typeof x === "string" ? x : String((x as { name?: string })?.name ?? ""),
            )
          : [],
    );
    if (!course || items.length === 0) continue;
    groups.push({ course, items });
  }
  return groups.length > 0 ? groups : null;
}

function normalizeFlatItems(
  raw: unknown,
  course: string,
): MenuCourseGroup[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const items = uniqueInclusions(
    raw.map((x) =>
      typeof x === "string"
        ? x
        : typeof x === "object" && x && "name" in x
          ? String((x as { name?: string }).name ?? "")
          : "",
    ),
  );
  if (items.length === 0) return null;
  return [{ course, items }];
}

/**
 * Resolve what Overview should show for a dining night's food offering.
 * Demo fixtures are isolated to mockMode and never treated as live venue data.
 */
export function resolveNightMenuDisplay(input: {
  mockMode: boolean;
  inclusions?: string[] | null;
  /** Nested menu object from the night/table payload when present. */
  menu?: unknown;
}): NightMenuDisplay {
  const genericInclusions = uniqueInclusions(input.inclusions);

  if (input.mockMode) {
    return {
      source: "demo",
      courses: DEMO_MENU_COURSES,
      genericInclusions: [],
    };
  }

  const apiCourses = extractApiDishCourses(input.menu);
  if (apiCourses) {
    return {
      source: "api_dishes",
      courses: apiCourses,
      genericInclusions: [],
    };
  }

  if (genericInclusions.length > 0) {
    return {
      source: "generic_inclusions",
      courses: [],
      genericInclusions,
    };
  }

  return {
    source: "none",
    courses: [],
    genericInclusions: [],
  };
}
