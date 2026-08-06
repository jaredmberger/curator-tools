const INTELLIGENCE_ENDPOINT = './data/intelligence.json';

const LIVE_ADAPTERS = [
  {
    id: 'site-health',
    endpoint: 'https://site-health.oceanliners.net/api/curator-intelligence',
  },
  {
    id: 'search-intelligence',
    endpoint: 'https://search-intelligence.oceanliners.net/api/curator-intelligence',
  },
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
        <div class="priority-meta">
          ${(item.sources || []).map(source => `<span class="chip">${escapeHtml(source)}</span>`).join('')}
          ${item.entity ? `<span class="chip">${escapeHtml(item.entity)}</span>` : ''}
          ${item.query ? `<span class="chip">${escapeHtml(item.query)}</span>` : ''}
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

async function fetchAdapter(adapter) {
  const response = await fetch(`${adapter.endpoint}?t=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${adapter.id} returned ${response.status}`);
  const payload = await response.json();
  if (!payload?.ok || !payload?.system) throw new Error(`${adapter.id} returned an invalid intelligence signal`);
  return payload;
}

async function mergeLiveAdapters(data) {
  const results = await Promise.allSettled(LIVE_ADAPTERS.map(fetchAdapter));
  let latestTimestamp = data.generatedAt || null;
  let connectedCount = 0;

  results.forEach((result, index) => {
    const adapter = LIVE_ADAPTERS[index];
    if (result.status === 'fulfilled') {
      const payload = result.value;
      mergeAdapterPayload(data, payload);
      connectedCount += 1;

      if (payload.generatedAt && (!latestTimestamp || new Date(payload.generatedAt) > new Date(latestTimestamp))) {
        latestTimestamp = payload.generatedAt;
      }
    } else {
      console.warn(`[Curator Intelligence] ${adapter.id} adapter unavailable`, result.reason);
    }
  });

  const liveReporting = (data.systems || []).filter(system => system.live).length;
  const priorities = Array.isArray(data.priorities) ? data.priorities : [];
  const criticalFailures = priorities.filter(item => item.severity === 'critical').length;
  data.summary = {
    ...(data.summary || {}),
    activeFindings: priorities.length,
    priorityActions: priorities.filter(item => ['high', 'critical'].includes(item.severity)).length,
    toolsReporting: liveReporting,
    criticalFailures,
  };
  data.generatedAt = latestTimestamp;

  if (connectedCount > 0) {
    const signalCount = priorities.length;
    data.overall = {
      label: signalCount ? 'Intelligence active' : 'Intelligence layer online',
      summary: signalCount
        ? `${connectedCount} live specialist adapters are reporting with ${signalCount} normalized intelligence signal${signalCount === 1 ? '' : 's'}. Cross-tool correlation will deepen as Link Map and the remaining systems are connected.`
        : `${connectedCount} live specialist adapter${connectedCount === 1 ? ' is' : 's are'} reporting. Cross-tool correlation will expand as additional systems are connected.`,
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
