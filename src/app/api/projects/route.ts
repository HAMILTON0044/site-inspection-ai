import { z } from "zod";
import { getCurrentUserContext } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";

const CreateProjectSchema = z.object({
  name: z.string().trim().min(1).max(150),
  code: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/),
  description: z.string().trim().max(2000).default(""),
});

export async function GET() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();

  if (!claimsData?.claims?.sub) {
    return Response.json({ error: "请先登录。" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("projects")
    .select("id, name, code")
    .eq("status", "ACTIVE")
    .order("name");

  if (error) {
    console.error("Failed to load cloud projects", error);
    return Response.json(
      { error: "无法读取可用项目，请稍后重试。" },
      { status: 500 },
    );
  }

  return Response.json({ projects: data });
}

export async function POST(request: Request) {
  const context = await getCurrentUserContext();
  if (!context.ok) {
    return Response.json(
      { error: context.status === 401 ? "请先登录。" : "当前账号不可用。" },
      { status: context.status },
    );
  }

  if (context.profile.role !== "MANAGER") {
    return Response.json({ error: "只有 Manager 可以创建项目。" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = CreateProjectSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "请检查项目名称、编号和描述。项目编号只能使用字母、数字、连字符和下划线。" },
      { status: 400 },
    );
  }

  const { data, error } = await context.supabase
    .from("projects")
    .insert({
      name: parsed.data.name,
      code: parsed.data.code.toUpperCase(),
      description: parsed.data.description,
      created_by: context.profile.id,
    })
    .select("id, name, code, description, status, created_at")
    .single();

  if (error) {
    console.error("Failed to create project", error);
    return Response.json(
      {
        error:
          error.code === "23505"
            ? "该项目编号已经存在。"
            : "创建项目失败，请稍后重试。",
      },
      { status: error.code === "23505" ? 409 : 500 },
    );
  }

  return Response.json({ project: data }, { status: 201 });
}
