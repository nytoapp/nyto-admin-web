export const CONSOLE_SETTINGS_KEY = "nyto.admin.settings";

export type ConsoleSettings = {
  city: string;
  timezone: string;
  currency: "INR" | "USD" | "AED";
  timeFormat: "12h" | "24h";
  defaultSeatPrice: number;
  defaultCapacity: number;
  confirmDestructive: boolean;
  compactTables: boolean;
  highlightPending: boolean;
};

export const CONSOLE_SETTINGS_DEFAULTS: ConsoleSettings = {
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

function clampSettings(
  parsed: Partial<ConsoleSettings> | null | undefined,
): ConsoleSettings {
  const currency =
    parsed?.currency === "USD" || parsed?.currency === "AED"
      ? parsed.currency
      : "INR";
  const seat = Number(parsed?.defaultSeatPrice);
  const capacity = Number(parsed?.defaultCapacity);
  return {
    city: (parsed?.city || CONSOLE_SETTINGS_DEFAULTS.city).trim() || "Hyderabad",
    timezone: parsed?.timezone || CONSOLE_SETTINGS_DEFAULTS.timezone,
    currency,
    timeFormat: parsed?.timeFormat === "24h" ? "24h" : "12h",
    defaultSeatPrice:
      Number.isFinite(seat) && seat >= 0
        ? Math.round(seat)
        : CONSOLE_SETTINGS_DEFAULTS.defaultSeatPrice,
    defaultCapacity:
      Number.isFinite(capacity) && capacity >= 2 && capacity <= 12
        ? Math.round(capacity)
        : CONSOLE_SETTINGS_DEFAULTS.defaultCapacity,
    confirmDestructive:
      parsed?.confirmDestructive ?? CONSOLE_SETTINGS_DEFAULTS.confirmDestructive,
    compactTables:
      parsed?.compactTables ?? CONSOLE_SETTINGS_DEFAULTS.compactTables,
    highlightPending:
      parsed?.highlightPending ?? CONSOLE_SETTINGS_DEFAULTS.highlightPending,
  };
}

export function loadConsoleSettings(): ConsoleSettings {
  if (typeof window === "undefined") return CONSOLE_SETTINGS_DEFAULTS;
  try {
    const raw = window.localStorage.getItem(CONSOLE_SETTINGS_KEY);
    if (!raw) return CONSOLE_SETTINGS_DEFAULTS;
    return clampSettings(JSON.parse(raw) as Partial<ConsoleSettings>);
  } catch {
    return CONSOLE_SETTINGS_DEFAULTS;
  }
}

export function saveConsoleSettings(next: ConsoleSettings): ConsoleSettings {
  const clamped = clampSettings(next);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(CONSOLE_SETTINGS_KEY, JSON.stringify(clamped));
    applyConsoleSettings(clamped);
    window.dispatchEvent(
      new CustomEvent("nyto:console-settings", { detail: clamped }),
    );
  }
  return clamped;
}

/** Apply display prefs that affect global chrome (e.g. table density). */
export function applyConsoleSettings(settings: ConsoleSettings = loadConsoleSettings()) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.compactTables = settings.compactTables
    ? "true"
    : "false";
  document.documentElement.dataset.timeFormat = settings.timeFormat;
  document.documentElement.dataset.currency = settings.currency;
  document.documentElement.dataset.timezone = settings.timezone;
}

export function currencyLocale(currency: ConsoleSettings["currency"]): string {
  if (currency === "USD") return "en-US";
  if (currency === "AED") return "en-AE";
  return "en-IN";
}

/** Respects Settings → confirm cancel & refund. */
export function confirmDestructive(message: string): boolean {
  if (typeof window === "undefined") return true;
  const settings = loadConsoleSettings();
  if (!settings.confirmDestructive) return true;
  return window.confirm(message);
}
