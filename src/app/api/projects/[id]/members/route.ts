import { z } from "zod";
import { getCurrentUserContext } from "@/lib/current-user";

type MemberRouteContext = { params: Promise<{ id: string }> };

const AddMemberSchema = z.object({
  email: z.email().trim().toLowerCase(),
});

export async function POST(request: Request, context: MemberRouteContext) {
  const { id } = await context.params;
  const projectId = z.uuid().safeParse(id);
  if (!projectId.success) {
    return Response.json({ error: "项目 ID 无效。" }, { status: 400 });
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

  const body = await request.json().catch(() => null);
  const parsed = AddMemberSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "请输入有效的巡检员邮箱。" }, { status: 400 });
  }

  const { data: project } = await userContext.supabase
    .from("projects")
    .select("id")
    .eq("id", projectId.data)
    .maybeSingle();
  if (!project) {
    return Response.json({ error: "项目不存在。" }, { status: 404 });
  }

  const { data: profile, error: profileError } = await userContext.supabase
    .from("profiles")
    .select("id, role, is_active")
    .eq("email", parsed.data.email)
    .maybeSingle();

  if (profileError) {
    console.error("Failed to find project member", profileError);
    return Response.json({ error: "无法查找该用户。" }, { status: 500 });
  }
  if (!profile || profile.role !== "INSPECTOR" || !profile.is_active) {
    return Response.json(
      { error: "没有找到已激活的巡检员账号，请让对方先注册并验证邮箱。" },
      { status: 404 },
    );
  }

  const { error } = await userContext.supabase.from("project_members").insert({
    project_id: projectId.data,
    user_id: profile.id,
    added_by: userContext.profile.id,
  });

  if (error) {
    console.error("Failed to add project member", error);
    return Response.json(
      { error: error.code === "23505" ? "该巡检员已经在项目中。" : "添加成员失败。" },
      { status: error.code === "23505" ? 409 : 500 },
    );
  }

  return Response.json({ success: true }, { status: 201 });
}
