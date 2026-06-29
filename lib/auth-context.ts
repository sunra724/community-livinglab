import { createServerSupabaseClient } from "@/lib/supabase/server";

export type PortalRole =
  | "anonymous"
  | "super_admin"
  | "admin"
  | "manager"
  | "facilitator"
  | "viewer"
  | "company_owner"
  | "youth_member";

export type UserContext = {
  isAuthenticated: boolean;
  canOperateProject: boolean;
  role: PortalRole;
  user: {
    id: string;
    email: string;
    name: string;
  } | null;
  projectRoles: Array<{
    projectId: string;
    role: string;
  }>;
  companyMemberships: Array<{
    companyId: string;
    role: string;
  }>;
  participantLinks: Array<{
    id: string;
    type: string;
    name: string;
    organization: string | null;
  }>;
};

const superAdminEmails = new Set(["soilabcoop@gmail.com", "sunra724@gmail.com"]);

export async function getCurrentUserContext(): Promise<UserContext> {
  let supabase;

  try {
    supabase = await createServerSupabaseClient();
  } catch {
    return anonymousContext();
  }

  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user?.email) {
    return anonymousContext();
  }

  const [profileResult, projectRolesResult, companyMembersResult, participantsResult] =
    await Promise.all([
      supabase.from("profiles").select("full_name,email").eq("id", user.id).maybeSingle(),
      supabase.from("user_project_roles").select("project_id,role").eq("user_id", user.id),
      supabase.from("company_members").select("company_id,role").eq("user_id", user.id),
      supabase
        .from("participants")
        .select("id,type,name,organization")
        .eq("user_id", user.id)
    ]);

  const email = user.email.toLowerCase();
  const projectRoles = (projectRolesResult.data ?? []).map((item) => ({
    projectId: String(item.project_id),
    role: String(item.role)
  }));
  const companyMemberships = (companyMembersResult.data ?? []).map((item) => ({
    companyId: String(item.company_id),
    role: String(item.role ?? "owner")
  }));
  const participantLinks = (participantsResult.data ?? []).map((item) => ({
    id: String(item.id),
    type: String(item.type),
    name: String(item.name ?? ""),
    organization: item.organization ? String(item.organization) : null
  }));
  const explicitProjectRole = pickProjectRole(projectRoles.map((item) => item.role));
  const role = resolveRole({
    email,
    explicitProjectRole,
    companyMemberships,
    participantLinks
  });

  return {
    isAuthenticated: true,
    canOperateProject: ["super_admin", "admin", "manager"].includes(role),
    role,
    user: {
      id: user.id,
      email,
      name:
        String(profileResult.data?.full_name ?? "").trim() ||
        String(user.user_metadata?.full_name ?? "").trim() ||
        email.split("@")[0]
    },
    projectRoles,
    companyMemberships,
    participantLinks
  };
}

export async function currentUserCanOperateProject() {
  const context = await getCurrentUserContext();
  return context.canOperateProject;
}

function anonymousContext(): UserContext {
  return {
    isAuthenticated: false,
    canOperateProject: false,
    role: "anonymous",
    user: null,
    projectRoles: [],
    companyMemberships: [],
    participantLinks: []
  };
}

function pickProjectRole(roles: string[]) {
  const priority = ["admin", "manager", "facilitator", "viewer"];
  return priority.find((role) => roles.includes(role)) ?? null;
}

function resolveRole(input: {
  email: string;
  explicitProjectRole: string | null;
  companyMemberships: UserContext["companyMemberships"];
  participantLinks: UserContext["participantLinks"];
}): PortalRole {
  if (superAdminEmails.has(input.email)) return "super_admin";
  if (input.explicitProjectRole === "admin") return "admin";
  if (input.explicitProjectRole === "manager") return "manager";
  if (input.explicitProjectRole === "facilitator") return "facilitator";
  if (input.companyMemberships.length > 0) return "company_owner";
  if (input.participantLinks.some((item) => item.type === "youth")) return "youth_member";
  if (input.explicitProjectRole === "viewer") return "viewer";
  return "viewer";
}
