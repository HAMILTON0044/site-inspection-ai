import "server-only";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type CloudInspectionStatus = "SUBMITTED" | "ARCHIVED";

export type CloudInspectionListItem = {
  id: string;
  inspectionNumber: string;
  projectId: string;
  projectName: string;
  projectCode: string;
  inspectorName: string;
  location: string;
  summary: string;
  status: CloudInspectionStatus;
  submittedAt: string;
  findingCount: number;
  openFindingCount: number;
  highRiskFindingCount: number;
  photoCount: number;
  reportCount: number;
};

export type CloudDetection = {
  id: string;
  clientDetectionId: string;
  label: string;
  confidence: number;
  excludedByUser: boolean;
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

export type CloudInspectionPhoto = {
  id: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
  signedUrl: string | null;
  detections: CloudDetection[];
};

export type CloudFindingEvent = {
  id: string;
  actorName: string;
  eventType: string;
  fromStatus: string | null;
  toStatus: string | null;
  comment: string | null;
  createdAt: string;
};

export type CloudFinding = {
  id: string;
  category: string;
  title: string;
  description: string;
  visibleEvidence: string;
  riskLevel: string;
  correctiveAction: string;
  uncertainty: string[];
  origin: string;
  modifiedByHuman: boolean;
  status: string;
  assigneeName: string | null;
  dueAt: string | null;
  createdAt: string;
  evidencePhotoIds: string[];
  evidenceDetectionIds: string[];
  events: CloudFindingEvent[];
};

export type CloudGeneratedReport = {
  id: string;
  format: string;
  generatedAt: string;
  signedUrl: string | null;
};

export type CloudReportListItem = {
  id: string;
  inspectionId: string;
  inspectionNumber: string;
  projectName: string;
  projectCode: string;
  inspectorName: string;
  format: string;
  generatedAt: string;
  signedUrl: string | null;
};

export type CloudInspectionDetail = {
  id: string;
  inspectionNumber: string;
  projectId: string;
  projectName: string;
  projectCode: string;
  inspectorName: string;
  location: string;
  note: string;
  summary: string;
  status: CloudInspectionStatus;
  submittedAt: string;
  createdAt: string;
  photos: CloudInspectionPhoto[];
  findings: CloudFinding[];
  reports: CloudGeneratedReport[];
};

export type CloudQueryResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: 401 | 404 | 500 };

type InspectionRow = {
  id: string;
  project_id: string;
  inspection_number: string;
  created_by: string;
  location: string;
  summary: string;
  status: CloudInspectionStatus;
  submitted_at: string | null;
  created_at: string;
};

type ProjectRow = {
  id: string;
  name: string;
  code: string;
};

type ProfileRow = {
  id: string;
  display_name: string;
};

type FindingSummaryRow = {
  inspection_id: string;
  status: string;
  risk_level: string;
};

type InspectionChildRow = {
  inspection_id: string;
};

type InspectionPhotoRow = {
  id: string;
  inspection_id: string;
  storage_key: string;
  original_file_name: string;
  mime_type: string;
  size_bytes: number;
  width: number;
  height: number;
  created_at: string;
};

type DetectionRow = {
  id: string;
  inspection_photo_id: string;
  client_detection_id: string;
  label: string;
  confidence: number;
  box_x: number;
  box_y: number;
  box_width: number;
  box_height: number;
  excluded_by_user: boolean;
};

type FindingRow = {
  id: string;
  inspection_id: string;
  category: string;
  title: string;
  description: string;
  visible_evidence: string;
  risk_level: string;
  corrective_action: string;
  uncertainty: string[];
  origin: string;
  modified_by_human: boolean;
  status: string;
  assignee_id: string | null;
  due_at: string | null;
  created_at: string;
};

type FindingEvidenceRow = {
  finding_id: string;
  inspection_photo_id: string;
  vision_detection_id: string | null;
};

type FindingEventRow = {
  id: string;
  finding_id: string;
  actor_id: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  comment: string | null;
  created_at: string;
};

type GeneratedReportRow = {
  id: string;
  inspection_id: string;
  format: string;
  storage_key: string;
  generated_at: string;
};

type ReportInspectionRow = Pick<
  InspectionRow,
  "id" | "project_id" | "inspection_number" | "created_by" | "status"
>;

function incrementCount(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

export async function getCloudInspectionList(): Promise<
  CloudQueryResult<CloudInspectionListItem[]>
> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();

  if (!claimsData?.claims?.sub) {
    return { ok: false, error: "请先登录。", status: 401 };
  }

  const { data: rawInspections, error: inspectionsError } = await supabase
    .from("inspections")
    .select(
      "id, project_id, inspection_number, created_by, location, summary, status, submitted_at, created_at",
    )
    .in("status", ["SUBMITTED", "ARCHIVED"])
    .order("submitted_at", { ascending: false });

  if (inspectionsError) {
    console.error("Failed to load cloud inspections", inspectionsError);
    return {
      ok: false,
      error: "无法读取云端巡检记录，请稍后重试。",
      status: 500,
    };
  }

  const inspections = (rawInspections ?? []) as InspectionRow[];

  if (inspections.length === 0) {
    return { ok: true, data: [] };
  }

  const inspectionIds = inspections.map((inspection) => inspection.id);
  const projectIds = [...new Set(inspections.map((item) => item.project_id))];
  const inspectorIds = [
    ...new Set(inspections.map((item) => item.created_by)),
  ];

  const [projectsResult, profilesResult, findingsResult, photosResult, reportsResult] =
    await Promise.all([
      supabase
        .from("projects")
        .select("id, name, code")
        .in("id", projectIds),
      supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", inspectorIds),
      supabase
        .from("findings")
        .select("inspection_id, status, risk_level")
        .in("inspection_id", inspectionIds),
      supabase
        .from("inspection_photos")
        .select("inspection_id")
        .in("inspection_id", inspectionIds),
      supabase
        .from("generated_reports")
        .select("inspection_id")
        .in("inspection_id", inspectionIds),
    ]);

  const relatedError = [
    projectsResult.error,
    profilesResult.error,
    findingsResult.error,
    photosResult.error,
    reportsResult.error,
  ].find(Boolean);

  if (relatedError) {
    console.error("Failed to load cloud inspection summaries", relatedError);
    return {
      ok: false,
      error: "无法读取巡检关联数据，请稍后重试。",
      status: 500,
    };
  }

  const projects = new Map(
    ((projectsResult.data ?? []) as ProjectRow[]).map((project) => [
      project.id,
      project,
    ]),
  );
  const profiles = new Map(
    ((profilesResult.data ?? []) as ProfileRow[]).map((profile) => [
      profile.id,
      profile.display_name,
    ]),
  );
  const findingCounts = new Map<string, number>();
  const openFindingCounts = new Map<string, number>();
  const highRiskFindingCounts = new Map<string, number>();
  const photoCounts = new Map<string, number>();
  const reportCounts = new Map<string, number>();

  for (const finding of (findingsResult.data ?? []) as FindingSummaryRow[]) {
    incrementCount(findingCounts, finding.inspection_id);
    if (finding.status !== "CLOSED") {
      incrementCount(openFindingCounts, finding.inspection_id);
    }
    if (finding.risk_level === "HIGH" || finding.risk_level === "CRITICAL") {
      incrementCount(highRiskFindingCounts, finding.inspection_id);
    }
  }

  for (const photo of (photosResult.data ?? []) as InspectionChildRow[]) {
    incrementCount(photoCounts, photo.inspection_id);
  }

  for (const report of (reportsResult.data ?? []) as InspectionChildRow[]) {
    incrementCount(reportCounts, report.inspection_id);
  }

  return {
    ok: true,
    data: inspections.map((inspection) => {
      const project = projects.get(inspection.project_id);

      return {
        id: inspection.id,
        inspectionNumber: inspection.inspection_number,
        projectId: inspection.project_id,
        projectName: project?.name ?? "未知项目",
        projectCode: project?.code ?? "—",
        inspectorName: profiles.get(inspection.created_by) ?? "未知巡检员",
        location: inspection.location,
        summary: inspection.summary,
        status: inspection.status,
        submittedAt: inspection.submitted_at ?? inspection.created_at,
        findingCount: findingCounts.get(inspection.id) ?? 0,
        openFindingCount: openFindingCounts.get(inspection.id) ?? 0,
        highRiskFindingCount: highRiskFindingCounts.get(inspection.id) ?? 0,
        photoCount: photoCounts.get(inspection.id) ?? 0,
        reportCount: reportCounts.get(inspection.id) ?? 0,
      };
    }),
  };
}

export async function getCloudReportList(): Promise<
  CloudQueryResult<CloudReportListItem[]>
> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();

  if (!claimsData?.claims?.sub) {
    return { ok: false, error: "请先登录。", status: 401 };
  }

  const { data: rawReports, error: reportsError } = await supabase
    .from("generated_reports")
    .select("id, inspection_id, format, storage_key, generated_at")
    .order("generated_at", { ascending: false });

  if (reportsError) {
    console.error("Failed to load cloud reports", reportsError);
    return { ok: false, error: "无法读取报告归档，请稍后重试。", status: 500 };
  }

  const reports = (rawReports ?? []) as GeneratedReportRow[];
  if (reports.length === 0) return { ok: true, data: [] };

  const inspectionIds = [...new Set(reports.map((report) => report.inspection_id))];
  const { data: rawInspections, error: inspectionsError } = await supabase
    .from("inspections")
    .select("id, project_id, inspection_number, created_by, status")
    .in("id", inspectionIds)
    .in("status", ["SUBMITTED", "ARCHIVED"]);

  if (inspectionsError) {
    console.error("Failed to load report inspections", inspectionsError);
    return { ok: false, error: "无法读取报告关联巡检，请稍后重试。", status: 500 };
  }

  const inspections = (rawInspections ?? []) as ReportInspectionRow[];
  if (inspections.length === 0) return { ok: true, data: [] };

  const projectIds = [...new Set(inspections.map((inspection) => inspection.project_id))];
  const profileIds = [...new Set(inspections.map((inspection) => inspection.created_by))];
  const [projectsResult, profilesResult] = await Promise.all([
    supabase.from("projects").select("id, name, code").in("id", projectIds),
    supabase.from("profiles").select("id, display_name").in("id", profileIds),
  ]);

  const relatedError = [projectsResult.error, profilesResult.error].find(Boolean);
  if (relatedError) {
    console.error("Failed to load report relations", relatedError);
    return { ok: false, error: "无法读取报告关联信息，请稍后重试。", status: 500 };
  }

  const inspectionMap = new Map(inspections.map((inspection) => [inspection.id, inspection]));
  const projectMap = new Map(
    ((projectsResult.data ?? []) as ProjectRow[]).map((project) => [project.id, project]),
  );
  const profileMap = new Map(
    ((profilesResult.data ?? []) as ProfileRow[]).map((profile) => [profile.id, profile.display_name]),
  );
  const signedUrls = new Map<string, string | null>();

  await Promise.all(
    reports.map(async (report) => {
      const { data, error } = await supabase.storage
        .from("inspection-reports")
        .createSignedUrl(report.storage_key, 600);
      if (error) {
        console.error("Failed to sign report archive", { reportId: report.id, message: error.message });
      }
      signedUrls.set(report.id, data?.signedUrl ?? null);
    }),
  );

  return {
    ok: true,
    data: reports.flatMap((report) => {
      const inspection = inspectionMap.get(report.inspection_id);
      if (!inspection) return [];
      const project = projectMap.get(inspection.project_id);
      return [{
        id: report.id,
        inspectionId: report.inspection_id,
        inspectionNumber: inspection.inspection_number,
        projectName: project?.name ?? "未知项目",
        projectCode: project?.code ?? "—",
        inspectorName: profileMap.get(inspection.created_by) ?? "未知巡检员",
        format: report.format,
        generatedAt: report.generated_at,
        signedUrl: signedUrls.get(report.id) ?? null,
      }];
    }),
  };
}

export async function getCloudInspectionDetail(
  inspectionId: string,
): Promise<CloudQueryResult<CloudInspectionDetail>> {
  const idResult = z.uuid().safeParse(inspectionId);

  if (!idResult.success) {
    return { ok: false, error: "巡检 ID 无效。", status: 404 };
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();

  if (!claimsData?.claims?.sub) {
    return { ok: false, error: "请先登录。", status: 401 };
  }

  const { data: rawInspection, error: inspectionError } = await supabase
    .from("inspections")
    .select(
      "id, project_id, inspection_number, created_by, location, note, summary, status, submitted_at, created_at",
    )
    .eq("id", idResult.data)
    .in("status", ["SUBMITTED", "ARCHIVED"])
    .maybeSingle();

  if (inspectionError) {
    console.error("Failed to load cloud inspection", inspectionError);
    return {
      ok: false,
      error: "无法读取云端巡检详情，请稍后重试。",
      status: 500,
    };
  }

  if (!rawInspection) {
    return { ok: false, error: "巡检记录不存在或无权查看。", status: 404 };
  }

  const inspection = rawInspection as InspectionRow & { note: string };
  const [projectResult, photosResult, findingsResult, reportsResult] =
    await Promise.all([
      supabase
        .from("projects")
        .select("id, name, code")
        .eq("id", inspection.project_id)
        .maybeSingle(),
      supabase
        .from("inspection_photos")
        .select(
          "id, inspection_id, storage_key, original_file_name, mime_type, size_bytes, width, height, created_at",
        )
        .eq("inspection_id", inspection.id)
        .order("created_at"),
      supabase
        .from("findings")
        .select(
          "id, inspection_id, category, title, description, visible_evidence, risk_level, corrective_action, uncertainty, origin, modified_by_human, status, assignee_id, due_at, created_at",
        )
        .eq("inspection_id", inspection.id)
        .order("created_at"),
      supabase
        .from("generated_reports")
        .select("id, inspection_id, format, storage_key, generated_at")
        .eq("inspection_id", inspection.id)
        .order("generated_at", { ascending: false }),
    ]);

  const primaryError = [
    projectResult.error,
    photosResult.error,
    findingsResult.error,
    reportsResult.error,
  ].find(Boolean);

  if (primaryError) {
    console.error("Failed to load inspection relations", primaryError);
    return {
      ok: false,
      error: "无法读取巡检关联数据，请稍后重试。",
      status: 500,
    };
  }

  const project = projectResult.data as ProjectRow | null;
  const photos = (photosResult.data ?? []) as InspectionPhotoRow[];
  const findings = (findingsResult.data ?? []) as FindingRow[];
  const reports = (reportsResult.data ?? []) as GeneratedReportRow[];
  const photoIds = photos.map((photo) => photo.id);
  const findingIds = findings.map((finding) => finding.id);

  const [detectionsResult, evidenceResult, eventsResult] = await Promise.all([
    photoIds.length > 0
      ? supabase
          .from("vision_detections")
          .select(
            "id, inspection_photo_id, client_detection_id, label, confidence, box_x, box_y, box_width, box_height, excluded_by_user",
          )
          .in("inspection_photo_id", photoIds)
      : Promise.resolve({ data: [], error: null }),
    findingIds.length > 0
      ? supabase
          .from("finding_evidence")
          .select("finding_id, inspection_photo_id, vision_detection_id")
          .in("finding_id", findingIds)
      : Promise.resolve({ data: [], error: null }),
    findingIds.length > 0
      ? supabase
          .from("finding_events")
          .select(
            "id, finding_id, actor_id, event_type, from_status, to_status, comment, created_at",
          )
          .in("finding_id", findingIds)
          .order("created_at")
      : Promise.resolve({ data: [], error: null }),
  ]);

  const secondaryError = [
    detectionsResult.error,
    evidenceResult.error,
    eventsResult.error,
  ].find(Boolean);

  if (secondaryError) {
    console.error("Failed to load inspection evidence", secondaryError);
    return {
      ok: false,
      error: "无法读取巡检证据，请稍后重试。",
      status: 500,
    };
  }

  const events = (eventsResult.data ?? []) as FindingEventRow[];
  const profileIds = [
    inspection.created_by,
    ...findings.flatMap((finding) =>
      finding.assignee_id ? [finding.assignee_id] : [],
    ),
    ...events.map((event) => event.actor_id),
  ];
  const uniqueProfileIds = [...new Set(profileIds)];
  const { data: rawProfiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", uniqueProfileIds);

  if (profilesError) {
    console.error("Failed to load inspection participants", profilesError);
    return {
      ok: false,
      error: "无法读取巡检参与人员，请稍后重试。",
      status: 500,
    };
  }

  const profileNames = new Map(
    ((rawProfiles ?? []) as ProfileRow[]).map((profile) => [
      profile.id,
      profile.display_name,
    ]),
  );
  const detections = (detectionsResult.data ?? []) as DetectionRow[];
  const evidence = (evidenceResult.data ?? []) as FindingEvidenceRow[];

  const photoUrls = new Map<string, string | null>();
  await Promise.all(
    photos.map(async (photo) => {
      const { data, error } = await supabase.storage
        .from("inspection-photos")
        .createSignedUrl(photo.storage_key, 600);

      if (error) {
        console.error("Failed to sign inspection photo", {
          photoId: photo.id,
          message: error.message,
        });
      }
      photoUrls.set(photo.id, data?.signedUrl ?? null);
    }),
  );

  const reportUrls = new Map<string, string | null>();
  await Promise.all(
    reports.map(async (report) => {
      const { data, error } = await supabase.storage
        .from("inspection-reports")
        .createSignedUrl(report.storage_key, 600);

      if (error) {
        console.error("Failed to sign inspection report", {
          reportId: report.id,
          message: error.message,
        });
      }
      reportUrls.set(report.id, data?.signedUrl ?? null);
    }),
  );

  return {
    ok: true,
    data: {
      id: inspection.id,
      inspectionNumber: inspection.inspection_number,
      projectId: inspection.project_id,
      projectName: project?.name ?? "未知项目",
      projectCode: project?.code ?? "—",
      inspectorName:
        profileNames.get(inspection.created_by) ?? "未知巡检员",
      location: inspection.location,
      note: inspection.note,
      summary: inspection.summary,
      status: inspection.status,
      submittedAt: inspection.submitted_at ?? inspection.created_at,
      createdAt: inspection.created_at,
      photos: photos.map((photo) => ({
        id: photo.id,
        originalFileName: photo.original_file_name,
        mimeType: photo.mime_type,
        sizeBytes: photo.size_bytes,
        width: photo.width,
        height: photo.height,
        signedUrl: photoUrls.get(photo.id) ?? null,
        detections: detections
          .filter((detection) => detection.inspection_photo_id === photo.id)
          .map((detection) => ({
            id: detection.id,
            clientDetectionId: detection.client_detection_id,
            label: detection.label,
            confidence: detection.confidence,
            excludedByUser: detection.excluded_by_user,
            box: {
              x: detection.box_x,
              y: detection.box_y,
              width: detection.box_width,
              height: detection.box_height,
            },
          })),
      })),
      findings: findings.map((finding) => ({
        id: finding.id,
        category: finding.category,
        title: finding.title,
        description: finding.description,
        visibleEvidence: finding.visible_evidence,
        riskLevel: finding.risk_level,
        correctiveAction: finding.corrective_action,
        uncertainty: finding.uncertainty,
        origin: finding.origin,
        modifiedByHuman: finding.modified_by_human,
        status: finding.status,
        assigneeName: finding.assignee_id
          ? (profileNames.get(finding.assignee_id) ?? "未知负责人")
          : null,
        dueAt: finding.due_at,
        createdAt: finding.created_at,
        evidencePhotoIds: evidence
          .filter((item) => item.finding_id === finding.id)
          .map((item) => item.inspection_photo_id),
        evidenceDetectionIds: evidence
          .filter(
            (item) =>
              item.finding_id === finding.id && item.vision_detection_id,
          )
          .map((item) => item.vision_detection_id as string),
        events: events
          .filter((event) => event.finding_id === finding.id)
          .map((event) => ({
            id: event.id,
            actorName: profileNames.get(event.actor_id) ?? "未知用户",
            eventType: event.event_type,
            fromStatus: event.from_status,
            toStatus: event.to_status,
            comment: event.comment,
            createdAt: event.created_at,
          })),
      })),
      reports: reports.map((report) => ({
        id: report.id,
        format: report.format,
        generatedAt: report.generated_at,
        signedUrl: reportUrls.get(report.id) ?? null,
      })),
    },
  };
}
