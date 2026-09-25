import { z } from "zod";
import { getCurrentUserContext } from "@/lib/current-user";

type MemberRouteContext = {
  params: Promise<{ id: string; userId: string }>;
};

export async function DELETE(_request: Request, context: MemberRouteContext) {
  const { id, userId } = await context.params;
  const parsed = z
    .object({ projectId: z.uuid(), userId: z.uuid() })
    .safeParse({ projectId: id, userId });
  if (!parsed.success) {
    return Response.json({ error: "项目或成员 ID 无效。" }, { status: 400 });
  }

  const userContext = await getCurrentUserContext();
  if (!userContext.ok) {
    return Response.json(
      { error: userContext.status === 401 ? "请先登录。" : "当前账号不可用。" },
      { status: userContext.status },
    );
  }
  if (userContext.profile.role !== "MANAGER") {
    return Response.json({ error: "只有 Manager 可以管理项目成员。" }, { status: 403 });
  }

  const { error, count } = await userContext.supabase
    .from("project_members")
    .delete({ count: "exact" })
    .eq("project_id", parsed.data.projectId)
    .eq("user_id", parsed.data.userId);

  if (error) {
    console.error("Failed to remove project member", error);
    return Response.json({ error: "移除成员失败。" }, { status: 500 });
  }
  if (!count) {
    return Response.json({ error: "项目成员不存在。" }, { status: 404 });
  }

  return Response.json({ success: true });
}
