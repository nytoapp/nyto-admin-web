"use client";

import { type ReactNode } from "react";

/** Shared Bookings-grade module chrome — use on every console page. */

export function ModuleHero({
  eyebrow,
  title,
  description,
  actions,
  stats,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  stats?: { label: string; value: string; soft?: boolean }[];
  children?: ReactNode;
}) {
  return (
    <div className="nyto-bookings-hero relative mb-8 overflow-hidden rounded-[22px] border border-border bg-bg-elevated shadow-[var(--shadow-md)]">
      <div
        className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-accent/15 blur-3xl nyto-drift"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-20 left-10 h-40 w-40 rounded-full bg-success/10 blur-3xl nyto-drift-slow"
        aria-hidden
      />
      <div className="relative z-[2] px-5 py-6 sm:px-7 sm:py-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 nyto-rise">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-faint">
              {eyebrow}
            </p>
            <h1 className="mt-2 font-display text-[34px] font-medium leading-none tracking-[-0.04em] text-ink sm:text-[40px]">
              {title}
            </h1>
            <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-text-muted">
              {description}
            </p>
          </div>
          {actions ? (
            <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
              {actions}
            </div>
          ) : null}
        </div>

        {stats && stats.length > 0 ? (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((s, i) => (
              <div
                key={s.label}
                className={`nyto-bookings-stat nyto-step-in rounded-xl border px-3.5 py-3 ${
                  s.soft
                    ? "border-border-subtle bg-bg/40"
                    : "border-accent/20 bg-[var(--accent-wash)]"
                }`}
                style={{ animationDelay: `${40 + i * 40}ms` }}
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-faint">
                  {s.label}
                </p>
                <p className="mt-1 font-display text-[26px] font-medium leading-none tracking-[-0.03em] text-ink">
                  {s.value}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        {children}
      </div>
    </div>
  );
}

export function ModuleFilters({ children }: { children: ReactNode }) {
  return (
    <div
      className="mb-4 rounded-2xl border border-border bg-bg-elevated/80 p-3 shadow-[var(--shadow-sm)] backdrop-blur-sm sm:p-3.5 nyto-rise"
      style={{ animationDelay: "60ms" }}
    >
      {children}
    </div>
  );
}

export function ModuleFeed({
  headers,
  children,
}: {
  headers?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className="overflow-hidden rounded-2xl border border-border bg-bg-elevated/50 shadow-[var(--shadow-sm)] nyto-rise"
      style={{ animationDelay: "100ms" }}
    >
      {headers}
      <ul>{children}</ul>
    </div>
  );
}

export function ModuleFeedRow({
  children,
  onClick,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  const base =
    "nyto-bookings-row group grid w-full grid-cols-1 gap-2.5 px-4 py-3.5 text-left hover:bg-bg-hover/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)] sm:px-5";

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${base} ${className}`}>
        {children}
      </button>
    );
  }

  return <div className={`${base} ${className}`}>{children}</div>;
}

export function ModulePill({
  active,
  onClick,
  label,
  count,
  title,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${
        active
          ? "bg-ink text-bg"
          : "bg-transparent text-text-muted hover:bg-bg-soft hover:text-text"
      }`}
    >
      {label}
      {count != null ? (
        <span
          className={`tabular-nums ${active ? "text-bg/70" : "text-text-faint"}`}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

export function ModuleChip({
  active,
  onClick,
  label,
  title,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold transition ${
        active
          ? "border-accent/40 bg-[var(--accent-wash)] text-accent-soft"
          : "border-border bg-bg text-text-muted hover:text-text"
      }`}
    >
      {label}
    </button>
  );
}

export function LiveBadge({
  label,
  pulse,
}: {
  label: string;
  pulse?: boolean;
}) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[11px] font-semibold tracking-[0.06em] transition ${
        pulse
          ? "border-accent/40 bg-[var(--accent-wash)] text-accent-soft"
          : "border-border bg-bg/60 text-text-faint backdrop-blur"
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${
          pulse ? "bg-accent nyto-live-dot" : "bg-text-faint"
        }`}
      />
      {label}
    </div>
  );
}
