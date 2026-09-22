# Site Inspection AI — AI 协作交接文档

最后更新：2026-09-23

本文档供项目组成员及后续 AI 编程助手使用。开始修改前，请先完整阅读本文档和根目录的 `AGENTS.md`。

## 1. 项目目标

施工主管日常巡检需要整理现场照片、文字备注、观察结果和整改措施。当前原型希望缩短这一流程：

1. 巡检员选择施工现场照片。
2. 浏览器内的 YOLOv8n 模型读取图片并生成目标检测结果。
3. 巡检员排除误检结果。
4. 系统只把结构化检测 JSON 和文字备注发送给黑客松指定 LLM。
5. LLM 生成等待人工审核的巡检问题草稿。
6. 巡检员批准或驳回每一条问题。

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
人工批准或驳回
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
- 换图或重新识别会清空上一张照片的检测状态，防止证据串图。

### 3.4 多照片选择与独立检测状态

- 一次最多选择 10 张照片。
- 页面显示照片编号和文件名。
- 可以切换当前照片。
- 当前只识别和分析选中的一张照片。
- 每张照片独立保存识别状态、检测结果、错误信息和人工排除项。
- 切换照片会恢复该照片已有的检测框和勾选状态，无需重新识别。
- 照片列表显示未识别、识别中、识别失败或已识别项目数量。

注意：目前还没有“一键识别全部照片”，也没有把多张照片的检测证据汇总给 LLM。这是下一阶段工作，不要误认为已经完成。

## 4. 关键文件

```text
src/app/page.tsx
  页面状态、照片选择、当前照片切换、检测框绘制、误检排除、分析结果和人工审核。

src/lib/vision.ts
  图片 letterbox 预处理、ONNX 会话、YOLO 输出解析、坐标还原和 NMS。

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
- ESLint、TypeScript 和 `git diff --check` 已通过。
- npm 安全审计为 0 个漏洞。

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

## 9. 当前限制

- YOLO 模型主要覆盖 PPE 和常见施工物体。
- `NO-Mask` 不等于现场一定违规，因为部分区域不强制佩戴口罩。
- 普通帽子可能被误认为安全帽。
- 小目标、遮挡、逆光、夜间和模糊图片可能降低准确率。
- 当前 LLM 请求只包含一张当前照片的检测结果。
- 尚未生成正式 PDF 或 Word 巡检报告。
- 批准和驳回状态目前只保存在页面内存中。
- 尚未建立数据库或巡检历史记录。
- 尚未完成停止开发服务器后的正式生产构建验证。

## 10. 模型与许可证

模型来源：

<https://github.com/snehilsanyal/Construction-Site-Safety-PPE-Detection>

导出模型的元数据标记 Ultralytics AGPL-3.0。第三方仓库没有为自定义权重和训练数据给出足够清晰的独立许可证说明。因此：

- 当前模型适合黑客松原型展示。
- 商业发布前必须完成许可证审查。
- 更稳妥的长期方案是使用授权清晰的数据集自行训练模型。

详细哈希见 `public/models/README.md`。

## 11. Git 状态与关键提交

主要功能提交：

```text
62eb45c feat: add browser-based PPE image detection
a8753c0 feat: allow excluding false-positive detections
85b4230 feat: add multi-photo selection
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

优先完成“识别全部照片并汇总证据”：

1. 增加“识别全部照片”按钮，按顺序逐张处理，避免浏览器内存峰值。
2. 显示“已完成数量 / 总数量”和当前正在识别的文件名。
3. 失败的照片保留错误状态，但不阻止其他照片继续识别。
4. 为每个检测证据增加 `photoId` 和 `photoName`。
5. 扩展 `/api/analyze` 请求 Schema，使其接收分组后的多照片证据。
6. 提示词必须明确证据来自哪张照片，禁止跨照片编造位置关系。
7. 浏览器验证至少覆盖：顺序识别、单张失败后继续、状态保留、误检排除和汇总发送。

建议的数据结构：

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

多照片证据请求可以设计为：

```json
{
  "note": "三层东侧施工区域",
  "photoEvidence": [
    {
      "photoId": "photo-1",
      "photoName": "east-side-01.jpg",
      "detections": [
        {
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

1. 识别全部照片并显示进度。
2. 将多照片证据汇总给 LLM。
3. 在报告中标注证据照片文件名。
4. 支持人工新增、修改和删除 finding。
5. 保存巡检记录和审核状态。
6. 生成 PDF 或 Word 报告。
7. 使用现场照片评估置信度阈值和误检率。
8. 收集并标注 `BLOCKED_ACCESS`、`UNSAFE_CABLE`、`IMPROPER_STORAGE` 数据。
9. 训练许可证清晰的自有模型。
10. 停止开发服务器后执行完整 `npm run build`。
11. 部署后检查 ONNX 模型、WASM 资源和网关环境变量。

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
