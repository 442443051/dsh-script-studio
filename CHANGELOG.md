# CHANGELOG

## 1.1.0 (2026-11-17)

### 新增
- `publish.mjs plan`：离线校验发布材料（检查 `dsh.bundle.patch`、`cordis.patch.yml`、tgz、条目 category/url、占位符），不联网、不需要凭据；输出上传清单与下一步
- `publish.mjs repo|status|pr`：纯 GitHub REST 建仓 + 上传 + 设 topic + 发 Release；查仓库年龄；fork + 提收录 PR

### 变更
- 技法库"战绩"补到 6 个项目并加入"工具链"说明（4 个工具即 S5/S8 的执行体）

### 修复
- 评分维度按各自满分校验（20/25/20/20/15），原先统一按 20 会误拒合法分数
- 相对路径优先解析会话工作区（`DSH_WORKSPACE` → 会话日志 cwd → 最近会话）

## 1.0.0 (2026-11-07)

首个版本，对应《剧本生产工作流程 v2.0-r4》。

### 新增
- `script_studio_audit`：项目审计（集/场/台词/动作、每集台词量、软收尾、静场开场、场景复用、钩子配额、大纲 risk_tag/diff 覆盖、红灯词、h 代理）
- `script_studio_score`：五维加权评分（20/25/20/20/15）、达标判定、自评→外部校准（−3.5~5）、逐维建议
- `script_studio_new_project`：00–05 项目脚手架
- `script_studio_playbook`：9 步流程 + 7 条硬规则 + 已验证技法库 + 项目战绩

### 工程
- 相对路径解析：`DSH_WORKSPACE` → 会话日志首行 cwd → 最近会话 → 建议绝对路径
- 纯本地计算，零模型调用；`lib/tools.js` 可脱离 DSH 单测
- 已在本机 desktop profile 安装并启用；`pnpm pack` 产物 `dsh-script-studio-1.0.0.tgz`

### 已知限制
- `DSH_WORKSPACE` 未设置时依赖 `~/.dsh/sessions` 可读；跨机器迁移请优先用绝对路径或设置该变量。
- 审计的"静场开场"为启发式（关键词 + 前两拍无对白），误报时用 `strict=false` 只看硬项。
