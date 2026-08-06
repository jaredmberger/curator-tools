const CURATOR_ACTIONS_KEY = 'curator-intelligence-actions-v1';
const ACTION_STATES = ['recommended', 'planned', 'implemented', 'verifying', 'resolved', 'ineffective'];

function actionKey(card) {
  const chips = [...card.querySelectorAll('.priority-meta .chip')].map(node => node.textContent.trim());
  const entity = chips.find(value => value.startsWith('/')) || '';
  const title = card.querySelector('h3')?.textContent?.trim() || '';
  return `${entity}|${title}`;
}

function readActions() {
  try {
    const raw = localStorage.getItem(CURATOR_ACTIONS_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

function writeActions(actions) {
  localStorage.setItem(CURATOR_ACTIONS_KEY, JSON.stringify(actions));
}

function labelForState(state) {
  return ({
    recommended: 'Recommended',
    planned: 'Planned',
    implemented: 'Implemented',
    verifying: 'Verifying',
    resolved: 'Resolved',
    ineffective: 'Ineffective',
  })[state] || 'Recommended';
}

function nextStates(state) {
  if (state === 'recommended') return ['planned'];
  if (state === 'planned') return ['implemented'];
  if (state === 'implemented') return ['verifying'];
  if (state === 'verifying') return ['resolved', 'ineffective'];
  return [];
}

function updateCard(card, record) {
  let panel = card.querySelector('.action-tracker');
  if (!panel) {
    panel = document.createElement('div');
    panel.className = 'action-tracker';
    const body = card.children[1] || card;
    body.appendChild(panel);
  }

  const state = ACTION_STATES.includes(record?.state) ? record.state : 'recommended';
  const changed = record?.updatedAt ? new Date(record.updatedAt).toLocaleString() : '';
  const buttons = nextStates(state).map(next =>
    `<button type="button" class="action-state-button" data-action-state="${next}">Mark ${labelForState(next)}</button>`
  ).join('');

  panel.innerHTML = `
    <div class="action-tracker-row">
      <strong>Action status:</strong>
      <span class="chip">${labelForState(state)}</span>
      ${changed ? `<small>Updated ${changed}</small>` : ''}
    </div>
    ${buttons ? `<div class="action-tracker-controls">${buttons}</div>` : ''}
    ${state === 'resolved' ? '<small>Outcome recorded as successful.</small>' : ''}
    ${state === 'ineffective' ? '<small>Outcome recorded as ineffective; retain for future learning.</small>' : ''}
  `;
}

function bindCard(card) {
  if (card.dataset.actionTrackingBound === 'true') return;
  const recommended = [...card.querySelectorAll('strong')].some(node => node.textContent.trim() === 'Recommended:');
  if (!recommended) return;

  card.dataset.actionTrackingBound = 'true';
  const key = actionKey(card);
  if (!key || key === '|') return;

  const actions = readActions();
  if (!actions[key]) {
    actions[key] = { state: 'recommended', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    writeActions(actions);
  }
  updateCard(card, actions[key]);

  card.addEventListener('click', event => {
    const button = event.target.closest('[data-action-state]');
    if (!button) return;
    const next = button.dataset.actionState;
    if (!ACTION_STATES.includes(next)) return;
    const current = readActions();
    current[key] = {
      ...(current[key] || {}),
      state: next,
      updatedAt: new Date().toISOString(),
    };
    if (next === 'implemented') current[key].implementedAt = new Date().toISOString();
    if (next === 'resolved' || next === 'ineffective') current[key].completedAt = new Date().toISOString();
    writeActions(current);
    updateCard(card, current[key]);
    updateTrackingSummary();
  });
}

function updateTrackingSummary() {
  const cards = [...document.querySelectorAll('.priority-card[data-action-tracking-bound="true"]')];
  if (!cards.length) return;
  const actions = readActions();
  const counts = { recommended: 0, planned: 0, implemented: 0, verifying: 0, resolved: 0, ineffective: 0 };
  for (const card of cards) {
    const record = actions[actionKey(card)];
    const state = ACTION_STATES.includes(record?.state) ? record.state : 'recommended';
    counts[state] += 1;
  }

  let activity = document.querySelector('#action-tracking-activity');
  const list = document.querySelector('#activity-list');
  if (!list) return;
  if (!activity) {
    activity = document.createElement('article');
    activity.id = 'action-tracking-activity';
    activity.className = 'stack-item';
    list.prepend(activity);
  }
  activity.innerHTML = `
    <strong>Action Tracking v1 active</strong>
    <p>${counts.planned} planned · ${counts.implemented} implemented · ${counts.verifying} verifying · ${counts.resolved} resolved · ${counts.ineffective} ineffective.</p>
    <small>Browser-local workflow state · Curator Intelligence</small>
  `;
}

function hydrateActionTracking() {
  const cards = [...document.querySelectorAll('.priority-card')];
  cards.forEach(bindCard);
  updateTrackingSummary();
}

window.addEventListener('load', () => {
  setTimeout(hydrateActionTracking, 1800);
  setTimeout(hydrateActionTracking, 3500);
});

const observer = new MutationObserver(() => hydrateActionTracking());
observer.observe(document.documentElement, { childList: true, subtree: true });
