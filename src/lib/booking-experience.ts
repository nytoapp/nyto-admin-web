import { listTableBookings } from "@/lib/api/tables";
import { listVenueMenus, listVenueTables } from "@/lib/api/venues";
import type { BookingRow } from "@/lib/mappers";

/**
 * Booking list/detail payloads omit nested `table.menu`.
 * Resolve experience name from existing admin reads only:
 * 1) `/admin/venues/:id/menus` by menuId
 * 2) `/admin/venues/:id/tables` by tableId → nested menu
 * 3) `/admin/tables/:id/bookings` table.menu (name only)
 *
 * Never invent names from inclusions or other free text.
 */
export type EnrichedBookingRow = BookingRow & {
  menuDescription: string | null;
};

/** User-visible fallback when no genuine menu/experience name exists. */
export const UNNAMED_EXPERIENCE = "Unnamed experience";

/**
 * Display label for an experience/menu name after resolution.
 * Does not invent names from inclusions, categories, or venues.
 */
export function experienceDisplayName(
  name: string | null | undefined,
): string {
  if (typeof name === "string" && name.trim()) return name.trim();
  return UNNAMED_EXPERIENCE;
}

type MenuBits = { name: string | null; description: string | null };

function normId(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length > 0 ? s : null;
}

function menuBitsFromUnknown(menu: unknown): MenuBits {
  if (!menu || typeof menu !== "object") {
    return { name: null, description: null };
  }
  const m = menu as { name?: unknown; description?: unknown };
  const name =
    typeof m.name === "string" && m.name.trim() ? m.name.trim() : null;
  const description =
    typeof m.description === "string" && m.description.trim()
      ? m.description.trim()
      : null;
  return { name, description };
}

function indexByNormalizedId<T>(
  entries: Array<[unknown, T]>,
): Map<string, T> {
  const map = new Map<string, T>();
  for (const [rawId, value] of entries) {
    const id = normId(rawId);
    if (id) map.set(id, value);
  }
  return map;
}

export async function enrichBookingsWithMenus(
  token: string,
  rows: BookingRow[],
): Promise<EnrichedBookingRow[]> {
  const venueIds = [
    ...new Set(
      rows.map((r) => normId(r.venueId)).filter((id): id is string => Boolean(id)),
    ),
  ];

  const menusByVenue = new Map<string, Map<string, MenuBits>>();
  const tableMenuByVenue = new Map<string, Map<string, MenuBits>>();

  await Promise.all(
    venueIds.map(async (venueId) => {
      const [menusRes, tablesRes] = await Promise.all([
        listVenueMenus(token, venueId).catch(() => null),
        listVenueTables(token, venueId).catch(() => null),
      ]);

      if (menusRes?.menus) {
        menusByVenue.set(
          venueId,
          indexByNormalizedId(
            menusRes.menus.map((m) => [m.id, menuBitsFromUnknown(m)] as const),
          ),
        );
      }

      if (tablesRes?.tables) {
        tableMenuByVenue.set(
          venueId,
          indexByNormalizedId(
            tablesRes.tables.map((t) => {
              const fromNested = menuBitsFromUnknown(t.menu);
              // If nested menu missing, still allow menuId → menus map later.
              return [t.id, fromNested] as const;
            }),
          ),
        );
      }
    }),
  );

  const unresolvedTableIds = new Set<string>();

  const prelim = rows.map((r) => {
    const venueId = normId(r.venueId);
    const menuId = normId(r.menuId);
    const tableId = normId(r.tableId);

    let name = r.experienceName?.trim() || null;
    let description: string | null = null;

    if (!name && venueId && menuId) {
      const fromMenus = menusByVenue.get(venueId)?.get(menuId);
      if (fromMenus?.name) {
        name = fromMenus.name;
        description = fromMenus.description;
      }
    }

    if ((!name || !description) && venueId && tableId) {
      const fromTable = tableMenuByVenue.get(venueId)?.get(tableId);
      if (fromTable) {
        name = name || fromTable.name;
        description = description || fromTable.description;
      }
    }

    // menuId present on table row but menus list missed it — try matching
    // menuId against any menu for that venue (same string key after normalize).
    if (!name && venueId && menuId) {
      const fromMenus = menusByVenue.get(venueId)?.get(menuId);
      if (fromMenus?.name) {
        name = fromMenus.name;
        description = description || fromMenus.description;
      }
    }

    if (!name && tableId) {
      unresolvedTableIds.add(tableId);
    }

    return {
      row: r,
      venueId,
      menuId,
      tableId,
      name,
      description,
    };
  });

  const tableBookingMenu = new Map<string, MenuBits>();
  await Promise.all(
    [...unresolvedTableIds].map(async (tableId) => {
      try {
        const res = await listTableBookings(token, tableId);
        tableBookingMenu.set(tableId, menuBitsFromUnknown(res.table?.menu));
      } catch {
        /* honest fallback remains */
      }
    }),
  );

  return prelim.map(({ row, tableId, name, description }) => {
    let resolvedName = name;
    let resolvedDescription = description;

    if (!resolvedName && tableId) {
      const fromBookings = tableBookingMenu.get(tableId);
      if (fromBookings?.name) {
        resolvedName = fromBookings.name;
        resolvedDescription =
          resolvedDescription || fromBookings.description;
      }
    }

    return {
      ...row,
      experienceName: resolvedName,
      menuDescription: resolvedDescription,
      // Keep identifiers normalized for downstream UI / retries.
      menuId: normId(row.menuId) ?? row.menuId,
      venueId: normId(row.venueId) ?? row.venueId,
      tableId: normId(row.tableId) ?? row.tableId,
    };
  });
}

export async function resolveMenuForBooking(
  token: string,
  row: BookingRow,
): Promise<{ name: string | null; description: string | null }> {
  const [enriched] = await enrichBookingsWithMenus(token, [row]);
  return {
    name: enriched.experienceName,
    description: enriched.menuDescription,
  };
}
