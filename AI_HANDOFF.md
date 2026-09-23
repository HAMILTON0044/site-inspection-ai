# Site Inspection AI — AI 协作交接文档

最后更新：2026-09-23

本文档供项目组成员及后续 AI 编程助手使用。开始修改前，请先完整阅读本文档和根目录的 `AGENTS.md`。

多人协作、角色权限、云端数据模型和问题状态机的正式设计见 `docs/COLLABORATION_SYSTEM_DESIGN.md`。云端技术选型见 `docs/ADR-001-CLOUD-STACK.md`。开始登录或数据库开发前必须先阅读这两份文档。

## 1. 项目目标

施工主管日常巡检需要整理现场照片、文字备注、观察结果和整改措施。当前原型希望缩短这一流程：

1. 巡检员选择施工现场照片。
2. 浏览器内的 YOLOv8n 模型读取图片并生成目标检测结果。
3. 巡检员排除误检结果。
4. 系统只把结构化检测 JSON 和文字备注发送给黑客松指定 LLM。
5. LLM 生成等待人工审核的巡检问题草稿。
6. 巡检员可以新增、修改、删除、批准或驳回每一条问题。
7. 完整巡检记录和照片可以保存到当前浏览器并在刷新后恢复。

原始照片不会发送给 LLM，也不依赖 LLM 网关的视觉能力。

## 2. 当前架构

```text
浏览器选择照片
    ↓
ONNX Runtime Web + YOLOv8n
    ↓
检测框、类别、置信度
    ↓
人工取消误检项目
    ↓
结构化检测 JSON + 巡检备注
    ↓
Next.js /api/analyze
    ↓
黑客松指定 LLM Gateway
    ↓
Zod 校验后的巡检问题草稿
    ↓
人工新增、修改、删除、批准或驳回
    ↓
浏览器 IndexedDB 本地巡检历史
```

技术栈：

- Next.js 16.3.5（App Router）
- React 19.2.8
- TypeScript 5
- Tailwind CSS 4
- Zod 4
- ONNX Runtime Web 1.30
- YOLOv8n 施工 PPE 模型

## 3. 已完成功能

### 3.1 文字巡检分析

- 接收巡检备注。
- 通过指定 LLM 生成结构化 JSON。
- 使用 Zod 校验模型输出。
- 支持四种问题类别：
  - `BLOCKED_ACCESS`
  - `UNSAFE_CABLE`
  - `MISSING_PPE`
  - `IMPROPER_STORAGE`
- 风险等级支持 `LOW`、`MEDIUM`、`HIGH`、`CRITICAL`、`UNCONFIRMED`。
- 每个问题必须保持 `AI_DRAFT` 和 `requires_human_review: true`。
- 页面支持批准或驳回单条问题。

### 3.2 浏览器内图片识别

- 图片不上传服务器，在浏览器中完成推理。
- 支持 JPEG、PNG 和 WebP。
- 单张图片最大 10 MB。
- ONNX 模型输入为 `1 × 3 × 640 × 640`。
- 支持以下类别：
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
- 页面在原图上绘制检测框、中文类别和置信度。
- 违规候选使用红框，普通目标使用蓝框。
- 默认置信度阈值为 0.35，NMS IoU 阈值为 0.45。

### 3.3 人工排除误检

- 每条检测结果都有勾选框。
- 取消勾选后，该结果不会进入 `/api/analyze` 请求。
- 切换照片会保留各自的检测和排除状态；重新识别某张照片时，只重置该照片的人工排除项。

### 3.4 多照片选择与独立检测状态

- 一次最多选择 10 张照片。
- 页面显示照片编号和文件名。
- 可以切换当前预览照片，并查看或排除该照片的检测结果。
- “开始分析”会自动识别尚未处理的照片，并汇总所有成功识别照片的有效检测结果。
- 每张照片独立保存识别状态、检测结果、错误信息和人工排除项。
- 切换照片会恢复该照片已有的检测框和勾选状态，无需重新识别。
- 照片列表显示未识别、识别中、识别失败或已识别项目数量。
- “识别全部照片”会按选择顺序串行处理，避免同时运行多个模型推理造成内存峰值。
- 已成功识别的照片会自动跳过，失败照片可以再次批量重试。
- 页面显示完成数、总数、当前文件名和失败数；单张失败不会中断后续照片。
- `/api/analyze` 接收按 `photoId` 和 `photoName` 分组的 `photoEvidence`，不接收原始图片。
- 每条分析结果通过 `evidence_photos` 返回真实证据文件名；API 会拒绝模型编造的文件名。

### 3.5 稳定 finding ID 与人工编辑

- LLM 只负责返回 finding 内容，不负责生成 ID。
- `/api/analyze` 在模型输出通过 Zod 校验后，为每条 AI finding 生成 UUID。
- 审核状态以 UUID 为键，不再依赖数组下标；新增、删除或排序不会让审核状态错位。
- 支持人工新增 finding，并标记为 `origin: "HUMAN"`、`status: "HUMAN_DRAFT"`。
- 支持修改问题类别、标题、描述、可见证据、证据照片、风险等级、整改措施和待确认事项。
- AI finding 被人工修改后保留原 UUID，并标记 `modified_by_human: true`。
- finding 内容发生修改后，其批准或驳回状态会重置为“等待审核”。
- 删除采用“删除 → 确认删除/取消删除”两步操作，降低误删风险。
- 切换当前预览照片不再清空整份分析结果。

### 3.6 证据照片跳转与检测框高亮

- 浏览器为每个发送给 LLM 的有效检测结果生成稳定的 `detectionId`。
- LLM finding 通过 `evidence_detection_ids` 引用实际检测结果；缺少该字段时兼容为空数组。
- `/api/analyze` 会拒绝不存在的检测 ID，以及不属于该 finding 证据照片的检测 ID。
- finding 的证据照片名称已改为“查看照片”按钮。
- 点击按钮会切换到对应照片，自动滚动到预览画布，并以黄色高亮关联检测框。
- 下方视觉检测结果列表也会同步以黄色背景和描边标记关联项。
- 人工新增或没有精确检测引用的 finding 仍可跳转整张照片，但会提示需要人工查看。

### 3.7 本地巡检历史与审核状态恢复

- 使用浏览器 IndexedDB 保存完整巡检记录，不需要额外数据库或账号。
- 保存内容包括文字备注、分析结果、finding UUID、人工修改、批准/驳回状态和当前照片。
- 原始照片以 Blob 保存，同时保留 YOLO 检测结果、误检排除项和每张照片的检测状态。
- 刷新页面后可以从历史面板载入记录，无需重新运行 YOLO 或 LLM。
- 载入后会重建照片预览 URL，证据照片跳转和检测框高亮仍然有效。
- 已载入记录可以通过“更新当前记录”覆盖保存；选择一批新照片会自动切换为新记录，避免误覆盖旧历史。
- 历史记录删除采用“删除 → 确认删除/取消”两步操作；删除历史不会清空当前页面内容。
- 当前实现是单浏览器本地存储，不会在不同设备或浏览器之间同步。

### 3.8 Supabase 云端基础

- 已创建 Supabase 项目 `site-inspection-ai`，区域为 Singapore，项目状态为 Healthy。
- 已配置本地 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`；`.env.local` 不提交 Git。
- 已安装 `@supabase/supabase-js` 和 `@supabase/ssr`。
- 已新增浏览器端与服务端 Supabase client 封装。
- 首个数据库 migration 已在云端执行，创建 `profiles`、`projects`、`project_members`、角色枚举、Auth 用户 trigger 和 RLS policies。
- 云端复核结果：`profiles` 2 条 policy、`projects` 3 条 policy、`project_members` 3 条 policy。
- 目前尚未把登录界面和云端表接入现有巡检页面；IndexedDB 仍是当前可用的数据层。

### 3.9 登录、注册与访问保护

- 新增 `/login` 登录和注册页面，支持邮箱密码认证与巡检员姓名 metadata。
- 新注册用户仍由数据库 trigger 固定创建为 `INSPECTOR`，前端不能把自己提升为 Manager。
- Next.js 16 `proxy.ts` 会刷新 Supabase 会话；未登录访问 `/` 会重定向到 `/login`，已登录访问 `/login` 会返回工作台。
- 根布局在已登录时显示当前用户、角色和退出按钮。
- `/api/analyze` 在服务端独立调用 `getClaims()` 校验身份，匿名请求返回 `401`，不只依赖页面跳转。
- 已使用真实测试账号验证注册、邮件确认、登录、profile trigger 和默认 Inspector 角色；验收结束后已删除测试账号及其关联 profile。

### 3.10 云端巡检、问题闭环与私有 Storage

- 第二个 Supabase migration 已创建巡检、照片、视觉检测、finding、证据、事件、跟进、跟进照片和生成报告共 9 张业务表。
- 草稿只有创建者可见；Manager 也不能读取其他人的草稿。提交后的记录才对同项目成员和 Manager 可见。
- finding 原始内容只能在所属巡检仍为草稿时修改或删除；正式记录不开放客户端直接删除。
- finding 证据 trigger 会拒绝跨巡检照片引用，以及 detection 与照片不匹配的引用。
- 新 finding 会自动写入不可由普通客户端伪造的 `CREATED` 审计事件。
- 跟进记录采用只追加模型；普通客户端不具备更新或删除既有跟进的权限。
- 已创建私有 `inspection-photos` 和 `inspection-reports` Bucket，并用项目 UUID、巡检 UUID、对象所有者和巡检状态限制访问。
- migration 先在真实 Supabase 使用事务回滚完成无副作用测试，再正式执行。
- 云端复核确认：9 张表全部启用 RLS、业务表策略数量正确、5 条 Storage policy 存在，照片和报告 Bucket 均为 private。
- 当前前端尚未调用这些表和 Bucket；IndexedDB 仍负责现有本地草稿。

## 4. 关键文件

```text
src/app/page.tsx
  页面状态、照片选择、当前照片切换、检测框绘制、误检排除、分析结果和人工审核。

src/components/finding-editor.tsx
  人工新增和编辑 finding 的受控表单；包括照片证据多选和基础必填校验。

src/components/inspection-history.tsx
  本地巡检历史面板；负责保存、载入和二次确认删除的交互。

src/lib/inspection-store.ts
  IndexedDB 数据层；保存分析结果、审核状态、照片 Blob 和检测结果。

docs/COLLABORATION_SYSTEM_DESIGN.md
  多人协作产品规则、权限矩阵、数据模型、状态机、页面与 API 设计。

docs/ADR-001-CLOUD-STACK.md
  Supabase Auth、PostgreSQL、Private Storage 和 IndexedDB 的技术选型。

supabase/migrations/202609230001_auth_projects.sql
  第一阶段 profiles、projects、project_members 表和 RLS；已在 Supabase 云端执行。

supabase/migrations/202609230002_inspections_findings_storage.sql
  巡检、finding 闭环、审计记录、私有照片和报告 Storage 的云端结构与 RLS；已在 Supabase 云端执行。

src/lib/supabase/client.ts
  浏览器端 Supabase client；只使用公开的 Project URL 和 Publishable key。

src/lib/supabase/server.ts
  Next.js 服务端 Supabase client；通过 cookies 共享登录会话。

src/lib/supabase/proxy.ts
  刷新 Supabase 会话，并执行登录页与工作台之间的访问控制。

src/proxy.ts
  Next.js 16 Proxy 入口；当前匹配 `/` 和 `/login`。

src/app/login/page.tsx
  邮箱密码登录和巡检员注册页面。

src/app/login/actions.ts
  登录、注册 Server Actions；注册角色不接受客户端输入。

src/app/auth/actions.ts
  退出登录 Server Action。

src/components/auth-status.tsx
  已登录用户身份、角色和退出按钮。

src/lib/vision.ts
  浏览器端动态加载 ONNX Runtime、图片 letterbox 预处理、YOLO 输出解析、坐标还原和 NMS。

src/app/api/analyze/route.ts
  请求校验、提示词、视觉证据约束、LLM 调用和返回结果校验。

src/lib/llm.ts
  黑客松指定 LLM Gateway 请求。

src/lib/schemas.ts
  巡检分析结果的 Zod Schema 和 TypeScript 类型。

public/models/construction-ppe-yolov8n.onnx
  浏览器使用的 YOLOv8n ONNX 模型，约 11.7 MB。

public/models/README.md
  模型来源、类别、哈希和许可证说明。

scripts/test-gateway.mjs
  网关测试脚本。
```

## 5. 本地运行

要求：

- Node.js
- npm
- 已配置 `.env.local`

安装并运行：

```powershell
cd E:\Hackathon\site-inspection-ai
npm install
npm run dev
```

浏览器访问：

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

不要把 `.env.local`、API Key、OIDC Token 或其他凭证提交到 Git。

## 6. 常用检查命令

```powershell
npm run lint
npx tsc --noEmit --incremental false
npm run build
git diff --check
git status --short
```

如果 `npm run build` 报错无法写入 `.next/trace`，通常是另一个 `next dev` 进程正在占用 `.next`。先正常停止开发服务器，再执行构建。不要使用破坏性 Git 命令处理该问题。

## 7. 已验证的行为

以下内容已经实际验证：

- ONNX 文件结构检查通过。
- 模型可以在本地浏览器加载并运行。
- 赛车手测试图识别出 `Person`。
- 施工测试图识别出 `Person`、`Hardhat`、`Safety Vest`、`NO-Mask` 和 `machinery`。
- 检测框和中文置信度可以显示。
- `Person` 等普通类别不会单独生成违规 finding。
- 合成的 `NO-Hardhat` 91% 证据会生成 `MISSING_PPE` 草稿。
- `NO-Mask` 证据会生成风险待确认的问题，并提示核实现场是否要求佩戴口罩。
- 取消勾选的误检不会发送给 LLM。
- 两张照片可以同时选择并切换。
- 两张照片可以分别保存检测结果。
- 切换照片后检测框和人工排除状态可以正确恢复。
- “识别全部照片”可以串行完成两张照片，进度由 `0/2` 更新至 `2/2`。
- 批量测试中两张照片分别保存了 12 项和 6 项检测结果，浏览器控制台无错误。
- 使用本地 Construction-PPE 数据集的三张测试图完成端到端验证，分别识别出 3、7、3 项。
- 多照片 LLM 分析分别把 `NO-Mask` 证据标记为 `image1.jpeg`，把 `NO-Hardhat` 证据标记为 `image10.jpeg`，未错误引用无违规 finding 的第三张照片。
- AI finding 返回服务端 UUID；批准状态按 UUID 保存。
- 已批准 finding 被人工修改后，UUID 保持不变，审核状态重置为等待审核，并显示“已人工修改”。
- 人工新增 finding 后记录数量正确增加，并显示“人工新增”。
- 删除按钮会先显示“确认删除”和“取消删除”；浏览器验收未执行最终删除，以保留测试记录。
- 使用 `image10.jpeg` 完成证据跳转端到端验证：YOLO 检出 7 项，LLM 返回 1 条未佩戴安全帽 finding，点击证据照片后正确跳转并高亮 1 个检测框。
- 使用同一张照片完成本地历史端到端验证：批准 finding 后保存记录，刷新页面并载入，1 张原始照片、7 个检测结果、1 条 finding 和“已批准”状态全部恢复。
- 恢复历史后再次点击证据照片，仍正确跳转并高亮 1 个检测框。
- ONNX Runtime 已改为仅在浏览器开始识别时动态加载，Next.js 正式生产构建可以完成静态预渲染。
- `npm run build` 已通过。
- 使用 `next start` 启动生产版本后，`image1.jpeg` 成功识别出 3 项，浏览器控制台无错误。
- ESLint、TypeScript 和 `git diff --check` 已通过。
- npm 安全审计为 0 个漏洞。
- Supabase 项目创建成功且状态为 Healthy，主数据库位于 Singapore。
- 首个云端 migration 执行成功；复核查询返回 `profiles`、`projects`、`project_members` 及 2、3、3 条 RLS policies。
- Supabase client 新增后，ESLint 与 TypeScript 严格类型检查通过。
- 匿名访问 `/` 会跳转到 `/login`，登录与注册表单可见。
- 匿名 POST `/api/analyze` 返回 HTTP 401。
- 认证页面、Proxy 和 API 权限校验新增后，ESLint、TypeScript 与 `git diff --check` 通过。
- 真实测试账号完成注册、邮箱确认和登录；`profiles` 自动生成且角色为 `INSPECTOR`、`is_active = true`。
- 删除 Supabase Auth 测试账号后，用户列表为空，对应 `profiles` 记录由外键级联删除，复核数量为 0。
- 停止开发服务器后，包含 `/`、`/login`、`/api/analyze` 和 Proxy 的正式 `npm run build` 已通过；开发服务器随后已恢复。
- 第二个 migration 的 `BEGIN ... ROLLBACK` 无副作用测试成功，正式执行也返回成功。
- 9 张新增业务表全部为 `rls=true`；策略数依次为 inspections 3、inspection_photos 3、vision_detections 4、findings 4、finding_evidence 3、finding_events 1、finding_follow_ups 2、follow_up_photos 2、generated_reports 2。
- `inspection-photos` 和 `inspection-reports` Bucket 均为 private，限制分别为 10 MB 和 25 MB；5 条 Storage policy 已复核存在。

## 8. 安全与真实性约束

后续修改不得破坏以下约束：

1. 原始图片不得伪装成已经被 LLM 网关理解。
2. LLM 只能使用文字备注和明确提供的检测 JSON。
3. `NO-Hardhat`、`NO-Safety Vest`、`NO-Mask` 只能产生 `MISSING_PPE` 候选。
4. `Person`、`Hardhat`、`Mask`、`Safety Vest`、`Safety Cone`、`machinery`、`vehicle` 本身不是违规。
5. 当前视觉模型不能判断通道堵塞、电缆布置或材料堆放是否违规。
6. 不得依据“没有检测到”推断某个物体一定不存在。
7. 所有 AI 问题都必须等待人工审核。
8. 视觉模型可能误检；不要删除人工排除检测结果的能力。
9. `evidence_photos` 只能引用当前请求 `photoEvidence` 中真实存在的 `photoName`。
10. 不得把不同照片里的目标描述成互相存在空间关系或同一个人、物体。

## 9. 当前限制

- YOLO 模型主要覆盖 PPE 和常见施工物体。
- `NO-Mask` 不等于现场一定违规，因为部分区域不强制佩戴口罩。
- 普通帽子可能被误认为安全帽。
- 小目标、遮挡、逆光、夜间和模糊图片可能降低准确率。
- LLM 只接收按照片分组的检测 JSON，仍然看不到原始图片。
- 尚未生成正式 PDF 或 Word 巡检报告。
- 巡检历史目前只保存在当前浏览器的 IndexedDB 中，不支持跨浏览器、跨设备或团队同步。
- 历史列表会读取包含照片 Blob 的完整记录；若记录数量和照片体积大幅增加，需要拆分摘要与照片存储。
- 云端业务表和私有 Bucket 已建立，但现有页面尚未实现“提交巡检”云端事务、正式记录读取或 Dashboard。
- 当前没有保留测试账号；Manager 提升和多角色权限隔离仍需后续重新创建测试账号验收。

## 10. 模型与许可证

模型来源：

<https://github.com/snehilsanyal/Construction-Site-Safety-PPE-Detection>

导出模型的元数据标记 Ultralytics AGPL-3.0。第三方仓库没有为自定义权重和训练数据给出足够清晰的独立许可证说明。因此：

- 当前模型适合黑客松原型展示。
- 商业发布前必须完成许可证审查。
- 更稳妥的长期方案是使用授权清晰的数据集自行训练模型。

详细哈希见 `public/models/README.md`。

本机另有用于测试的 Ultralytics Construction-PPE 数据集：

```text
datasets/construction-ppe
```

该目录约 171 MB，包含 1,416 张图片，已由根目录 `.gitignore` 的 `/datasets/` 规则排除，不会上传 GitHub。它只用于本地测试，目前没有训练新模型。

## 11. Git 状态与关键提交

主要功能提交：

```text
62eb45c feat: add browser-based PPE image detection
a8753c0 feat: allow excluding false-positive detections
85b4230 feat: add multi-photo selection
694f329 feat: preserve detection state per photo
```

远程仓库：

<https://github.com/HAMILTON0044/site-inspection-ai>

开发前建议执行：

```powershell
git status --short
git pull --ff-only origin main
```

不要使用 `git reset --hard` 或覆盖他人未提交改动。

## 12. 推荐的下一阶段

优先完成“认证与项目权限基础”：

1. Supabase 项目、本地环境变量和 client 封装已经完成。
2. User、Project、ProjectMember 数据结构和第一阶段 RLS 已经部署。
3. 登录、注册、受保护路由和服务端权限校验已通过单账号验收；下一步验证 Manager 提升和多账号权限隔离。
4. 保留 IndexedDB 作为未提交草稿层，不要直接删除当前本地历史能力。
5. 使用两个 Inspector 和一个 Manager 验证项目权限隔离。

当前照片状态结构：

```ts
type SelectedPhoto = {
  id: string;
  file: File;
  previewUrl: string;
  detectionStatus: "IDLE" | "RUNNING" | "DONE" | "ERROR";
  detections: VisionDetection[];
  excludedDetectionIndexes: number[];
  error: string;
};
```

当前多照片证据请求结构：

```json
{
  "note": "三层东侧施工区域",
  "photoEvidence": [
    {
      "photoId": "photo-1",
      "photoName": "east-side-01.jpg",
      "detections": [
        {
          "detectionId": "photo-1::0",
          "label": "NO-Hardhat",
          "confidence": 0.91,
          "box": {
            "x": 10,
            "y": 20,
            "width": 100,
            "height": 200
          }
        }
      ]
    }
  ]
}
```

## 13. 后续任务清单

建议顺序：

1. 实现受控的“提交巡检”服务端事务，把本地已审核结果和照片同步到云端。
2. 创建首个 Manager，并使用两个 Inspector 和一个 Manager 验证项目与巡检 RLS 隔离。
3. 验证退出、刷新 token、删除或禁用账号后的会话行为。
4. 实现项目 finding Dashboard 和整改状态机。
5. 生成带证据照片文件名和检测框快照的 PDF 或 Word 报告。
6. 使用现场照片评估置信度阈值和误检率。
7. 收集并标注 `BLOCKED_ACCESS`、`UNSAFE_CABLE`、`IMPROPER_STORAGE` 数据。
8. 训练许可证清晰的自有模型。
9. 停止开发服务器后执行完整 `npm run build`。
10. 部署后检查 ONNX 模型、WASM 资源、Supabase 和网关环境变量。

## 14. 给后续 AI 的工作要求

- 修改前先检查 `git status`，保护已有改动。
- 遵守 `AGENTS.md` 中的 Next.js 版本说明，写代码前查阅本地 Next.js 文档。
- 使用小提交，每个阶段先检查再提交。
- 不要读取、输出或提交 `.env.local` 中的秘密。
- 不要重新尝试把图片直接塞给当前 LLM 网关；该路径已经验证不可用。
- 不要声称 YOLO 能判断它没有训练过的安全关系。
- 优先保持浏览器本地推理，除非团队明确决定增加 Python/FastAPI 服务。
- 每次视觉状态重构后都要测试换图、误检排除和 LLM 请求数据。
- 更新功能后同步更新本文档，并推送 GitHub。
