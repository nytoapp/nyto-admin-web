import {
  formatMoneyInr,
  formatSeats,
  formatWhen,
  guestName,
} from "@/lib/format";
import { resolveHostedBy, type HostedBy } from "@/lib/hosted-by";
import type {
  AdminBooking,
  AdminPayment,
  AdminTable,
  Venue,
  VenueMenu,
} from "@/lib/types";

export type BookingRow = {
  id: string;
  guest: string;
  /** Guest account id when present on the booking payload. */
  userId: string | null;
  phone: string;
  email: string;
  venue: string;
  venueId: string;
  area: string;
  when: string;
  /** ISO night start from `table.startsAt` when present; used for journey staging. */
  startsAtIso: string | null;
  seats: number;
  status: string;
  amount: string;
  amountValue: number | null;
  paymentId: string | null;
  paymentStatus: string | null;
  paymentMethod: string | null;
  paymentRef: string | null;
  checkInCode: string | null;
  bookingType: string | null;
  /** Night category — Weekly / Women-led / Couples / Singles */
  tableType: string | null;
  capacity: number | null;
  seatsLeft: number | null;
  hostedBy: HostedBy;
  cancelReason: string | null;
  createdAt: string | null;
  tableId: string | null;
  /** Menu/experience name when nested on the table payload. */
  experienceName: string | null;
  menuId: string | null;
  /** Seat-price inclusions from the scheduled night (table). */
  inclusions: string[];
  paymentType: string | null;
  seatPrice: number | null;
};

export type PaymentRow = {
  id: string;
  when: string;
  guest: string;
  amount: string;
  amountValue: number;
  venue: string;
  status: string;
  method: string | null;
  providerRef: string | null;
  bookingId: string | null;
  hostedBy: HostedBy;
};

export type SessionRow = {
  id: string;
  when: string;
  venue: string;
  venueId: string;
  price: string;
  seats: string;
  status: string;
  experience: string;
  hostedBy: HostedBy;
};

export type VenueRow = {
  id: string;
  name: string;
  area: string;
  city: string;
  address: string;
  /** Dining-night count from `_count.tables` when present; null if count unavailable. */
  tables: number | null;
  /** Contact/staff count from `_count.staff` when present; null if unavailable. */
  staff: number | null;
  active: boolean;
  /** Who organises nights here — NYTO or the venue. Never mixed. */
  hostedBy: HostedBy;
};

export function mapVenueRow(
  v: Venue & { hostedBy?: HostedBy | string | null },
): VenueRow {
  return {
    id: v.id,
    name: v.name,
    area: v.area || "—",
    city: v.city,
    address: v.address,
    tables: v._count ? v._count.tables : null,
    staff: v._count ? v._count.staff : null,
    active: v.isActive,
    hostedBy: resolveHostedBy(v.hostedBy),
  };
}

export function mapBookingRow(b: AdminBooking): BookingRow {
  const amount =
    b.amountPaid ??
    b.payment?.amount ??
    b.payment?.amountInr ??
    null;
  const inclusions = Array.isArray(b.table?.inclusions)
    ? b.table!.inclusions.filter((s) => typeof s === "string" && s.trim())
    : [];
  return {
    id: b.id,
    guest: guestName(b.user),
    userId: b.user?.id ?? null,
    phone: b.user?.phone || "—",
    email: b.user?.email || "—",
    venue: b.table?.venue?.name || "—",
    // Prefer scalar table.venueId (always on the booking table row).
    venueId: String(b.table?.venueId || b.table?.venue?.id || "").trim(),
    area: b.table?.venue?.area || "—",
    when: formatWhen(b.table?.startsAt),
    startsAtIso: b.table?.startsAt
      ? String(b.table.startsAt).trim() || null
      : null,
    seats: b.seatsBooked,
    status: b.status,
    amount: amount != null ? formatMoneyInr(amount) : "—",
    amountValue: amount != null ? Number(amount) : null,
    paymentId: b.payment?.id ?? null,
    paymentStatus: b.payment?.status ?? null,
    paymentMethod: b.payment?.method ?? null,
    paymentRef: b.payment?.providerRef ?? null,
    checkInCode: b.checkInCode ?? null,
    bookingType: b.bookingType ?? null,
    tableType: b.table?.tableType ?? null,
    capacity: b.table?.capacity ?? null,
    seatsLeft: b.table?.seatsLeft ?? null,
    // Hosted-by lives on the venue — table field is guest-API derived only.
    hostedBy: resolveHostedBy(
      b.table?.hostedBy ?? b.table?.venue?.hostedBy,
    ),
    cancelReason: b.cancelReason ?? null,
    createdAt: b.createdAt ?? null,
    tableId: b.table?.id != null ? String(b.table.id).trim() || null : null,
    experienceName: b.table?.menu?.name?.trim() || null,
    menuId: (() => {
      const raw = b.table?.menuId ?? b.table?.menu?.id ?? null;
      if (raw == null) return null;
      const s = String(raw).trim();
      return s.length > 0 ? s : null;
    })(),
    inclusions,
    paymentType: b.table?.paymentType ?? null,
    seatPrice: Number.isFinite(b.table?.seatPrice)
      ? (b.table!.seatPrice as number)
      : null,
  };
}

export function mapPaymentRow(p: AdminPayment): PaymentRow {
  const amountValue = p.amount ?? p.amountInr ?? 0;
  return {
    id: p.id,
    when: formatWhen(p.createdAt),
    guest: guestName(p.booking?.user),
    amount: formatMoneyInr(amountValue),
    amountValue,
    venue: p.booking?.table?.venue?.name || "—",
    status: p.status,
    method: p.method ?? null,
    providerRef: p.providerRef ?? null,
    bookingId: p.bookingId ?? p.booking?.id ?? null,
    hostedBy: resolveHostedBy(
      p.booking?.table?.hostedBy ?? p.booking?.table?.venue?.hostedBy,
    ),
  };
}

/** Display status for sessions: keep lifecycle truth, add FULL for sold-out OPEN. */
export function sessionDisplayStatus(t: AdminTable): string {
  if (t.status === "CANCELLED") return "CANCELLED";
  if (
    t.status === "MATCHING" ||
    t.status === "AWAITING_REVIEW" ||
    t.status === "APPROVED" ||
    t.status === "REVEALED" ||
    t.status === "COMPLETED"
  ) {
    return t.status;
  }
  if ((t.seatsLeft ?? Math.max(t.capacity, 0)) === 0) return "FULL";
  return t.status;
}

export function mapSessionRow(
  t: AdminTable & {
    venue?: { id: string; name: string } | null;
  },
): SessionRow {
  return {
    id: t.id,
    when: formatWhen(t.startsAt),
    venue: t.venue?.name || "—",
    venueId: t.venueId,
    price: formatMoneyInr(t.seatPrice),
    seats: formatSeats(t.seatsLeft, t.capacity),
    status: sessionDisplayStatus(t),
    experience: t.menu?.name || "—",
    hostedBy: resolveHostedBy(t.hostedBy),
  };
}

export function mapExperienceRow(m: VenueMenu) {
  return {
    id: m.id,
    name: m.name,
    description: m.description?.trim() || null,
    diet: m.dietaryType,
    cost: formatMoneyInr(m.costPerHead),
    costPerHead: m.costPerHead,
  };
}

export function priceTierFromLocalDatetime(value: string): "DAYTIME" | "EVENING" {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "EVENING";
  return d.getHours() >= 16 ? "EVENING" : "DAYTIME";
}

export function toIsoFromLocalDatetime(value: string): string {
  return new Date(value).toISOString();
}
