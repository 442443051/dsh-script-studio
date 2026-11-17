# dsh-script-studio

把《剧本生产工作流程 v2.0-r4》做成 DeepSeek Harness 插件——一套可复用的短剧剧本生产工作台。**零模型调用的确定性工具**：审计、评分、脚手架、技法库。

## 提供 4 个工具

| 工具 | 作用 |
|---|---|
| `script_studio_audit` | 审计项目目录：集/场/台词/动作统计、每集台词量、**软收尾、静场开场、场景复用、钩子配额**四项检查、大纲 risk_tag 与 diff 覆盖、红灯词、h 代理；返回结构化结果 + 可读报告 |
| `script_studio_score` | 按 2026.10.31 海外竖屏短剧百分制标准算五维总分（黄金三秒20/冲突密度25/故事吸引力20/结尾钩子20/节奏紧凑度15），给达标判定、自评→外部校准区间（−3.5~5）、逐维改进建议 |
| `script_studio_new_project` | 生成 00 定位 / 01 人物圣经 / 02 四十集大纲表 / 03 前 10 集正文模板 / 04 质检 / 05 风控 的项目骨架 |
| `script_studio_playbook` | 返回工作流程全文：9 步流程、7 条硬规则、已验证技法库（架构/写作/判定/反模式/冲线循环）、项目战绩 |

## 安装

已在本机 desktop profile 安装并启用（本地链接，改代码后 disable→enable 即热更新）。

重新安装 / 换机：

```text
# 方式一：插件管理器（在 DSH 里让 agent 调用）
plugin_manager install_bundle target="<本目录绝对路径>"

# 方式二：tgz 安装
plugin_manager install_bundle target="<本目录>/dsh-script-studio-1.0.0.tgz"

# 方式三：手动进 profile
# 把包放进 <profile>/node_modules/dsh-script-studio，
# profile 的 package.json 加 "dsh-script-studio": "file:<本目录>"，
# 并把 "dsh-script-studio" 加入 dsh.profile.bundles
```

启用/停用：

```text
plugin_manager set_bundle target="dsh-script-studio" enabled=true|false
```

## 使用示例

```text
# 1) 新建项目骨架
script_studio_new_project(outDir="output/新剧_40集", titleCn="新剧", titleEn="New Show", genre="霸总", series=40, episodes=10)

# 2) 写完正文后审计（相对路径按会话工作区解析）
script_studio_audit(dir="output/新剧_40集")

# 3) 算分与校准（各维度按自己的满分）
script_studio_score(golden=18, conflict=21, attraction=17, hook=18, pace=10.5)

# 4) 载入技法库
script_studio_playbook()
```

## 发布到插件市场

```powershell
# 离线备料校验（不需要凭据）
node publish.mjs plan
# 建仓 + 上传 + topic + Release
$env:GH_TOKEN="ghp_xxx"; $env:GH_OWNER="你的用户名"; node publish.mjs repo
# 查仓库年龄
node publish.mjs status
# 满 1 天后提收录 PR
node publish.mjs pr
```

完整步骤与市场硬门槛见 [PUBLISHING.md](PUBLISHING.md)。

## 相对路径如何解析

DSH 工具进程的 `process.cwd()` 是 **profile 目录**，不是会话工作区，所以插件按顺序解析：

1. `DSH_WORKSPACE` 环境变量（如设置）
2. 会话日志首行的 `cwd`（`~/.dsh/sessions/*/<session-id>/session.v4.jsonl.zstd`，zstd 解压后取第一行）
3. 环境里没有 `DSH_SESSION_ID` 时，取最近修改的会话日志
4. 都不行 → 直接传**绝对路径**（最稳）

解析结果按进程缓存，不重复读日志。

## 目录

```
dsh-script-studio/
  index.js              插件入口（注册 4 个工具）
  lib/tools.js           工具实现（纯 Node，可单测）
  lib/workspace.js       会话工作区解析（会话日志 cwd）
  cordis.patch.yml       插件装配 patch
  package.json           清单（dsh.bundle.patch）
  README.md
  CHANGELOG.md
  dsh-script-studio-1.0.0.tgz  可分发安装包
  LICENSE
```

## 设计原则

- **确定性**：审计/评分纯本地计算，不调用模型，结果可复现。
- **可移植**：技法库内置在插件里，换机器、换项目都能直接调用。
- **零依赖**：`lib/tools.js` 只依赖 `node:fs` / `node:path` / `node:zlib`，便于单测与审计。

## 版本

- 1.0.0 · 对应工作流程 v2.0-r4（含外部评分校准与已验证技法库）
- 战绩：清算之外 85.5（可进入制作）、隐痛 84.5→修订、租金帝国 81、药房暗账 82
