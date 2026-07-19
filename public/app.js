const state = {
  prefill: null,
  options: [],
  selectedOptionId: null,
  reviewToken: null,
  config: null,
  revision: 0,
  prefillRequestId: 0,
  optionsRequestId: 0,
  confirmRequestId: 0
};

const byId = (id) => document.getElementById(id);
const form = byId('vehicle-form');
const aiButton = byId('ai-prefill');
const reviewFields = ['make', 'model', 'year', 'engineLiters', 'fuel', 'powerHp', 'transmission'];
const numericFields = {
  year: { label: 'Year', min: 1886, max: 2100, integer: true },
  engineLiters: { label: 'Engine size', min: 0.1, max: 20, integer: false },
  powerHp: { label: 'Power', min: 1, max: 5000, integer: true }
};
const canonicalFields = {
  fuel: new Set(['diesel', 'petrol', 'electric', 'hybrid']),
  transmission: new Set(['automatic', 'manual']),
  repairNodeId: new Set(['front-brake-service', 'rear-brake-service'])
};

function anonymousClientId() {
  const key = 'repair-reference-session';
  let value = sessionStorage.getItem(key);
  if (!value) {
    value = crypto.randomUUID().replaceAll('-', '');
    sessionStorage.setItem(key, value);
  }
  return value;
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers ?? {}) }
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'The request could not be completed.');
  return body;
}

function setBusy(button, busy, label) {
  if (busy) {
    button.dataset.label = button.textContent;
    button.textContent = label;
  } else if (button.dataset.label) {
    button.textContent = button.dataset.label;
  }
  button.disabled = busy;
}

function writeStatus(id, message, tone = '') {
  const node = byId(id);
  node.textContent = message;
  node.className = `inline-status ${tone}`.trim();
}

function updateFieldValidity(control) {
  const field = control?.name;
  if (![...reviewFields, 'repairNodeId'].includes(field)) return;
  const raw = String(control.value ?? '').trim();
  let valid = raw !== '';
  if (['make', 'model'].includes(field)) valid = valid && raw.length <= 80;
  if (numericFields[field]) {
    const rule = numericFields[field];
    const value = Number(raw.replace(',', '.'));
    valid = valid && Number.isFinite(value) && value >= rule.min && value <= rule.max && (!rule.integer || Number.isInteger(value));
  }
  if (canonicalFields[field]) valid = canonicalFields[field].has(raw.toLowerCase());
  control.setAttribute('aria-invalid', String(!valid));
}

function setFormValues(prefill) {
  for (const [field, value] of Object.entries(prefill.values)) {
    if (form.elements[field]) form.elements[field].value = value ?? '';
  }
  const supportedJobs = new Set(['front-brake-service', 'rear-brake-service']);
  form.elements.repairNodeId.value = supportedJobs.has(prefill.repairJob?.id)
    ? prefill.repairJob.id
    : 'unknown';
  for (const field of [...reviewFields, 'repairNodeId']) updateFieldValidity(form.elements[field]);
}

function readFormValues() {
  const data = new FormData(form);
  const values = Object.fromEntries(['make', 'model', 'fuel', 'transmission'].map((field) => {
    const raw = String(data.get(field) ?? '').trim();
    return [field, raw === '' ? undefined : raw.toLowerCase()];
  }));
  for (const [field, rule] of Object.entries(numericFields)) {
    const raw = String(data.get(field) ?? '').trim();
    if (raw === '') {
      values[field] = undefined;
      continue;
    }
    const value = Number(raw.replace(',', '.'));
    if (!Number.isFinite(value) || value < rule.min || value > rule.max || (rule.integer && !Number.isInteger(value))) {
      throw new Error(`${rule.label} must be a valid value between ${rule.min} and ${rule.max}.`);
    }
    values[field] = value;
  }
  return values;
}

function resetDecision(message = 'Confirm a synthetic catalog option to reveal the node, path, parts, and provenance.') {
  state.options = [];
  state.selectedOptionId = null;
  state.reviewToken = null;
  byId('catalog-options').replaceChildren();
  byId('confirm-option').disabled = true;
  byId('repair-path').className = 'empty-state';
  byId('repair-path').replaceChildren(
    Object.assign(document.createElement('div'), { className: 'empty-icon', textContent: '→' }),
    Object.assign(document.createElement('p'), { textContent: message })
  );
  byId('path-status').textContent = message.startsWith('Review changed') ? 'Review changed' : 'Awaiting confirmation';
  byId('path-status').className = 'status-pill neutral';
}

function invalidateDecision() {
  state.revision += 1;
  state.optionsRequestId += 1;
  state.confirmRequestId += 1;
  resetDecision('Review changed — search and confirm the visible options again.');
  writeStatus('confirm-status', 'Review changed. Search the synthetic catalog again before confirming.', 'error');
}

function invalidatePrefill() {
  state.prefillRequestId += 1;
  state.revision += 1;
  state.prefill = null;
  resetDecision('Request changed — create and review a new prefill before searching.');
  byId('find-options').disabled = true;
  renderAIContribution(null, null);
}

function scrollToSection(id) {
  const behavior = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  byId(id).scrollIntoView({ behavior, block: 'start' });
}

function renderAIContribution(prefill, comparison) {
  const node = byId('ai-contribution');
  if (!comparison) {
    node.hidden = true;
    node.replaceChildren();
    return;
  }
  const resolved = comparison.resolvedFields.map((field) => field.replace(/([A-Z])/g, ' $1').toLowerCase());
  const details = [...resolved, ...(comparison.repairJobResolved ? ['repair job'] : [])];
  node.hidden = false;
  node.replaceChildren(
    textNode('strong', '', `Live response: ${prefill.aiEvidence.servedModel}`),
    document.createTextNode(` · ${comparison.localFieldCount}/7 local fields → ${comparison.aiFieldCount}/7 structured fields`),
    textNode('div', '', details.length ? `Resolved from the same request: ${details.join(', ')}.` : 'No additional fields were inferred beyond the local baseline.')
  );
}

async function runPrefill(mode, button) {
  const requestId = ++state.prefillRequestId;
  const revision = state.revision;
  setBusy(button, true, mode === 'ai' ? 'Requesting structured prefill…' : 'Parsing locally…');
  writeStatus('intake-status', '');
  try {
    const { prefill, comparison } = await request('/api/prefill', {
      method: 'POST',
      body: JSON.stringify({
        mode,
        text: byId('request-text').value,
        clientId: anonymousClientId()
      })
    });
    if (requestId !== state.prefillRequestId || revision !== state.revision) return;
    state.prefill = prefill;
    setFormValues(prefill);
    state.revision += 1;
    resetDecision();
    byId('find-options').disabled = false;
    const fieldCount = Object.values(prefill.values).filter((value) => value !== undefined).length;
    const source = mode === 'ai' ? `${prefill.aiEvidence.servedModel} Structured Output` : 'deterministic local parser';
    writeStatus('intake-status', `Prefill ready via ${source}. Extracted fields: ${fieldCount}/7. Review every value below.`, 'success');
    renderAIContribution(prefill, comparison);
    scrollToSection('confirm');
  } catch (error) {
    writeStatus('intake-status', error.message, 'error');
  } finally {
    setBusy(button, false);
    if (button === aiButton && !state.config?.aiPrefillAvailable) button.disabled = true;
  }
}

function textNode(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = value;
  return node;
}

function optionDescription(option) {
  return [option.year, `${option.engineLiters} L`, option.fuel, `${option.powerHp} hp`, option.transmission]
    .filter(Boolean)
    .join(' · ');
}

function renderOptions(options) {
  const container = byId('catalog-options');
  container.replaceChildren();
  if (options.length === 0) {
    container.append(textNode('p', 'no-options', 'No synthetic option matched. Correct the proposed fields and try again.'));
    return;
  }

  for (const option of options) {
    const label = document.createElement('label');
    label.className = 'option-card';
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'catalogOption';
    radio.value = option.id;
    radio.addEventListener('change', () => {
      state.selectedOptionId = option.id;
      byId('confirm-option').disabled = false;
    });
    const content = document.createElement('span');
    content.className = 'option-content';
    const title = textNode('span', 'option-title', `${option.make} ${option.model} · ${option.variant}`);
    const details = textNode('span', 'option-details', optionDescription(option));
    const provenance = textNode('span', 'option-provenance', `Union provenance: ${option.availableFrom.join(' + ')}`);
    content.append(title, details, provenance);
    label.append(radio, content);
    container.append(label);
  }
}

async function findOptions() {
  const button = byId('find-options');
  const requestId = ++state.optionsRequestId;
  const revision = state.revision;
  resetDecision();
  setBusy(button, true, 'Building source union…');
  writeStatus('confirm-status', '');
  try {
    const { options, reviewToken } = await request('/api/catalog-options', {
      method: 'POST',
      body: JSON.stringify({
        values: readFormValues(),
        repairNodeId: form.elements.repairNodeId.value,
        clientId: anonymousClientId()
      })
    });
    if (requestId !== state.optionsRequestId || revision !== state.revision) return;
    state.options = options;
    state.reviewToken = reviewToken;
    state.selectedOptionId = null;
    byId('confirm-option').disabled = true;
    renderOptions(options);
    writeStatus('confirm-status', `${options.length} reviewable synthetic option${options.length === 1 ? '' : 's'} found. Select one explicitly.`, options.length ? 'success' : 'error');
  } catch (error) {
    writeStatus('confirm-status', error.message, 'error');
  } finally {
    setBusy(button, false);
  }
}

function renderRepairPath(path, confirmation) {
  const container = byId('repair-path');
  container.className = 'path-layout';
  container.replaceChildren();

  const summary = document.createElement('div');
  summary.className = 'confirmed-summary';
  summary.append(
    textNode('span', 'check-mark', '✓'),
    textNode('div', '', `${confirmation.vehicle.make} ${confirmation.vehicle.model} · ${confirmation.vehicle.variant}`),
    textNode('small', '', 'Explicitly confirmed by the user')
  );

  const diagram = document.createElement('div');
  diagram.className = 'diagram';
  path.node.diagram.forEach((item, index) => {
    diagram.append(textNode('span', 'diagram-node', item));
    if (index < path.node.diagram.length - 1) diagram.append(textNode('span', 'diagram-arrow', '→'));
  });

  const partsHeading = textNode('h3', '', 'Synthetic parts path');
  const parts = document.createElement('div');
  parts.className = 'parts-list';
  path.parts.forEach((part) => {
    const row = document.createElement('div');
    row.className = 'part-row';
    row.append(
      textNode('span', 'part-quantity', `${part.quantity}×`),
      textNode('strong', '', part.label),
      textNode('small', '', part.availableFrom.join(', '))
    );
    parts.append(row);
  });
  const provenance = textNode('p', 'provenance-line', `Node provenance: ${path.catalogProvenance.join(' + ')}`);
  container.append(summary, textNode('h3', '', path.node.label), diagram, partsHeading, parts, provenance);
  if (path.evidenceWarnings?.length) {
    container.append(textNode('p', 'evidence-warning', `${path.evidenceWarnings.length} source conflict${path.evidenceWarnings.length === 1 ? '' : 's'} preserved for review.`));
  }
  byId('path-status').textContent = 'Confirmed path';
  byId('path-status').className = 'status-pill available';
}

async function confirmOption() {
  const button = byId('confirm-option');
  if (!state.selectedOptionId) return;
  const requestId = ++state.confirmRequestId;
  const revision = state.revision;
  setBusy(button, true, 'Building confirmed path…');
  try {
    const result = await request('/api/confirm', {
      method: 'POST',
      body: JSON.stringify({
        selectedOptionId: state.selectedOptionId,
        values: readFormValues(),
        repairNodeId: form.elements.repairNodeId.value,
        clientId: anonymousClientId(),
        reviewToken: state.reviewToken,
        explicitConfirmation: true
      })
    });
    if (requestId !== state.confirmRequestId || revision !== state.revision) return;
    renderRepairPath(result.path, result.confirmation);
    state.reviewToken = null;
    writeStatus('confirm-status', 'Selection confirmed. The repair path is now tied to that exact synthetic option.', 'success');
    scrollToSection('path');
  } catch (error) {
    writeStatus('confirm-status', error.message, 'error');
  } finally {
    setBusy(button, false);
    if (!state.reviewToken) button.disabled = true;
  }
}

async function submitReport(event) {
  event.preventDefault();
  const button = byId('submit-report');
  const data = new FormData(byId('report-form'));
  setBusy(button, true, 'Creating safe receipt…');
  try {
    const result = await request('/api/error-report', {
      method: 'POST',
      body: JSON.stringify({
        stage: data.get('stage'),
        category: data.get('category'),
        note: data.get('note')
      })
    });
    byId('report-dialog').close();
    byId('report-result').replaceChildren(
      textNode('strong', '', `Report ${result.receipt}`),
      textNode('span', '', `Aggregate count: ${result.aggregate.count} · ${result.noteDisposition.replaceAll('-', ' ')}`)
    );
    byId('report-form').reset();
  } catch (error) {
    byId('report-result').textContent = error.message;
  } finally {
    setBusy(button, false);
  }
}

async function initialize() {
  try {
    state.config = await request('/api/config');
    const status = byId('ai-status');
    status.textContent = state.config.aiPrefillAvailable
      ? `${state.config.model} live · Structured Output · store:false`
      : 'Deterministic demo ready · add a server key for GPT-5.6';
    status.classList.toggle('available', state.config.aiPrefillAvailable);
    aiButton.disabled = !state.config.aiPrefillAvailable;
    aiButton.textContent = `Prefill with ${state.config.model}`;
    aiButton.className = state.config.aiPrefillAvailable ? 'primary' : 'secondary';
    byId('local-prefill').className = state.config.aiPrefillAvailable ? 'secondary' : 'primary';
  } catch {
    byId('ai-status').textContent = 'Offline mode ready';
  }
}

byId('local-prefill').addEventListener('click', () => runPrefill('local', byId('local-prefill')));
aiButton.addEventListener('click', () => runPrefill('ai', aiButton));
byId('find-options').addEventListener('click', findOptions);
byId('confirm-option').addEventListener('click', confirmOption);
byId('request-text').addEventListener('input', invalidatePrefill);
form.addEventListener('input', (event) => {
  updateFieldValidity(event.target);
  invalidateDecision();
});
byId('open-report').addEventListener('click', () => byId('report-dialog').showModal());
byId('close-report').addEventListener('click', () => byId('report-dialog').close());
byId('cancel-report').addEventListener('click', () => byId('report-dialog').close());
byId('report-form').addEventListener('submit', submitReport);

initialize();
