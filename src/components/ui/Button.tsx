import { type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const styles: Record<Variant, string> = {
  primary:
    "bg-accent text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_10px_28px_-10px_rgba(77,139,255,0.55)] hover:bg-accent-deep disabled:opacity-45",
  secondary:
    "bg-bg-soft text-text border border-border hover:bg-bg-hover hover:border-accent/35 disabled:opacity-45",
  ghost:
    "bg-transparent text-text-muted hover:text-text hover:bg-bg-soft disabled:opacity-45",
  danger:
    "bg-danger/10 text-danger border border-danger/25 hover:bg-danger/16 disabled:opacity-45",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`nyto-press inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-[13px] font-semibold tracking-[-0.01em] disabled:cursor-not-allowed ${styles[variant]} ${className}`}
      {...props}
    />
  );
}
