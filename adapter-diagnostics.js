const ADAPTER_DIAGNOSTICS = [
  ['site-health', 'Site Health', 'https://site-health.oceanliners.net/api/curator-intelligence'],
  ['search-intelligence', 'Search Intelligence', 'https://search-intelligence.oceanliners.net/api/curator-intelligence'],
];

function findSystemCard(name) {
  return [...document.querySelectorAll('.system-card')].find(card => card.querySelector('h3')?.textContent?.trim() === name);
}

function setDiagnostic(card, state, detail) {
  if (!card) return;
  const badge = card.querySelector('.badge');
  const footer = card.querySelector('footer span');
  if (badge) {
    badge.textContent = state;
    badge.className = `badge ${state === 'Connected' ? 'good' : 'warning'}`;
  }
  if (footer) footer.textContent = detail;
}

async function diagnoseAdapter(id, name, endpoint) {
  const card = findSystemCard(name);
  // If the main intelligence client already connected it, leave it alone.
  if (card?.querySelector('.badge')?.textContent?.trim() === 'Connected') return;

  try {
    const response = await fetch(`${endpoint}?diagnostic=${Date.now()}`, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      setDiagnostic(card, 'Adapter error', `${id}: HTTP ${response.status}`);
      return;
    }

    const payload = await response.json();
    if (!payload?.ok) {
      setDiagnostic(card, 'Adapter error', `${id}: endpoint returned ok:false`);
      return;
    }
    if (!payload?.system) {
      setDiagnostic(card, 'Contract error', `${id}: endpoint is live but response has no system object`);
      return;
    }

    // A successful independent browser fetch proves the live endpoint and CORS path work.
    setDiagnostic(card, 'Connected', `${id}: live endpoint reachable from tools.oceanliners.net`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setDiagnostic(card, 'Fetch blocked', `${id}: ${message}`);
  }
}

window.addEventListener('load', () => {
  // Let app.js finish its normal adapter merge first.
  setTimeout(() => {
    for (const adapter of ADAPTER_DIAGNOSTICS) diagnoseAdapter(...adapter);
  }, 1200);
});
