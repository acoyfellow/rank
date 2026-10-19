import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Schema } from 'effect'
import { Plan, Verdict } from '../server/plan'

export const EXPERIMENTS_DIR = 'experiments'

export type LoadedPlan = Plan & Readonly<{ verdict: 'open' | 'proven' | 'disproven' | 'inconclusive' }>

const readJson = (file: string): unknown => JSON.parse(readFileSync(file, 'utf8'))

export const loadPlans = (dir = EXPERIMENTS_DIR): ReadonlyArray<LoadedPlan> =>
  readdirSync(dir)
    .sort()
    .filter(id => existsSync(join(dir, id, 'experiment.json')))
    .map(id => {
      const plan = Schema.decodeUnknownSync(Plan)(readJson(join(dir, id, 'experiment.json')))
      const verdictFile = join(dir, id, 'verdict.json')
      const verdict = existsSync(verdictFile)
        ? Schema.decodeUnknownSync(Verdict)(readJson(verdictFile)).verdict
        : 'open'
      return { ...plan, verdict }
    })
