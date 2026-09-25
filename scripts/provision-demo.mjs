import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "需要 NEXT_PUBLIC_SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY。该脚本只允许在受信任的本地终端运行。",
  );
}

const values = {
  manager: {
    email: required("DEMO_MANAGER_EMAIL"),
    password: required("DEMO_MANAGER_PASSWORD"),
    displayName: process.env.DEMO_MANAGER_NAME || "演示项目经理",
  },
  inspectorA: {
    email: required("DEMO_INSPECTOR_A_EMAIL"),
    password: required("DEMO_INSPECTOR_A_PASSWORD"),
    displayName: process.env.DEMO_INSPECTOR_A_NAME || "演示巡检员 A",
  },
  inspectorB: {
    email: required("DEMO_INSPECTOR_B_EMAIL"),
    password: required("DEMO_INSPECTOR_B_PASSWORD"),
    displayName: process.env.DEMO_INSPECTOR_B_NAME || "演示巡检员 B",
  },
};

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const manager = await ensureUser(values.manager);
const inspectorA = await ensureUser(values.inspectorA);
const inspectorB = await ensureUser(values.inspectorB);

const { error: profilesError } = await admin.from("profiles").upsert(
  [
    {
      id: manager.id,
      email: values.manager.email,
      display_name: values.manager.displayName,
      role: "MANAGER",
      is_active: true,
    },
    {
      id: inspectorA.id,
      email: values.inspectorA.email,
      display_name: values.inspectorA.displayName,
      role: "INSPECTOR",
      is_active: true,
    },
    {
      id: inspectorB.id,
      email: values.inspectorB.email,
      display_name: values.inspectorB.displayName,
      role: "INSPECTOR",
      is_active: true,
    },
  ],
  { onConflict: "id" },
);

if (profilesError) throw profilesError;

const { data: project, error: projectError } = await admin
  .from("projects")
  .upsert(
    {
      name: "滨江商务中心二期（演示）",
      code: "DEMO-BJC-2026",
      description: "用于现场巡检、权限和整改闭环演示的测试项目。",
      status: "ACTIVE",
      created_by: manager.id,
    },
    { onConflict: "code" },
  )
  .select("id, name, code")
  .single();

if (projectError) throw projectError;

const { error: membersError } = await admin
  .from("project_members")
  .upsert(
    [
      { project_id: project.id, user_id: inspectorA.id, added_by: manager.id },
      { project_id: project.id, user_id: inspectorB.id, added_by: manager.id },
    ],
    { onConflict: "project_id,user_id" },
  );

if (membersError) throw membersError;

console.log(`演示环境已准备：${project.name}（${project.code}）`);
console.log(`Manager: ${values.manager.email}`);
console.log(`Inspector A: ${values.inspectorA.email}`);
console.log(`Inspector B: ${values.inspectorB.email}`);
console.log("下一步：分别登录三个账号，按 TEAM_HANDOFF.md 的演示流程完成真实提交和整改闭环。");

async function ensureUser(value) {
  const existing = await findUserByEmail(value.email);
  if (existing) {
    const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
      email_confirm: true,
      user_metadata: { display_name: value.displayName },
    });
    if (error) throw error;
    return data.user;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: value.email,
    password: value.password,
    email_confirm: true,
    user_metadata: { display_name: value.displayName },
  });
  if (error) throw error;
  return data.user;
}

async function findUserByEmail(email) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email.toLowerCase());
    if (user) return user;
    if (data.users.length < 1000) return null;
  }
  return null;
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`缺少环境变量 ${name}`);
  return value;
}
