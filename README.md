# rank

An agentic SEO loop that runs on your own Cloudflare account.

Live on coey.dev: https://coey.dev/rank

## The problem

Search tools tell you what happened. They do not change your site, and they do not tell you
whether a change worked. They also send your traffic data to a third party.

## The promise

`rank` reads your traffic from Cloudflare, researches what people and agents search for, makes one
change to your site, and records whether that change moved the numbers. Every experiment, win or
loss, goes into a public ledger.

## Run it

```sh
bun install
bun run dev
```

The dashboard runs at the local URL that Vite prints.

## How it works

```text
research -> hypothesis -> act -> measure -> record
```

1. **Research.** Cloudflare AI Search indexes your site. The Web Search API shows who ranks for your
   target queries.
2. **Hypothesis.** One change, one metric, a target, and a control group.
3. **Act.** The change is pushed to your site.
4. **Measure.** The same metric is read over the same length of window before and after the change.
5. **Record.** The verdict (`proven`, `disproven`, or `inconclusive`) is added to the ledger.

A person starts each iteration with `bun run iterate`. Nothing runs on a schedule.

## How you know it worked

`bun run verify` checks the build, the lint, the tests, the live dashboard, the freshness of every
data source, and that the public data contains no private values.

## What it does not do

- It does not use Google Search Console, Google Analytics, or any third-party script.
- It cannot see Google's own impressions or click-through rate. It measures search referrers,
  crawler visits, and query rank instead.
- It does not publish IP addresses, emails, or full user agents. Counts under 5 are rounded.
- It does not run the optimization loop on its own.

## Where to change behavior

The target queries and page groups live in one file, `rank.config.ts`.

## What this makes possible next

A shared experiment format for SEO on Cloudflare. Each ledger entry is a receipt that another site
can read and repeat.
