"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  accessCheck,
  logout as apiLogout,
  refreshSession,
  verifyEmailOtp,
  requestEmailOtp,
} from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  saveSession,
} from "@/lib/auth-storage";
import {
  isMockAuth,
  mockAccessCheck,
  mockRequestOtp,
  mockVerifyOtp,
} from "@/lib/mock/auth";
import type { AdminUser } from "@/lib/types";

type AuthState = {
  ready: boolean;
  user: AdminUser | null;
  token: string | null;
  error: string | null;
  mockMode: boolean;
  requestOtp: (email: string) => Promise<{ maskedEmail: string }>;
  verifyOtp: (email: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  getToken: () => Promise<string | null>;
};

const AuthContext = createContext<AuthState | null>(null);
const REFRESH_SKEW_MS = 60_000;

function accessTokenNeedsRefresh(token: string): boolean {
  try {
    if (token.startsWith("mock.")) return false;
    const payload = token.split(".")[1];
    if (!payload) return true;
    const json = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/")),
    ) as { exp?: number };
    if (!json.exp) return true;
    return json.exp * 1000 <= Date.now() + REFRESH_SKEW_MS;
  } catch {
    return true;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AdminUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refreshInFlight = useRef<Promise<string | null> | null>(null);
  const userRef = useRef<AdminUser | null>(null);
  userRef.current = user;
  const mockMode = isMockAuth();

  const ensureAdmin = useCallback(async (accessToken: string, u: AdminUser) => {
    if (mockMode || accessToken.startsWith("mock.")) {
      await mockAccessCheck();
      setToken(accessToken);
      setUser({ ...u, role: "ADMIN" });
      return;
    }
    const check = await accessCheck(accessToken);
    if (check.role !== "ADMIN") {
      clearSession();
      throw new ApiError("This account is not an NYTO admin.", 403);
    }
    setToken(accessToken);
    setUser({ ...u, role: "ADMIN" });
  }, [mockMode]);

  const rotateSession = useCallback(async (): Promise<string | null> => {
    if (refreshInFlight.current) return refreshInFlight.current;

    refreshInFlight.current = (async () => {
      const refresh = getRefreshToken();
      if (!refresh) return null;
      if (mockMode || refresh.startsWith("mock.")) {
        const access = getAccessToken();
        return access;
      }
      try {
        const rotated = await refreshSession(refresh);
        const stored = getStoredUser<AdminUser>();
        saveSession({
          accessToken: rotated.accessToken,
          refreshToken: rotated.refreshToken,
          user: stored ?? userRef.current,
        });
        setToken(rotated.accessToken);
        return rotated.accessToken;
      } catch {
        clearSession();
        setUser(null);
        setToken(null);
        return null;
      } finally {
        refreshInFlight.current = null;
      }
    })();

    return refreshInFlight.current;
  }, [mockMode]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let access = getAccessToken();
        const refresh = getRefreshToken();
        const stored = getStoredUser<AdminUser>();
        if ((!access && !refresh) || !stored) {
          if (!cancelled) setReady(true);
          return;
        }
        if (!access || accessTokenNeedsRefresh(access)) {
          access = await rotateSession();
        }
        if (!access) {
          clearSession();
          return;
        }
        try {
          await ensureAdmin(access, stored);
        } catch {
          const rotated = await rotateSession();
          if (rotated) await ensureAdmin(rotated, stored);
          else {
            clearSession();
            if (!cancelled) {
              setUser(null);
              setToken(null);
            }
          }
        }
      } catch {
        clearSession();
        if (!cancelled) {
          setUser(null);
          setToken(null);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ensureAdmin, rotateSession]);

  useEffect(() => {
    if (!ready) return;
    // Only bounce away from login when already authenticated.
    // Unauthenticated console routes are gated by (console)/AppShell.
    if (user && pathname === "/login") {
      router.replace("/overview");
    }
  }, [ready, user, pathname, router]);

  const requestOtp = useCallback(async (email: string) => {
    setError(null);
    if (mockMode) return mockRequestOtp(email);
    const res = await requestEmailOtp(email.trim().toLowerCase());
    return { maskedEmail: res.maskedEmail };
  }, [mockMode]);

  const verifyOtp = useCallback(
    async (email: string, code: string) => {
      setError(null);
      const res = mockMode
        ? await mockVerifyOtp(email, code)
        : await verifyEmailOtp(email.trim().toLowerCase(), code.trim());
      saveSession({
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
        user: res.user,
      });
      try {
        // Navigate first so /login never paints inside the ops shell.
        router.replace("/overview");
        await ensureAdmin(res.accessToken, res.user);
      } catch (err) {
        clearSession();
        setUser(null);
        setToken(null);
        router.replace("/login");
        const message =
          err instanceof ApiError || err instanceof Error
            ? err.message
            : "Could not verify admin access.";
        setError(message);
        throw err;
      }
    },
    [ensureAdmin, mockMode, router],
  );

  const logout = useCallback(async () => {
    const access = getAccessToken();
    const refresh = getRefreshToken();
    if (!mockMode && refresh) {
      try {
        await apiLogout(access, refresh);
      } catch {
        /* ignore network errors on sign-out */
      }
    }
    clearSession();
    // Do NOT setUser(null) first — that paints a "Signing out…" shell flash.
    // Hard navigate with session already cleared; login remounts clean.
    window.location.href = "/login";
  }, [mockMode]);

  const getToken = useCallback(async () => {
    const access = getAccessToken();
    if (access && !accessTokenNeedsRefresh(access)) return access;
    return rotateSession();
  }, [rotateSession]);

  const value = useMemo(
    () => ({
      ready,
      user,
      token,
      error,
      mockMode,
      requestOtp,
      verifyOtp,
      logout,
      getToken,
    }),
    [ready, user, token, error, mockMode, requestOtp, verifyOtp, logout, getToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
