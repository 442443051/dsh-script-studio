/**
 * dsh-script-studio
 * 把《剧本生产工作流程 v2.0-r4》做成 DSH 插件：
 *   script_studio_audit      项目本地复核（四项检查 + 红线 + 大纲统计 + h 代理）
 *   script_studio_score      五维加权评分与达标判定（含自评→外部校准）
 *   script_studio_new_project 项目脚手架（00–05）
 *   script_studio_playbook    工作流程 + 已验证技法库全文
 */
import { defineTool } from '@deepseek-ai/dsh-tools'
import { createTools } from './lib/tools.js'

export const name = 'script-studio'
export const inject = ['tools']

export function apply(ctx) {
  for (const tool of createTools(defineTool)) ctx.tools.register(tool)
}
