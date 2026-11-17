# 上架 DSH 插件市场：dsh-script-studio

> 市场数据源：`awesome-dsh-plugin/awesome-dsh-plugin` 仓库的 `data/plugins/*.yml`（一个插件一个文件）。
> 收录方式：给该仓库提一个只新增 1 个 YAML 文件的 PR；合并后自动生成 README/站点，市场次日起可搜到。

## 硬性门槛（CI 自动检查）

| # | 要求 | 本插件状态 |
|---|---|---|
| 1 | 仓库 **public**，有真实可用代码 | ✅ 代码在 `plugins/dsh-script-studio/`（4 个工具，已实测） |
| 2 | 根 `package.json` 声明 `dsh.bundle.patch`，根目录有 `cordis.patch.yml` | ✅ 已有 |
| 3 | 仓库创建满 **1 天** | ❌ 新仓库，需等 24 小时 |
| 4 | 加 `dsh-plugin` topic | 待建仓后设置（脚本已含） |
| 5 | 描述与代码一致、无营销词 | ✅ 见 `market/dsh-script-studio.entry.yml` |

## 第 1 步：建仓库并推代码（有 GitHub 账号即可）

**方式 A：用发布脚本（推荐，无需安装 git/gh）**

```powershell
# 1) 在 GitHub 建 Personal Access Token（classic，勾 repo 权限）
$env:GH_TOKEN = "ghp_xxx"
$env:GH_OWNER = "你的GitHub用户名"
node plugins/dsh-script-studio/publish.mjs repo
```

脚本会：创建 `dsh-script-studio` 仓库 → 上传全部源码 → 设置 topic → 创建 `v1.0.0` Release 并上传 `dsh-script-studio.tgz`。

**方式 B：手动**

```bash
cd plugins/dsh-script-studio
git init -b main && git add -A && git commit -m "dsh-script-studio 1.0.0"
gh repo create <owner>/dsh-script-studio --public --source . --remote origin --push
gh repo edit <owner>/dsh-script-studio --add-topic dsh-plugin
# 可选：发 Release 并上传 dsh-script-studio.tgz（资产名不要带版本号）
```

## 第 2 步：等满 1 天

仓库创建后 **24 小时**才能提收录 PR（CI 查 `createdAt`）。期间可补 README/截图，脚本会自动判断是否到点。

## 第 3 步：提收录 PR

```powershell
# 到点后执行（同一套环境变量）
node plugins/dsh-script-studio/publish.mjs pr
```

脚本会：fork `awesome-dsh-plugin/awesome-dsh-plugin` → 建分支 → 提交
`data/plugins/<owner>__dsh-script-studio.yml` → 创建 PR（标题/正文已备）。

手动等价：

```bash
gh repo fork awesome-dsh-plugin/awesome-dsh-plugin --clone=false
# 在自己的 fork 上新增 data/plugins/<owner>__dsh-script-studio.yml（内容见 market/）
gh pr create --repo awesome-dsh-plugin/awesome-dsh-plugin \
  --head <owner>:add-dsh-script-studio \
  --title "Add dsh-script-studio" \
  --body-file plugins/dsh-script-studio/market/PR-body.md
```

## 第 4 步：等合并

- PR 最多 3 条条目；只新增 `data/plugins/*.yml`，**不要手改生成的 README**
- CI 依次查：条目数 → `dsh.bundle` → 仓库年龄 → awesome-lint/站点构建
- 合并后站点自动重建，市场实时拉取；用户安装命令：
  `dsh plugin --profile <profile> add github:<owner>/dsh-script-studio`
  或从 Release 装 tgz。

## 可选增强

- **npm**：`npm publish --access public`（包名 `dsh-script-studio` 需先查重）；发布包 `repository` 必须指回本仓库，条目里不要手写 `npm:` 字段。
- **截图**：无 UI 的纯工具插件可跳过；如需，仓库根放 `screenshots.json` + 1–8 张 GitHub 托管的图。
- **图标**：条目可选 `icon:`（GitHub 托管的方形位图，不要 SVG）。

## 文件清单

| 文件 | 用途 |
|---|---|
| `market/dsh-script-studio.entry.yml` | 收录条目（把 `<OWNER>` 换成 GitHub 用户名） |
| `market/PR-body.md` | PR 正文 |
| `publish.mjs` | GitHub API 一键发布脚本（repo / pr 两个子命令） |
| `dsh-script-studio-1.0.0.tgz` | Release 资产（上传时重命名为 `dsh-script-studio.tgz`） |
| `PUBLISHING.md` | 本文件 |
