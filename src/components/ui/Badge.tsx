const toneClass: Record<string, string> = {
  neutral: "bg-bg-soft text-text-muted border-border",
  accent: "bg-accent/15 text-accent-soft border-accent/30",
  success: "bg-success/15 text-success border-success/25",
  warning: "bg-warning/15 text-warning border-warning/25",
  danger: "bg-danger/15 text-danger border-danger/25",
};

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: keyof typeof toneClass;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold tracking-[0.01em] ${toneClass[tone]}`}
    >
      {children}
    </span>
  );
}

export function statusTone(
  status: string,
): keyof typeof toneClass {
  const s = status.toUpperCase();
  if (["OPEN", "CONFIRMED", "CAPTURED", "PAID", "ACTIVE"].includes(s)) {
    return "success";
  }
  if (["CANCELLED", "FAILED", "REFUNDED"].includes(s)) return "danger";
  if (["FULL", "PENDING_PAYMENT", "DRAFT", "CLOSED"].includes(s)) {
    return "warning";
  }
  return "accent";
}
