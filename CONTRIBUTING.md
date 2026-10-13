# Contributing

1. Install with `bun install`.
2. Make one change.
3. Run `bun run verify`. It must exit 0.
4. Open a pull request that says what changed and how you checked it.

## Rules

- Use Effect for services and Foldkit for the dashboard. Read `FOLDKIT.md` first.
- Biome formats the code. `scripts/slop.ts` rejects placeholder text, hype words, `any`, and
  unfinished-work markers.
- Use real Cloudflare APIs. Do not add mocks to the dashboard.
- New data on the dashboard must be totals. Never add a field that can identify a visitor.
