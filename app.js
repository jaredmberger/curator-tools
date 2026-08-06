const INTELLIGENCE_ENDPOINT = './data/intelligence.json';
const MAX_CORRELATION_PAGES = 8;

const LIVE_ADAPTERS = [
  { id: 'site-health', endpoint: 'https://site-health.oceanliners.net/api/curator-intelligence' },
  { id: 'search-intelligence', endpoint: 'https://search-intelligence.oceanliners.net/api/curator-intelligence' },
  { id: 'link-map', endpoint: 'https://link-map.oceanliners.net/api/curator-intelligence' },
  { id: 'integrity', endpoint: 'https://integrity.oceanliners.net/api/curator-intelligence' },
  { id: 'speed', endpoint: 'https://speed.oceanliners.net/api/curator-intelligence' },
  { id: 'curator-indexer', endpoint: 'https://curator-indexer.oceanliners.net/api/curator-intelligence' },
];

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const formatSnapshot = (value) => {
  if (!value) return 'Snapshot time unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Snapshot time unavailable';
  return `Snapshot ${date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`;
};

const normalizeEntity = (value = '') => {
  if (!value) return '';
  try {
    const url = new URL(String(value), 'https://oceanliners.net');
    let path = url.pathname || '/';
    path = path.replace(/\/index\.html?$/i, '/').replace(/\.html?$/i, '');
    if (path.length > 1) path = path.replace(/\/$/, '');
    return path.toLowerCase();
  } catch {
    let path = String(value).trim();
    if (!path.startsWith('/')) path = `/${path}`;
    path = path.replace(/\.html?$/i, '');
    if (path.length > 1) path = path.replace(/\/$/, '');
    return path.toLowerCase();
  }
};

function renderMetrics(data) {
  document.querySelector('#metric-findings').textContent = data.summary?.activeFindings ?? 0;
  document.querySelector('#metric-priorities').textContent = data.summary?.priorityActions ?? 0;
  document.querySelector('#metric-tools').textContent = data.summary?.toolsReporting ?? 0;
  document.querySelector('#metric-critical').textContent = data.summary?.criticalFailures ?? 0;
  document.querySelector('#overall-status').textContent = data.overall?.label || 'System status unavailable';
  document.querySelector('#overall-summary').textContent = data.overall?.summary || 'No system summary is available.';
  document.querySelector('#snapshot-time').textContent = formatSnapshot(data.generatedAt);
}

function renderSystems(systems = []) {
  const target = document.querySelector('#system-grid');
  if (!systems.length) {
    target.innerHTML = '<div class="empty-state">No specialist tools are reporting into Curator Intelligence yet.</div>';
    return;
  }
  target.innerHTML = systems.map(system => `
    <article class="system-card">
      <header>
        <h3>${escapeHtml(system.name)}</h3>
        <span class="badge ${escapeHtml(system.status || 'info')}">${escapeHtml(system.statusLabel || system.status || 'Unknown')}</span>
      </header>
      <strong class="system-value">${escapeHtml(system.value ?? '—')}</strong>
      <p>${escapeHtml(system.summary || '')}</p>
      <footer>
        <span>${escapeHtml(system.detail || '')}</span>
        ${system.url ? `<a href="${escapeHtml(system.url)}">Open →</a>` : ''}
      </footer>
    </article>`).join('');
}

function renderPriorities(priorities = []) {
  const target = document.querySelector('#priority-list');
  if (!priorities.length) {
    target.innerHTML = '<div class="empty-state">No prioritized cross-tool findings are active.</div>';
    return;
  }
  target.innerHTML = priorities.map((item, index) => `
    <article class="priority-card">
      <span class="priority-rank">${index + 1}</span>
      <div>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.summary || '')}</p>
        ${item.decision ? `
          <p><strong>Recommended:</strong> ${escapeHtml(item.decision.action)}</p>
          <p><strong>Why:</strong> ${escapeHtml(item.decision.rationale)}</p>
          <p><strong>Verify:</strong> ${escapeHtml(item.decision.verification)}</p>
        ` : ''}
        <div class="priority-meta">
          ${(item.sources || []).map(source => `<span class="chip">${escapeHtml(source)}</span>`).join('')}
          ${item.entity ? `<span class="chip">${escapeHtml(item.entity)}</span>` : ''}
          ${item.query ? `<span class="chip">${escapeHtml(item.query)}</span>` : ''}
          ${item.correlated ? '<span class="chip">Correlated</span>' : ''}
          ${item.decision?.confidence ? `<span class="chip">${escapeHtml(item.decision.confidence)} confidence</span>` : ''}
          ${item.decision?.targetUrl ? `<a class="chip" href="${escapeHtml(item.decision.targetUrl)}">Open action target →</a>` : ''}
        </div>
      </div>
      <span class="severity ${escapeHtml(item.severity || 'low')}">${escapeHtml(item.severity || 'low')} priority</span>
    </article>`).join('');
}

function renderStack(selector, items = [], emptyMessage) {
  const target = document.querySelector(selector);
  if (!items.length) {
    target.innerHTML = `<div class="empty-state">${escapeHtml(emptyMessage)}</div>`;
    return;
  }
  target.innerHTML = items.map(item => `
    <article class="stack-item">
      <strong>${escapeHtml(item.title)}</strong>
      <p>${escapeHtml(item.summary || '')}</p>
      ${item.meta ? `<small>${escapeHtml(item.meta)}</small>` : ''}
    </article>`).join('');
}

function render(data) {
  renderMetrics(data);
  renderSystems(data.systems);
  renderPriorities(data.priorities);
  renderStack('#opportunity-list', data.opportunities, 'No opportunities have been promoted into the intelligence layer yet.');
  renderStack('#activity-list', data.activity, 'No recent intelligence events are available.');
}

function mergeSystem(data, system) {
  if (!system?.id) return;
  const systems = Array.isArray(data.systems) ? [...data.systems] : [];
  const index = systems.findIndex(item => item.id === system.id);
  if (index >= 0) systems[index] = { ...systems[index], ...system, live: true };
  else systems.push({ ...system, live: true });
  data.systems = systems;
}

function mergeUnique(base = [], incoming = [], keyFn) {
  const merged = [...incoming, ...base];
  const seen = new Set();
  return merged.filter(item => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mergeAdapterPayload(data, payload) {
  mergeSystem(data, payload.system);
  data.priorities = mergeUnique(
    Array.isArray(data.priorities) ? data.priorities : [],
    Array.isArray(payload.priorities) ? payload.priorities : [],
    item => `${item.title || ''}|${item.entity || ''}|${item.query || ''}`,
  ).sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
  data.opportunities = mergeUnique(
    Array.isArray(data.opportunities) ? data.opportunities : [],
    Array.isArray(payload.opportunities) ? payload.opportunities : [],
    item => `${item.title || ''}|${item.entity || ''}|${item.query || ''}`,
  );
  data.activity = mergeUnique(
    Array.isArray(data.activity) ? data.activity : [],
    [
      ...(Array.isArray(payload.activity) ? payload.activity : []),
      {
        title: `${payload.system.name} reporting live`,
        summary: payload.system.summary,
        meta: 'Live adapter · Curator Intelligence',
      },
    ],
    item => `${item.title || ''}|${item.meta || ''}`,
  );
}

function collectSearchSignals(search) {
  const raw = [
    ...(Array.isArray(search?.priorities) ? search.priorities : []),
    ...(Array.isArray(search?.opportunities) ? search.opportunities : []),
  ];
  const seen = new Set();
  return raw.filter(signal => {
    const entity = normalizeEntity(signal.entity);
    if (!entity) return false;
    const key = `${entity}|${signal.query || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, MAX_CORRELATION_PAGES);
}

function loadJsonp(url, callbackBase = '__curatorCorrelation') {
  return new Promise((resolve, reject) => {
    const callback = `${callbackBase}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement('script');
    const timer = setTimeout(() => cleanup(new Error('Bounded intelligence request timed out')), 10000);
    const cleanup = (error, value) => {
      clearTimeout(timer);
      try { delete window[callback]; } catch { window[callback] = undefined; }
      script.remove();
      if (error) reject(error); else resolve(value);
    };
    window[callback] = payload => cleanup(null, payload);
    script.onerror = () => cleanup(new Error('Bounded intelligence callback failed'));
    const target = new URL(url);
    target.searchParams.set('callback', callback);
    target.searchParams.set('v', '20260806-v2');
    script.src = target.href;
    document.head.appendChild(script);
  });
}

async function fetchDetailedIntegrity(signals) {
  const pages = [...new Set(signals.map(signal => normalizeEntity(signal.entity)).filter(Boolean))].slice(0, MAX_CORRELATION_PAGES);
  if (!pages.length) return null;
  const url = new URL('https://integrity.oceanliners.net/api/curator-intelligence');
  pages.forEach(path => url.searchParams.append('page', `https://oceanliners.net${path}`));
  try {
    const payload = await loadJsonp(url.href, '__curatorIntegrityV2');
    return payload?.ok ? payload : null;
  } catch (error) {
    console.warn('[Curator Intelligence] bounded Integrity correlation unavailable', error);
    return null;
  }
}

function healthMapFromSearch(search) {
  const pages = search?.technicalContext?.pages || [];
  return new Map(pages.map(page => [normalizeEntity(page.path), page]));
}

function integrityMap(payload) {
  return new Map((payload?.pages || []).map(page => [normalizeEntity(page.path || page.url), page]));
}

function graphMap(payload) {
  return new Map((payload?.pages || []).map(page => [normalizeEntity(page.path), page]));
}

function hasTechnicalBlocker(health) {
  if (!health) return false;
  return health.ok === false ||
    (health.httpStatus && Number(health.httpStatus) !== 200) ||
    health.canonicalOk === false ||
    health.indexable === false ||
    (Array.isArray(health.issues) && health.issues.length > 0);
}

function technicalDescription(health) {
  const parts = [];
  if (health?.httpStatus && Number(health.httpStatus) !== 200) parts.push(`HTTP ${health.httpStatus}`);
  if (health?.canonicalOk === false) parts.push('canonical mismatch');
  if (health?.indexable === false) parts.push('indexability problem');
  if (Array.isArray(health?.issues)) parts.push(...health.issues.slice(0, 2));
  return [...new Set(parts)].join(', ') || 'a verified technical issue';
}

function isSearchDecline(signal) {
  const text = `${signal.title || ''} ${signal.summary || ''}`.toLowerCase();
  return /decline|drop|fell|fall|loss|lost|down|decrease/.test(text);
}

function integritySeverity(page) {
  const findings = page?.findings || [];
  if (findings.some(f => ['error', 'critical'].includes(String(f.severity).toLowerCase()))) return 'high';
  if (findings.some(f => ['warning', 'medium'].includes(String(f.severity).toLowerCase()))) return 'medium';
  return findings.length ? 'low' : 'low';
}

function buildConclusion(signal, health, integrity, graph) {
  const baseScore = Math.max(40, Number(signal.score || 60));
  const decline = isSearchDecline(signal);
  const technical = hasTechnicalBlocker(health);
  const integrityProblem = Boolean(integrity && integrity.ok === false && (integrity.findingCount || integrity.findings?.length));
  const inbound = Number(graph?.inboundCount || 0);
  const weakLinks = Boolean(graph && (graph.orphan || inbound <= 1));
  const sources = ['Search Intelligence'];
  if (technical) sources.push('Site Health');
  if (integrityProblem) sources.push('Curator Integrity');
  if (weakLinks) sources.push('Link Map');

  if (technical) {
    const extra = [];
    if (integrityProblem) extra.push(`${integrity.findingCount || integrity.findings.length} Integrity finding${Number(integrity.findingCount || integrity.findings.length) === 1 ? '' : 's'}`);
    if (weakLinks) extra.push(graph.orphan ? 'no inbound internal links' : `only ${inbound} inbound internal link${inbound === 1 ? '' : 's'}`);
    return {
      title: decline ? 'Search decline coincides with a technical blocker' : 'Search change coincides with a technical blocker',
      summary: `${signal.entity} has ${technicalDescription(health)}. Fix the technical issue before changing content${extra.length ? `; secondary evidence also shows ${extra.join(' and ')}` : ''}.`,
      severity: 'high', score: Math.min(100, baseScore + 25), entity: signal.entity, query: signal.query || '', sources, correlated: true, conclusionType: 'technical-first',
    };
  }

  if (integrityProblem) {
    const count = Number(integrity.findingCount || integrity.findings?.length || 0);
    return {
      title: decline ? 'Search decline coincides with Integrity findings' : 'Search change coincides with Integrity findings',
      summary: `${signal.entity} has no verified technical blocker, but Curator Integrity found ${count} active standards issue${count === 1 ? '' : 's'}. Review those findings before making broader editorial changes${weakLinks ? `; Link Map also shows ${graph.orphan ? 'orphan risk' : `only ${inbound} inbound link${inbound === 1 ? '' : 's'}`}` : ''}.`,
      severity: integritySeverity(integrity), score: Math.min(100, baseScore + 18), entity: signal.entity, query: signal.query || '', sources, correlated: true, conclusionType: 'integrity-first',
    };
  }

  if (weakLinks) {
    const suggestions = Array.isArray(graph.suggestions) ? graph.suggestions.length : 0;
    return {
      title: decline ? 'Search decline coincides with weak internal-link support' : 'Search opportunity coincides with weak internal-link support',
      summary: `${signal.entity} has no technical or Integrity blocker, but ${graph.orphan ? 'currently has no inbound internal links' : `has only ${inbound} inbound internal link${inbound === 1 ? '' : 's'}`}. ${suggestions ? `Link Map has ${suggestions} candidate source page${suggestions === 1 ? '' : 's'} to review.` : 'Review Link Map for appropriate supporting links.'}`,
      severity: decline ? 'high' : 'medium', score: Math.min(100, baseScore + (graph.orphan ? 14 : 10)), entity: signal.entity, query: signal.query || '', sources, correlated: true, conclusionType: 'links-first',
    };
  }

  return {
    title: decline ? 'Search decline has no corroborating site issue yet' : 'Search change has no corroborating site issue yet',
    summary: `${signal.entity} shows a Search Intelligence signal, while available Site Health, Integrity, and Link Map evidence does not identify an immediate site-side cause. Monitor the next Watchtower snapshot before intervening.`,
    severity: 'low', score: Math.min(65, baseScore), entity: signal.entity, query: signal.query || '', sources, correlated: true, conclusionType: 'monitor',
  };
}

function decisionConfidence(conclusion, evidence) {
  const independentSources = new Set(conclusion.sources || []).size;
  if (conclusion.conclusionType === 'monitor') {
    const negativeChecks = [evidence.health, evidence.integrity, evidence.graph].filter(Boolean).length;
    return negativeChecks >= 3 ? 'High' : negativeChecks >= 2 ? 'Medium' : 'Low';
  }
  if (independentSources >= 3) return 'High';
  if (independentSources === 2) return 'High';
  return 'Medium';
}

function buildDecision(conclusion, evidence) {
  const confidence = decisionConfidence(conclusion, evidence);
  const path = normalizeEntity(conclusion.entity);
  const encodedPage = encodeURIComponent(`https://oceanliners.net${path}`);

  if (conclusion.conclusionType === 'technical-first') {
    return {
      action: `Fix the verified technical issue on ${path} before changing content or links.`,
      rationale: `Search Intelligence and Site Health agree on the same page, and technical accessibility/canonical/indexability problems outrank secondary optimization work.`,
      confidence,
      targetTool: 'Site Health',
      targetUrl: `https://site-health.oceanliners.net/?url=${encodedPage}`,
      verification: 'Re-check Site Health after the fix, then watch the next 2–3 Search Intelligence snapshots for recovery or stabilization.',
      successCriteria: 'Technical blocker cleared; page remains indexable/canonical; subsequent Watchtower snapshots stabilize or improve.',
    };
  }

  if (conclusion.conclusionType === 'integrity-first') {
    return {
      action: `Review and resolve the active Curator Integrity findings on ${path} before broader editorial changes.`,
      rationale: `Site Health shows no technical blocker, while Integrity identifies concrete standards issues on the same search-signaled page.`,
      confidence,
      targetTool: 'Curator Integrity',
      targetUrl: `https://integrity.oceanliners.net/?url=${encodedPage}`,
      verification: 'Re-run the bounded Integrity check after changes, then compare the next 2–3 Watchtower snapshots.',
      successCriteria: 'Relevant Integrity findings cleared without introducing technical regressions; search signal stabilizes or improves.',
    };
  }

  if (conclusion.conclusionType === 'links-first') {
    return {
      action: `Strengthen appropriate internal-link support for ${path}.`,
      rationale: `No technical or Integrity blocker was found; Link Map is the strongest actionable evidence currently associated with the search signal.`,
      confidence,
      targetTool: 'Link Map',
      targetUrl: 'https://link-map.oceanliners.net/',
      verification: 'Confirm inbound-link support increased in Link Map, then watch the next 2–3 Search Intelligence snapshots before making additional page changes.',
      successCriteria: 'Inbound support improves and the Watchtower trend stabilizes or improves without unnecessary content rewrites.',
    };
  }

  return {
    action: `Monitor ${path}; do not change the page solely because of the current search movement.`,
    rationale: `The Search Intelligence signal is real, but available technical, Integrity, and link evidence does not identify a corroborating site-side cause.`,
    confidence,
    targetTool: 'Search Intelligence',
    targetUrl: 'https://search-intelligence.oceanliners.net/',
    verification: 'Wait for the next Watchtower snapshot and reassess only if the signal persists, worsens, or gains corroborating evidence.',
    successCriteria: 'A later snapshot either normalizes the movement or provides enough repeated evidence to justify intervention.',
  };
}

function applyDecision(conclusion, evidence) {
  return { ...conclusion, decision: buildDecision(conclusion, evidence) };
}

async function correlateSignalsV2(data, payloads) {
  const search = payloads.get('search-intelligence');
  if (!search?.ok) return 0;
  const signals = collectSearchSignals(search);
  if (!signals.length) return 0;

  const detailedIntegrity = await fetchDetailedIntegrity(signals);
  if (detailedIntegrity?.system) payloads.set('integrity-detail', detailedIntegrity);

  const healthByPath = healthMapFromSearch(search);
  const integrityByPath = integrityMap(detailedIntegrity);
  const graphByPath = graphMap(payloads.get('link-map'));
  const conclusions = signals.map(signal => {
    const entity = normalizeEntity(signal.entity);
    const evidence = {
      health: healthByPath.get(entity),
      integrity: integrityByPath.get(entity),
      graph: graphByPath.get(entity),
    };
    return applyDecision(buildConclusion(signal, evidence.health, evidence.integrity, evidence.graph), evidence);
  });
  const correlatedEntities = new Set(conclusions.map(item => normalizeEntity(item.entity)));

  data.priorities = (Array.isArray(data.priorities) ? data.priorities : []).filter(item => {
    const entity = normalizeEntity(item.entity);
    const sources = item.sources || [];
    const isRawSpecialistSignal = sources.length === 1 && ['Search Intelligence', 'Curator Integrity'].includes(sources[0]);
    return !(entity && correlatedEntities.has(entity) && isRawSpecialistSignal);
  });

  data.priorities = mergeUnique(
    data.priorities,
    conclusions,
    item => `${item.title || ''}|${normalizeEntity(item.entity)}|${item.query || ''}`,
  ).sort((a, b) => Number(b.score || 0) - Number(a.score || 0));

  const actionable = conclusions.filter(item => item.conclusionType !== 'monitor').length;
  const monitored = conclusions.length - actionable;
  const highConfidence = conclusions.filter(item => item.decision?.confidence === 'High').length;
  data.activity = mergeUnique(
    Array.isArray(data.activity) ? data.activity : [],
    [{
      title: 'Decision Engine v1 completed',
      summary: `${conclusions.length} correlated conclusion${conclusions.length === 1 ? '' : 's'} converted into explicit next-step decisions; ${actionable} actionable, ${monitored} monitor-only, and ${highConfidence} high-confidence.`,
      meta: 'Curator Intelligence · Decision Engine v1',
    }, {
      title: 'Correlation Engine v2 completed',
      summary: `${conclusions.length} search-signaled page${conclusions.length === 1 ? '' : 's'} evaluated across technical health, Integrity standards, and internal-link support; ${actionable} actionable and ${monitored} monitor-only conclusion${monitored === 1 ? '' : 's'}.`,
      meta: 'Curator Intelligence · Correlation Engine v2',
    }],
    item => `${item.title || ''}|${item.meta || ''}`,
  );
  return conclusions.length;
}

async function fetchAdapter(adapter) {
  const response = await fetch(`${adapter.endpoint}?t=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${adapter.id} returned ${response.status}`);
  const payload = await response.json();
  if (!payload?.ok || !payload?.system) throw new Error(`${adapter.id} returned an invalid intelligence signal`);
  return payload;
}

async function mergeLiveAdapters(data) {
  const results = await Promise.allSettled(LIVE_ADAPTERS.map(fetchAdapter));
  const payloads = new Map();
  let latestTimestamp = data.generatedAt || null;
  let connectedCount = 0;

  results.forEach((result, index) => {
    const adapter = LIVE_ADAPTERS[index];
    if (result.status === 'fulfilled') {
      const payload = result.value;
      payloads.set(adapter.id, payload);
      mergeAdapterPayload(data, payload);
      connectedCount += 1;
      if (payload.generatedAt && (!latestTimestamp || new Date(payload.generatedAt) > new Date(latestTimestamp))) latestTimestamp = payload.generatedAt;
    } else {
      console.warn(`[Curator Intelligence] ${adapter.id} adapter unavailable`, result.reason);
    }
  });

  const correlatedCount = await correlateSignalsV2(data, payloads);
  const liveReporting = (data.systems || []).filter(system => system.live).length;
  const priorities = Array.isArray(data.priorities) ? data.priorities : [];
  const criticalFailures = priorities.filter(item => item.severity === 'critical').length;
  const decisions = priorities.filter(item => item.decision);
  data.summary = {
    ...(data.summary || {}),
    activeFindings: priorities.length,
    priorityActions: priorities.filter(item => ['high', 'critical'].includes(item.severity)).length,
    toolsReporting: liveReporting,
    criticalFailures,
    decisions: decisions.length,
  };
  data.generatedAt = latestTimestamp;

  if (connectedCount > 0) {
    data.overall = {
      label: correlatedCount ? 'Decision intelligence active' : priorities.length ? 'Intelligence active' : 'Intelligence layer online',
      summary: correlatedCount
        ? `${connectedCount} live specialist adapters are reporting. Correlation Engine v2 produced ${correlatedCount} page-level conclusion${correlatedCount === 1 ? '' : 's'}, and Decision Engine v1 assigned an explicit next action to each.`
        : priorities.length
          ? `${connectedCount} live specialist adapters are reporting with ${priorities.length} normalized intelligence signal${priorities.length === 1 ? '' : 's'}.`
          : `${connectedCount} live specialist adapter${connectedCount === 1 ? ' is' : 's are'} reporting.`,
    };
  }
  return data;
}

async function loadIntelligence() {
  try {
    const response = await fetch(`${INTELLIGENCE_ENDPOINT}?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Intelligence feed returned ${response.status}`);
    const baseData = await response.json();
    const data = await mergeLiveAdapters(baseData);
    render(data);
  } catch (error) {
    console.error('[Curator Intelligence]', error);
    document.querySelector('#overall-status').textContent = 'Intelligence feed unavailable';
    document.querySelector('#overall-summary').textContent = 'The dashboard shell is online, but its normalized intelligence feed could not be loaded.';
    document.querySelector('#snapshot-time').textContent = 'Check data/intelligence.json';
    renderSystems([]);
    renderPriorities([]);
    renderStack('#opportunity-list', [], 'The opportunity feed is unavailable.');
    renderStack('#activity-list', [], 'The activity feed is unavailable.');
  }
}

document.addEventListener('DOMContentLoaded', loadIntelligence);
