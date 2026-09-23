import { createClient } from "@/lib/supabase/server";

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
