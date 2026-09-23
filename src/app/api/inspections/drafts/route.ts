import { randomUUID } from "node:crypto";
import { CreateInspectionDraftSchema } from "@/lib/cloud-inspection-schema";
import { createClient } from "@/lib/supabase/server";

function createInspectionNumber() {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:T.Z]/g, "")
    .slice(0, 14);

  return `SI-${timestamp}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

export async function POST(request: Request) {
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

  const parsed = CreateInspectionDraftSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "巡检草稿信息不完整或格式不正确。" },
      { status: 400 },
    );
  }

  const inspectionId = randomUUID();
  const { error } = await supabase.from("inspections").insert({
    id: inspectionId,
    project_id: parsed.data.projectId,
    inspection_number: createInspectionNumber(),
    created_by: userId,
    location: parsed.data.location,
    note: parsed.data.note,
    summary: parsed.data.summary,
    status: "DRAFT",
  });

  if (error) {
    console.error("Failed to create inspection draft", error);
    return Response.json(
      { error: "无法创建云端巡检草稿。请确认你已加入所选项目。" },
      { status: 403 },
    );
  }

  return Response.json({ inspectionId });
}
