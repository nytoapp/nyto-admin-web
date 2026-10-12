import {
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
  type SelectHTMLAttributes,
  type ReactNode,
} from "react";

export function Label({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1.5 block text-[12px] font-semibold tracking-[0.02em] text-text-muted">
      {children}
    </label>
  );
}

export function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`h-11 w-full rounded-xl border border-border bg-bg-soft px-3.5 text-[14px] text-text outline-none transition placeholder:text-text-faint focus:border-accent focus:bg-bg-elevated focus:shadow-[0_0_0_4px_var(--ring)] ${className}`}
      {...props}
    />
  );
}

export function Textarea({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`min-h-24 w-full rounded-xl border border-border bg-bg-soft px-3.5 py-2.5 text-[14px] text-text outline-none transition placeholder:text-text-faint focus:border-accent focus:bg-bg-elevated focus:shadow-[0_0_0_4px_var(--ring)] ${className}`}
      {...props}
    />
  );
}

export function Select({
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`h-11 w-full rounded-xl border border-border bg-bg-soft px-3.5 text-[14px] text-text outline-none transition focus:border-accent focus:bg-bg-elevated focus:shadow-[0_0_0_4px_var(--ring)] ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

export function FieldError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p className="mt-2 text-[12px] font-medium text-danger" role="alert">
      {message}
    </p>
  );
}
