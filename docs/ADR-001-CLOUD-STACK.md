# ADR-001：认证、数据库与文件存储选型

状态：已决定，尚未实施  
日期：2026-09-23

## 决策

采用以下组合：

```text
Next.js 16 + Vercel
        │
        ├── Supabase Auth
        ├── Supabase PostgreSQL + Row Level Security
        ├── Supabase Private Storage
        └── Browser IndexedDB（本地草稿）
```

## 选择理由

### Supabase Auth

- 支持账号密码登录、会话刷新和密码重置。
- 官方提供 Next.js SSR cookie 集成。
- 登录身份可以直接用于 PostgreSQL 和 Storage 的 RLS 策略。
- 不需要业务代码自行保存密码或实现密码哈希。

注意：官方 `@supabase/ssr` 当前仍标记为 beta，升级依赖前要检查变更说明。Next.js 16 使用 `proxy.ts` 处理会话刷新，而不是旧版 `middleware.ts` 命名。

### Supabase PostgreSQL

- 适合 Project、Inspection、Finding、Assignment 和 Event 等关系数据。
- RLS 可以在数据库层执行项目成员和角色隔离。
- Auth 用户 ID 可以直接作为业务用户身份来源。
- SQL 约束和事务适合实现 finding 状态机和审计记录。

### Supabase Private Storage

- 私有 bucket 默认要求经过访问控制才能读取。
- 可使用 RLS 限制用户只能读取所属项目的照片。
- 支持短期签名 URL，不需要暴露永久公开链接。
- 与 Auth 和 PostgreSQL 使用同一用户身份，减少权限系统数量。

### IndexedDB

- 继续保存未提交巡检和离线草稿。
- 网络异常时不会丢失已经完成的本地 YOLO 检测。
- 正式提交成功后，云端数据库成为团队协作的权威数据源。

## 不使用现有 Public Vercel Blob 保存正式照片

当前项目已经连接一个 public Vercel Blob store。公开 Blob 的读取不会经过项目成员权限检查，任何获得 URL 的人都可能访问文件。

因此：

- 不把正式巡检照片、整改照片或报告上传到现有 public store。
- 现有 store 可保留用于非敏感公开演示素材，也可以暂时不使用。
- 如果以后决定继续使用 Vercel Blob，必须新建 private store，并通过经过认证和授权的 Vercel Function 转发文件。

## 被否决的替代方案

### 自己实现账号密码

否决原因：密码哈希、重置、会话轮换、防暴力破解和邮件验证容易出现安全缺陷，不适合当前阶段自行实现。

### Supabase Auth + 独立数据库 + Vercel Blob

暂不采用。技术上可行，但会增加身份映射、权限逻辑、环境变量和故障点。当前 MVP 更适合统一使用 Supabase。

### 仅使用 IndexedDB

否决原因：无法跨设备同步，Manager 也无法查看团队巡检记录。

## 环境变量规划

浏览器和服务端均可使用：

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

仅允许服务端使用：

```dotenv
SUPABASE_SECRET_KEY=
```

规则：

- Publishable key 可以进入浏览器，但所有表和 Storage 必须启用正确的 RLS。
- Secret key 只能用于必要的后台管理任务，不能进入 Client Component。
- 普通业务请求优先使用当前登录用户的 session，让 RLS 生效。
- 不把任何 Supabase 密钥提交到 Git。

## 初始云端资源

需要创建：

1. 一个 Supabase 项目。
2. 一个私有 bucket：`inspection-evidence`。
3. Auth 邮箱密码登录。
4. `profiles`、`projects`、`project_members` 三张第一阶段表。
5. 对上述表和 `storage.objects` 的 RLS 策略。
6. 一个 Manager 测试账号和两个 Inspector 测试账号。

## 第一阶段实施边界

认证和权限阶段只实现：

- 登录和退出。
- 创建或读取用户 profile。
- 受保护路由。
- Manager 创建项目。
- Manager 添加 Inspector 到项目。
- Inspector 只能看到自己参与的项目。

暂时不把现有巡检分析提交到云端。只有上述权限隔离通过测试后，才进入 Inspection 和 Finding 云端同步。

## 验收条件

1. 未登录用户访问受保护页面会跳转到 `/login`。
2. Inspector A 看不到未加入项目的数据。
3. Inspector A 和 Inspector B 加入同一项目后都能看到项目，但不能管理成员。
4. Manager 可以创建项目和管理成员。
5. 在浏览器中伪造 `projectId` 不能绕过服务端和 RLS。
6. Secret key 不出现在浏览器 bundle、网络响应或 Git 历史中。

## 官方依据

- Supabase Auth SSR：<https://supabase.com/docs/guides/auth/server-side>
- Next.js SSR client：<https://supabase.com/docs/guides/auth/server-side/creating-a-client>
- Supabase private bucket：<https://supabase.com/docs/guides/storage/buckets/fundamentals>
- Supabase Storage RLS：<https://supabase.com/docs/guides/storage/security/access-control>
- Vercel Blob private storage：<https://vercel.com/docs/vercel-blob/private-storage>
