import { type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const styles: Record<Variant, string> = {
  primary:
    "bg-accent text-white shadow-[0_0_0_1px_rgba(61,110,255,0.4),0_8px_20px_rgba(43,92,232,0.25)] hover:bg-accent-deep disabled:opacity-45",
  secondary:
    "bg-bg-soft text-text border border-border hover:bg-bg-hover hover:border-accent-soft/40 disabled:opacity-45",
  ghost:
    "bg-transparent text-text-muted hover:text-text hover:bg-bg-soft disabled:opacity-45",
  danger:
    "bg-danger/10 text-danger border border-danger/25 hover:bg-danger/20 disabled:opacity-45",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`nyto-press inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3.5 text-[13px] font-semibold disabled:cursor-not-allowed ${styles[variant]} ${className}`}
      {...props}
    />
  );
}
