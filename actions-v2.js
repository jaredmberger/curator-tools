const ACTIONS_ENDPOINT = 'https://search-intelligence.oceanliners.net/api/outcomes';

const actionEscape = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const actionNormalize = (value = '') => {
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

function searchPayload() {
  return window.__CURATOR_ADAPTERS__?.['search-intelligence'] || null;
}

function baselineForPage(page) {
  const normalized = actionNormalize(page);
  const history = searchPayload()?.verificationContext?.pages || [];
  const row = history.find(item => actionNormalize(item.path) === normalized);
  const points = [...(row?.points || [])].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const latest = points[points.length - 1];
  if (!latest) return null;
  return {
    search: {
      clicks: Number(latest.clicks || 0),
      impressions: Number(latest.impressions || 0),
      ctr: Number(latest.ctr || 0),
      position: Number(latest.position || 0),
    },
  };
}

function classifyCandidate(title = '') {
  const value = title.toLowerCase();
  if (value.includes('technical')) return 'technical-first';
  if (value.includes('integrity')) return 'integrity-first';
  if (value.includes('internal-link')) return 'links-first';
  return 'monitor';
}

function collectCurrentRecommendations() {
  const cards = [...document.querySelectorAll('#priority-list .priority-card')];
  return cards.map(card => {
    const title = card.querySelector('h3')?.textContent?.trim() || 'Curator Intelligence recommendation';
    const paragraphs = [...card.querySelectorAll('p')];
    const recommendationLine = paragraphs.find(p => p.textContent?.trim().startsWith('Recommended:'));
    const recommendation = recommendationLine?.textContent?.replace(/^Recommended:\s*/i, '').trim() || '';
    const chips = [...card.querySelectorAll('.priority-meta .chip')].map(node => node.textContent?.trim()).filter(Boolean);
    const page = chips.find(value => value.startsWith('/')) || '';
    const sources = chips.filter(value => ['Search Intelligence', 'Site Health', 'Curator Integrity', 'Link Map'].includes(value));
    if (!recommendation || !page) return null;
    return {
      title,
      page,
      recommendation,
      sources,
      opportunityType: classifyCandidate(title),
      baseline: baselineForPage(page),
    };
  }).filter(Boolean);
}

async function readActions() {
  const response = await fetch(`${ACTIONS_ENDPOINT}?verify=1&t=${Date.now()}`, {
    method: 'GET',
    headers: { accept: 'application/json' },
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) throw new Error(payload?.error || `Outcome registry returned HTTP ${response.status}`);
  return payload;
}

async function saveAction(body) {
  const response = await fetch(ACTIONS_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) throw new Error(payload?.error || `Outcome registry returned HTTP ${response.status}`);
  return payload;
}

function actionStateLabel(record) {
  if (record.status === 'planned') return 'Planned';
  if (record.status === 'implemented') {
    const verification = record.verification;
    if (!verification || verification.state === 'waiting') return 'Implemented · waiting to verify';
    if (verification.ready) return `Verifying · ${verification.label}`;
    return `Implemented · ${verification.label || 'verification pending'}`;
  }
  return record.status || 'Tracked';
}

function renderTrackedActions(payload) {
  const target = document.querySelector('#tracked-action-list');
  if (!target) return;
  const records = Array.isArray(payload?.records) ? payload.records : [];
  if (!records.length) {
    target.innerHTML = '<div class="empty-state">No interventions are being tracked yet.</div>';
    return;
  }

  target.innerHTML = records.map(record => `
    <article class="stack-item" data-action-id="${actionEscape(record.id)}">
      <strong>${actionEscape(record.recommendation || record.page || 'Tracked intervention')}</strong>
      <p>${actionEscape(record.page || record.query || '')}</p>
      <small>${actionEscape(actionStateLabel(record))}${record.updatedAt ? ` · updated ${actionEscape(new Date(record.updatedAt).toLocaleDateString())}` : ''}</small>
      ${record.verification?.detail ? `<p>${actionEscape(record.verification.detail)}</p>` : ''}
      ${record.status === 'planned' ? `<p><button class="button" type="button" data-mark-implemented="${actionEscape(record.id)}">Mark Implemented</button></p>` : ''}
    </article>`).join('');

  target.querySelectorAll('[data-mark-implemented]').forEach(button => {
    button.addEventListener('click', async () => {
      const id = button.getAttribute('data-mark-implemented');
      button.disabled = true;
      button.textContent = 'Saving…';
      try {
        await saveAction({ id, status: 'implemented' });
        await refreshActionRegistry();
      } catch (error) {
        console.warn('[Curator Intelligence] unable to mark intervention implemented', error);
        button.disabled = false;
        button.textContent = 'Mark Implemented';
      }
    });
  });
}

function renderRecommendationCandidates(records = []) {
  const target = document.querySelector('#action-candidate-list');
  if (!target) return;
  const tracked = new Set(records.map(record => `${actionNormalize(record.page)}|${String(record.recommendation || '').trim().toLowerCase()}`));
  const candidates = collectCurrentRecommendations().filter(candidate => !tracked.has(`${actionNormalize(candidate.page)}|${candidate.recommendation.toLowerCase()}`));

  if (!candidates.length) {
    target.innerHTML = '<div class="empty-state">No untracked Decision Engine recommendations are currently available.</div>';
    return;
  }

  target.innerHTML = candidates.map((candidate, index) => `
    <article class="stack-item">
      <strong>${actionEscape(candidate.title)}</strong>
      <p>${actionEscape(candidate.recommendation)}</p>
      <small>${actionEscape(candidate.page)} · ${actionEscape(candidate.sources.join(' + ') || 'Curator Intelligence')}</small>
      <p><button class="button primary" type="button" data-track-candidate="${index}">Track this action</button></p>
    </article>`).join('');

  target.querySelectorAll('[data-track-candidate]').forEach(button => {
    button.addEventListener('click', async () => {
      const candidate = candidates[Number(button.getAttribute('data-track-candidate'))];
      if (!candidate) return;
      button.disabled = true;
      button.textContent = 'Saving…';
      try {
        await saveAction({
          page: candidate.page,
          recommendation: candidate.recommendation,
          status: 'planned',
          baseline: candidate.baseline,
          source: 'Curator Intelligence',
          opportunityType: candidate.opportunityType,
          signalLanes: candidate.sources,
        });
        await refreshActionRegistry();
      } catch (error) {
        console.warn('[Curator Intelligence] unable to track recommendation', error);
        button.disabled = false;
        button.textContent = 'Track this action';
      }
    });
  });
}

async function refreshActionRegistry() {
  const status = document.querySelector('#action-registry-status');
  try {
    if (status) status.textContent = 'Loading persistent intervention registry…';
    const payload = await readActions();
    renderTrackedActions(payload);
    renderRecommendationCandidates(payload.records || []);
    if (status) {
      const summary = payload.summary || {};
      status.textContent = `${summary.tracked || 0} tracked · ${summary.implemented || 0} implemented · ${summary.ready || 0} ready for verification`;
    }
  } catch (error) {
    console.warn('[Curator Intelligence] Action Registry v2 unavailable', error);
    const tracked = document.querySelector('#tracked-action-list');
    const candidates = document.querySelector('#action-candidate-list');
    if (tracked) tracked.innerHTML = '<div class="empty-state">The persistent Action Registry is currently unavailable. The rest of Curator Intelligence is unaffected.</div>';
    if (candidates) candidates.innerHTML = '<div class="empty-state">Recommendations remain visible above; tracking is temporarily unavailable.</div>';
    if (status) status.textContent = 'Action Registry unavailable';
  }
}

function waitForDecisionCards() {
  const priorityList = document.querySelector('#priority-list');
  if (!priorityList) return;
  const attempt = () => {
    if (priorityList.querySelector('.priority-card')) {
      refreshActionRegistry();
      return true;
    }
    return false;
  };
  if (attempt()) return;
  const observer = new MutationObserver(() => {
    if (attempt()) observer.disconnect();
  });
  observer.observe(priorityList, { childList: true });
  setTimeout(() => {
    observer.disconnect();
    refreshActionRegistry();
  }, 5000);
}

document.addEventListener('DOMContentLoaded', waitForDecisionCards);
