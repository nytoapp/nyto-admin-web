import { describe, expect, it } from "vitest";
import { paymentMethodLabel } from "./format";
import {
  collectPaymentMethodFilterOptions,
  filterPaymentRows,
  PAYMENT_METHOD_UNAVAILABLE,
  paymentMatchesMethodFilter,
  paymentMethodFilterKey,
} from "./payment-method";

function pay(
  over: Partial<{
    guest: string;
    venue: string;
    amount: string;
    when: string;
    providerRef: string | null;
    method: string | null;
    status: string;
    hostedBy: string;
  }> = {},
) {
  return {
    guest: "Asha",
    venue: "Jubilee",
    amount: "₹1,299",
    when: "1 Oct",
    providerRef: null as string | null,
    method: "UPI" as string | null,
    status: "CAPTURED",
    hostedBy: "NYTO",
    ...over,
  };
}

describe("paymentMethodLabel", () => {
  it("renders available methods from the API", () => {
    expect(paymentMethodLabel("UPI")).toBe("UPI");
    expect(paymentMethodLabel("CARD")).toBe("Card");
  });

  it("shows a dash when method is missing or UNKNOWN", () => {
    expect(paymentMethodLabel(null)).toBe("—");
    expect(paymentMethodLabel("")).toBe("—");
    expect(paymentMethodLabel("UNKNOWN")).toBe("—");
  });
});

describe("payment method filter", () => {
  it("filters by a selected method", () => {
    const rows = [
      pay({ method: "UPI", guest: "Upi Guest" }),
      pay({ method: "CARD", guest: "Card Guest" }),
    ];
    expect(
      filterPaymentRows(rows, { method: "UPI" }).map((r) => r.guest),
    ).toEqual(["Upi Guest"]);
  });

  it("treats null and UNKNOWN as Not available for filtering", () => {
    expect(paymentMethodFilterKey(null)).toBe(PAYMENT_METHOD_UNAVAILABLE);
    expect(paymentMethodFilterKey("UNKNOWN")).toBe(PAYMENT_METHOD_UNAVAILABLE);
    expect(
      paymentMatchesMethodFilter(null, PAYMENT_METHOD_UNAVAILABLE),
    ).toBe(true);
    expect(
      paymentMatchesMethodFilter("UPI", PAYMENT_METHOD_UNAVAILABLE),
    ).toBe(false);
  });

  it("combines method filter with status and search", () => {
    const rows = [
      pay({ method: "UPI", status: "CAPTURED", guest: "Ananya" }),
      pay({ method: "UPI", status: "FAILED", guest: "Ananya Fail" }),
      pay({ method: "CARD", status: "CAPTURED", guest: "Rahul" }),
    ];
    expect(
      filterPaymentRows(rows, {
        method: "UPI",
        status: "CAPTURED",
        q: "Ananya",
      }).map((r) => r.guest),
    ).toEqual(["Ananya"]);
  });

  it("clears the method filter with all", () => {
    const rows = [
      pay({ method: "UPI" }),
      pay({ method: "CARD" }),
    ];
    expect(filterPaymentRows(rows, { method: "all" })).toHaveLength(2);
    expect(paymentMatchesMethodFilter("CARD", "all")).toBe(true);
  });

  it("always lists UPI and Card only — no Not available option", () => {
    const options = collectPaymentMethodFilterOptions([
      pay({ method: "UPI" }),
      pay({ method: null }),
    ]);
    expect(options.map((o) => o.value)).toEqual(["UPI", "CARD"]);
    expect(options.find((o) => o.value === "UPI")?.label).toBe("UPI");
    expect(options.find((o) => o.value === "CARD")?.label).toBe("Card");
  });
});
