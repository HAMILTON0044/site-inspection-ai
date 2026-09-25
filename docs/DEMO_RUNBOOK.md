# 演示环境运行手册

## 1. 准备账号和项目

`scripts/provision-demo.mjs` 只在受信任的本地终端运行，需要 Supabase Service Role Key。不要把这些环境变量写入 Git 或浏览器配置。

PowerShell 示例：

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL = "https://your-project.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "仅在本地临时设置"
$env:DEMO_MANAGER_EMAIL = "manager@example.com"
$env:DEMO_MANAGER_PASSWORD = "使用临时演示密码"
$env:DEMO_INSPECTOR_A_EMAIL = "inspector-a@example.com"
$env:DEMO_INSPECTOR_A_PASSWORD = "使用临时演示密码"
$env:DEMO_INSPECTOR_B_EMAIL = "inspector-b@example.com"
$env:DEMO_INSPECTOR_B_PASSWORD = "使用临时演示密码"
npm run demo:provision
```

脚本会创建或复用三个账号、确保 Manager 角色正确、创建演示项目，并加入两个 Inspector。它不会打印密码，也不会删除已有数据。

## 2. 检查匿名访问保护

启动开发服务器后执行：

```powershell
$env:BASE_URL = "http://localhost:3000"
npm run demo:check-api
```

所有受保护的项目、巡检和 finding API 都应返回 `401`。

## 3. 推荐演示顺序

1. Inspector A 登录，上传 2 到 3 张施工照片并完成 YOLO 识别。
2. 排除一条误检，输入备注，生成 AI finding。
3. 修改并批准一条 finding，驳回另一条 finding。
4. 提交到演示项目，确认正式记录和 PDF 报告归档。
5. Inspector B 登录，确认能看到正式记录但不能看到 A 的草稿。
6. Manager 登录，在问题看板指派 finding 并设置截止时间。
7. Inspector B 开始整改，上传说明和照片，提交复核。
8. Manager 关闭问题，或重新打开并检查审计时间线。
9. 在报告中心下载已归档 PDF。
