const baseUrl = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const checks = [
  "/api/projects",
  "/api/inspections",
  "/api/findings",
  "/api/inspections/00000000-0000-4000-8000-000000000000",
];

let failed = false;

for (const path of checks) {
  const response = await fetch(`${baseUrl}${path}`);
  console.log(`${response.status} ${path}`);
  if (response.status !== 401) failed = true;
}

if (failed) {
  console.error("匿名 API 检查失败：至少一个受保护接口没有返回 401。");
  process.exit(1);
}

console.log("匿名访问保护检查通过。");
