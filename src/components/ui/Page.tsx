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
    <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-faint">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-[26px] font-semibold tracking-[-0.03em] text-text">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-text-muted">
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
    <div className="nyto-panel px-6 py-16 text-center">
      <div className="mx-auto mb-4 h-px w-10 bg-border" />
      <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-text">
        {title}
      </h3>
      <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-text-muted">
        {description}
      </p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-bg-soft ${className}`}
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
    <div className="mb-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-[13px] text-danger">
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
    <div className="nyto-panel px-4 py-4 transition duration-150 hover:border-accent/25">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-faint">
        {label}
      </p>
      <p className="mt-2 text-[28px] font-semibold tracking-[-0.03em] tabular-nums">
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-[12px] text-text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
