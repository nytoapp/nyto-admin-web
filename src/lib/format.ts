/** Human-facing labels for backend enums. */
const STATUS_LABELS: Record<string, string> = {
  OPEN: "Open",
  FULL: "Full",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
  DRAFT: "Draft",
  PENDING_PAYMENT: "Awaiting payment",
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
  WITHDRAWN: "Withdrawn",
  INVITED: "Invited",
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  NEW: "New",
  OWNER: "Owner",
  MANAGER: "Manager",
  STAFF: "Staff",
  ADMIN: "Admin",
  VEGETARIAN: "Vegetarian",
  NON_VEGETARIAN: "Non-vegetarian",
  VEGAN: "Vegan",
  WEEKLY: "Weekly",
  WOMEN_LED: "Women-led",
  COUPLES: "Couples",
  SINGLES: "Singles",
  UPI: "UPI",
  CARD: "Card",
  UNKNOWN: "Unknown",
  STUB: "Stub",
  RAZORPAY: "Razorpay",
  ALL_INCLUSIVE: "All-inclusive",
  /** Guest-facing / ops label for PAY_OWN_BILL nights. */
  PAY_OWN_BILL: "Pay as you go",
  DAYTIME: "Daytime",
  EVENING: "Evening",
};

/** Payment method from API — never invent UPI/card when missing or UNKNOWN. */
export function paymentMethodLabel(
  method: string | null | undefined,
): string {
  const raw = (method ?? "").trim();
  if (!raw || raw.toUpperCase() === "UNKNOWN") return "—";
  return statusLabel(raw);
}

/** Night bill model: All-inclusive vs Pay as you go (PAY_OWN_BILL). */
export function billTypeLabel(
  paymentType: string | null | undefined,
): string | null {
  if (!paymentType?.trim()) return null;
  return statusLabel(paymentType);
}

const TIMEZONE = "Asia/Kolkata";

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

export function formatMoneyInr(
  amount: number | string | null | undefined,
): string {
  return formatMoney(amount);
}

/** INR only — Hyderabad launch. */
export function formatMoney(
  amount: number | string | null | undefined,
): string {
  if (amount === null || amount === undefined || amount === "") return "—";
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

/** e.g. 5 Dec · 20:00 (24h, Asia/Kolkata). */
export function formatWhen(
  value: string | Date | null | undefined,
): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  const date = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: TIMEZONE,
  }).format(d);
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TIMEZONE,
  }).format(d);
  return `${date} · ${time}`;
}

/** e.g. 5 Dec 2026 · 20:00 — use when year must be unambiguous. */
export function formatWhenWithYear(
  value: string | Date | null | undefined,
): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  const date = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: TIMEZONE,
  }).format(d);
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TIMEZONE,
  }).format(d);
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
