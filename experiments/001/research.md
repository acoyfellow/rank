# Experiment 001 research

## Sources

- GraphQL Analytics, `httpRequestsAdaptiveGroups` by path, 2026-10-06 to 2026-10-13.
- Clef (`@cf/cloudflare/clef`) scores for each pair of prompts, in `coey.dev/scripts/related/scores.json`.

## Gap

`/prompts/*` pages did not appear in the top paths for human traffic. Each prompt page linked only
back to the index, so a reader who finished one prompt had no next step. Clef found that five
prompts were never a strong match for any other prompt. Those five pages get no new links and are
the control group.
