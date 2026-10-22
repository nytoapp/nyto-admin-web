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
  if (key === PAYMENT_METHOD_UNAVAILABLE) return "Not available";
  return paymentMethodLabel(key);
}

/** Options present in the loaded payment rows only — never invent methods. */
export function collectPaymentMethodFilterOptions(
  rows: Array<{ method: string | null | undefined }>,
): { value: string; label: string }[] {
  const keys = new Set<string>();
  for (const row of rows) {
    keys.add(paymentMethodFilterKey(row.method));
  }
  return [...keys]
    .sort((a, b) => {
      if (a === PAYMENT_METHOD_UNAVAILABLE) return 1;
      if (b === PAYMENT_METHOD_UNAVAILABLE) return -1;
      return paymentMethodFilterLabel(a).localeCompare(
        paymentMethodFilterLabel(b),
      );
    })
    .map((value) => ({
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

export type PaymentListFilterable = {
  guest: string;
  venue: string;
  amount: string;
  when: string;
  providerRef: string | null;
  method: string | null;
  status: string;
  hostedBy: string;
};

export function filterPaymentRows<T extends PaymentListFilterable>(
  rows: T[],
  opts: {
    q?: string;
    status?: string;
    hostedBy?: string;
    method?: PaymentMethodFilter;
  },
): T[] {
  const needle = (opts.q ?? "").trim().toLowerCase();
  const status = opts.status ?? "all";
  const hostedBy = opts.hostedBy ?? "all";
  const method = opts.method ?? "all";

  return rows.filter((p) => {
    if (status !== "all" && p.status !== status) return false;
    if (hostedBy !== "all" && p.hostedBy !== hostedBy) return false;
    if (!paymentMatchesMethodFilter(p.method, method)) return false;
    if (!needle) return true;
    return [p.guest, p.venue, p.amount, p.when, p.providerRef, p.method]
      .join(" ")
      .toLowerCase()
      .includes(needle);
  });
}
