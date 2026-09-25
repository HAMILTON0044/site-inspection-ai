import "server-only";

import { z } from "zod";
import { getCurrentUserContext, type CurrentUserProfile } from "@/lib/current-user";

export type ProjectOverview = {
  id: string;
  name: string;
  code: string;
  description: string;
  status: "ACTIVE" | "ARCHIVED";
  createdAt: string;
  memberCount: number;
  inspectionCount: number;
  openFindingCount: number;
};

export type ProjectMember = {
  id: string;
  email: string;
  displayName: string;
  role: "INSPECTOR" | "MANAGER";
  joinedAt: string;
};

export type ProjectDetail = ProjectOverview & {
  members: ProjectMember[];
  availableInspectors: Array<{
    id: string;
    email: string;
    displayName: string;
  }>;
};

export type ProjectQueryResult<T> =
  | { ok: true; data: T; currentUser: CurrentUserProfile }
  | { ok: false; status: 401 | 403 | 404 | 500; error: string };

type ProjectRow = {
  id: string;
  name: string;
  code: string;
  description: string;
  status: "ACTIVE" | "ARCHIVED";
  created_at: string;
};

type MembershipRow = {
  project_id: string;
  user_id: string;
  joined_at: string;
};

type InspectionRow = {
  id: string;
  project_id: string;
};

type FindingRow = {
  inspection_id: string;
  status: string;
};

type ProfileRow = {
  id: string;
  email: string;
  display_name: string;
  role: "INSPECTOR" | "MANAGER";
};

function countBy<T>(items: T[], key: (item: T) => string) {
  const result = new Map<string, number>();
  for (const item of items) {
    const itemKey = key(item);
    result.set(itemKey, (result.get(itemKey) ?? 0) + 1);
  }
  return result;
}

export async function getProjectOverview(): Promise<
  ProjectQueryResult<ProjectOverview[]>
> {
  const context = await getCurrentUserContext();
  if (!context.ok) {
    return {
      ok: false,
      status: context.status,
      error: context.status === 401 ? "请先登录。" : "当前账号不可用。",
    };
  }

  const { data: rawProjects, error: projectsError } = await context.supabase
    .from("projects")
    .select("id, name, code, description, status, created_at")
    .order("status")
    .order("name");

  if (projectsError) {
    console.error("Failed to load projects", projectsError);
    return { ok: false, status: 500, error: "无法读取项目。" };
  }

  const projects = (rawProjects ?? []) as ProjectRow[];
  if (projects.length === 0) {
    return { ok: true, data: [], currentUser: context.profile };
  }

  const projectIds = projects.map((project) => project.id);
  const [membersResult, inspectionsResult] = await Promise.all([
    context.supabase
      .from("project_members")
      .select("project_id, user_id, joined_at")
      .in("project_id", projectIds),
    context.supabase
      .from("inspections")
      .select("id, project_id")
      .in("project_id", projectIds)
      .in("status", ["SUBMITTED", "ARCHIVED"]),
  ]);

  if (membersResult.error || inspectionsResult.error) {
    console.error(
      "Failed to load project summaries",
      membersResult.error ?? inspectionsResult.error,
    );
    return { ok: false, status: 500, error: "无法读取项目统计。" };
  }

  const memberships = (membersResult.data ?? []) as MembershipRow[];
  const inspections = (inspectionsResult.data ?? []) as InspectionRow[];
  const inspectionIds = inspections.map((inspection) => inspection.id);
  const findingsResult =
    inspectionIds.length > 0
      ? await context.supabase
          .from("findings")
          .select("inspection_id, status")
          .in("inspection_id", inspectionIds)
          .neq("status", "CLOSED")
      : { data: [], error: null };

  if (findingsResult.error) {
    console.error("Failed to load project finding counts", findingsResult.error);
    return { ok: false, status: 500, error: "无法读取项目问题统计。" };
  }

  const findings = (findingsResult.data ?? []) as FindingRow[];
  const memberCounts = countBy(memberships, (membership) => membership.project_id);
  const inspectionCounts = countBy(inspections, (inspection) => inspection.project_id);
  const projectByInspection = new Map(
    inspections.map((inspection) => [inspection.id, inspection.project_id]),
  );
  const openFindingCounts = new Map<string, number>();
  for (const finding of findings) {
    const projectId = projectByInspection.get(finding.inspection_id);
    if (projectId) {
      openFindingCounts.set(projectId, (openFindingCounts.get(projectId) ?? 0) + 1);
    }
  }

  return {
    ok: true,
    currentUser: context.profile,
    data: projects.map((project) => ({
      id: project.id,
      name: project.name,
      code: project.code,
      description: project.description,
      status: project.status,
      createdAt: project.created_at,
      memberCount: memberCounts.get(project.id) ?? 0,
      inspectionCount: inspectionCounts.get(project.id) ?? 0,
      openFindingCount: openFindingCounts.get(project.id) ?? 0,
    })),
  };
}

export async function getProjectDetail(
  projectId: string,
): Promise<ProjectQueryResult<ProjectDetail>> {
  const idResult = z.uuid().safeParse(projectId);
  if (!idResult.success) {
    return { ok: false, status: 404, error: "项目不存在或无权查看。" };
  }

  const overviewResult = await getProjectOverview();
  if (!overviewResult.ok) return overviewResult;

  const project = overviewResult.data.find((item) => item.id === idResult.data);
  if (!project) {
    return { ok: false, status: 404, error: "项目不存在或无权查看。" };
  }

  const context = await getCurrentUserContext();
  if (!context.ok) {
    return { ok: false, status: context.status, error: "当前账号不可用。" };
  }

  const { data: rawMemberships, error: membershipsError } = await context.supabase
    .from("project_members")
    .select("project_id, user_id, joined_at")
    .eq("project_id", project.id)
    .order("joined_at");

  if (membershipsError) {
    console.error("Failed to load project members", membershipsError);
    return { ok: false, status: 500, error: "无法读取项目成员。" };
  }

  const memberships = (rawMemberships ?? []) as MembershipRow[];
  const memberIds = memberships.map((membership) => membership.user_id);
  const membersResult =
    memberIds.length > 0
      ? await context.supabase
          .from("profiles")
          .select("id, email, display_name, role")
          .in("id", memberIds)
      : { data: [], error: null };

  const candidatesResult =
    context.profile.role === "MANAGER"
      ? await context.supabase
          .from("profiles")
          .select("id, email, display_name, role")
          .eq("role", "INSPECTOR")
          .eq("is_active", true)
          .order("display_name")
      : { data: [], error: null };

  if (membersResult.error || candidatesResult.error) {
    console.error(
      "Failed to load project profiles",
      membersResult.error ?? candidatesResult.error,
    );
    return { ok: false, status: 500, error: "无法读取成员资料。" };
  }

  const profiles = new Map(
    ((membersResult.data ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]),
  );
  const existingIds = new Set(memberIds);

  return {
    ok: true,
    currentUser: context.profile,
    data: {
      ...project,
      members: memberships.flatMap((membership) => {
        const profile = profiles.get(membership.user_id);
        return profile
          ? [
              {
                id: profile.id,
                email: profile.email,
                displayName: profile.display_name,
                role: profile.role,
                joinedAt: membership.joined_at,
              },
            ]
          : [];
      }),
      availableInspectors: ((candidatesResult.data ?? []) as ProfileRow[])
        .filter((profile) => !existingIds.has(profile.id))
        .map((profile) => ({
          id: profile.id,
          email: profile.email,
          displayName: profile.display_name,
        })),
    },
  };
}
