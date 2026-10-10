import type { AdminUser } from "@/lib/types";

/** UI-first mock auth — swap for real API when screens are done. */
export const MOCK_OTP = "123456";

const MOCK_USER: AdminUser = {
  id: "mock-admin",
  email: "admin@nyto.app",
  fullName: "NYTO Admin",
  role: "ADMIN",
};

function fakeToken(kind: "access" | "refresh") {
  const exp = Math.floor(Date.now() / 1000) + (kind === "access" ? 3600 : 86400 * 30);
  const payload = btoa(JSON.stringify({ sub: MOCK_USER.id, exp, kind }));
  return `mock.${payload}.sig`;
}

export async function mockRequestOtp(email: string) {
  await delay(450);
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) {
    throw new Error("Enter a valid work email.");
  }
  const [local, domain] = normalized.split("@");
  const masked = `${local.slice(0, 2)}•••@${domain}`;
  return { maskedEmail: masked };
}

export async function mockVerifyOtp(email: string, code: string) {
  await delay(550);
  if (code.trim() !== MOCK_OTP) {
    throw new Error("Invalid code. Use 123456 in UI mock mode.");
  }
  return {
    accessToken: fakeToken("access"),
    refreshToken: fakeToken("refresh"),
    user: { ...MOCK_USER, email: email.trim().toLowerCase() },
  };
}

export async function mockAccessCheck() {
  await delay(120);
  return { role: "ADMIN" as const, ok: true };
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function isMockAuth() {
  return process.env.NEXT_PUBLIC_AUTH_MODE !== "live";
}
