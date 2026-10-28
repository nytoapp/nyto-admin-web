import { apiRequest } from "@/lib/api/client";

export type AdminSupportTicket = {
  id: string;
  source: "VENUE" | "GUEST" | string;
  subject: string;
  category: string;
  message: string;
  status: "OPEN" | "IN_REVIEW" | "RESOLVED" | string;
  createdAt: string;
  venue?: {
    id: string;
    name: string;
    area?: string | null;
    city?: string | null;
  } | null;
  staff?: {
    id: string;
    fullName?: string | null;
    firstName?: string | null;
    email?: string | null;
  } | null;
  user?: {
    id: string;
    fullName?: string | null;
    firstName?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
};

export async function listSupportTickets(
  token: string,
  opts?: { status?: string; source?: string; category?: string },
) {
  const q = new URLSearchParams();
  if (opts?.status) q.set("status", opts.status);
  if (opts?.source) q.set("source", opts.source);
  if (opts?.category) q.set("category", opts.category);
  const suffix = q.toString() ? `?${q}` : "";
  return apiRequest<{ ok: true; tickets: AdminSupportTicket[] }>(
    `/admin/support${suffix}`,
    { token },
  );
}

export async function patchSupportTicket(
  token: string,
  id: string,
  status: "OPEN" | "IN_REVIEW" | "RESOLVED",
) {
  return apiRequest<{ ok: true; ticket: AdminSupportTicket }>(
    `/admin/support/${id}`,
    { method: "PATCH", token, body: { status } },
  );
}
