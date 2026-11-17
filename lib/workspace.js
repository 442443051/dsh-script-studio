/**
 * 解析会话工作区：DSH 工具的 process.cwd() 是 profile 目录，不是会话工作区。
 * 优先 DSH_WORKSPACE；其次按会话日志（session.v4.jsonl.zstd 首行 cwd）；
 * 若环境里没有 DSH_SESSION_ID，则取最近修改的会话日志。
 * 结果按进程缓存，失败返回 null。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { zstdDecompressSync } from 'node:zlib'

let cached
const headerCwd = file => {
  try {
    const head = readFileSync(file).subarray(0, 200000)
    const text = zstdDecompressSync(head).toString('utf8')
    const firstLine = text.split('\n').find(l => l.trim())
    if (!firstLine) return null
    const meta = JSON.parse(firstLine)
    return meta && typeof meta.cwd === 'string' && meta.cwd ? meta.cwd : null
  } catch { return null }
}

export function sessionWorkspace() {
  if (cached !== undefined) return cached
  cached = null
  try {
    if (process.env.DSH_WORKSPACE) { cached = process.env.DSH_WORKSPACE; return cached }
    const home = process.env.DSH_HOME || join(homedir(), '.dsh')
    const root = join(home, 'sessions')
    const sid = process.env.DSH_SESSION_ID
    const buckets = readdirSync(root)
    if (sid) {
      for (const bucket of buckets) {
        const dir = join(root, bucket, sid)
        const cwd = headerCwd(join(dir, 'session.v4.jsonl.zstd'))
        if (cwd) { cached = cwd; return cached }
      }
    }
    const files = []
    for (const bucket of buckets) {
      let sessions
      try { sessions = readdirSync(join(root, bucket)) } catch { continue }
      for (const dir of sessions) {
        const f = join(root, bucket, dir, 'session.v4.jsonl.zstd')
        try { files.push({ f, mtime: statSync(f).mtimeMs }) } catch { /* skip */ }
      }
    }
    files.sort((a, b) => b.mtime - a.mtime)
    for (const item of files.slice(0, 5)) {
      const cwd = headerCwd(item.f)
      if (cwd) { cached = cwd; return cached }
    }
  } catch { /* keep null */ }
  return cached
}
