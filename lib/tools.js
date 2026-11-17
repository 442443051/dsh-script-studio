/**
 * dsh-script-studio · 工具实现（纯函数，可脱离 DSH 单测）
 * 由 index.js 注入 defineTool 后注册为 4 个工具：
 *   script_studio_audit       项目本地复核（v2.0-r4 四项检查 + 红线 + 大纲统计）
 *   script_studio_score       五维加权评分与达标判定（含自评→外部校准）
 *   script_studio_new_project 脚手架：生成 00–05 文件骨架
 *   script_studio_playbook    返回 V2.0 工作流程 + 已验证技法库全文
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, isAbsolute, resolve } from 'node:path'
import { sessionWorkspace } from './workspace.js'

const RED = ['血', '枪', '枪口', '处决', '酷刑', '折磨', '绑架', '强暴', '性侵', '虐童', '自残', '毒品', '洗钱', '未成年', '高中生', '幼态', '囚禁', '强迫']
const BEN = ['血缘', '血脉', '血型', '血亲', '血统', '扫码枪']
const HOOK_TYPES = ['信息缺口', '情绪悬崖', '新角色登场', '反转突变', '危机降临', '关系破裂']
const WEIGHTS = [0.2, 0.25, 0.2, 0.2, 0.15]
const DIM_NAMES = ['黄金三秒', '冲突密度', '故事吸引力', '结尾钩子', '节奏紧凑度']
const DIALOGUE_RE = /^[\u4e00-\u9fa5·A-Za-z]+（[^）]*）：/
const SCENE_RE = /^\d+-\d+\s/
const EP_RE = /^第(\d+)集\s/

const read = p => { try { return readFileSync(p, 'utf8') } catch { return null } }
const dirExists = d => { try { return statSync(d).isDirectory() } catch { return false } }
/** 把相对目录解析到会话工作区：优先绝对路径，其次 base 列表（exec cwd / agent cwd / process.cwd） */
export function resolveDir(dir, bases = []) {
  if (isAbsolute(dir)) return dir
  const cands = [resolve(dir), ...bases.filter(Boolean).map(b => resolve(String(b), dir))]
  const ws = sessionWorkspace()
  if (ws) cands.push(resolve(ws, dir))
  for (const c of cands) if (dirExists(c)) return c
  return cands[0]
}
const listMd = dir => { try { return readdirSync(dir).filter(f => f.endsWith('.md')).sort() } catch { return [] } }
const firstEp = f => { const m = f.match(/(\d+)-(\d+)集/); if (m) return +m[1]; const n = f.match(/(\d+)集/); return n ? +n[1] : 1 }

/** 目标目录解析：绝对路径原样；相对路径优先会话工作区，其次 exec 基址，最后 cwd */
export function resolveTargetDir(dir, bases = []) {
  if (isAbsolute(dir)) return dir
  const ws = sessionWorkspace()
  const base = ws || bases.find(Boolean) || process.cwd()
  return resolve(base, dir)
}

export function auditProject(dir, bases = []) {
  const abs = resolveDir(dir, bases)
  const files = listMd(abs)
  const sfs = files.filter(f => f.startsWith('03')).sort((a, b) => firstEp(a) - firstEp(b))
  const outlineFile = files.find(f => f.startsWith('02'))
  const warnings = []
  if (!sfs.length || !outlineFile) {
    return { ok: false, dir: abs, reason: '缺 02 大纲或 03 正文（目录未找到或文件不全）', files, warnings, report: `# 项目审计：${abs}\n未找到 02 大纲或 03 正文。请用绝对路径或会话工作区相对路径。` }
  }
  const S = sfs.map(f => read(join(abs, f)) || '').join('\n\n')
  const O = read(join(abs, outlineFile)) || ''

  const parts = S.split(/^第(\d+)集 /gm)
  const blocks = []
  for (let i = 1; i + 1 < parts.length; i += 2) {
    const ep = Number(parts[i])
    const body = parts[i + 1].split('\n')
    const content = body.filter(l => l.trim() && !SCENE_RE.test(l.trim()) && !l.startsWith('人物：'))
    const scenes = body.map(l => l.trim()).filter(l => SCENE_RE.test(l))
    blocks.push({ ep, body, content, scenes })
  }
  const eps = blocks.length
  const scenes = blocks.reduce((a, b) => a + b.scenes.length, 0)
  const dialogueLines = S.split('\n').filter(l => DIALOGUE_RE.test(l))
  const actions = S.split('\n').filter(l => l.startsWith('▲▲'))
  const perEp = blocks.map(b => ({
    ep: b.ep,
    dialogue: b.content.filter(l => DIALOGUE_RE.test(l)).length,
    actions: b.content.filter(l => l.startsWith('▲▲')).length,
    scenes: b.scenes.length
  }))

  // 集尾软收尾
  const soft = []
  for (const b of blocks) {
    const last = b.content.length ? b.content[b.content.length - 1].trim() : ''
    if (DIALOGUE_RE.test(last) && !/[？?！!]|——|…/.test(last)) soft.push(b.ep)
  }
  // 静场开场
  const staticOpen = []
  const atmo = /灯|门轴|走廊|光|墙|窗|雨|风|钟|桌|椅|台阶|楼梯|卷帘|铁门/
  for (const b of blocks) {
    const first = (b.content[0] || '').trim()
    const second = (b.content[1] || '').trim()
    if (first.startsWith('▲▲') && atmo.test(first) && !DIALOGUE_RE.test(second)) staticOpen.push(b.ep)
  }
  // 场景复用
  const places = blocks.map(b => {
    const loc = b.scenes[0] || ''
    const m = loc.match(/^\d+-\d+\s+\S+\s+\S+\s+(.*)$/)
    return { ep: b.ep, place: m ? m[1].trim() : '' }
  }).filter(x => x.place)
  const placeCount = {}
  for (const p of places) placeCount[p.place] = (placeCount[p.place] || 0) + 1
  const overThreshold = Math.max(3, Math.ceil(eps * 0.25))
  const reuseOver = Object.keys(placeCount).filter(k => placeCount[k] > overThreshold)
  const runs = []
  let run = { place: '', eps: [] }
  for (const p of places) {
    if (p.place === run.place) run.eps.push(p.ep)
    else { if (run.eps.length > 3) runs.push(run); run = { place: p.place, eps: [p.ep] } }
  }
  if (run.eps.length > 3) runs.push(run)

  // 大纲统计
  const rows = (O.match(/^\| \d+ \|.*$/gm) || [])
  const risk = {}
  for (const r of (O.match(/\| (无风险|需注意画面尺度|触发改道) \|/g) || [])) {
    const k = r.replace(/\|/g, '').trim()
    risk[k] = (risk[k] || 0) + 1
  }
  const diffServed = (O.match(/^\| \d+ \|.*\| (?!—)[^|]{1,25} \|$/gm) || []).length
  const weakWindows = []
  for (let w = 0; w < Math.ceil(rows.length / 10); w++) {
    const seg = rows.slice(w * 10, (w + 1) * 10).join('\n')
    const types = HOOK_TYPES.filter(t => seg.includes(t))
    if (types.length < 4) weakWindows.push(`${w * 10 + 1}-${Math.min((w + 1) * 10, rows.length)}`)
  }

  // 红线
  let masked = S + '\n' + O
  for (const w of BEN) masked = masked.split(w).join('　')
  const redline = []
  for (const p of RED) {
    const m = masked.match(new RegExp(p, 'g'))
    if (m) redline.push(`${p}×${m.length}`)
  }

  // h 代理
  const lens = dialogueLines.map(l => (l.split('）：')[1] || '').replace(/[\s，。！？、；：""''（）【】…—·]/g, '').length).filter(n => n > 0)
  const mean = lens.reduce((a, b) => a + b, 0) / (lens.length || 1)
  const sd = Math.sqrt(lens.reduce((a, b) => a + (b - mean) ** 2, 0) / (lens.length || 1))
  const cv = mean > 0 ? sd / mean : 0
  const shortRatio = lens.filter(n => n <= 8).length / (lens.length || 1)
  const cl = x => Math.max(0, Math.min(1, x))
  const hookVariety = new Set((O.match(/(信息缺口|情绪悬崖|新角色登场|反转突变|危机降临|关系破裂)/g) || [])).size
  const sceneOK = blocks.filter(b => b.scenes.length <= 3).length / (blocks.length || 1)
  const h = Math.round(25 * cl((cv - 0.15) / 0.5) + 15 * cl((shortRatio - 0.15) / 0.35) + 15 * Math.min(1, hookVariety / 6) + 20 + 15 + 10 * sceneOK)

  const checks = {
    softEndings: soft,
    staticOpenings: staticOpen,
    sceneReuseOver: reuseOver.map(k => `${k}×${placeCount[k]}`),
    sceneRunsOver3: runs.map(r => `${r.place}(${r.eps[0]}-${r.eps[r.eps.length - 1]})`),
    hookQuotaWeak: weakWindows
  }
  const ok = redline.length === 0 && soft.length === 0 && staticOpen.length === 0 && reuseOver.length === 0 && runs.length === 0 && weakWindows.length === 0 && eps > 0 && rows.length > 0
  if (eps !== rows.length && rows.length > 10) warnings.push(`正文 ${eps} 集 / 大纲 ${rows.length} 集（前段交付属正常）`)
  if (perEp.some(e => e.dialogue < 6 || e.dialogue > 14)) warnings.push('有集台词数超出 6–14 句')
  if (redline.length) warnings.push('红灯词命中：' + redline.join('、'))

  const report = [
    `# 项目审计：${abs}`,
    `ok=${ok}｜正文 ${eps} 集 / ${scenes} 场 / ${dialogueLines.length} 句台词 / ${actions.length} 个动作｜h 代理 ${(h / 100).toFixed(2)}`,
    `每集台词：${perEp.map(e => e.ep + ':' + e.dialogue).join(' ')}`,
    `大纲：${rows.length} 行｜risk_tag ${JSON.stringify(risk)}｜diff 覆盖 ${diffServed}`,
    `检查：软收尾 ${soft.length ? soft.join('/') : '0'}｜静场开场 ${staticOpen.length ? staticOpen.join('/') : '0'}｜场景复用 ${reuseOver.length ? checks.sceneReuseOver.join('、') : '0'}｜连续>3 ${runs.length ? checks.sceneRunsOver3.join('、') : '0'}｜钩子配额 ${weakWindows.length ? weakWindows.join('、') : 'OK'}`,
    `红线：${redline.length ? redline.join('、') : '0 命中'}`
  ].join('\n')

  return { ok, dir: abs, files, metrics: { episodes: eps, scenes, dialogue: dialogueLines.length, actions: actions.length, dialogueAvg: +mean.toFixed(1), shortRatio: +shortRatio.toFixed(2), h: h / 100, perEp }, outline: { file: outlineFile, rows: rows.length, riskTag: risk, diffServed }, checks, redline, warnings, report }
}

const MAXES = [20, 25, 20, 20, 15]

export function scoreProject(input) {
  const scores = [input.golden, input.conflict, input.attraction, input.hook, input.pace].map(Number)
  if (scores.some((s, i) => !Number.isFinite(s) || s < 0 || s > MAXES[i])) throw new Error('维度分数超出满分（黄金三秒≤20、冲突密度≤25、故事吸引力≤20、结尾钩子≤20、节奏紧凑度≤15）')
  const total = +scores.reduce((a, b) => a + b, 0).toFixed(1)
  const lines = DIM_NAMES.map((n, i) => ({ dimension: n, weight: WEIGHTS[i], max: MAXES[i], raw: scores[i], points: scores[i] }))
  const low = lines.filter(x => x.raw / x.max < 0.8)
  const verdict = total >= 90 ? '优质剧本' : total >= 85 ? '可进入制作' : '未达标（差 ' + (85 - total).toFixed(1) + ' 分）'
  const external = { low: +(total - 5).toFixed(1), high: +(total - 3.5).toFixed(1) }
  const advice = low.map(x => {
    if (x.dimension === '节奏紧凑度') return '节奏：优先做英文本地化（美式口语/断句/口头禅），未本地化时该维度通常只拿 70%'
    if (x.dimension === '黄金三秒') return '黄金三秒：第 1 集前 3 秒加可截图关键帧（数字/物件/表情），仅对话冲突拿不满'
    if (x.dimension === '冲突密度') return '冲突密度：11–18 集检查“发现→压制→坚持”微重复，至少 2 集换冲突类型（第三方施压/主角动摇/同盟对质）'
    if (x.dimension === '结尾钩子') return '结尾钩子：温和集升级为信息缺口或反转突变，末拍停在动作/物件上'
    return '故事吸引力：靠差异锚点每 3 集回扣一次，弥补细分赛道不确定性'
  })
  const report = [
    `# 五维加权评分`,
    `总分 ${total} / 100 → ${verdict}`,
    ...lines.map(l => `- ${l.dimension}：${l.raw}/${l.max}（权重 ${Math.round(l.weight * 100)}%，得分率 ${Math.round(l.raw / l.max * 100)}%）`),
    `外部校准（自评 −3.5~5）：约 ${external.low}–${external.high}`,
    advice.length ? '建议：\n' + advice.map(a => '- ' + a).join('\n') : '五维均达标，直接提交外部回评'
  ].join('\n')
  return { total, verdict, lines, externalEstimate: external, advice, report }
}

const TEMPLATES = {
  '00_项目定位.md': (p) => `# 项目定位（${p.series} 集 · 本次交付前 ${p.episodes} 集）\n\n> 项目：${p.titleCn} / ${p.titleEn}\n> 定位：Netshort / ReelShort 类海外竖屏短剧｜投放 TikTok、Meta｜全剧 ${p.series} 集 × 约 60 秒（本次前 ${p.episodes} 集）｜9:16｜${p.audience}｜纯中文工作版\n> 生成：${p.date}　｜　模式：零子代理直写 + 本地复核 v2.0-r4\n\n## 定位卡\n| 项 | 值 |\n|---|---|\n| 题材 | ${p.genre} |\n| 受限 | ${p.restricted ? '是（书面授权待补）' : '否（主池）'} |\n| 体量 | ${p.series} 集（本次 ${p.episodes} 集） |\n| 受众 | ${p.audience} |\n\n## 差异锚点\n> （6–60 字、可检验、禁空泛词）\n\n## 交付范围\n- 全 ${p.series} 集大纲（02）\n- 前 ${p.episodes} 集正文（03）\n- 质检与风控（04、05）\n`,
  '01_故事与人物.md': (p) => `# 故事与人物（${p.series} 集版人物圣经）\n\n> 项目：${p.titleCn} / ${p.titleEn}｜全剧 ${p.series} 集｜本次交付前 ${p.episodes} 集\n\n## 故事核\n（一句话：谁为了什么、付出什么代价）\n\n## 人物卡\n### 主角（年龄）｜身份\n- 外形：\n- 外在目标：\n- 内在需求：\n- 缺陷：\n- 秘密：\n- 底线：\n- 反差：\n- 口头禅：\n- 关系：\n- 弧光：\n\n## 关系网\n## 三角冲突\n## 合规约束（写稿时执行）\n`,
  '02_分集大纲_40集.md': (p) => `# 分集大纲（全 ${p.series} 集）\n\n> 项目：${p.titleCn}｜全剧 ${p.series} 集｜本次交付前 ${p.episodes} 集\n> 差异锚点：（见 00）\n> 钩子六类：信息缺口 / 情绪悬崖 / 新角色登场 / 反转突变 / 危机降临 / 关系破裂\n\n## 卡点\n\n## 伏笔\n\n| 集 | 事件 | 钩子 | risk_tag | diff_service |\n|---|---|---|---|---|\n` + Array.from({ length: p.series }, (_, i) => `| ${i + 1} |  |  | 无风险 |  |`).join('\n') + `\n`,
  '03_剧本正文_前10集.md': (p) => `# 剧本正文（前 ${p.episodes} 集）\n\n> 项目：${p.titleCn} / ${p.titleEn}\n> 每集约 60 秒，1–2 场，0:55 后落钩子；集尾必须停在动作/物件上。\n\n` + Array.from({ length: p.episodes }, (_, i) => `第${i + 1}集 （标题）\n\n${i + 1}-1 日 内 （地点）\n人物：\n▲▲（开场即人物动作或对话，禁静场）\n（角色）（情绪）：（台词）\n▲▲（末拍：动作/物件）\n`).join('\n'),
  '04_质检与路由.md': (p) => `# 质检与路由（${p.series} 集版 · 前 ${p.episodes} 集）\n\n> 项目：${p.titleCn} / ${p.titleEn}\n> 自评 + 本地复核 v2.0-r4；外部 ≈ 自评 −(3.5~5)，外部回评前不宣称达标。\n\n## 闸门A\n## 闸门B\n## 诊断\n## 差异化\n## 判定\n`,
  '05_风控档案.md': (p) => `# 风控档案（${p.series} 集版 · 前 ${p.episodes} 集）\n\n> 项目：${p.titleCn} / ${p.titleEn}｜${p.genre}｜${p.restricted ? '受限（授权待补）' : '主池'}\n\n## 题材锁定卡\n## 筛查档位\n## 逐集预检\n## 闸门A 否决记录\n## 差异化核验\n## 判定\n`
}

export function newProject(input) {
  const p = {
    titleCn: input.titleCn, titleEn: input.titleEn || '', genre: input.genre || '其他',
    restricted: input.restricted === true, series: Number(input.series || 40), episodes: Number(input.episodes || 10),
    audience: input.audience || '欧美 18–45 岁女性', date: input.date || new Date().toISOString().slice(0, 10)
  }
  const dir = resolveTargetDir(input.outDir, input.bases || [])
  mkdirSync(dir, { recursive: true })
  const written = []
  for (const [f, tpl] of Object.entries(TEMPLATES)) {
    const p2 = { ...p, episodes: f.startsWith('03') ? Math.min(p.episodes, 10) : p.episodes }
    writeFileSync(join(dir, f), tpl(p2), 'utf8')
    written.push({ path: join(dir, f), chars: tpl(p2).length })
  }
  return { ok: true, dir, files: written, next: '填 00/01 后先写 02 大纲，再写 03 正文；每次改完跑 script_studio_audit' }
}

const PLAYBOOK = `# 剧本生产工作流程 v2.0-r4（零子代理直写）
## 9 步
S0 输入 → S1 立项/锁定卡 → S2 故事+人物 → S3 40集大纲 → S4 正文前10集 → S5 本地复核 → S6 修正 → S7 质检/风控 → S8 判定 → S9 续写
## 判分口径
自评只作参考：外部 ≈ 自评 −(3.5~5)；外部 ≥85 = 可进入制作；≥90 = 优质剧本。
## 7 条硬规则
1 集尾三改：末拍=动作/物件/具体选择，禁陈述句+氛围收尾
2 钩子前置：最强信息在中段时，0:50 再给"代价已开始"
3 开场去静场：前 3 秒是异常动作/反常物件/具体损失
4 场景轮换：同主场景连续 ≤3 集；10 集内同场景 >4 集必换
5 钩子配额：每 10 集六类至少各 1 次、同类 ≤4、相邻集不重复类型
6 卡点前集（N−1）：倒计时/代价已发生/最后机会三选一
7 高光切片：每 5 集至少 1 句可独立做切片的台词
## 已验证技法库
A 架构：脚本 ≤25KB 内联；提示词内联；一次合并评审；只改脏集；内置 agents/chars 计数
B 写作：集尾换钩；去静场；两处伏笔用一条线合并；口头禅第 1 集植入终集回收；设定原句进正文；成人-儿童接触改"无接触动作"；点修后回读上下文（对话链/人物表/锚定）；本地化交付（未做时节奏按 70%）；首帧可截图
C 判定：自评虚高按 −3.5~5 折算；双评取低制造假信号；每轮回评更新轨迹表；受限题材无授权标 HOLD
D 反模式：LLM 逐字复制代码装载；双评取低做迭代信号；整包重写修 3 个点；自评达标就宣布过线；忽略本地化；修订后不复盘
E 冲线循环：写稿 → 本地四项检查 → 点修 → 外部回评 → 按清单点修再回评（每轮 +1.5~2.5）
## 战绩
清算之外 82→84→85.5（可进入制作，正文已续至 20 集）；隐痛 84.5（已按清单修订，待复评）；租金帝国 81（软收尾/场景复用已清零，待复评）；药房暗账 82；替我坐牢的人 自评 87.6 待评；街区的债 待评
## 工具链
本插件 4 个工具即 S5 本地复核与 S8 判定的执行体；发布用 publish.mjs（plan 离线校验 / repo 建仓 / status 查年龄 / pr 提收录）。`

export function playbook() {
  return { version: '2.0-r4', text: PLAYBOOK, chars: PLAYBOOK.length }
}

export function createTools(defineTool) {
  return [
    defineTool({
      name: 'script_studio_audit',
      description: '审计一个短剧项目目录（v2.0-r4）：集数/场数/台词/动作、每集台词量、软收尾、静场开场、场景复用、钩子配额、大纲 risk_tag 与 diff 覆盖、红灯词、h 代理。返回结构化结果与可读报告。',
      parameters: {
        dir: { type: 'string', required: true, description: '项目目录（含 02 大纲与 03 正文）' },
        strict: { type: 'boolean', description: '严格模式：任一检查不过则 ok=false（默认 true）' }
      },
      output: {
        schema: {
          type: 'object', additionalProperties: false,
          properties: {
            ok: { type: 'boolean', required: true },
            dir: { type: 'string', required: true },
            files: { type: 'array', items: { type: 'string' } },
            metrics: { type: 'object', additionalProperties: true },
            outline: { type: 'object', additionalProperties: true },
            checks: { type: 'object', additionalProperties: true },
            redline: { type: 'array', items: { type: 'string' } },
            warnings: { type: 'array', items: { type: 'string' } },
            report: { type: 'string', required: true },
            reason: { type: 'string' }
          }
        },
        render: (_a, v) => [{ type: 'text', text: v.report }]
      },
      isConcurrencySafe: () => true,
      async execute(args, exec) {
        const r = auditProject(args.dir, [exec?.agent?.session?.cwd, exec?.agent?.cwd, exec?.cwd])
        if (args.strict === false) r.ok = r.redline.length === 0 && r.metrics && r.metrics.episodes > 0
        return r
      },
      presentCall: (args) => ({ card: 'generic', title: `Script studio audit: ${args.dir}`, kind: 'search' }),
      presentResult: (args) => ({ card: 'generic', title: `Audit done: ${args.dir}` })
    }),
    defineTool({
      name: 'script_studio_score',
      description: '按 2026.10.31 海外竖屏短剧百分制标准计算五维加权总分（黄金三秒20/冲突密度25/故事吸引力20/结尾钩子20/节奏紧凑度15），给出达标判定、自评→外部校准区间与逐维改进建议。',
      parameters: {
        golden: { type: 'number', required: true, description: '黄金三秒，0–20（满分 20）' },
        conflict: { type: 'number', required: true, description: '冲突密度，0–25（满分 25）' },
        attraction: { type: 'number', required: true, description: '故事吸引力，0–20（满分 20）' },
        hook: { type: 'number', required: true, description: '结尾钩子，0–20（满分 20）' },
        pace: { type: 'number', required: true, description: '节奏紧凑度，0–15（满分 15）' }
      },
      output: {
        schema: {
          type: 'object', additionalProperties: false,
          properties: {
            total: { type: 'number', required: true },
            verdict: { type: 'string', required: true },
            lines: { type: 'array', required: true, items: { type: 'object', additionalProperties: true } },
            externalEstimate: { type: 'object', required: true, additionalProperties: true },
            advice: { type: 'array', required: true, items: { type: 'string' } },
            report: { type: 'string', required: true }
          }
        },
        render: (_a, v) => [{ type: 'text', text: v.report }]
      },
      isConcurrencySafe: () => true,
      async execute(args) { return scoreProject(args) }
    }),
    defineTool({
      name: 'script_studio_new_project',
      description: '为短剧项目生成 v2.0-r4 目录骨架：00 定位、01 人物圣经、02 四十集大纲表、03 前 10 集正文模板、04 质检、05 风控。写完用 script_studio_audit 校验。',
      parameters: {
        outDir: { type: 'string', required: true, description: '项目目录（不存在会自动创建）' },
        titleCn: { type: 'string', required: true, description: '中文剧名' },
        titleEn: { type: 'string', description: '英文剧名' },
        genre: { type: 'string', enum: ['霸总', '家庭伦理', '黑帮', '血缘禁忌', '其他'], description: '题材（默认其他）' },
        restricted: { type: 'boolean', description: '是否受限变体池（默认 false）' },
        series: { type: 'integer', description: '全剧集数（默认 40）' },
        episodes: { type: 'integer', description: '本次交付集数（默认 10）' },
        audience: { type: 'string', description: '受众（默认欧美 18–45 岁女性）' },
        date: { type: 'string', description: '日期 YYYY-MM-DD' }
      },
      output: {
        schema: {
          type: 'object', additionalProperties: false,
          properties: {
            ok: { type: 'boolean', required: true },
            dir: { type: 'string', required: true },
            files: { type: 'array', required: true, items: { type: 'object', additionalProperties: true } },
            next: { type: 'string', required: true }
          }
        },
        render: (_a, v) => [{ type: 'text', text: `已创建 ${v.dir}\n` + v.files.map(f => `- ${f.path}（${f.chars} 字符）`).join('\n') + `\n\n下一步：${v.next}` }]
      },
      isConcurrencySafe: () => false,
      async execute(args, exec) { return newProject({ ...args, bases: [exec?.agent?.session?.cwd, exec?.agent?.cwd, exec?.cwd] }) },
      presentCall: (args) => ({ card: 'diff', title: `New script project: ${args.outDir}`, diffs: [] })
    }),
    defineTool({
      name: 'script_studio_playbook',
      description: '返回《剧本生产工作流程 v2.0-r4》全文：9 步流程、7 条硬规则、已验证技法库（架构/写作/判定/反模式/冲线循环）、项目战绩。写稿或复盘前先读。',
      parameters: {},
      output: {
        schema: {
          type: 'object', additionalProperties: false,
          properties: {
            version: { type: 'string', required: true },
            text: { type: 'string', required: true },
            chars: { type: 'number', required: true }
          }
        },
        render: (_a, v) => [{ type: 'text', text: v.text }]
      },
      isConcurrencySafe: () => true,
      async execute() { return playbook() }
    })
  ]
}
