"use client";

const ACCESS = "nyto_admin_access";
const REFRESH = "nyto_admin_refresh";
const USER = "nyto_admin_user";

export type StoredSession = {
  accessToken: string;
  refreshToken: string;
  userJson: string;
};

export function saveSession(session: {
  accessToken: string;
  refreshToken: string;
  user: unknown;
}) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACCESS, session.accessToken);
  localStorage.setItem(REFRESH, session.refreshToken);
  localStorage.setItem(USER, JSON.stringify(session.user));
}

export function clearSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ACCESS);
  localStorage.removeItem(REFRESH);
  localStorage.removeItem(USER);
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH);
}

export function getStoredUser<T>(): T | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
