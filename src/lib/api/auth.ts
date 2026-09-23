import { apiRequest } from "@/lib/api/client";
import type { AdminUser } from "@/lib/types";

export async function requestEmailOtp(email: string) {
  return apiRequest<{
    ok: true;
    otpSent: boolean;
    maskedEmail: string;
    expiresAt: string;
    resendAfterSeconds: number;
  }>("/auth/email/otp/request", {
    method: "POST",
    body: { email },
  });
}

export async function verifyEmailOtp(email: string, code: string) {
  return apiRequest<{
    ok: true;
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    user: AdminUser;
  }>("/auth/email/otp/verify", {
    method: "POST",
    body: { email, code },
  });
}

export async function refreshSession(refreshToken: string) {
  return apiRequest<{
    ok: true;
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }>("/auth/refresh", {
    method: "POST",
    body: { refreshToken },
  });
}

export async function fetchMe(token: string) {
  return apiRequest<{ ok: true; user: AdminUser }>("/auth/me", { token });
}

export async function accessCheck(token: string) {
  return apiRequest<{
    ok: true;
    surface: string;
    userId: string;
    role: string;
  }>("/admin/access-check", { token });
}

export async function logout(token: string | null, refreshToken: string | null) {
  if (!refreshToken) return;
  try {
    await apiRequest("/auth/logout", {
      method: "POST",
      token: token ?? undefined,
      body: { refreshToken },
    });
  } catch {
    // Ignore — local session is cleared either way.
  }
}
