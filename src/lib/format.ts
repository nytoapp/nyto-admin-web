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
  CAPTURED: "Captured",
  PAID: "Paid",
  FAILED: "Failed",
  REFUNDED: "Refunded",
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  ACTIVE: "Active",
  INACTIVE: "Inactive",
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

export function formatMoneyInr(
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

/** e.g. 5 Dec · 8:00 PM */
export function formatWhen(
  value: string | Date | null | undefined,
): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  const date = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(d);
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
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
