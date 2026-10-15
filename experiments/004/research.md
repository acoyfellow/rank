# Experiment 004 research

## Sources

- A crawl of sitemap.xml (80 URLs) compared with the route folders in coey.dev, 2026-10-15.
- A crawl of each missing route for status, robots meta, canonical and title.
- GraphQL Analytics, `httpRequestsAdaptiveGroups` by path for human visitor requests, 2026-10-01 to 2026-10-15.

## Gap

`src/lib/article-seo.ts` keeps 15 posts in `unlistedArticles`. They are off the blog index on purpose,
but they also never reached sitemap.xml. Each one returns 200, has a canonical URL and has no noindex,
so crawlers can only find them through a link. Some still get traffic without the sitemap:
/agentic-architecture 95, /ditto 87, /blaze 72, /workflow-live 60 human views in two weeks. The
change adds 14 of them to the sitemap only. The blog index does not change. /post-form is a form, not
a post, so it stays out. The control group is 8 listed posts of similar traffic that no other
experiment touches.
