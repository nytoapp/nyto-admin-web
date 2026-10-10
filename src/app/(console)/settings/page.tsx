"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/Page";

const STORAGE_KEY = "nyto.admin.settings";

type ConsoleSettings = {
  city: string;
  timezone: string;
  currency: string;
};

const DEFAULTS: ConsoleSettings = {
  city: "Hyderabad",
  timezone: "Asia/Kolkata",
  currency: "INR",
};

function loadSettings(): ConsoleSettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<ConsoleSettings>;
    return {
      city: parsed.city || DEFAULTS.city,
      timezone: parsed.timezone || DEFAULTS.timezone,
      currency: parsed.currency || DEFAULTS.currency,
    };
  } catch {
    return DEFAULTS;
  }
}

export default function SettingsPage() {
  const [city, setCity] = useState(DEFAULTS.city);
  const [timezone, setTimezone] = useState(DEFAULTS.timezone);
  const [currency, setCurrency] = useState(DEFAULTS.currency);
  const [saved, setSaved] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const next = loadSettings();
    setCity(next.city);
    setTimezone(next.timezone);
    setCurrency(next.currency);
    setReady(true);
  }, []);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next: ConsoleSettings = {
      city: city.trim() || DEFAULTS.city,
      timezone,
      currency,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setCity(next.city);
    setSaved(true);
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Console defaults for formatting and ops context."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,28rem)_260px]">
        <form
          className="nyto-panel space-y-4 p-5 sm:p-6"
          onSubmit={onSubmit}
        >
          <div>
            <Label>Primary city</Label>
            <Input
              value={city}
              onChange={(e) => {
                setSaved(false);
                setCity(e.target.value);
              }}
              disabled={!ready}
            />
          </div>
          <div>
            <Label>Timezone</Label>
            <Select
              value={timezone}
              disabled={!ready}
              onChange={(e) => {
                setSaved(false);
                setTimezone(e.target.value);
              }}
            >
              <option value="Asia/Kolkata">Asia/Kolkata</option>
              <option value="Asia/Dubai">Asia/Dubai</option>
              <option value="UTC">UTC</option>
            </Select>
          </div>
          <div>
            <Label>Currency</Label>
            <Select
              value={currency}
              disabled={!ready}
              onChange={(e) => {
                setSaved(false);
                setCurrency(e.target.value);
              }}
            >
              <option value="INR">INR (₹)</option>
              <option value="USD">USD ($)</option>
            </Select>
          </div>
          <Button type="submit" disabled={!ready}>
            Save settings
          </Button>
          {saved ? (
            <p className="text-[13px] font-medium text-success">
              Saved in this browser.
            </p>
          ) : (
            <p className="text-[12px] text-text-faint">
              Local console prefs — shared org settings can come later if needed.
            </p>
          )}
        </form>

        <aside className="nyto-panel h-fit p-5 text-[14px] text-text-muted">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-faint">
            Later upgrades
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-4 leading-relaxed">
            <li>Feature flags</li>
            <li>Refund policies</li>
            <li>Brand / email templates</li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
