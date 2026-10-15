# Experiment 003 research

## Sources

- A crawl of all 80 sitemap URLs for the `<title>` text, 2026-10-15.
- GraphQL Analytics, `httpRequestsAdaptiveGroups` by path for human visitor requests, 2026-10-01 to 2026-10-15.

## Gap

Several post titles are one to four words and do not name the topic. Examples are "Taste", "The Perfect DO",
"Constraint Theory" and "desk and living-artifact". A search result shows only the title and a snippet, so a
bare title does not tell the reader or the ranker what the page is about. Seven such posts get 54 to 98 human
views each in two weeks. Eight posts with similar traffic (55 to 84 views) already have a "Name: what it is"
title, and they are the control group. This experiment changes only the title text in `src/lib/articles.ts`.
Experiment 002 changed hub pages, and the control group of experiment 001 is prompt pages, so the groups do
not overlap. /terraloop and /cursing-agents also have short titles, but they are in the control group of 002, so
they stay unchanged.
