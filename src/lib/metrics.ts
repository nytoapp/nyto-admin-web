/**
 * NYTO Admin metric contract — labels and definitions shared across modules.
 * Backend aggregates in `/admin/overview` are authoritative for Overview KPIs.
 *
 * Units: never confuse venues ≠ nights ≠ bookings ≠ seats ≠ guests ≠ payment records ≠ INR.
 */

export const OVERVIEW_UPCOMING_DAYS = 30;

export type ModuleStat = {
  label: string;
  value: string;
  soft?: boolean;
  /** Short definition under the value (ModuleHero hint). */
  hint?: string;
  href?: string;
};

/** Canonical booking status → operator-facing label (backend enums unchanged). */
export const BOOKING_STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: "Awaiting payment",
  CONFIRMED: "Confirmed",
  CANCELLED: "Cancelled",
  ATTENDED: "Attended",
  NO_SHOW: "No-show",
};

/** Canonical payment status → operator-facing label. */
export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  CAPTURED: "Captured",
  REFUNDED: "Refunded",
  FAILED: "Failed",
};

export function bookingStatusLabel(status: string): string {
  return BOOKING_STATUS_LABEL[status] ?? status;
}

export function paymentStatusLabel(status: string): string {
  return PAYMENT_STATUS_LABEL[status] ?? status;
}
