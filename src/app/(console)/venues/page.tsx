"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { HostedByBadge, HostedByFilterBar } from "@/components/ui/HostedBy";
import {
  ModuleChip,
  ModuleFeed,
  ModuleFeedRow,
  ModuleFilters,
  ModuleHero,
} from "@/components/ui/ModuleShell";
import {
  EmptyState,
  ErrorBanner,
  Skeleton,
} from "@/components/ui/Page";
import { listTables } from "@/lib/api/tables";
import { listVenues } from "@/lib/api/venues";
import {
  EXPERIENCE_CATEGORIES,
  type ExperienceCategory,
} from "@/lib/categories";
import type { HostedBy, HostedByFilter } from "@/lib/hosted-by";
import { resolveHostedBy } from "@/lib/hosted-by";
import { useAdminResource } from "@/lib/hooks/useAdminResource";
import { venueNetworkKpis } from "@/lib/kpi";
import { mapVenueRow } from "@/lib/mappers";
import { MOCK_VENUES } from "@/lib/mock/data";
import type { NightPhaseFilter } from "@/lib/venue-experiences";
import {
  contactCountForVenue,
  loadVenueHostedBy,
} from "@/lib/venue-meta";
import { useAuth } from "@/providers/auth-provider";

type VenueListRow = {
  id: string;
  name: string;
  area: string;
  city: string;
  tables: number | null;
  active: boolean;
  hostedBy: HostedBy;
  contacts: number | null;
  categories: ExperienceCategory[];
  nightPhase: "upcoming" | "cancelled" | "none";
};

type CategoryFilter = "all" | ExperienceCategory;
type StatusFilter = "all" | "active" | "inactive";

function countLabel(value: number | null): string {
  if (value == null) return "—";
  return String(value);
}

export default function VenuesPage() {
  const router = useRouter();
  const { mockMode } = useAuth();
  const [q, setQ] = useState("");
  const [hostedBy, setHostedBy] = useState<HostedByFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [nightPhase, setNightPhase] = useState<NightPhaseFilter>("all");
  const [metaTick, setMetaTick] = useState(0);

  const { data, loading, error, reload } = useAdminResource(
    !mockMode,
    async (token) => {
      const [venuesRes, tablesRes] = await Promise.all([
        listVenues(token),
        listTables(token),
      ]);
      const nowMs = Date.now();
      const byVenue = new Map<
        string,
        { categories: Set<ExperienceCategory>; phase: VenueListRow["nightPhase"] }
      >();
      for (const t of tablesRes.tables) {
        const venueId = t.venueId || t.venue?.id;
        if (!venueId) continue;
        const cur = byVenue.get(venueId) ?? {
          categories: new Set<ExperienceCategory>(),
          phase: "none",
        };
        const tt = String(t.tableType ?? "").toUpperCase();
        if (
          tt === "WEEKLY" ||
          tt === "WOMEN_LED" ||
          tt === "COUPLES" ||
          tt === "SINGLES"
        ) {
          cur.categories.add(tt as ExperienceCategory);
        }
        const status = String(t.status ?? "").toUpperCase();
        const starts = new Date(t.startsAt).getTime();
        if (status === "CANCELLED") {
          if (cur.phase === "none") cur.phase = "cancelled";
        } else if (Number.isFinite(starts) && starts > nowMs) {
          cur.phase = "upcoming";
        }
        byVenue.set(venueId, cur);
      }
      return venuesRes.venues.map((v) => {
        const row = mapVenueRow(v);
        const meta = byVenue.get(row.id);
        return {
          ...row,
          liveCategories: meta
            ? ([...meta.categories] as ExperienceCategory[])
            : ([] as ExperienceCategory[]),
          liveNightPhase: (meta?.phase ?? "none") as VenueListRow["nightPhase"],
        };
      });
    },
  );

  useEffect(() => {
    const onFocus = () => setMetaTick((n) => n + 1);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const rows = useMemo(() => {
    void metaTick;
    return mockMode
      ? MOCK_VENUES.map((v) => ({
          id: v.id,
          name: v.name,
          area: v.area,
          city: v.city,
          tables: v.tables,
          active: v.active,
          hostedBy: loadVenueHostedBy(v.id) ?? (v.hostedBy as HostedBy),
          contacts: contactCountForVenue(v.id, v.staff),
          categories: [...v.categories] as ExperienceCategory[],
          nightPhase: (v.nightPhase === "present"
            ? "upcoming"
            : v.nightPhase === "upcoming"
              ? "upcoming"
              : v.nightPhase === "cancelled"
                ? "cancelled"
                : "none") as VenueListRow["nightPhase"],
        }))
      : (data ?? []).map((v) => ({
          id: v.id,
          name: v.name,
          area: v.area,
          city: v.city,
          tables: v.tables,
          active: v.active,
          hostedBy: resolveHostedBy(v.hostedBy),
          contacts: v.staff != null ? v.staff : 0,
          categories: v.liveCategories,
          nightPhase: v.liveNightPhase,
        }));
  }, [mockMode, data, metaTick]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((v) => {
      if (status === "active" && !v.active) return false;
      if (status === "inactive" && v.active) return false;
      if (hostedBy !== "all" && v.hostedBy !== hostedBy) return false;
      if (category !== "all" && !v.categories.includes(category)) return false;
      if (nightPhase !== "all" && v.nightPhase !== nightPhase) return false;
      if (!needle) return true;
      return [v.name, v.area, v.city].join(" ").toLowerCase().includes(needle);
    });
  }, [rows, q, hostedBy, status, category, nightPhase]);

  const network = venueNetworkKpis(
    rows.map((v) => ({ active: v.active, hostedBy: v.hostedBy })),
  );

  return (
    <div className="nyto-fade">
      <ModuleHero
        eyebrow="Operations"
        title="Venues"
        description="Manage venues and their dining nights."
        actions={
          <Link href="/venues/new">
            <Button>+ Add venue</Button>
          </Link>
        }
        stats={[
          {
            label: "Active venues",
            value:
              loading && !mockMode && !data
                ? "—"
                : String(network.activeVenues),
          },
          {
            label: "Active NYTO-organized",
            value:
              loading && !mockMode && !data
                ? "—"
                : String(network.activeNyto),
            soft: true,
          },
          {
            label: "Active Venue-organized",
            value:
              loading && !mockMode && !data
                ? "—"
                : String(network.activePartner),
            soft: true,
          },
        ]}
      />

      {error ? <ErrorBanner message={error} onRetry={() => void reload()} /> : null}

      <ModuleFilters>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1 lg:max-w-[280px]">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search venues..."
              aria-label="Search venues"
            />
          </div>
          <HostedByFilterBar value={hostedBy} onChange={setHostedBy} />
          <div
            className="flex rounded-xl border border-border bg-bg p-0.5"
            role="group"
            aria-label="Venue status"
          >
            {(
              [
                ["all", "All status"],
                ["active", "Active"],
                ["inactive", "Inactive"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setStatus(id)}
                className={`rounded-lg px-3.5 py-2 text-[13px] font-semibold transition ${
                  status === id
                    ? "bg-bg-soft text-ink"
                    : "text-text-muted hover:text-text"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-[13px] tabular-nums text-text-faint lg:ml-auto">
            {filtered.length}
            <span className="text-text-faint/70"> shown</span>
          </p>
        </div>

        <div
          className="mt-3 flex flex-wrap gap-1.5"
          role="group"
          aria-label="Experience category"
        >
          <ModuleChip
            active={category === "all"}
            onClick={() => setCategory("all")}
            label="Any type"
          />
          {EXPERIENCE_CATEGORIES.map((c) => (
            <ModuleChip
              key={c.id}
              active={category === c.id}
              onClick={() => setCategory(c.id)}
              label={c.label}
              title={c.hint}
            />
          ))}
        </div>

        <div
          className="mt-3 flex flex-wrap gap-1.5 border-t border-border-subtle pt-3"
          role="group"
          aria-label="Dining night phase"
        >
          {(
            [
              ["all", "Any night"],
              ["upcoming", "Upcoming"],
              ["cancelled", "Cancelled"],
            ] as const
          ).map(([id, label]) => (
            <ModuleChip
              key={id}
              active={nightPhase === id}
              onClick={() => setNightPhase(id)}
              label={label}
            />
          ))}
        </div>
      </ModuleFilters>

      {loading && !mockMode && !data ? (
        <div className="overflow-hidden rounded-2xl border border-border">
          <Skeleton className="h-[72px] rounded-none" />
          <Skeleton className="h-[72px] rounded-none opacity-70" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No venues match"
          description="Try another search or clear filters."
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setQ("");
                setHostedBy("all");
                setStatus("all");
                setCategory("all");
                setNightPhase("all");
              }}
            >
              Clear
            </Button>
          }
        />
      ) : (
        <ModuleFeed
          headers={
            <div className="hidden border-b border-border-subtle px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-faint lg:grid lg:grid-cols-[minmax(0,1.4fr)_minmax(140px,0.9fr)_88px_88px_88px_28px] lg:gap-3">
              <span>Venue</span>
              <span>Organized by</span>
              <span className="text-right">Dining nights</span>
              <span className="text-right">Contacts</span>
              <span className="text-right">Status</span>
              <span />
            </div>
          }
        >
          {filtered.map((v, i) => (
            <li
              key={v.id}
              className="nyto-step-in border-b border-border-subtle last:border-0"
              style={{ animationDelay: `${120 + Math.min(i, 10) * 40}ms` }}
            >
              <ModuleFeedRow
                onClick={() => router.push(`/venues/${v.id}`)}
                className="lg:grid-cols-[minmax(0,1.4fr)_minmax(140px,0.9fr)_88px_88px_88px_28px] lg:items-center lg:gap-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold tracking-[-0.02em] text-ink">
                    {v.name}
                  </p>
                  <p className="mt-1 truncate text-[12px] text-text-faint">
                    {v.area} · {v.city}
                  </p>
                  <div className="mt-1.5 lg:hidden">
                    <HostedByBadge value={v.hostedBy} short />
                  </div>
                </div>
                <div className="hidden min-w-0 lg:block">
                  <HostedByBadge value={v.hostedBy} short />
                </div>
                <p className="tabular-nums text-[13px] text-text-muted lg:text-right">
                  {countLabel(v.tables)}
                </p>
                <p className="tabular-nums text-[13px] text-text-muted lg:text-right">
                  {countLabel(v.contacts)}
                </p>
                <div className="lg:text-right">
                  <Badge tone={v.active ? "success" : "neutral"}>
                    {v.active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <span
                  className="nyto-bookings-arrow hidden text-[16px] text-text-faint lg:block lg:text-right"
                  aria-hidden
                >
                  →
                </span>
              </ModuleFeedRow>
            </li>
          ))}
        </ModuleFeed>
      )}
    </div>
  );
}
