const toneClass: Record<string, string> = {
  neutral: "bg-bg-soft text-text-muted border-border",
  accent: "bg-[var(--accent-wash)] text-accent border-accent/20",
  success: "bg-success/10 text-success border-success/20",
  warning: "bg-warning/10 text-warning border-warning/25",
  danger: "bg-danger/10 text-danger border-danger/20",
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
      className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[12px] font-semibold tracking-[0.01em] ${toneClass[tone]}`}
    >
      {children}
    </span>
  );
}

export function statusTone(status: string): keyof typeof toneClass {
  const s = status.toUpperCase();
  if (
    [
      "OPEN",
      "CONFIRMED",
      "CAPTURED",
      "PAID",
      "ACTIVE",
      "APPROVED",
      "ATTENDED",
      "REVEALED",
    ].includes(s)
  ) {
    return "success";
  }
  if (
    ["CANCELLED", "FAILED", "REFUNDED", "REJECTED", "NO_SHOW"].includes(s)
  ) {
    return "danger";
  }
  if (
    [
      "FULL",
      "PENDING_PAYMENT",
      "DRAFT",
      "CLOSED",
      "PENDING",
      "MATCHING",
      "AWAITING_REVIEW",
      "INVITED",
      "NEW",
    ].includes(s)
  ) {
    return "warning";
  }
  return "accent";
}
