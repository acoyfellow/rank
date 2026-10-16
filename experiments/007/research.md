# Experiment 007 research

## Sources

- A crawl of /prompts, /blog, /liquid-primitives, /entropy-wall and /prompts/grill-me, parsing each JSON-LD block, 2026-10-16.
- GraphQL Analytics, `httpRequestsAdaptiveGroups` by path for human visitor requests, 2026-10-01 to 2026-10-15.

## Gap

Post and prompt pages carry Article JSON-LD with headline, dates, image and author. The /prompts index
(135 human views in two weeks) carries only the site-wide Organization block. Nothing tells a crawler that
the page is a list of 27 prompts. The change adds one CollectionPage block with an ItemList of every prompt
URL and name, built from `src/lib/prompts.ts` so it stays current. Experiment 001 covers /prompts/* detail
pages, and its pattern does not match the bare /prompts path, so this group does not overlap.

## Control caveat

No unused page has traffic like /prompts. /about is the control for experiment 005 and is reused here
because it gets no change in either experiment. /show-me, /parley and /quinn have almost no human traffic.
Read this experiment mainly as a before/after on /prompts, and treat the control line as a weak reference.
