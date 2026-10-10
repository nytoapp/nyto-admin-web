import { apiRequest } from "@/lib/api/client";

export type HostApplication = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | string;
  contactName: string;
  contactPhone?: string | null;
  contactEmail?: string | null;
  venueName?: string | null;
  venueType?: string | null;
  address?: string | null;
  city?: string | null;
  area?: string | null;
  businessDetails?: string | null;
  notes?: string | null;
  rejectionReason?: string | null;
  venueId?: string | null;
  createdAt: string;
  user?: {
    id: string;
    firstName?: string | null;
    fullName?: string | null;
    phone?: string | null;
    email?: string | null;
    role?: string;
  };
  venue?: {
    id: string;
    name: string;
    city: string;
    area?: string | null;
  } | null;
};

export async function listHostApplications(
  token: string,
  status: string = "PENDING",
) {
  const q = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiRequest<{ ok: true; applications: HostApplication[] }>(
    `/admin/host-applications${q}`,
    { token },
  );
}

export async function approveHostApplication(
  token: string,
  id: string,
  venueId?: string,
) {
  return apiRequest<{ ok: true; application: HostApplication }>(
    `/admin/host-applications/${id}/approve`,
    { method: "POST", token, body: { venueId } },
  );
}

export async function rejectHostApplication(
  token: string,
  id: string,
  reason?: string,
) {
  return apiRequest<{ ok: true; application: HostApplication }>(
    `/admin/host-applications/${id}/reject`,
    { method: "POST", token, body: { reason } },
  );
}
