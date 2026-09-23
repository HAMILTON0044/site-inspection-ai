# Supabase setup

当前目录保存未来云端协作功能的数据库 migration。技术决策见：

- `docs/ADR-001-CLOUD-STACK.md`
- `docs/COLLABORATION_SYSTEM_DESIGN.md`

## 当前 migration

`migrations/202609230001_auth_projects.sql` 创建：

- `profiles`
- `projects`
- `project_members`
- Inspector/Manager 枚举
- 新 Auth 用户自动创建 Inspector profile 的 trigger
- 项目成员权限所需的私有 helper functions
- 第一阶段 Row Level Security policies

该 migration 已于 2026-09-23 执行到 Supabase 项目 `site-inspection-ai`（Singapore）。复核查询确认：

- `profiles`：2 条 RLS policy
- `projects`：3 条 RLS policy
- `project_members`：3 条 RLS policy

认证链路已用真实测试账号验证：注册后 trigger 正确生成 `INSPECTOR` profile；删除 Auth 用户后 profile 通过外键级联删除。测试账号已清理，项目当前不保留测试用户。

`migrations/202609230002_inspections_findings_storage.sql` 创建：

- `inspections`
- `inspection_photos`
- `vision_detections`
- `findings`
- `finding_evidence`
- `finding_events`
- `finding_follow_ups`
- `follow_up_photos`
- `generated_reports`
- 巡检、finding、风险、事件、报告和 PPE 类别枚举
- 草稿隐私、项目成员读取和追加跟进所需的 RLS policies
- finding 证据一致性校验和首条审计事件 trigger
- 私有 `inspection-photos` Bucket（10 MB，仅 JPEG/PNG/WebP）
- 私有 `inspection-reports` Bucket（25 MB，仅 PDF/DOCX）
- 按项目和巡检 UUID 路径校验的 Storage RLS policies

该 migration 已于 2026-09-23 先使用 `BEGIN ... ROLLBACK` 在真实项目完成无副作用测试，随后正式执行。复核确认 9 张业务表全部启用 RLS、5 条 Storage policy 存在，两个 Bucket 均为 private。

`migrations/202609230003_submit_inspection_rpc.sql` 创建：

- `submit_inspection_draft(uuid, jsonb)`：验证草稿所有权和 Storage 对象后，在单个事务中写入照片元数据、YOLO detections、已批准 findings 与证据，再将巡检改为 `SUBMITTED`
- `abort_inspection_draft(uuid)`：仅允许创建者删除自己尚未提交的草稿，供上传失败后的补偿清理使用
- 两个函数都采用 `SECURITY DEFINER`、固定空 `search_path`，仅向 `authenticated` 授予执行权

该 migration 已于 2026-09-24 正式执行。复核查询确认两个函数均存在、`prosecdef = true`，且 `authenticated` 角色可以执行。

## 重要安全约束

- 新注册用户始终创建为 `INSPECTOR`，不能通过注册 metadata 把自己提升为 Manager。
- 第一个 Manager 必须由项目管理员在受信任环境中手动提升。
- `private` schema 不加入 Supabase Exposed Schemas。
- 不在浏览器中使用 Supabase Secret Key。
- 后续 migration 应先在本地或分支数据库测试，再应用到生产项目。
- `inspection-photos` 路径必须使用 `{projectId}/{inspectionId}/photos/...` 或 `{projectId}/{inspectionId}/follow-ups/...`。
- `inspection-reports` 路径必须使用 `{projectId}/{inspectionId}/reports/...`。
- 正式提交必须通过 `submit_inspection_draft` RPC，不要开放客户端直接修改 `status` 或 `submitted_at`。
- 浏览器只负责直接上传私有照片；关系数据必须经过共享 Zod Schema 和服务端 RPC 验证。
- 若照片上传或事务失败，必须先删除 Storage 对象，再调用 `abort_inspection_draft`，因为删除对象的 RLS 依赖仍然存在的草稿记录。

## 创建第一个 Manager

创建测试账号后，在 Supabase SQL Editor 中使用真实邮箱执行一次：

```sql
update public.profiles
set role = 'MANAGER'
where id = (
  select id
  from auth.users
  where email = 'manager@example.com'
);
```

不要把真实测试密码或密钥写入 migration、文档或 Git。
