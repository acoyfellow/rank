import { spawnSync } from 'node:child_process'

const RETRY_WAIT_MS = 330_000
const MAX_ATTEMPTS = 4

const ids = process.argv.slice(2)
if (ids.length === 0) throw new Error('usage: bun scripts/baseline-batch.ts <id> [id...]')

const runOnce = (id: string) => spawnSync('bun', ['scripts/baseline.ts', id], { encoding: 'utf8' })

const isRateLimited = (output: string) => output.includes('Rate limiter budget depleted')

for (const id of ids) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const result = runOnce(id)
    const output = `${result.stdout}${result.stderr}`
    if (result.status === 0) {
      console.log(output.trim().split('\n').at(-1))
      break
    }
    if (!isRateLimited(output) || attempt === MAX_ATTEMPTS) {
      console.error(`baseline ${id} failed:\n${output}`)
      process.exit(1)
    }
    console.log(`baseline ${id}: rate limited, waiting ${RETRY_WAIT_MS / 1000}s (attempt ${attempt})`)
    await Bun.sleep(RETRY_WAIT_MS)
  }
}
