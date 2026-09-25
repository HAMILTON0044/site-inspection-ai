import { z } from "zod";
import { getCurrentUserContext } from "@/lib/current-user";
import { getProjectDetail } from "@/lib/project-queries";

type ProjectRouteContext = { params: Promise<{ id: string }> };

const UpdateProjectSchema = z.object({
  name: z.string().trim().min(1).max(150),
  code: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/),
  description: z.string().trim().max(2000),
  status: z.enum(["ACTIVE", "ARCHIVED"]),
});

export async function GET(_request: Request, context: ProjectRouteContext) {
  const { id } = await context.params;
  const result = await getProjectDetail(id);

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json({ project: result.data, currentUser: result.currentUser });
}

export async function PATCH(request: Request, context: ProjectRouteContext) {
  const { id } = await context.params;
  const idResult = z.uuid().safeParse(id);
  if (!idResult.success) {
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
    return Response.json({ error: "只有 Manager 可以修改项目。" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = UpdateProjectSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "请检查项目资料。" }, { status: 400 });
  }

  const { data, error } = await userContext.supabase
    .from("projects")
    .update({
      name: parsed.data.name,
      code: parsed.data.code.toUpperCase(),
      description: parsed.data.description,
      status: parsed.data.status,
    })
    .eq("id", idResult.data)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Failed to update project", error);
    return Response.json(
      { error: error.code === "23505" ? "该项目编号已经存在。" : "项目更新失败。" },
      { status: error.code === "23505" ? 409 : 500 },
    );
  }
  if (!data) {
    return Response.json({ error: "项目不存在或无权修改。" }, { status: 404 });
  }

  return Response.json({ success: true });
}
