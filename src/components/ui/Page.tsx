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
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="nyto-panel px-4 py-4 transition duration-200 hover:border-accent/30 sm:px-5 sm:py-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-faint">
        {label}
      </p>
      <p className="mt-2 font-display text-[30px] font-medium tracking-[-0.03em] text-ink tabular-nums sm:text-[34px]">
        {value}
      </p>
      {hint ? (
        <p className="mt-1.5 text-[13px] text-text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
