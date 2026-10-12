import {
  currencyLocale,
  loadConsoleSettings,
  type ConsoleSettings,
} from "@/lib/console-settings";

/** Human-facing labels for backend enums. */
const STATUS_LABELS: Record<string, string> = {
  OPEN: "Open",
  FULL: "Full",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
  DRAFT: "Draft",
  PENDING_PAYMENT: "Pending payment",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  ATTENDED: "Attended",
  NO_SHOW: "No-show",
  MATCHING: "Matching",
  AWAITING_REVIEW: "Awaiting review",
  APPROVED: "Approved",
  REVEALED: "Revealed",
  CAPTURED: "Captured",
  PAID: "Paid",
  FAILED: "Failed",
  REFUNDED: "Refunded",
  PENDING: "Pending",
  REJECTED: "Rejected",
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  NEW: "New",
  INVITED: "Invited",
  OWNER: "Owner",
  MANAGER: "Manager",
  STAFF: "Staff",
  ADMIN: "Admin",
  VEGETARIAN: "Vegetarian",
  NON_VEGETARIAN: "Non-vegetarian",
  VEGAN: "Vegan",
  UPI: "UPI",
  CARD: "Card",
  STUB: "Stub",
  RAZORPAY: "Razorpay",
};

export function statusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  const key = status.toUpperCase();
  if (STATUS_LABELS[key]) return STATUS_LABELS[key];
  return status
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function activeSettings(): ConsoleSettings {
  if (typeof window === "undefined") {
    return {
      city: "Hyderabad",
      timezone: "Asia/Kolkata",
      currency: "INR",
      timeFormat: "12h",
      defaultSeatPrice: 1299,
      defaultCapacity: 6,
      confirmDestructive: true,
      compactTables: false,
      highlightPending: true,
    };
  }
  return loadConsoleSettings();
}

export function formatMoneyInr(
  amount: number | string | null | undefined,
): string {
  return formatMoney(amount);
}

export function formatMoney(
  amount: number | string | null | undefined,
  currencyOverride?: ConsoleSettings["currency"],
): string {
  if (amount === null || amount === undefined || amount === "") return "—";
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (Number.isNaN(n)) return "—";
  const currency = currencyOverride ?? activeSettings().currency;
  return new Intl.NumberFormat(currencyLocale(currency), {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

/** e.g. 5 Dec · 8:00 PM (respects console timezone + 12/24h). */
export function formatWhen(
  value: string | Date | null | undefined,
): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  const settings = activeSettings();
  const date = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: settings.timezone,
  }).format(d);
  const time = new Intl.DateTimeFormat(
    settings.timeFormat === "24h" ? "en-GB" : "en-US",
    {
      hour: "numeric",
      minute: "2-digit",
      hour12: settings.timeFormat !== "24h",
      timeZone: settings.timezone,
    },
  ).format(d);
  return `${date} · ${time}`;
}

/** Seats left of capacity, e.g. "2 left · 6 seats" */
export function formatSeats(
  left: number | null | undefined,
  capacity: number,
): string {
  const open = left ?? capacity;
  return `${open} left · ${capacity} seats`;
}

export function guestName(user?: {
  fullName?: string | null;
  firstName?: string | null;
} | null): string {
  return user?.fullName || user?.firstName || "Guest";
}
