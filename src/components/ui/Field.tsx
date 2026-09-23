import {
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
  type SelectHTMLAttributes,
  type ReactNode,
} from "react";

export function Label({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1.5 block text-[12px] font-medium text-text-muted">
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
      className={`h-10 w-full rounded-[8px] border border-border bg-bg-elevated px-3 text-[13px] text-text outline-none transition placeholder:text-text-faint focus:border-accent focus:shadow-[0_0_0_3px_var(--ring)] ${className}`}
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
      className={`min-h-24 w-full rounded-[8px] border border-border bg-bg-elevated px-3 py-2 text-[13px] text-text outline-none placeholder:text-text-faint focus:border-accent ${className}`}
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
      className={`h-10 w-full rounded-[8px] border border-border bg-bg-elevated px-3 text-[13px] text-text outline-none transition focus:border-accent focus:shadow-[0_0_0_3px_var(--ring)] ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

export function FieldError({ message }: { message?: string | null }) {
  if (!message) return null;
  return <p className="mt-1.5 text-[12px] text-danger">{message}</p>;
}
