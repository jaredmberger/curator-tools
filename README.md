# CuratorOS Tools

CuratorOS Tools is the suite launcher for the research, site-assurance, search, maintenance, and publishing tools behind Ocean Liner Curator.

Primary address:

`https://tools.oceanliners.net/`

## Included tools

- **CuratorOS** — `https://curator.oceanliners.net/`
- **Site Health** — `https://site-health.oceanliners.net/`
- **Curator Integrity** — `https://integrity.oceanliners.net/`
- **Curator Speed** — `https://speed.oceanliners.net/`
- **Search Intelligence** — `https://search-intelligence.oceanliners.net/`
- **Link Map** — `https://link-map.oceanliners.net/`
- **Curator Indexer** — `https://curator-indexer.oceanliners.net/`
- **Page Studio** — `https://page-studio.oceanliners.net/`

CuratorOS remains the central operating environment. The other applications remain focused tools that support the broader workflow.

## Deployment

This repository is intentionally lightweight and static. `index.html` and `styles.css` can be served directly with GitHub Pages.

The repository includes a `CNAME` file for `tools.oceanliners.net` and a `.nojekyll` file so GitHub Pages can publish the files without Jekyll processing.

To publish:

1. In the repository settings, open **Pages**.
2. Choose **Deploy from a branch**.
3. Select `main` and `/ (root)`.
4. Confirm the custom domain is `tools.oceanliners.net`.
5. In Cloudflare DNS, point the `tools` hostname to the GitHub Pages host used for this repository.
6. Enable HTTPS when GitHub reports the domain as ready.

## Design intent

`tools.oceanliners.net` answers one question: **What CuratorOS tools are available and where do I open them?**

It is a launcher and suite overview, not another operating dashboard. CuratorOS itself remains the place where project records, evidence, findings, decisions, knowledge workflows, and publication work come together.
