# Experiment 006 research

## Sources

- A crawl of eight high-traffic posts, counting internal links inside the article body, 2026-10-15.
- GraphQL Analytics, `httpRequestsAdaptiveGroups` by path for human visitor requests, 2026-10-01 to 2026-10-15.

## Gap

/entropy-wall (501 human views in two weeks), /whos-driving (260) and /liquid-primitives (240) are among
the most-read posts. Their only internal links are the site header and footer (/, /blog, /projects,
/resources). A reader who finishes one of them has no path to another post, and a crawler that enters
there finds no post-to-post link. Experiment 001 tested the same idea on prompt pages. This experiment
tests it on posts. The metric is views on the nine linked-to posts, because those are the pages that gain
new inbound links. None of the twelve pages is in another experiment. The control group is six posts of
similar traffic that get no new links.
