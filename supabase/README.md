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

## 重要安全约束

- 新注册用户始终创建为 `INSPECTOR`，不能通过注册 metadata 把自己提升为 Manager。
- 第一个 Manager 必须由项目管理员在受信任环境中手动提升。
- `private` schema 不加入 Supabase Exposed Schemas。
- 不在浏览器中使用 Supabase Secret Key。
- migration 尚未在真实 Supabase 项目执行，执行前需要通过本地或分支数据库测试。

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
