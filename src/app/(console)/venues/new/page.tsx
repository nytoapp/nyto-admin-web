"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { FieldError, Input, Label, Select } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/Page";
import { ApiError } from "@/lib/api/client";
import { createVenue } from "@/lib/api/venues";
import type { HostedBy } from "@/lib/hosted-by";
import { useAuth } from "@/providers/auth-provider";

export default function NewVenuePage() {
  const router = useRouter();
  const { getToken, mockMode } = useAuth();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("Hyderabad");
  const [area, setArea] = useState("");
  const [hostedBy, setHostedBy] = useState<HostedBy>("NYTO");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !address.trim() || !city.trim()) {
      setError("Name, address, and city are required.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      if (mockMode) {
        await new Promise((r) => setTimeout(r, 400));
        router.push(hostedBy === "NYTO" ? "/venues/3" : "/venues/2");
        return;
      }
      const token = await getToken();
      if (!token) throw new ApiError("Session expired. Sign in again.", 401);
      const res = await createVenue(token, {
        name: name.trim(),
        address: address.trim(),
        city: city.trim(),
        area: area.trim() || undefined,
        isActive: true,
      });
      // hostedBy ships with backend later; route into venue detail for now.
      void hostedBy;
      router.push(`/venues/${res.venue.id}`);
    } catch (err) {
      setError(
        err instanceof ApiError || err instanceof Error
          ? err.message
          : "Could not create venue.",
      );
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Add venue"
        description="Create a place for NYTO curated or partner nights."
        actions={
          <Link href="/venues">
            <Button variant="ghost">Cancel</Button>
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,28rem)_260px]">
        <form onSubmit={onSubmit} className="nyto-panel space-y-4 p-5 sm:p-6">
          <div>
            <Label>Venue name</Label>
            <Input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="SkyGarden Madhapur"
              autoFocus
            />
          </div>
          <div>
            <Label>Address</Label>
            <Input
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street / landmark"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>City</Label>
              <Input
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>
            <div>
              <Label>Area</Label>
              <Input
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="Madhapur"
              />
            </div>
          </div>
          <div>
            <Label>Organised by</Label>
            <Select
              value={hostedBy}
              onChange={(e) => setHostedBy(e.target.value as HostedBy)}
            >
              <option value="NYTO">NYTO curated</option>
              <option value="PARTNER">Partner venue</option>
            </Select>
            <p className="mt-1.5 text-[12px] leading-relaxed text-text-faint">
              {hostedBy === "NYTO"
                ? "You’ll publish experiences and nights from admin."
                : "Venue publishes packages. NYTO takes a platform share."}
            </p>
          </div>
          <FieldError message={error} />
          <Button type="submit" disabled={busy}>
            {busy ? "Creating…" : "Create venue"}
          </Button>
        </form>

        <aside className="nyto-panel h-fit p-5 text-[14px] text-text-muted">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-faint">
            After create
          </p>
          <ol className="mt-3 list-decimal space-y-2 pl-4 leading-relaxed">
            <li>
              {hostedBy === "NYTO"
                ? "Publish a NYTO curated experience (categories, diet, schedule)"
                : "Wait for the venue to publish packages — view only in admin"}
            </li>
            <li>Add shift contacts (name, times, mobile)</li>
            <li>Track bookings & payments from the sidebar</li>
          </ol>
        </aside>
      </div>
    </div>
  );
}
