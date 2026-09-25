import { z } from "zod";
import { getCurrentUserContext } from "@/lib/current-user";
import { getWorkflowErrorResponse } from "@/lib/workflow-error";

type FindingRouteContext = { params: Promise<{ id: string }> };

const ManageFindingSchema = z.object({
  assigneeId: z.uuid().nullable(),
  dueAt: z.iso.datetime({ offset: true }).nullable(),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL", "UNCONFIRMED"]),
  comment: z.string().trim().max(5000).default(""),
});

export async function POST(request: Request, context: FindingRouteContext) {
  const { id } = await context.params;
  const findingId = z.uuid().safeParse(id);
  const body = await request.json().catch(() => null);
  const parsed = ManageFindingSchema.safeParse(body);

  if (!findingId.success || !parsed.success) {
    return Response.json({ error: "请检查负责人、期限、风险等级和说明。" }, { status: 400 });
  }

  const userContext = await getCurrentUserContext();
  if (!userContext.ok) {
    return Response.json(
      { error: userContext.status === 401 ? "请先登录。" : "当前账号不可用。" },
      { status: userContext.status },
    );
  }
  if (userContext.profile.role !== "MANAGER") {
    return Response.json({ error: "只有 Manager 可以指派和调整问题。" }, { status: 403 });
  }

  const { error } = await userContext.supabase.rpc("manage_finding", {
    target_finding_id: findingId.data,
    target_assignee_id: parsed.data.assigneeId,
    target_due_at: parsed.data.dueAt,
    target_risk_level: parsed.data.riskLevel,
    action_comment: parsed.data.comment || null,
  });

  if (error) {
    console.error("Failed to manage finding", error);
    const response = getWorkflowErrorResponse(error, "问题管理操作失败。请稍后重试。");
    return Response.json({ error: response.message }, { status: response.status });
  }

  return Response.json({ success: true });
}
