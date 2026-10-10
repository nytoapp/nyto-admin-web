"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { FieldError, Input, Label } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/Page";
import { ApiError } from "@/lib/api/client";
import { createVenue } from "@/lib/api/venues";
import { useAuth } from "@/providers/auth-provider";

export default function NewVenuePage() {
  const router = useRouter();
  const { getToken, mockMode } = useAuth();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("Hyderabad");
  const [area, setArea] = useState("");
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
        router.push("/venues/1");
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
        description="Create a place NYTO can host nights."
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
            <li>Add an experience (menu package)</li>
            <li>Create a session night</li>
            <li>Assign venue staff if needed</li>
          </ol>
        </aside>
      </div>
    </div>
  );
}
