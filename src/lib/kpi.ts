/**
 * Frontend KPI derivations from loaded list payloads.
 * Never present filtered/page counts as undocumented global totals.
 */

export type CountScope =
  | "loaded_list"
  | "filtered_results"
  | "overview_upcoming_30d"
  | "ledger_current"
  | "unavailable";

export function formatSeatAllocation(
  seatsBooked: number | null | undefined,
  capacity: number | null | undefined,
): string {
  if (seatsBooked == null || !Number.isFinite(seatsBooked)) return "—";
  if (capacity == null || !Number.isFinite(capacity) || capacity <= 0) {
    return `${seatsBooked} seat${seatsBooked === 1 ? "" : "s"}`;
  }
  return `${seatsBooked} of ${capacity}`;
}

export function formatUnsetMoney(raw: string): string {
  const n = Number(raw);
  if (raw.trim() === "" || !Number.isFinite(n)) return "Price unset";
  return `₹${n.toLocaleString("en-IN")}`;
}

export function countByStatus<T extends { status: string }>(
  rows: T[],
  status: string,
): number {
  return rows.filter((r) => r.status === status).length;
}

export function sumMoneyByStatus<T extends { status: string; amountValue: number }>(
  rows: T[],
  status: string,
): number {
  return rows
    .filter((r) => r.status === status)
    .reduce((sum, r) => sum + (Number.isFinite(r.amountValue) ? r.amountValue : 0), 0);
}

export type VenueKpiInput = {
  active: boolean;
  hostedBy: "NYTO" | "PARTNER";
};

export function venueNetworkKpis(venues: VenueKpiInput[]) {
  const active = venues.filter((v) => v.active);
  return {
    totalVenues: venues.length,
    nytoOrganized: venues.filter((v) => v.hostedBy === "NYTO").length,
    venueOrganized: venues.filter((v) => v.hostedBy === "PARTNER").length,
    activeVenues: active.length,
    activeNyto: active.filter((v) => v.hostedBy === "NYTO").length,
    activePartner: active.filter((v) => v.hostedBy === "PARTNER").length,
    inactiveVenues: venues.filter((v) => !v.active).length,
    totalLoaded: venues.length,
  };
}

export type BookingKpiInput = { status: string };

export function bookingFeedKpis(bookings: BookingKpiInput[]) {
  return {
    totalBookings: bookings.length,
    awaitingPayment: countByStatus(bookings, "PENDING_PAYMENT"),
    confirmed: countByStatus(bookings, "CONFIRMED"),
    cancelled: countByStatus(bookings, "CANCELLED"),
    attended: countByStatus(bookings, "ATTENDED"),
    noShow: countByStatus(bookings, "NO_SHOW"),
  };
}

export type GuestKpiInput = { status?: string; bookings: number };

/**
 * Guest cohorts from booking-record counts (any booking status counts).
 * Prefer `bookings` over status labels so KPIs stay mutually exclusive.
 */
export function guestHasBooked(g: GuestKpiInput): boolean {
  return Number.isFinite(g.bookings) && g.bookings > 0;
}

export function guestListKpis(guests: GuestKpiInput[]) {
  const hasBooked = guests.filter(guestHasBooked).length;
  const neverBooked = guests.filter((g) => !guestHasBooked(g)).length;
  return {
    guestAccounts: guests.length,
    hasBooked,
    neverBooked,
  };
}

export type TeamKpiInput = { status: string };

export function teamKpis(members: TeamKpiInput[]) {
  const activeAdmins = members.filter((m) => m.status === "ACTIVE").length;
  const pendingInvitations = members.filter((m) => m.status === "INVITED").length;
  return {
    activeAdmins,
    pendingInvitations,
    /** Explicit: active accounts + outstanding invites (not double-counting people). */
    teamSize: activeAdmins + pendingInvitations,
  };
}

export type HostKpiInput = { status: string };

export function hostApplicationKpis(apps: HostKpiInput[]) {
  return {
    awaitingReview: countByStatus(apps, "PENDING"),
    approved: countByStatus(apps, "APPROVED"),
    rejected: countByStatus(apps, "REJECTED"),
    withdrawn: countByStatus(apps, "WITHDRAWN"),
    totalLoaded: apps.length,
  };
}
