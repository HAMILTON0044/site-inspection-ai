# Site Inspection AI — 团队正式交接说明

最后更新：2026-09-25

当前分支：`main`  
远程仓库：<https://github.com/HAMILTON0044/site-inspection-ai>  
交接基线：以 `origin/main` 最新提交为准

> 一句话状态：项目已经完成“登录 → 多照片浏览器端 YOLO 识别 → 指定 LLM 生成问题草稿 → 人工编辑与审核 → 正式提交 → 项目/成员管理 → finding 整改 Dashboard → 跟进复核闭环 → PDF 报告”的可运行主链路，下一阶段重点是多角色真实验收、报告云端归档和 Vercel 演示部署。

## 1. 交接时项目处于什么阶段

当前不是单纯的界面原型，核心链路已经具备真实实现：

1. 用户使用 Supabase 邮箱密码登录。
2. 巡检员选择最多 10 张现场照片。
3. YOLOv8n ONNX 模型直接在浏览器中识别 PPE 和常见施工目标。
4. 巡检员可以排除误检。
5. 只有结构化检测 JSON 和文字备注会发送给黑客松指定 LLM。
6. LLM 返回带稳定 UUID 和照片证据引用的 finding 草稿。
7. 巡检员可以新增、修改、删除、批准或驳回 finding。
8. 未提交内容可以保存到 IndexedDB，刷新后继续处理。
9. 审核完成后，照片进入 Supabase 私有 Storage，正式数据通过数据库事务写入 PostgreSQL。
10. 登录页和巡检工作台已完成第一阶段企业视觉改造：统一品牌、侧边导航、顶部状态栏、三步巡检进度和宽屏工作区。
11. 全部 finding 完成人工审核后，可下载带证据照片和 YOLO 检测框的正式 A4 PDF 报告。
12. 提交后的巡检会进入云端记录列表，并可在详情页查看私有证据照片、检测框、finding、审计事件和报告归档。

仍未完成的主要部分：

- Manager/Inspector 多账号真实权限验收。
- Word 报告和 PDF 云端归档（浏览器端正式 PDF 已完成）。
- Vercel 正式部署后的整体验收。

## 2. 产品要解决的问题

施工主管日常巡检需要反复整理照片、备注、观察结果和整改措施，人工编写报告耗时且容易延误沟通。

本项目的目标不是让 AI 直接替代安全负责人，而是：

- 用本地视觉模型从照片中提取可验证的目标检测结果。
- 用指定 LLM 把结构化证据和巡检备注整理成问题草稿。
- 强制人工审核每个问题。
- 保存照片、证据、修改记录和正式巡检数据。
- 后续让团队持续跟进未关闭问题。

## 3. 当前 Agent 的定位

目前它是一个面向现场巡检的单用途工作流 Agent，而不是可以任意调用工具的通用自主 Agent。

当前决策链：

```text
现场照片
  ↓
浏览器端 YOLOv8n
  ↓
结构化检测结果
  ↓
人工排除误检
  ↓
检测 JSON + 文字备注
  ↓
黑客松指定 LLM
  ↓
finding 草稿
  ↓
人工新增/编辑/删除/批准/驳回
  ├─ IndexedDB：本地草稿和离线恢复
  └─ Supabase：正式照片、检测、finding、证据和审计记录
```

当前没有使用：

- LangChain
- 向量数据库
- 多 Agent 系统
- 长期后台自主运行框架

这不是当前阶段的严重缺陷。现阶段优先把巡检闭环、权限、报告和演示体验做扎实，比过早增加通用 Agent 编排更重要。

## 4. 技术栈

- Next.js 16.3.5，App Router
- React 19.2.8
- TypeScript 5
- Tailwind CSS 4
- Zod 4
- ONNX Runtime Web 1.30
- YOLOv8n Construction PPE ONNX 模型
- Supabase Auth
- Supabase PostgreSQL + Row Level Security
- Supabase Private Storage
- 浏览器 IndexedDB
- 黑客松指定 LLM Gateway
- React PDF 4.9

## 5. 已完成功能

### 5.1 账号与访问保护

- `/login` 支持邮箱密码登录和注册巡检员。
- 新注册账号固定为 `INSPECTOR`，不能通过前端把自己提升为 Manager。
- 未登录访问 `/` 会重定向到 `/login`。
- 已登录访问 `/login` 会返回工作台。
- `/api/analyze` 和云端提交 API 都会在服务端独立校验 Supabase JWT claims。
- 页面右上角显示用户姓名、角色和退出按钮。

### 5.2 浏览器端照片识别

- 原图不需要上传给 LLM。
- 支持 JPEG、PNG、WebP。
- 单张最大 10 MB，一次最多 10 张。
- 多张照片分别保存检测状态、检测结果和错误信息。
- 可以识别：
  - `Hardhat`
  - `Mask`
  - `NO-Hardhat`
  - `NO-Mask`
  - `NO-Safety Vest`
  - `Person`
  - `Safety Cone`
  - `Safety Vest`
  - `machinery`
  - `vehicle`
- 检测框会还原到原图坐标。
- 违规候选使用红框，普通目标使用蓝框，finding 证据使用黄色高亮。
- 批量识别按照片串行执行，避免多个 ONNX 推理同时占用大量内存。

### 5.3 LLM 分析和证据约束

- `/api/analyze` 只接收巡检备注和按照片分组的检测 JSON。
- 原始图片不会发送给 LLM Gateway。
- 每个有效 detection 使用稳定的 `photoId::index` 标识。
- LLM 只能引用请求中真实存在的照片名和 detection ID。
- 服务端使用 Zod 校验输出，拒绝模型编造的照片或检测引用。
- LLM 不负责生成 finding ID；服务端校验后统一生成 UUID。

### 5.4 人工审核

- 支持人工新增 finding。
- 支持编辑类别、标题、描述、可见证据、照片、风险、整改建议和不确定事项。
- AI finding 被编辑后保留 UUID，并标记 `modified_by_human: true`。
- 编辑后审核状态自动重置。
- 删除需要二次确认。
- 每一条 finding 都可以批准或驳回。
- 正式提交前必须处理所有待审核 finding。
- 只有批准的 finding 会进入正式云端记录。

### 5.5 本地巡检历史

- IndexedDB 保存文字、分析结果、审核状态、照片 Blob 和 YOLO 检测结果。
- 刷新页面后可以重新载入。
- 载入后不需要重新运行 YOLO 或 LLM。
- 证据跳转和检测框高亮仍然有效。
- 本地记录可以更新或二次确认删除。

### 5.6 云端正式提交

- 页面会读取当前账号可访问的 ACTIVE 项目。
- 先创建仅本人可见的 `DRAFT` 云端巡检。
- 浏览器直接上传照片到私有 `inspection-photos` Bucket，避免 Vercel Function 请求体限制。
- 上传路径为：

```text
{projectId}/{inspectionId}/photos/{photoUuid}.{ext}
```

- 客户端计算并保存：
  - 原文件名
  - MIME type
  - 文件大小
  - 图片宽高
  - SHA-256
  - YOLO 类别、置信度和检测框
  - 人工排除状态
- `submit_inspection_draft` RPC 在一个 PostgreSQL 事务中写入关系数据并把状态改为 `SUBMITTED`。
- RPC 会确认 Storage 对象真实存在且属于当前登录用户。
- 任何关系数据失败都会整体回滚。
- 上传或事务失败时会删除已上传对象，并调用 `abort_inspection_draft` 清理草稿。
- 浏览器客户端没有权限直接修改正式状态或 `submitted_at`。

### 5.7 正式 PDF 报告

- 所有 finding 必须先批准或驳回；还有待审核项时下载按钮不可用。
- 报告只收录人工批准项，驳回项仅进入封面统计。
- PDF 在浏览器本地生成，不额外上传照片或内容。
- 封面包含报告编号、项目、位置、巡检员、时间、摘要、原始备注和审核统计。
- 每条批准问题独占一页，每张照片独占一页，避免分页把内容拆开。
- 照片页会把未被人工排除的 YOLO 框、中文标签和置信度绘制进最终图片。
- 末页包含巡检员/Manager 签名区和 AI 辅助生成免责声明。
- 中文字体随项目提供，许可证见 `public/fonts/OFL.txt`。

### 5.8 云端正式记录读取

- `/inspections` 只列出当前账号通过 Supabase RLS 有权读取的 `SUBMITTED` 与 `ARCHIVED` 巡检。
- 列表汇总 finding、未关闭、高风险、照片和报告数量，并支持进入 `/inspections/[id]`。
- 详情显示项目、巡检员、原始备注、正式 finding、证据、审计事件、私有照片和已归档报告。
- 服务端为私有照片和报告生成 10 分钟 signed URL，浏览器不会收到原始 Storage 路径。
- 证据照片按数据库 detection 坐标绘制 YOLO 框；finding 引用框黄色高亮，违规红色，其余蓝色，人工排除项不绘制。
- 无权限、不存在、非法 UUID 或仍为草稿的记录统一显示中文 404，避免泄露记录存在性。
- `GET /api/inspections` 与 `GET /api/inspections/[id]` 均独立校验登录状态，匿名请求返回 401。

### 5.9 项目管理与 finding 整改闭环

- `/projects` 提供项目列表、汇总和 Manager 创建入口；`/projects/[id]` 提供项目资料、归档和成员管理。
- Manager 可以按已注册邮箱加入 Inspector，并通过二次确认移除成员；Inspector 只能读取自己所属项目。
- `/findings` 提供未关闭、高风险、逾期、待复核统计，以及状态、项目、风险、负责人等筛选。
- `/findings/[id]` 展示原始证据、整改要求、跟进记录、私有整改照片和不可变审计时间线。
- Inspector 只能处理指派给自己的 finding；Manager 可以指派负责人、设置截止日期和风险等级，并关闭或重开问题。
- finding 状态按 `OPEN → ASSIGNED → IN_PROGRESS → AWAITING_VERIFICATION → CLOSED` 受控转换；关闭后的问题可重开。
- 跟进记录只追加不覆盖；整改照片直接上传私有 Storage，关系数据通过事务 RPC 写入。
- HIGH/CRITICAL 问题关闭前必须存在跟进，且至少有一张跟进照片；关闭和重开都要求复核说明。
- 新增、指派、风险/期限变化、评论、证据、状态变化都会写入 `finding_events`。

## 6. Supabase 当前状态

Supabase 项目：`site-inspection-ai`  
Project ref：`zjbkiwatbfujqssibkbs`  
区域：Singapore

已部署四个 migration：

### `202609230001_auth_projects.sql`

创建：

- `profiles`
- `projects`
- `project_members`
- `INSPECTOR` / `MANAGER` 角色
- 新 Auth 用户自动创建 profile 的 trigger
- 第一阶段 RLS

### `202609230002_inspections_findings_storage.sql`

创建 9 张业务表：

- `inspections`
- `inspection_photos`
- `vision_detections`
- `findings`
- `finding_evidence`
- `finding_events`
- `finding_follow_ups`
- `follow_up_photos`
- `generated_reports`

同时创建：

- 私有 `inspection-photos` Bucket
- 私有 `inspection-reports` Bucket
- Storage RLS
- finding 证据一致性 trigger
- finding 创建审计事件 trigger

### `202609230003_submit_inspection_rpc.sql`

创建：

- `submit_inspection_draft(uuid, jsonb)`
- `abort_inspection_draft(uuid)`

两个函数已经在真实 Supabase 中部署，并确认：

- `SECURITY DEFINER = true`
- `authenticated` 可以执行
- `anon` 没有执行权

### `202609250004_project_finding_workflow.sql`

创建：

- `manage_finding(...)`：Manager 指派负责人、调整期限和风险
- `transition_finding_status(...)`：按角色和状态机执行开始整改、提交复核、关闭与重开
- `add_finding_follow_up(...)`：在事务中追加跟进、登记整改照片并可提交复核
- `private.can_delete_unlinked_follow_up_object(text)`：只允许上传者清理尚未关联的失败上传对象
- 私有整改照片的失败上传清理 Storage policy

该 migration 已于 2026-09-25 正式执行。复核确认 4 个函数均为 `SECURITY DEFINER`，`authenticated` 具有执行权，相关 Storage policy 只授予登录用户。

## 7. 权限规则

### Inspector

- 可以读取自己所属项目。
- 只能看到和编辑自己的 DRAFT 巡检。
- Manager 也不能读取其他人的 DRAFT。
- 提交后，同项目成员可以读取正式记录。
- 普通客户端不能直接改变 finding 正式状态。
- 被指派的 Inspector 可以开始整改、追加跟进并提交复核。
- 未指派给自己的 Inspector 不能改变 finding 或追加跟进。

### Manager

- 可以查看项目和已提交的团队记录。
- 可以创建、修改、归档项目并管理 Inspector 成员。
- 不能偷看其他巡检员尚未提交的草稿。
- 通过受控 RPC 指派、调整风险/期限、关闭和重开 finding。

## 8. 关键文件

```text
src/app/page.tsx
  主巡检页面、照片状态、分析结果、审核和提交入口。

src/components/product-shell.tsx
  企业工作台外壳；包含桌面侧边导航、顶部栏、系统状态和后续模块占位。

src/app/login/page.tsx
  双栏企业登录入口；保留原有 Supabase 登录与巡检员注册 Server Actions。

src/lib/vision.ts
  ONNX Runtime Web、YOLO 预处理、输出解析、NMS 和坐标还原。

src/app/api/analyze/route.ts
  LLM 请求、提示词、证据约束和输出校验。

src/lib/schemas.ts
  AI 分析结果的 Zod Schema。

src/components/finding-editor.tsx
  人工新增和编辑 finding。

src/components/inspection-history.tsx
  IndexedDB 本地历史界面。

src/lib/inspection-store.ts
  IndexedDB 数据访问层。

src/components/cloud-submission.tsx
  云端项目选择、审核计数、提交进度和结果提示。

src/components/report-download.tsx
  浏览器端正式 PDF 下载、证据图检测框绘制和报告数据组装。

src/components/inspection-report-document.tsx
  A4 PDF 模板、中文字体、问题页、证据页、页眉页脚和签字区。

src/lib/cloud-inspection.ts
  图片哈希、直传 Storage、载荷构造、正式提交和失败清理。

src/lib/cloud-inspection-schema.ts
  云端提交的共享 Zod Schema。

src/lib/cloud-inspection-queries.ts
  服务端正式记录读取、RLS 查询、列表聚合和私有对象 signed URL。

src/app/inspections/page.tsx
  云端正式巡检列表和汇总。

src/app/inspections/[id]/page.tsx
  巡检详情、finding、照片检测框、审计事件和报告归档。

src/app/api/projects/route.ts
  GET 返回当前用户可访问的 ACTIVE 项目；POST 仅允许 Manager 创建项目。

src/app/projects/ 和 src/app/api/projects/[id]/
  项目列表/详情、资料维护、归档，以及按邮箱添加和移除 Inspector 成员。

src/app/findings/ 和 src/app/api/findings/
  finding Dashboard、详情、筛选，以及指派、状态转换和跟进 API。

src/components/finding-workflow-panel.tsx
  Manager 管理和 Inspector 整改操作面板；包括私有跟进照片直传与失败清理。

src/lib/project-queries.ts 和 src/lib/finding-queries.ts
  依赖 Supabase RLS 的服务端项目/finding 查询与页面 DTO。

src/app/api/inspections/drafts/route.ts
  创建受保护云端草稿。

src/app/api/inspections/[id]/route.ts
  GET 正式记录详情；POST 正式提交；DELETE 失败清理。

src/app/api/inspections/route.ts
  当前账号可读取的正式巡检列表。

supabase/migrations/
  已部署数据库结构、RLS、Storage policy、正式提交 RPC 和 finding 整改工作流 RPC。

docs/COLLABORATION_SYSTEM_DESIGN.md
  多人协作、权限矩阵、finding 状态机和 Dashboard 设计。

docs/ADR-001-CLOUD-STACK.md
  Supabase + IndexedDB 技术选型。

AI_HANDOFF.md
  更详细的功能演进、历史验收和后续 AI 工作说明。
```

## 9. 本地运行

要求：

- Node.js
- npm
- 项目根目录存在有效 `.env.local`

命令：

```powershell
cd E:\Hackathon\site-inspection-ai
npm install
npm run dev
```

访问：

```text
http://localhost:3000
```

环境变量名称：

```dotenv
LLM_GATEWAY_URL=
LLM_GATEWAY_API_KEY=
LLM_MODEL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

不要提交 `.env.local`、密码、Secret Key、Service Role Key、OIDC Token 或其他凭证。

## 10. 推荐演示流程

1. 使用 Inspector 登录。
2. 选择 2–3 张施工照片。
3. 点击“识别全部照片”。
4. 切换照片查看检测框。
5. 取消勾选一个明显误检。
6. 输入巡检备注并开始分析。
7. 点击 finding 的证据照片，展示跳转和黄色高亮框。
8. 人工修改一条 finding，展示审核状态被重置。
9. 批准有效 finding、驳回无效 finding。
10. 保存一次本地历史。
11. 点击“下载正式 PDF 报告”，展示问题页和带检测框的证据照片页。
12. 选择项目并提交云端。
13. 打开“云端记录”，展示刚提交的正式记录和带检测框的详情页。

## 11. 已完成的验证

- ESLint 通过。
- TypeScript 严格检查通过。
- `git diff --check` 通过。
- `npm run build` 通过。
- Next.js 生产构建包含：
  - `/`
  - `/login`
  - `/api/analyze`
  - `/api/projects`
  - `/api/inspections/drafts`
  - `/api/inspections`
  - `/api/inspections/[id]`
- 生产构建还包含 `/inspections`、`/inspections/[id]`、`/projects`、`/projects/[id]`、`/findings` 和 `/findings/[id]`，以及对应项目/整改 API。
- 匿名访问 finding 列表/详情、项目创建和状态转换接口均返回 HTTP 401。
- Supabase 四个 migration 均已执行。
- 9 张业务表全部启用 RLS。
- 两个 Storage Bucket 都是 private。
- 正式提交和失败清理 RPC 已在系统表中验证存在和权限。
- 多照片识别、误检排除、LLM 证据分组、finding 编辑、证据高亮和本地历史恢复均做过浏览器端验收。
- 正式 PDF 已使用真实本地巡检记录完成浏览器下载；3 页 A4 报告经 Poppler 渲染确认中文、检测框、页眉页脚和签字区无溢出。
- 云端列表已在真实登录会话中验证空状态；不存在或不可见的详情 UUID 会进入统一中文 404。
- 匿名访问正式记录列表和详情 GET API 均返回 HTTP 401。
- 真实 Inspector 会话已打开 `/projects` 和 `/findings`：只能看到 Inspector 权限，空状态和筛选正确，未暴露 Manager 操作。
- 第四个 migration 的 4 个函数和失败上传清理 policy 已在系统目录复核；综合权限查询返回 `all_permissions_verified = true`。

## 12. 当前已知限制

- 当前只有用于页面检查的 Inspector 登录会话；没有 Manager、项目、正式巡检或 finding 测试数据。
- 因此最新云端提交链路尚未使用真实账号完成一次完整照片提交验收。
- 项目管理和 finding 整改代码已完成，但因缺少 Manager、项目和正式 finding 数据，尚未完成真实多角色事务验收。
- 浏览器端 PDF 已完成，但尚未上传到私有 `inspection-reports` Bucket，也未写入 `generated_reports`；Word 尚未实现。
- LLM 看不到原图，只能使用检测 JSON 和文字备注。
- 当前 YOLO 模型主要识别 PPE，不能可靠判断通道堵塞、电缆布置或材料堆放关系。
- 模型和训练数据许可证适合黑客松原型；商业发布前必须重新审查。

## 13. 接手后的第一组任务

建议严格按以下顺序推进：

### 第一步：建立测试角色

1. 注册一个 Manager 候选账号和两个 Inspector 账号。
2. 在受信任的 Supabase SQL Editor 中把 Manager 候选 profile 提升为 `MANAGER`。
3. 不要把密码写进代码、SQL migration 或文档。

### 第二步：建立项目和成员关系

1. Manager 创建一个测试项目。
2. 把两个 Inspector 加入项目。
3. 验证 Inspector 只能看到自己所属项目。

### 第三步：真实验收正式提交

1. Inspector A 上传照片并生成 findings。
2. 保留至少一条批准项和一条驳回项。
3. 执行云端正式提交。
4. 在 Supabase 检查照片、detections、findings、evidence 和事件数量。
5. 确认驳回项没有进入正式 findings。
6. 确认巡检状态为 `SUBMITTED`。

### 第四步：验证 RLS

1. Inspector B 不能查看 A 的 DRAFT。
2. Inspector B 可以查看同项目内 A 的 SUBMITTED 记录。
3. 非项目成员不能查看该项目记录或私有照片。
4. Manager 可以查看已提交记录，但不能查看 A 的 DRAFT。
5. 人为制造一次提交失败，确认照片和草稿被清理。

### 第五步：验收正式记录与整改界面

1. 确认 Inspector A 提交后列表出现新记录。
2. 确认 Inspector B 只能读取同项目正式记录。
3. 确认详情照片 signed URL、detection 框、finding 证据和审计事件正确。
4. Manager 指派 finding、设置截止日期和风险；Inspector 开始整改、上传照片并提交复核。
5. Manager 关闭和重开 finding，确认审计事件完整、其他 Inspector 无权操作。

## 14. 推荐的后续开发顺序

1. 用一个 Manager 和两个 Inspector 完成项目、提交、RLS 与整改闭环真实验收。
2. PDF 云端归档和报告历史下载；如演示确有需要再增加 Word。
3. Vercel 环境变量和正式部署验收。
4. 真实施工照片评估、阈值调整和自有模型训练。

不要优先做 LangChain、向量数据库或多 Agent。除非新的需求明确需要知识检索、后台长期任务或多工具自治，否则这些基础设施会增加复杂度，却不会直接完成当前演示闭环。

## 15. 安全和真实性底线

后续开发不得破坏：

1. 不得声称当前 LLM 已经直接看懂原图。
2. 原图不得发送给不支持视觉输入的网关。
3. 所有 AI finding 必须经过人工审核。
4. 不得用“没有检测到”推断目标一定不存在。
5. `Person`、`Hardhat`、`Safety Vest` 等普通检测本身不是违规。
6. 不得让 LLM 引用不存在的照片或检测框。
7. 不得把不同照片里的目标描述成同一个对象或空间关系。
8. 不得把 Supabase Secret/Service Role Key 放进浏览器。
9. 正式状态变化必须走受控 RPC，不要直接开放表字段更新。
10. 不得删除人工排除误检和人工编辑 finding 的能力。

## 16. Git 协作规范

开始工作：

```powershell
git status --short
git pull --ff-only origin main
```

完成工作：

```powershell
npm run lint
npx tsc --noEmit --incremental false
npm run build
git diff --check
git status --short
```

注意：

- 不要使用 `git reset --hard` 覆盖他人改动。
- 不要提交 `.env.local` 或 `datasets/`。
- 每个阶段使用小而明确的 commit。
- 修改功能后同步更新 `TEAM_HANDOFF.md` 和 `AI_HANDOFF.md`。

## 17. 常见问题

### 页面要求登录

这是预期行为。未登录用户会被 Proxy 重定向到 `/login`。

### 登录后没有可选项目

当前账号还没有加入任何 ACTIVE 项目，需要 Manager 创建项目并添加成员。

### 云端提交按钮不可用

检查：

- 是否已选择项目。
- 是否至少有一张照片。
- 是否已完成分析。
- 是否逐条批准或驳回所有 findings。
- 是否已经成功提交过当前版本。

### 图片会不会发送给 LLM

不会。YOLO 在浏览器本地运行，LLM 只接收检测 JSON 和文字备注；只有用户点击正式提交时，照片才进入 Supabase 私有 Storage。

### `npm run build` 无法写入 `.next`

通常是 `next dev` 仍在运行。先正常停止开发服务器，再重新构建，不要用破坏性 Git 命令解决。

## 18. 给下一位 AI 助手的起始提示

可以把下面这段直接交给下一位编程助手：

```text
请先完整阅读 AGENTS.md、TEAM_HANDOFF.md、AI_HANDOFF.md、
docs/COLLABORATION_SYSTEM_DESIGN.md 和 docs/ADR-001-CLOUD-STACK.md。
检查 git status，保护已有改动，并以 origin/main 最新提交为基线。
下一步先建立 Manager + 两个 Inspector + 一个项目，真实验收云端提交、记录列表/详情、RLS 和已实现的 finding 整改闭环，
然后实现 PDF 私有归档并完成 Vercel 演示部署，
不要先引入 LangChain、向量数据库或多 Agent，也不要把图片发送给当前 LLM 网关。
每个阶段完成后运行 lint、TypeScript、build 和 git diff --check，并更新交接文档。
```

## 19. 相关文档

- `AI_HANDOFF.md`：完整实现历史、验证记录与技术细节。
- `docs/COLLABORATION_SYSTEM_DESIGN.md`：协作产品模型和权限设计。
- `docs/ADR-001-CLOUD-STACK.md`：云端技术选型决策。
- `supabase/README.md`：migration、Storage 和 Manager 初始化说明。
- `public/models/README.md`：YOLO 模型来源、哈希和许可证提示。
