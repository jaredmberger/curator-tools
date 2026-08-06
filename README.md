# Curator Intelligence

`tools.oceanliners.net` is the unified intelligence layer for CuratorOS and the specialist systems behind Ocean Liner Curator.

## Architecture

CuratorOS now follows a three-layer model:

1. **Specialist tools observe** — Site Health, Curator Integrity, Curator Speed, Search Intelligence, Link Map, Curator Indexer, and Page Studio each continue to perform a focused job.
2. **Curator Intelligence understands** — this repository normalizes signals from those tools, correlates findings by entity or URL, ranks priorities, surfaces opportunities, and tracks recent intelligence.
3. **CuratorOS decides** — `curator.oceanliners.net` remains the central operating environment for evidence, records, decisions, knowledge workflows, interventions, and publication work.

The intended flow is:

`Observe → Normalize → Correlate → Prioritize → Decide → Act → Verify → Learn`

## Primary addresses

- **Curator Intelligence** — `https://tools.oceanliners.net/`
- **CuratorOS** — `https://curator.oceanliners.net/`

## Specialist tools

- **Site Health** — `https://site-health.oceanliners.net/`
- **Curator Integrity** — `https://integrity.oceanliners.net/`
- **Curator Speed** — `https://speed.oceanliners.net/`
- **Search Intelligence** — `https://search-intelligence.oceanliners.net/`
- **Link Map** — `https://link-map.oceanliners.net/`
- **Curator Indexer** — `https://curator-indexer.oceanliners.net/`
- **Page Studio** — `https://page-studio.oceanliners.net/`

## Intelligence data contract

The dashboard currently consumes `data/intelligence.json`. This is the normalized contract between specialist systems and the Intelligence Center.

Top-level fields:

- `schemaVersion`
- `generatedAt`
- `overall`
- `summary`
- `systems`
- `priorities`
- `opportunities`
- `activity`

The initial file is deliberately safe: it reports adapters as pending rather than inventing live measurements.

### System signal

Each specialist system may provide:

```json
{
  "id": "site-health",
  "name": "Site Health",
  "status": "good",
  "statusLabel": "Healthy",
  "value": "98%",
  "summary": "Short human-readable interpretation.",
  "detail": "Optional supporting metric",
  "url": "https://site-health.oceanliners.net/"
}
```

Supported status levels are currently `good`, `warning`, `critical`, and `info`.

### Cross-tool priority

Priorities should represent interpreted intelligence rather than raw scanner output:

```json
{
  "title": "Strengthen a high-visibility page",
  "summary": "Search visibility is strong, internal-link support is weak, and performance requires attention.",
  "severity": "high",
  "entity": "/ships/example",
  "sources": ["Search Intelligence", "Link Map", "Curator Speed"]
}
```

This is the core distinction of the Intelligence Center: raw findings remain inside specialist tools; Curator Intelligence surfaces what the combined evidence means.

## Integration roadmap

### Phase 1 — Intelligence shell

Complete. The former tool launcher now includes system status, summary metrics, prioritized findings, opportunities, recent intelligence, architecture context, and direct access to the specialist tools.

### Phase 2 — First live adapter

Connect one specialist tool to the normalized data contract. Site Health is the recommended first implementation because its finding model is a good foundation for common severity, URL, timestamp, and status fields.

### Phase 3 — Cross-tool correlation

Add Search Intelligence and Link Map feeds, then correlate signals by canonical URL/entity. At this point the Intelligence Center can begin producing meaningful multi-system page dossiers and ranked actions.

### Phase 4 — CuratorOS feedback loop

Allow CuratorOS interventions and decisions to be represented in the intelligence layer so recommendations can be marked accepted, deferred, completed, or rejected and later compared with measured outcomes.

### Phase 5 — Learning layer

Use intervention/outcome history to improve ranking and recommendations. The system should eventually answer not only what needs attention, but which types of action have historically produced useful results for Ocean Liner Curator.

## Deployment

The repository remains compatible with static GitHub Pages. `index.html`, `styles.css`, `app.js`, and `data/intelligence.json` are served directly. The `CNAME` and `.nojekyll` files preserve the existing `tools.oceanliners.net` deployment.

A future server-side aggregator can replace the static JSON feed without requiring the dashboard UI to be redesigned, because `app.js` already consumes a normalized intelligence endpoint.
