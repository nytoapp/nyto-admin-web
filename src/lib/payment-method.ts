import { paymentMethodLabel } from "@/lib/format";

/** Sentinel for null / empty / UNKNOWN method in filters. */
export const PAYMENT_METHOD_UNAVAILABLE = "NOT_AVAILABLE";

export type PaymentMethodFilter = "all" | string;

/**
 * Normalize API method for filtering.
 * Does not invent UPI/CARD — only groups missing/unknown as unavailable.
 */
export function paymentMethodFilterKey(
  method: string | null | undefined,
): string {
  const raw = (method ?? "").trim();
  if (!raw) return PAYMENT_METHOD_UNAVAILABLE;
  const upper = raw.toUpperCase();
  if (upper === "UNKNOWN") return PAYMENT_METHOD_UNAVAILABLE;
  return upper;
}

export function paymentMethodFilterLabel(key: string): string {
  if (key === "all") return "All methods";
  if (key === PAYMENT_METHOD_UNAVAILABLE) return "—";
  return paymentMethodLabel(key);
}

/**
 * Backend PaymentMethod enum is UPI | CARD | UNKNOWN.
 * Filter always offers UPI and Card only — missing/UNKNOWN methods are not a filter option.
 */
export const PAYMENT_METHOD_FILTER_CORE = ["UPI", "CARD"] as const;

export function collectPaymentMethodFilterOptions(
  rows: Array<{ method: string | null | undefined }> = [],
): { value: string; label: string }[] {
  void rows;
  return PAYMENT_METHOD_FILTER_CORE.map((value) => ({
    value,
    label: paymentMethodFilterLabel(value),
  }));
}

export function paymentMatchesMethodFilter(
  method: string | null | undefined,
  filter: PaymentMethodFilter,
): boolean {
  if (filter === "all") return true;
  return paymentMethodFilterKey(method) === filter;
}

export type BillTypeFilter = "all" | "ALL_INCLUSIVE" | "PAY_OWN_BILL";

export type PaymentListFilterable = {
  guest: string;
  venue: string;
  amount: string;
  when: string;
  providerRef: string | null;
  method: string | null;
  status: string;
  hostedBy: string;
  paymentType?: string | null;
};

export function filterPaymentRows<T extends PaymentListFilterable>(
  rows: T[],
  opts: {
    q?: string;
    status?: string;
    hostedBy?: string;
    method?: PaymentMethodFilter;
    billType?: BillTypeFilter;
  },
): T[] {
  const needle = (opts.q ?? "").trim().toLowerCase();
  const status = opts.status ?? "all";
  const hostedBy = opts.hostedBy ?? "all";
  const method = opts.method ?? "all";
  const billType = opts.billType ?? "all";

  return rows.filter((p) => {
    if (status !== "all" && p.status !== status) return false;
    if (hostedBy !== "all" && p.hostedBy !== hostedBy) return false;
    if (!paymentMatchesMethodFilter(p.method, method)) return false;
    if (
      billType !== "all" &&
      String(p.paymentType ?? "").toUpperCase() !== billType
    ) {
      return false;
    }
    if (!needle) return true;
    return [
      p.guest,
      p.venue,
      p.amount,
      p.when,
      p.providerRef,
      p.method,
      p.paymentType,
    ]
      .join(" ")
      .toLowerCase()
      .includes(needle);
  });
}
