"use client";

import {
  useRef,
  type ClipboardEvent,
  type KeyboardEvent,
  type ChangeEvent,
} from "react";

const LENGTH = 6;

export function OtpInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: LENGTH }, (_, i) => value[i] ?? "");

  function setAt(index: number, char: string) {
    const next = digits.map((d, i) => (i === index ? char : d));
    onChange(next.join("").slice(0, LENGTH));
  }

  function onDigitChange(index: number, e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, "");
    if (!raw) {
      setAt(index, "");
      return;
    }
    const chars = raw.split("");
    const next = [...digits];
    let cursor = index;
    for (const c of chars) {
      if (cursor >= LENGTH) break;
      next[cursor] = c;
      cursor += 1;
    }
    onChange(next.join("").slice(0, LENGTH));
    const focusTo = Math.min(cursor, LENGTH - 1);
    refs.current[focusTo]?.focus();
  }

  function onKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
      setAt(index - 1, "");
    }
    if (e.key === "ArrowLeft" && index > 0) refs.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < LENGTH - 1) {
      refs.current[index + 1]?.focus();
    }
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, LENGTH);
    if (!pasted) return;
    onChange(pasted);
    refs.current[Math.min(pasted.length, LENGTH) - 1]?.focus();
  }

  return (
    <div className="flex justify-between gap-2">
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          disabled={disabled}
          value={digit}
          onChange={(e) => onDigitChange(i, e)}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={onPaste}
          aria-label={`Digit ${i + 1}`}
          className="h-12 w-11 rounded-xl border border-border bg-bg-elevated text-center font-mono text-[18px] font-semibold text-ink outline-none transition duration-150 focus:border-accent focus:shadow-[0_0_0_4px_var(--ring)] disabled:opacity-50 sm:w-12"
        />
      ))}
    </div>
  );
}
