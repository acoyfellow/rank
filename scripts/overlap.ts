import { readFileSync } from 'node:fs'
import { Schema } from 'effect'
import { findOverlaps } from '../server/plan'
import { loadPlans } from './plans'

const Proposal = Schema.Struct({
  id: Schema.String,
  treated: Schema.Array(Schema.String),
  control: Schema.Array(Schema.String),
})

const proposalFile = process.argv[2]
const proposals = proposalFile
  ? Schema.decodeUnknownSync(Schema.Array(Proposal))(JSON.parse(readFileSync(proposalFile, 'utf8')))
  : []
const open = loadPlans().filter(plan => plan.verdict === 'open')
const overlaps = findOverlaps([...open, ...proposals])

for (const overlap of overlaps) console.log(`OVERLAP ${overlap.path}: ${overlap.owners.join(', ')}`)
console.log(`${open.length} open + ${proposals.length} proposed, ${overlaps.length} overlap(s)`)
process.exit(overlaps.length === 0 ? 0 : 1)
