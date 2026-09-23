"use client";

import { FormEvent, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/Button";
import { FieldError, Input, Label } from "@/components/ui/Field";

export default function LoginPage() {
  const { requestOtp, verifyOtp, error: authError } = useAuth();
  const [email, setEmail] = useState("admin@nyto.app");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [masked, setMasked] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onRequest(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await requestOtp(email);
      setMasked(res.maskedEmail);
      setStep("code");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send code.");
    } finally {
      setBusy(false);
    }
  }

  async function onVerify(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await verifyOtp(email, code);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Invalid code or not an admin account.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-20%] h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-accent/20 blur-[120px]" />
      </div>

      <div className="nyto-page relative w-full max-w-[420px]">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-[13px] font-bold text-white shadow-[0_10px_40px_rgba(61,110,255,0.45)]">
            N
          </div>
          <p className="text-[11px] font-semibold tracking-[0.22em] text-accent-soft">
            NYTO ADMIN
          </p>
          <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.03em]">
            Operations console
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-text-muted">
            Founder access only. Sign in with email OTP against the shared NYTO
            backend.
          </p>
        </div>

        <div className="nyto-panel p-6">
          {step === "email" ? (
            <form onSubmit={onRequest} className="space-y-4">
              <div>
                <Label>Work email</Label>
                <Input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@nyto.app"
                />
              </div>
              <FieldError message={error || authError} />
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Sending…" : "Continue with email"}
              </Button>
            </form>
          ) : (
            <form onSubmit={onVerify} className="space-y-4">
              <p className="text-[13px] text-text-muted">
                Enter the code sent to{" "}
                <span className="font-medium text-text">{masked}</span>
              </p>
              <div>
                <Label>One-time code</Label>
                <Input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="6-digit code"
                  className="tracking-[0.3em]"
                />
              </div>
              <FieldError message={error || authError} />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  disabled={busy}
                  onClick={() => {
                    setStep("email");
                    setCode("");
                    setError(null);
                  }}
                >
                  Back
                </Button>
                <Button type="submit" className="flex-1" disabled={busy}>
                  {busy ? "Verifying…" : "Enter console"}
                </Button>
              </div>
            </form>
          )}
        </div>

        <p className="mt-5 text-center text-[11px] text-text-faint">
          Founder access · email OTP
        </p>
      </div>
    </div>
  );
}
