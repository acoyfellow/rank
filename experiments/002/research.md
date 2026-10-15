# Experiment 002 research

## Sources

- GraphQL Analytics, `httpRequestsAdaptiveGroups` by status, path and `requestSource`, 2026-10-08 to 2026-10-15.
- A crawl of 11 top pages for title, description, canonical, JSON-LD, h1 and og:image.

## Ruled out: the 504 errors

All 54,594 status 504 rows in the week have `requestSource=edgeWorkerCacheAPI`. They are cache
lookups made by the Worker, not responses to visitors. Visitors (`requestSource=eyeball`) received
no 5xx responses. The rank dashboard now counts visitor requests only.

## Gap

Every page has a canonical URL, JSON-LD, one h1 and an og:image, and the sitemap lists 80 URLs.
The gap is meta text on the hub pages. `/` (3,892 human views, 202 verified-bot views) and `/blog`
use the description "jordan coeyman's unrefined notepad.", which names no topic. `/projects` uses
"Projects by Jordan Coeyman". Post pages already have specific descriptions of 150 characters or
more, so they are the control group.
