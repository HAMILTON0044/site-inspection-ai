import "server-only";

import { z } from "zod";
import { getCurrentUserContext, type CurrentUserProfile } from "@/lib/current-user";

export type FindingStatus =
  | "OPEN"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "AWAITING_VERIFICATION"
  | "CLOSED"
  | "REOPENED";

export type FindingRisk =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL"
  | "UNCONFIRMED";

export type FindingDashboardItem = {
  id: string;
  title: string;
  category: string;
  riskLevel: FindingRisk;
  status: FindingStatus;
  assigneeId: string | null;
  assigneeName: string | null;
  dueAt: string | null;
  isOverdue: boolean;
  createdAt: string;
  inspectionId: string;
  inspectionNumber: string;
  projectId: string;
  projectName: string;
  projectCode: string;
  location: string;
  followUpCount: number;
};

export type FindingEventDetail = {
  id: string;
  actorName: string;
  eventType: string;
  fromStatus: FindingStatus | null;
  toStatus: FindingStatus | null;
  comment: string | null;
  createdAt: string;
};

export type FollowUpPhotoDetail = {
  id: string;
  originalFileName: string;
  signedUrl: string | null;
};

export type FindingFollowUpDetail = {
  id: string;
  authorName: string;
  comment: string;
  createdAt: string;
  photos: FollowUpPhotoDetail[];
};

export type FindingDetail = FindingDashboardItem & {
  description: string;
  visibleEvidence: string;
  correctiveAction: string;
  uncertainty: string[];
  origin: string;
  modifiedByHuman: boolean;
  inspectorName: string;
  events: FindingEventDetail[];
  followUps: FindingFollowUpDetail[];
  projectMembers: Array<{
    id: string;
    displayName: string;
    email: string;
  }>;
};

export type FindingQueryResult<T> =
  | { ok: true; data: T; currentUser: CurrentUserProfile }
  | { ok: false; status: 401 | 403 | 404 | 500; error: string };

type FindingRow = {
  id: string;
  inspection_id: string;
  category: string;
  title: string;
  description: string;
  visible_evidence: string;
  risk_level: FindingRisk;
  corrective_action: string;
  uncertainty: string[];
  origin: string;
  modified_by_human: boolean;
  status: FindingStatus;
  assignee_id: string | null;
  due_at: string | null;
  created_at: string;
};

type InspectionRow = {
  id: string;
  project_id: string;
  inspection_number: string;
  created_by: string;
  location: string;
};

type ProjectRow = {
  id: string;
  name: string;
  code: string;
};

type ProfileRow = {
  id: string;
  email: string;
  display_name: string;
};

type FollowUpRow = {
  id: string;
  finding_id: string;
  author_id: string;
  comment: string;
  created_at: string;
};

type FollowUpPhotoRow = {
  id: string;
  follow_up_id: string;
  storage_key: string;
  original_file_name: string;
};

type EventRow = {
  id: string;
  actor_id: string;
  event_type: string;
  from_status: FindingStatus | null;
  to_status: FindingStatus | null;
  comment: string | null;
  created_at: string;
};

function toDashboardItem(
  finding: FindingRow,
  inspection: InspectionRow,
  project: ProjectRow | undefined,
  profiles: Map<string, ProfileRow>,
  followUpCount: number,
): FindingDashboardItem {
  return {
    id: finding.id,
    title: finding.title,
    category: finding.category,
    riskLevel: finding.risk_level,
    status: finding.status,
    assigneeId: finding.assignee_id,
    assigneeName: finding.assignee_id
      ? (profiles.get(finding.assignee_id)?.display_name ?? "未知负责人")
      : null,
    dueAt: finding.due_at,
    isOverdue:
      finding.status !== "CLOSED" &&
      finding.due_at !== null &&
      new Date(finding.due_at).getTime() < Date.now(),
    createdAt: finding.created_at,
    inspectionId: inspection.id,
    inspectionNumber: inspection.inspection_number,
    projectId: inspection.project_id,
    projectName: project?.name ?? "未知项目",
    projectCode: project?.code ?? "—",
    location: inspection.location,
    followUpCount,
  };
}

export async function getFindingDashboard(): Promise<
  FindingQueryResult<FindingDashboardItem[]>
> {
  const context = await getCurrentUserContext();
  if (!context.ok) {
    return {
      ok: false,
      status: context.status,
      error: context.status === 401 ? "请先登录。" : "当前账号不可用。",
    };
  }

  const { data: rawInspections, error: inspectionsError } = await context.supabase
    .from("inspections")
    .select("id, project_id, inspection_number, created_by, location")
    .in("status", ["SUBMITTED", "ARCHIVED"]);

  if (inspectionsError) {
    console.error("Failed to load finding inspections", inspectionsError);
    return { ok: false, status: 500, error: "无法读取正式巡检。" };
  }

  const inspections = (rawInspections ?? []) as InspectionRow[];
  if (inspections.length === 0) {
    return { ok: true, data: [], currentUser: context.profile };
  }

  const inspectionIds = inspections.map((inspection) => inspection.id);
  const { data: rawFindings, error: findingsError } = await context.supabase
    .from("findings")
    .select(
      "id, inspection_id, category, title, description, visible_evidence, risk_level, corrective_action, uncertainty, origin, modified_by_human, status, assignee_id, due_at, created_at",
    )
    .in("inspection_id", inspectionIds)
    .order("created_at", { ascending: false });

  if (findingsError) {
    console.error("Failed to load finding dashboard", findingsError);
    return { ok: false, status: 500, error: "无法读取问题看板。" };
  }

  const findings = (rawFindings ?? []) as FindingRow[];
  if (findings.length === 0) {
    return { ok: true, data: [], currentUser: context.profile };
  }

  const projectIds = [...new Set(inspections.map((inspection) => inspection.project_id))];
  const profileIds = [
    ...new Set([
      ...inspections.map((inspection) => inspection.created_by),
      ...findings.flatMap((finding) => (finding.assignee_id ? [finding.assignee_id] : [])),
    ]),
  ];
  const findingIds = findings.map((finding) => finding.id);

  const [projectsResult, profilesResult, followUpsResult] = await Promise.all([
    context.supabase.from("projects").select("id, name, code").in("id", projectIds),
    profileIds.length > 0
      ? context.supabase
          .from("profiles")
          .select("id, email, display_name")
          .in("id", profileIds)
      : Promise.resolve({ data: [], error: null }),
    context.supabase
      .from("finding_follow_ups")
      .select("finding_id")
      .in("finding_id", findingIds),
  ]);

  const relatedError = projectsResult.error ?? profilesResult.error ?? followUpsResult.error;
  if (relatedError) {
    console.error("Failed to load finding dashboard relations", relatedError);
    return { ok: false, status: 500, error: "无法读取问题关联数据。" };
  }

  const inspectionMap = new Map(inspections.map((inspection) => [inspection.id, inspection]));
  const projectMap = new Map(
    ((projectsResult.data ?? []) as ProjectRow[]).map((project) => [project.id, project]),
  );
  const profileMap = new Map(
    ((profilesResult.data ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]),
  );
  const followUpCounts = new Map<string, number>();
  for (const followUp of (followUpsResult.data ?? []) as Array<{ finding_id: string }>) {
    followUpCounts.set(followUp.finding_id, (followUpCounts.get(followUp.finding_id) ?? 0) + 1);
  }

  return {
    ok: true,
    currentUser: context.profile,
    data: findings.flatMap((finding) => {
      const inspection = inspectionMap.get(finding.inspection_id);
      return inspection
        ? [
            toDashboardItem(
              finding,
              inspection,
              projectMap.get(inspection.project_id),
              profileMap,
              followUpCounts.get(finding.id) ?? 0,
            ),
          ]
        : [];
    }),
  };
}

export async function getFindingDetail(
  findingId: string,
): Promise<FindingQueryResult<FindingDetail>> {
  const idResult = z.uuid().safeParse(findingId);
  if (!idResult.success) {
    return { ok: false, status: 404, error: "问题不存在或无权查看。" };
  }

  const context = await getCurrentUserContext();
  if (!context.ok) {
    return {
      ok: false,
      status: context.status,
      error: context.status === 401 ? "请先登录。" : "当前账号不可用。",
    };
  }

  const { data: rawFinding, error: findingError } = await context.supabase
    .from("findings")
    .select(
      "id, inspection_id, category, title, description, visible_evidence, risk_level, corrective_action, uncertainty, origin, modified_by_human, status, assignee_id, due_at, created_at",
    )
    .eq("id", idResult.data)
    .maybeSingle();

  if (findingError) {
    console.error("Failed to load finding", findingError);
    return { ok: false, status: 500, error: "无法读取问题详情。" };
  }
  if (!rawFinding) {
    return { ok: false, status: 404, error: "问题不存在或无权查看。" };
  }

  const finding = rawFinding as FindingRow;
  const { data: rawInspection, error: inspectionError } = await context.supabase
    .from("inspections")
    .select("id, project_id, inspection_number, created_by, location, status")
    .eq("id", finding.inspection_id)
    .in("status", ["SUBMITTED", "ARCHIVED"])
    .maybeSingle();

  if (inspectionError) {
    console.error("Failed to load finding inspection", inspectionError);
    return { ok: false, status: 500, error: "无法读取所属巡检。" };
  }
  if (!rawInspection) {
    return { ok: false, status: 404, error: "问题不存在或无权查看。" };
  }

  const inspection = rawInspection as InspectionRow & { status: string };
  const [projectResult, eventsResult, followUpsResult, membershipsResult] =
    await Promise.all([
      context.supabase
        .from("projects")
        .select("id, name, code")
        .eq("id", inspection.project_id)
        .maybeSingle(),
      context.supabase
        .from("finding_events")
        .select("id, actor_id, event_type, from_status, to_status, comment, created_at")
        .eq("finding_id", finding.id)
        .order("created_at"),
      context.supabase
        .from("finding_follow_ups")
        .select("id, finding_id, author_id, comment, created_at")
        .eq("finding_id", finding.id)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("project_members")
        .select("user_id")
        .eq("project_id", inspection.project_id),
    ]);

  const relatedError =
    projectResult.error ?? eventsResult.error ?? followUpsResult.error ?? membershipsResult.error;
  if (relatedError) {
    console.error("Failed to load finding relations", relatedError);
    return { ok: false, status: 500, error: "无法读取问题关联数据。" };
  }

  const events = (eventsResult.data ?? []) as EventRow[];
  const followUps = (followUpsResult.data ?? []) as FollowUpRow[];
  const memberIds = (membershipsResult.data ?? []).map((row) => row.user_id as string);
  const profileIds = [
    ...new Set([
      inspection.created_by,
      ...memberIds,
      ...events.map((event) => event.actor_id),
      ...followUps.map((followUp) => followUp.author_id),
      ...(finding.assignee_id ? [finding.assignee_id] : []),
    ]),
  ];
  const followUpIds = followUps.map((followUp) => followUp.id);

  const [profilesResult, photosResult] = await Promise.all([
    profileIds.length > 0
      ? context.supabase
          .from("profiles")
          .select("id, email, display_name")
          .in("id", profileIds)
      : Promise.resolve({ data: [], error: null }),
    followUpIds.length > 0
      ? context.supabase
          .from("follow_up_photos")
          .select("id, follow_up_id, storage_key, original_file_name")
          .in("follow_up_id", followUpIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (profilesResult.error || photosResult.error) {
    console.error(
      "Failed to load finding participants",
      profilesResult.error ?? photosResult.error,
    );
    return { ok: false, status: 500, error: "无法读取问题参与人员。" };
  }

  const profiles = new Map(
    ((profilesResult.data ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]),
  );
  const photos = (photosResult.data ?? []) as FollowUpPhotoRow[];
  const signedUrls = new Map<string, string | null>();
  await Promise.all(
    photos.map(async (photo) => {
      const { data, error } = await context.supabase.storage
        .from("inspection-photos")
        .createSignedUrl(photo.storage_key, 600);
      if (error) {
        console.error("Failed to sign follow-up photo", {
          photoId: photo.id,
          message: error.message,
        });
      }
      signedUrls.set(photo.id, data?.signedUrl ?? null);
    }),
  );

  const project = projectResult.data as ProjectRow | null;
  const dashboardItem = toDashboardItem(
    finding,
    inspection,
    project ?? undefined,
    profiles,
    followUps.length,
  );

  return {
    ok: true,
    currentUser: context.profile,
    data: {
      ...dashboardItem,
      description: finding.description,
      visibleEvidence: finding.visible_evidence,
      correctiveAction: finding.corrective_action,
      uncertainty: finding.uncertainty,
      origin: finding.origin,
      modifiedByHuman: finding.modified_by_human,
      inspectorName: profiles.get(inspection.created_by)?.display_name ?? "未知巡检员",
      events: events.map((event) => ({
        id: event.id,
        actorName: profiles.get(event.actor_id)?.display_name ?? "未知用户",
        eventType: event.event_type,
        fromStatus: event.from_status,
        toStatus: event.to_status,
        comment: event.comment,
        createdAt: event.created_at,
      })),
      followUps: followUps.map((followUp) => ({
        id: followUp.id,
        authorName: profiles.get(followUp.author_id)?.display_name ?? "未知用户",
        comment: followUp.comment,
        createdAt: followUp.created_at,
        photos: photos
          .filter((photo) => photo.follow_up_id === followUp.id)
          .map((photo) => ({
            id: photo.id,
            originalFileName: photo.original_file_name,
            signedUrl: signedUrls.get(photo.id) ?? null,
          })),
      })),
      projectMembers: memberIds.flatMap((memberId) => {
        const profile = profiles.get(memberId);
        return profile
          ? [
              {
                id: profile.id,
                displayName: profile.display_name,
                email: profile.email,
              },
            ]
          : [];
      }),
    },
  };
}
