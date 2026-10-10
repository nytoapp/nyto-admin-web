"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/providers/auth-provider";

type State<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
};

/**
 * Fetch admin API data with the current access token.
 * When AUTH_MODE=mock, callers should short-circuit before using this.
 */
export function useAdminResource<T>(
  enabled: boolean,
  loader: (token: string) => Promise<T>,
  deps: unknown[] = [],
): State<T> {
  const { getToken } = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new ApiError("Session expired. Sign in again.", 401);
      const next = await loader(token);
      setData(next);
    } catch (err) {
      const message =
        err instanceof ApiError || err instanceof Error
          ? err.message
          : "Could not load data.";
      setError(message);
      setData(null);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, getToken, ...deps]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload };
}
