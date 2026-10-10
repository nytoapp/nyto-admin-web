"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ApiError } from "@/lib/api/client";
import { MOCK_OTP } from "@/lib/mock/auth";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/Button";
import { FieldError, Input, Label } from "@/components/ui/Field";
import { OtpInput } from "@/components/ui/OtpInput";

export default function LoginPage() {
  const { requestOtp, verifyOtp, error: authError, mockMode } = useAuth();
  const [email, setEmail] = useState("admin@nyto.app");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [masked, setMasked] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [pointer, setPointer] = useState({ x: 0.5, y: 0.4 });
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function onPointerMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = stageRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPointer({
      x: (e.clientX - r.left) / r.width,
      y: (e.clientY - r.top) / r.height,
    });
  }

  async function onRequest(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await requestOtp(email);
      setMasked(res.maskedEmail);
      setCode("");
      setStep("code");
    } catch (err) {
      setError(
        err instanceof ApiError || err instanceof Error
          ? err.message
          : "Could not send code.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function onVerify(e: FormEvent) {
    e.preventDefault();
    if (code.length < 6) {
      setError("Enter the 6-digit code.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await verifyOtp(email, code);
    } catch (err) {
      setError(
        err instanceof ApiError || err instanceof Error
          ? err.message
          : "Invalid code or not an admin account.",
      );
    } finally {
      setBusy(false);
    }
  }

  const parallaxX = (pointer.x - 0.5) * 18;
  const parallaxY = (pointer.y - 0.5) * 12;

  return (
    <div
      ref={stageRef}
      onMouseMove={onPointerMove}
      className="relative flex min-h-screen overflow-hidden bg-[#0a0c10]"
    >
      {/* Full-bleed cinematic hero */}
      <div className="absolute inset-0 lg:w-[54%]">
        <div
          className="absolute inset-[-4%] transition-transform duration-500 ease-out will-change-transform"
          style={{
            transform: `translate3d(${parallaxX}px, ${parallaxY}px, 0) scale(1.06)`,
          }}
        >
          <Image
            src="/brand/login-hero.jpg"
            alt=""
            fill
            priority
            className={`object-cover transition-opacity duration-1000 ${mounted ? "opacity-100" : "opacity-0"}`}
            sizes="(max-width: 1024px) 100vw, 54vw"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/55 to-black/35 lg:to-black/70" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40" />
        <div
          className="nyto-drift absolute -left-20 top-1/4 h-72 w-72 rounded-full bg-accent/25 blur-[100px]"
          aria-hidden
        />
      </div>

      {/* Brand copy over hero */}
      <aside className="relative z-10 hidden w-[54%] flex-col justify-between px-12 py-12 text-white lg:flex xl:px-16">
        <div
          className={mounted ? "nyto-rise" : "opacity-0"}
          style={{ animationDelay: "60ms" }}
        >
          <div className="inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 backdrop-blur-md">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-[11px] font-bold shadow-[0_8px_24px_rgba(21,94,239,0.45)]">
              N
            </span>
            <span className="pr-1 text-[11px] font-semibold tracking-[0.2em]">
              NYTO OPERATIONS
            </span>
          </div>
        </div>

        <div className="max-w-[480px] pb-6">
          <p
            className={`mb-4 text-[12px] font-semibold uppercase tracking-[0.22em] text-white/50 ${mounted ? "nyto-rise" : "opacity-0"}`}
            style={{ animationDelay: "140ms" }}
          >
            Founder console
          </p>
          <h1
            className={`font-display text-[52px] font-semibold leading-[1.02] tracking-[-0.05em] text-white ${mounted ? "nyto-rise" : "opacity-0"}`}
            style={{ animationDelay: "200ms" }}
          >
            The nights.
            <br />
            <span className="text-white/55">Under control.</span>
          </h1>
          <p
            className={`mt-6 max-w-[380px] text-[15px] leading-relaxed text-white/60 ${mounted ? "nyto-rise" : "opacity-0"}`}
            style={{ animationDelay: "280ms" }}
          >
            Venues, sessions, bookings, and payments in one place — built for
            the people running NYTO.
          </p>

          <div
            className={`mt-10 flex gap-8 border-t border-white/10 pt-6 ${mounted ? "nyto-rise" : "opacity-0"}`}
            style={{ animationDelay: "360ms" }}
          >
            {[
              ["8+", "venues"],
              ["Live", "sessions"],
              ["OTP", "secured"],
            ].map(([value, label]) => (
              <div key={label}>
                <p className="font-display text-[22px] font-semibold tracking-[-0.03em]">
                  {value}
                </p>
                <p className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-white/40">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Form column */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-5 py-12 lg:bg-[#f3f5f8]">
        <div
          className="pointer-events-none absolute inset-0 hidden lg:block"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(12,18,34,0.05) 1px, transparent 0)",
            backgroundSize: "22px 22px",
          }}
        />
        <div
          className="nyto-drift-slow pointer-events-none absolute right-[-10%] top-[-10%] hidden h-[420px] w-[420px] rounded-full bg-accent/10 blur-[100px] lg:block"
          aria-hidden
        />

        <div
          className={`relative w-full max-w-[400px] ${mounted ? "nyto-rise" : "opacity-0"}`}
          style={{ animationDelay: "220ms" }}
        >
          <div className="mb-8 lg:hidden">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/40 px-3 py-1.5 text-white backdrop-blur">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent text-[10px] font-bold">
                N
              </span>
              <span className="text-[10px] font-semibold tracking-[0.18em]">
                NYTO
              </span>
            </div>
            <h2 className="font-display text-[30px] font-semibold tracking-[-0.04em] text-white">
              Operations console
            </h2>
          </div>

          <div className="rounded-[20px] border border-border bg-white p-7 shadow-[0_30px_80px_-40px_rgba(12,18,34,0.45)] sm:p-8">
            <div className="mb-6">
              <p className="text-[11px] font-semibold tracking-[0.18em] text-accent">
                SIGN IN
              </p>
              <h2 className="mt-2 hidden font-display text-[28px] font-semibold tracking-[-0.04em] text-ink lg:block">
                {step === "email" ? "Welcome back" : "Enter your code"}
              </h2>
              <p className="mt-2 text-[13px] leading-relaxed text-text-muted">
                {step === "email"
                  ? "Continue with your founder email to open the console."
                  : `Code sent to ${masked}`}
              </p>
            </div>

            {step === "email" ? (
              <form key="email" onSubmit={onRequest} className="nyto-step-in space-y-5">
                <div>
                  <Label>Work email</Label>
                  <Input
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@nyto.app"
                    autoFocus
                    className="h-12"
                  />
                </div>
                <FieldError message={error || authError} />
                <Button type="submit" className="h-12 w-full text-[14px]" disabled={busy}>
                  {busy ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Sending…
                    </span>
                  ) : (
                    "Continue"
                  )}
                </Button>
              </form>
            ) : (
              <form key="code" onSubmit={onVerify} className="nyto-step-in space-y-5">
                <div>
                  <Label>One-time code</Label>
                  <OtpInput value={code} onChange={setCode} disabled={busy} />
                </div>
                <FieldError message={error || authError} />
                <div className="flex gap-2.5">
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-12 flex-1"
                    disabled={busy}
                    onClick={() => {
                      setStep("email");
                      setCode("");
                      setError(null);
                    }}
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    className="h-12 flex-[1.4] text-[14px]"
                    disabled={busy || code.length < 6}
                  >
                    {busy ? "Verifying…" : "Enter"}
                  </Button>
                </div>
              </form>
            )}
          </div>

          {mockMode ? (
            <p className="mt-5 text-center text-[12px] text-white/55 lg:text-text-faint">
              Mock mode · code{" "}
              <span className="font-mono font-semibold text-white/80 lg:text-text-muted">
                {MOCK_OTP}
              </span>
            </p>
          ) : (
            <p className="mt-5 text-center text-[12px] text-white/55 lg:text-text-faint">
              Email OTP · rotating sessions
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
