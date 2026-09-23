import { z } from "zod";
import { CloudInspectionPayloadSchema } from "@/lib/cloud-inspection-schema";
import { createClient } from "@/lib/supabase/server";

type InspectionRouteContext = {
  params: Promise<{ id: string }>;
};

async function getInspectionId(context: InspectionRouteContext) {
  const { id } = await context.params;
  return z.uuid().safeParse(id);
}

export async function POST(
  request: Request,
  context: InspectionRouteContext,
) {
  const idResult = await getInspectionId(context);

  if (!idResult.success) {
    return Response.json({ error: "巡检 ID 无效。" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();

  if (!claimsData?.claims?.sub) {
    return Response.json({ error: "请先登录。" }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "请求内容不是有效的 JSON。" }, { status: 400 });
  }

  const parsed = CloudInspectionPayloadSchema.safeParse(body);

  if (!parsed.success) {
    console.error("Invalid cloud inspection payload", parsed.error.flatten());
    return Response.json(
      { error: "云端提交数据不完整或格式不正确。" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase.rpc("submit_inspection_draft", {
    target_inspection_id: idResult.data,
    payload: parsed.data,
  });

  if (error) {
    console.error("Failed to submit inspection draft", error);
    return Response.json(
      { error: "云端事务提交失败，草稿将被清理。" },
      { status: 409 },
    );
  }

  return Response.json({ inspectionId: data });
}

export async function DELETE(
  _request: Request,
  context: InspectionRouteContext,
) {
  const idResult = await getInspectionId(context);

  if (!idResult.success) {
    return Response.json({ error: "巡检 ID 无效。" }, { status: 400 });
  }

  const inspectionId = idResult.data;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();

  if (!claimsData?.claims?.sub) {
    return Response.json({ error: "请先登录。" }, { status: 401 });
  }

  const { data: inspection, error: inspectionError } = await supabase
    .from("inspections")
    .select("project_id, status")
    .eq("id", inspectionId)
    .maybeSingle();

  if (inspectionError || !inspection || inspection.status !== "DRAFT") {
    return Response.json({ removed: false });
  }

  const folder = `${inspection.project_id}/${inspectionId}/photos`;
  const { data: objects, error: listError } = await supabase.storage
    .from("inspection-photos")
    .list(folder, { limit: 100 });

  if (listError) {
    console.error("Failed to list draft photo objects", listError);
  } else if (objects.length > 0) {
    const paths = objects.map((object) => `${folder}/${object.name}`);
    const { error: removeError } = await supabase.storage
      .from("inspection-photos")
      .remove(paths);

    if (removeError) {
      console.error("Failed to remove draft photo objects", removeError);
      return Response.json(
        { error: "无法清理已上传的草稿照片。" },
        { status: 500 },
      );
    }
  }

  const { data: removed, error: abortError } = await supabase.rpc(
    "abort_inspection_draft",
    { target_inspection_id: inspectionId },
  );

  if (abortError) {
    console.error("Failed to abort inspection draft", abortError);
    return Response.json(
      { error: "无法清理云端巡检草稿。" },
      { status: 500 },
    );
  }

  return Response.json({ removed });
}
