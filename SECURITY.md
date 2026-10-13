# Security

## Report a problem

Open a private security advisory on GitHub:
https://github.com/acoyfellow/rank/security/advisories/new

Do not open a public issue for a security problem.

## What this project protects

- The public dashboard shows totals only. It never shows IP addresses, emails, full user agents,
  or query strings.
- Counts under 5 are rounded so that one visitor cannot be singled out.
- Cloudflare API tokens stay in Worker secrets. They never reach the browser.
- The optimization loop runs only when a person starts it.
