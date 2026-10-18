import { type ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-text-faint">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-display text-[30px] font-medium tracking-[-0.03em] text-ink sm:text-[36px]">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-text-muted">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="nyto-panel px-5 py-14 text-center sm:px-6 sm:py-16">
      <div className="mx-auto mb-4 h-px w-12 bg-border" />
      <h3 className="text-[17px] font-semibold tracking-[-0.02em] text-ink">
        {title}
      </h3>
      <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-text-muted">
        {description}
      </p>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-2xl bg-bg-soft ${className}`}
      aria-hidden
    />
  );
}

export function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="mb-4 rounded-xl border border-danger/25 bg-danger/8 px-4 py-3 text-[14px] text-danger">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p>{message}</p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="font-semibold underline-offset-2 hover:underline"
          >
            Try again
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  /** Soft left accent for hierarchy on dense dashboards */
  accent?: "accent" | "success" | "warning" | "neutral";
}) {
  const bar =
    accent === "success"
      ? "bg-success"
      : accent === "warning"
        ? "bg-warning"
        : accent === "neutral"
          ? "bg-border"
          : "bg-accent";
  return (
    <div className="nyto-panel relative overflow-hidden px-4 py-3.5 transition duration-200 hover:border-accent/30 sm:px-5 sm:py-4">
      <span
        className={`absolute inset-y-3 left-0 w-[3px] rounded-full ${bar} opacity-80`}
        aria-hidden
      />
      <p className="pl-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-faint">
        {label}
      </p>
      <p className="mt-1.5 pl-2 font-display text-[28px] font-medium tracking-[-0.03em] text-ink tabular-nums sm:text-[32px]">
        {value}
      </p>
      {hint ? (
        <p className="mt-1 pl-2 text-[12px] leading-snug text-text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
