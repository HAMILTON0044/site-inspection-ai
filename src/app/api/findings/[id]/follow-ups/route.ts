import { z } from "zod";
import { getCurrentUserContext } from "@/lib/current-user";
import { getWorkflowErrorResponse } from "@/lib/workflow-error";

type FindingRouteContext = { params: Promise<{ id: string }> };

const PhotoSchema = z.object({
  id: z.uuid(),
  storage_key: z.string().trim().min(1).max(1000),
  original_file_name: z.string().trim().min(1).max(255),
  mime_type: z.enum(["image/jpeg", "image/png", "image/webp"]),
  size_bytes: z.number().int().positive().max(10 * 1024 * 1024),
});

const FollowUpSchema = z.object({
  followUpId: z.uuid(),
  comment: z.string().trim().min(1).max(5000),
  photos: z.array(PhotoSchema).max(5).default([]),
  submitForVerification: z.boolean().default(false),
});

export async function POST(request: Request, context: FindingRouteContext) {
  const { id } = await context.params;
  const findingId = z.uuid().safeParse(id);
  const body = await request.json().catch(() => null);
  const parsed = FollowUpSchema.safeParse(body);

  if (!findingId.success || !parsed.success) {
    return Response.json({ error: "请检查整改说明和照片资料。" }, { status: 400 });
  }

  const userContext = await getCurrentUserContext();
  if (!userContext.ok) {
    return Response.json(
      { error: userContext.status === 401 ? "请先登录。" : "当前账号不可用。" },
      { status: userContext.status },
    );
  }

  const { error } = await userContext.supabase.rpc("add_finding_follow_up", {
    target_finding_id: findingId.data,
    target_follow_up_id: parsed.data.followUpId,
    follow_up_comment: parsed.data.comment,
    photo_payload: parsed.data.photos,
    submit_for_verification: parsed.data.submitForVerification,
  });

  if (error) {
    console.error("Failed to add finding follow-up", error);
    const response = getWorkflowErrorResponse(error, "整改跟进提交失败。请稍后重试。");
    return Response.json({ error: response.message }, { status: response.status });
  }

  return Response.json({ success: true }, { status: 201 });
}
