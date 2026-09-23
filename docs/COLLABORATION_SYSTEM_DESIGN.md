# Site Inspection AI — 协作与问题闭环系统设计

最后更新：2026-09-23

本文档定义账号、权限、巡检报告、问题 Dashboard 和整改闭环。它是后续登录、数据库和页面开发的产品与技术基线。

认证、数据库和对象存储选型已经确定，见 `docs/ADR-001-CLOUD-STACK.md`。

## 1. 产品目标

系统不仅生成巡检报告，还要完成以下闭环：

```text
发现问题 → 人工确认 → 提交报告 → 分配问题 → 整改跟进 → 复核 → 关闭
```

AI 只负责辅助识别和起草。所有正式 finding、状态变化和关闭决定都由已登录用户执行，并保留审计记录。

## 2. MVP 范围

第一版支持：

- 账号密码登录。
- `INSPECTOR`（巡检员）和 `MANAGER` 两种角色。
- Manager 创建项目并添加巡检员。
- 巡检员在自己参与的项目中创建巡检。
- 浏览器 YOLO + 指定 LLM 生成 finding 草稿。
- 巡检员人工修改和确认后提交正式报告。
- 已提交 finding 进入项目问题 Dashboard。
- Manager 指派负责人、设置截止时间和调整优先级。
- 巡检员上传跟进说明和整改照片。
- Manager 复核并关闭或重新打开问题。
- 保存完整状态变更和证据时间线。
- 导出 PDF/Word 报告。

第一版暂不支持：

- 多级组织结构和多级审批。
- 实时聊天。
- 自动派单。
- 向量数据库。
- 多 Agent 协作。
- 跨组织共享。

## 3. 核心设计决策

### 3.1 报告和问题必须分离

`Inspection` 是一次巡检活动及其正式记录。

`Finding` 是报告中一个需要跟踪的问题。一份报告可以没有 finding，也可以包含多个状态不同的 finding。

```text
Inspection INS-2026-001
├── Finding F-001：未佩戴安全帽 → CLOSED
├── Finding F-002：通道堵塞     → IN_PROGRESS
└── Finding F-003：电缆未固定   → AWAITING_VERIFICATION
```

Dashboard 默认展示未关闭的 finding，而不是简单堆放报告。

### 3.2 草稿私有，提交后项目内可见

- 巡检草稿只对创建者可见。
- 同项目巡检员可以查看已提交报告和开放 finding。
- 同项目巡检员不能修改其他人的原始报告或 finding 原文。
- 其他巡检员可以通过跟进记录补充说明和新证据。
- Manager 可以查看和管理其负责项目内的全部记录。

### 3.3 关闭问题不等于删除记录

问题关闭后从默认的“开放问题”视图消失，但仍保留在历史中。正式报告、finding、整改证据和审计日志不得因关闭而删除。

### 3.4 本地优先，提交后云端同步

- 未提交工作继续使用 IndexedDB，避免刷新或断网导致内容丢失。
- 点击“提交巡检”后，结构化记录写入云端数据库，照片写入对象存储。
- 提交成功后保留本地缓存；云端记录是团队协作的权威版本。
- 本地保存不等于正式提交。

## 4. 角色与权限

### 4.1 Inspector

可以：

- 查看自己参与的项目。
- 创建、保存和修改自己的巡检草稿。
- 提交自己的正式巡检报告。
- 查看同项目已提交报告和开放 finding。
- 接受或认领分配给自己的 finding。
- 添加跟进说明、整改照片和现场复查证据。
- 把负责的 finding 提交为等待复核。

不能：

- 查看其他巡检员的未提交草稿。
- 修改其他人的原始报告内容。
- 删除已提交报告或审计记录。
- 关闭需要 Manager 复核的 finding。
- 查看未加入项目的数据。

### 4.2 Manager

可以：

- 创建和管理项目。
- 将巡检员加入项目或移出项目。
- 查看负责项目内的全部巡检记录。
- 指派 finding 负责人。
- 设置截止时间、风险等级和优先级。
- 要求补充证据。
- 复核整改结果。
- 关闭或重新打开 finding。
- 查看统计 Dashboard 和导出报告。

### 4.3 权限矩阵

| 操作 | 创建者 Inspector | 同项目 Inspector | Manager |
|---|---:|---:|---:|
| 查看未提交草稿 | 是 | 否 | MVP 默认否 |
| 修改未提交草稿 | 是 | 否 | 否 |
| 提交报告 | 是 | 否 | 否 |
| 查看已提交报告 | 是 | 是 | 是 |
| 修改正式报告原文 | 否 | 否 | 否 |
| 查看开放 finding | 是 | 是 | 是 |
| 添加跟进记录 | 是 | 是 | 是 |
| 指派负责人 | 否 | 否 | 是 |
| 提交等待复核 | 负责人 | 负责人 | 是 |
| 关闭或重新打开 | 否 | 否 | 是 |
| 删除云端正式记录 | 否 | 否 | MVP 不提供 |

所有权限都必须在服务端验证，不能只依靠前端隐藏按钮。

## 5. 状态机

### 5.1 Inspection 状态

```text
DRAFT → SUBMITTED → ARCHIVED
```

- `DRAFT`：仅创建者可见，可以修改。
- `SUBMITTED`：项目内可见，原始内容不可直接覆盖。
- `ARCHIVED`：长期归档；MVP 中只由 Manager 操作。

提交后的修正应通过 revision 或 correction 记录完成，不能静默改写原报告。

### 5.2 Finding 状态

```text
OPEN
  ↓
ASSIGNED
  ↓
IN_PROGRESS
  ↓
AWAITING_VERIFICATION
  ├──→ CLOSED
  └──→ REOPENED → IN_PROGRESS
```

状态含义：

| 状态 | 含义 |
|---|---|
| `OPEN` | 已提交，尚未分配或认领 |
| `ASSIGNED` | 已指定负责人，尚未开始处理 |
| `IN_PROGRESS` | 正在整改或持续跟进 |
| `AWAITING_VERIFICATION` | 负责人已提交整改证据，等待复核 |
| `CLOSED` | Manager 复核通过 |
| `REOPENED` | 复核未通过或问题再次出现 |

允许的状态变更必须由服务端检查。每次变化都写入 `FindingEvent`。

## 6. 数据模型

所有主键使用 UUID。所有时间统一保存为 UTC，在界面按用户时区显示。

### 6.1 User

```text
id
auth_user_id
email
display_name
role                  INSPECTOR | MANAGER
is_active
created_at
updated_at
```

密码哈希和登录会话交给成熟的认证服务管理，业务数据库不自行保存明文密码。

### 6.2 Project

```text
id
name
code
description
status                ACTIVE | ARCHIVED
created_by
created_at
updated_at
```

### 6.3 ProjectMember

```text
project_id
user_id
joined_at
added_by
```

MVP 中用户全局角色只有 Inspector 或 Manager；`ProjectMember` 决定 Inspector 能访问哪些项目。

### 6.4 Inspection

```text
id
project_id
inspection_number
created_by
location
note
summary
status                DRAFT | SUBMITTED | ARCHIVED
submitted_at
created_at
updated_at
```

### 6.5 InspectionPhoto

```text
id
inspection_id
storage_key
original_file_name
mime_type
size_bytes
width
height
sha256
uploaded_by
created_at
```

`storage_key` 指向对象存储中的私有文件。数据库不直接保存大图片 Blob。

### 6.6 VisionDetection

```text
id
inspection_photo_id
model_name
model_version
label
confidence
box_x
box_y
box_width
box_height
excluded_by_user
created_at
```

### 6.7 Finding

```text
id
inspection_id
category
title
description
visible_evidence
risk_level
corrective_action
origin                AI | HUMAN
modified_by_human
status
assignee_id           nullable
due_at                 nullable
created_by
created_at
updated_at
closed_at              nullable
closed_by              nullable
```

### 6.8 FindingEvidence

```text
id
finding_id
inspection_photo_id
vision_detection_id   nullable
created_at
```

允许只关联整张照片，也允许精确关联检测框。

### 6.9 FindingEvent

```text
id
finding_id
actor_id
event_type
from_status            nullable
to_status              nullable
comment                nullable
created_at
```

常见 `event_type`：

- `CREATED`
- `ASSIGNED`
- `STATUS_CHANGED`
- `COMMENT_ADDED`
- `EVIDENCE_ADDED`
- `RISK_CHANGED`
- `DUE_DATE_CHANGED`
- `REOPENED`
- `CLOSED`

### 6.10 FindingFollowUp

```text
id
finding_id
author_id
comment
created_at
```

### 6.11 FollowUpPhoto

```text
id
follow_up_id
storage_key
original_file_name
mime_type
size_bytes
created_at
```

### 6.12 GeneratedReport

```text
id
inspection_id
format                 PDF | DOCX
storage_key
generated_by
generated_at
```

## 7. 页面结构

### 7.1 公共页面

- `/login`：账号密码登录。
- `/forgot-password`：由认证服务提供或跳转到认证流程。

### 7.2 Inspector 页面

- `/dashboard`：我的待办、我提交的问题、同项目开放问题。
- `/projects`：我参与的项目。
- `/projects/[projectId]`：项目概览和开放问题。
- `/inspections/new`：创建巡检。
- `/inspections/[inspectionId]`：查看巡检报告。
- `/findings/[findingId]`：问题详情、时间线和跟进证据。

### 7.3 Manager 页面

- `/dashboard`：全部开放、超期、高风险、等待复核统计。
- `/projects`：项目管理。
- `/projects/[projectId]/members`：项目成员管理。
- `/inspections`：全部巡检记录。
- `/findings`：可筛选的问题池。
- `/findings/[findingId]`：指派、复核、关闭或重新打开。

同一个路由可以根据角色显示不同操作，不需要复制两套页面。

## 8. Dashboard 设计

### 8.1 Inspector Dashboard

顶部指标：

- 分配给我的开放问题。
- 即将到期。
- 已超期。
- 等待我补充证据。

列表区域：

- 我的任务。
- 我提交的问题。
- 同项目最近开放的问题。

### 8.2 Manager Dashboard

顶部指标：

- 开放问题总数。
- 严重和高风险问题。
- 超期问题。
- 等待复核问题。

筛选维度：

- 项目。
- 状态。
- 风险等级。
- 负责人。
- 截止日期。

默认只显示非 `CLOSED` finding。历史记录通过筛选查看，不做物理删除。

## 9. API 边界草案

```text
POST   /api/auth/*

GET    /api/projects
POST   /api/projects
GET    /api/projects/:projectId
POST   /api/projects/:projectId/members
DELETE /api/projects/:projectId/members/:userId

GET    /api/inspections
POST   /api/inspections
GET    /api/inspections/:inspectionId
PATCH  /api/inspections/:inspectionId
POST   /api/inspections/:inspectionId/photos
POST   /api/inspections/:inspectionId/submit

GET    /api/findings
GET    /api/findings/:findingId
POST   /api/findings/:findingId/assign
POST   /api/findings/:findingId/follow-ups
POST   /api/findings/:findingId/status
POST   /api/findings/:findingId/verify

POST   /api/inspections/:inspectionId/reports
```

`/api/analyze` 继续负责 AI 草稿生成，但云端提交接口必须重新校验客户端传来的全部数据。

## 10. 文件存储规则

- 原始照片和整改照片存入私有对象存储。
- 数据库只保存对象 key 和元数据。
- 浏览器不得长期持有永久公开 URL。
- 查看照片时由服务端验证权限，再生成短期签名 URL。
- 报告文件同样使用私有存储。
- 上传时校验 MIME、扩展名、文件大小和实际文件内容。

## 11. 安全规则

- 使用成熟认证服务处理密码哈希、登录会话、重置密码和防暴力破解。
- Cookie 使用 `HttpOnly`、`Secure` 和合适的 `SameSite` 设置。
- 每个 API 请求都在服务端读取当前用户和角色。
- 所有项目资源都检查项目成员关系。
- 用户传入的 `userId`、`projectId`、`inspectionId` 不能被直接信任。
- 提交报告、指派、状态变更和关闭操作记录 actor 与时间。
- 对登录、上传、AI 分析和报告生成设置速率限制。
- 不在客户端暴露数据库密钥、对象存储写入密钥或 LLM API Key。

## 12. 关键业务规则

1. AI finding 永远是草稿，必须由巡检员人工确认后才能随报告提交。
2. 提交报告时，每个有效 finding 创建为 `OPEN`。
3. 没有 finding 的报告仍可提交，作为正常巡检记录。
4. 正式报告提交后不得被静默覆盖。
5. 其他巡检员只能添加跟进，不能改写原始 finding。
6. 负责人提交整改后，状态变为 `AWAITING_VERIFICATION`，不能直接变为 `CLOSED`。
7. 只有 Manager 可以执行 `CLOSED` 和 `REOPENED`。
8. 每次状态变化都必须创建不可变事件记录。
9. Dashboard 上“没有问题”表示没有开放 finding，不表示删除历史。
10. 高风险或严重问题在关闭时必须至少包含一条整改跟进和一张新证据照片。

## 13. 分阶段实施计划

### 阶段 A：认证和项目权限

- 使用 Supabase Auth、PostgreSQL 和 Private Storage；技术决策见 `docs/ADR-001-CLOUD-STACK.md`。
- 建立 User、Project、ProjectMember。
- 完成登录、退出和受保护路由。
- 完成服务端角色与项目成员校验。

### 阶段 B：云端巡检记录

- 建立 Inspection、Photo、Detection、Finding、Evidence。
- 把 IndexedDB 草稿提交到云端。
- 上传照片到私有对象存储。
- 实现正式报告只读详情页。

### 阶段 C：问题 Dashboard

- 建立 FindingEvent、FollowUp、FollowUpPhoto。
- 完成指派、整改、等待复核、关闭和重新打开。
- 完成 Inspector 与 Manager Dashboard。

### 阶段 D：报告与演示验收

- 生成 PDF/Word。
- 增加统计、筛选和超期提示。
- 部署 Vercel。
- 使用两个 Inspector 和一个 Manager 测试完整闭环。

## 14. MVP 验收场景

```text
1. Inspector A 登录并创建巡检。
2. 上传照片，完成 YOLO 和 LLM 分析。
3. 人工确认 finding 后提交报告。
4. Inspector B 在同一项目 Dashboard 看见开放问题，但看不到 A 的草稿。
5. Manager 将问题指派给 Inspector B。
6. Inspector B 上传整改说明和新照片，提交等待复核。
7. Manager 复核不通过并重新打开。
8. Inspector B 再次整改并提交。
9. Manager 关闭问题。
10. 默认 Dashboard 不再显示该问题，但历史和时间线仍可查询。
```

完成以上场景，才说明协作闭环真正成立。
