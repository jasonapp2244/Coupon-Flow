// Build-time settings for the post-build scripts, read the way Vite reads them:
// the process environment first, then the .env files.
import { readFileSync, existsSync } from 'node:fs'

export function env(key) {
  if (process.env[key]) return process.env[key]
  for (const file of ['.env.production.local', '.env.production', '.env.local', '.env']) {
    if (!existsSync(file)) continue
    const line = readFileSync(file, 'utf8').split(/\r?\n/).find(l => l.startsWith(`${key}=`))
    if (line) return line.slice(key.length + 1).trim().replace(/^["']|["']$/g, '')
  }
  return ''
}

/** GET a public API path as JSON; throws with the status on failure. */
export async function getJson(path) {
  const api = env('VITE_API_URL').replace(/\/$/, '')
  const res = await fetch(`${api}${path}`, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`)
  return res.json()
}
