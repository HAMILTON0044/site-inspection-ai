import { z } from "zod";
import { getCurrentUserContext } from "@/lib/current-user";
import { getWorkflowErrorResponse } from "@/lib/workflow-error";

type FindingRouteContext = { params: Promise<{ id: string }> };

const TransitionSchema = z.object({
  status: z.enum([
    "ASSIGNED",
    "IN_PROGRESS",
    "AWAITING_VERIFICATION",
    "CLOSED",
    "REOPENED",
  ]),
  comment: z.string().trim().max(5000).default(""),
});

export async function POST(request: Request, context: FindingRouteContext) {
  const { id } = await context.params;
  const findingId = z.uuid().safeParse(id);
  const body = await request.json().catch(() => null);
  const parsed = TransitionSchema.safeParse(body);

  if (!findingId.success || !parsed.success) {
    return Response.json({ error: "状态或说明无效。" }, { status: 400 });
  }

  const userContext = await getCurrentUserContext();
  if (!userContext.ok) {
    return Response.json(
      { error: userContext.status === 401 ? "请先登录。" : "当前账号不可用。" },
      { status: userContext.status },
    );
  }

  const operation =
    parsed.data.status === "REOPENED"
      ? userContext.supabase.rpc("reopen_finding", {
          target_finding_id: findingId.data,
          action_comment: parsed.data.comment,
        })
      : userContext.supabase.rpc("transition_finding_status", {
          target_finding_id: findingId.data,
          target_status: parsed.data.status,
          action_comment: parsed.data.comment || null,
        });
  const { error } = await operation;

  if (error) {
    console.error("Failed to transition finding", error);
    const response = getWorkflowErrorResponse(error, "问题状态更新失败。请稍后重试。");
    return Response.json({ error: response.message }, { status: response.status });
  }

  return Response.json({ success: true });
}
