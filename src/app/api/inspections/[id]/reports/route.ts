import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

type ReportRouteContext = {
  params: Promise<{ id: string }>;
};

const ReportRequestSchema = z.object({
  storageKey: z.string().min(1).max(1000),
  format: z.literal("PDF"),
});

function isReportStorageKey(value: string, projectId: string, inspectionId: string) {
  const prefix = `${projectId}/${inspectionId}/reports/`;
  return value.startsWith(prefix) && value.endsWith(".pdf") && !value.slice(prefix.length).includes("/");
}

export async function POST(request: Request, context: ReportRouteContext) {
  const { id } = await context.params;
  const idResult = z.uuid().safeParse(id);

  if (!idResult.success) {
    return Response.json({ error: "巡检 ID 无效。" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) {
    return Response.json({ error: "请先登录。" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "请求内容不是有效的 JSON。" }, { status: 400 });
  }

  const parsed = ReportRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "报告归档参数不完整。" }, { status: 400 });
  }

  const { data: inspection, error: inspectionError } = await supabase
    .from("inspections")
    .select("id, project_id, status")
    .eq("id", idResult.data)
    .maybeSingle();

  if (inspectionError) {
    console.error("Failed to load inspection for report archive", inspectionError);
    return Response.json({ error: "无法读取巡检归档权限。" }, { status: 500 });
  }

  if (!inspection || (inspection.status !== "SUBMITTED" && inspection.status !== "ARCHIVED")) {
    return Response.json({ error: "只有正式提交的巡检才能归档报告。" }, { status: 404 });
  }

  if (!isReportStorageKey(parsed.data.storageKey, inspection.project_id, idResult.data)) {
    return Response.json({ error: "报告存储路径无效。" }, { status: 400 });
  }

  const { data: report, error: insertError } = await supabase
    .from("generated_reports")
    .insert({
      inspection_id: idResult.data,
      format: parsed.data.format,
      storage_key: parsed.data.storageKey,
      generated_by: userId,
    })
    .select("id, generated_at")
    .single();

  if (insertError) {
    console.error("Failed to archive inspection report", insertError);
    return Response.json({ error: "报告归档失败。" }, { status: 409 });
  }

  return Response.json({ reportId: report.id, generatedAt: report.generated_at });
}
