import { apiRequest } from "@/lib/api/client";

export type TeamMember = {
  id: string;
  name: string;
  email?: string | null;
  role: string;
  status: "ACTIVE" | "INVITED" | string;
};

export async function listTeam(token: string) {
  return apiRequest<{ ok: true; members: TeamMember[] }>("/admin/team", {
    token,
  });
}

export type DeliveryNotification = {
  emailDelivered: boolean;
  deliveryMode: string;
  nextStep: string;
};

export async function inviteAdmin(
  token: string,
  body: { email: string; name: string },
) {
  return apiRequest<{
    ok: true;
    member: TeamMember;
    notification?: DeliveryNotification;
  }>("/admin/team/invite", {
    method: "POST",
    token,
    body,
  });
}

export async function revokeAdmin(token: string, userId: string) {
  return apiRequest<{ ok: true; member: TeamMember }>(
    `/admin/team/${userId}/revoke`,
    { method: "POST", token, body: {} },
  );
}
