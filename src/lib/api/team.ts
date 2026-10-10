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

export async function inviteAdmin(
  token: string,
  body: { email: string; name: string },
) {
  return apiRequest<{ ok: true; member: TeamMember }>("/admin/team/invite", {
    method: "POST",
    token,
    body,
  });
}
