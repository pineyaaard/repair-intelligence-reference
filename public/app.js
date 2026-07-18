const state = {
  prefill: null,
  options: [],
  selectedOptionId: null,
  config: null
};

const byId = (id) => document.getElementById(id);
const form = byId('vehicle-form');
const aiButton = byId('ai-prefill');

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

function setFormValues(prefill) {
  for (const [field, value] of Object.entries(prefill.values)) {
    if (form.elements[field]) form.elements[field].value = value ?? '';
  }
  form.elements.repairNodeId.value = prefill.repairJob?.id === 'front-brake-service'
    ? 'front-brake-service'
    : 'unknown';
}

function readFormValues() {
  const data = new FormData(form);
  const numeric = new Set(['year', 'engineLiters', 'powerHp']);
  const values = {};
  for (const field of ['make', 'model', 'year', 'engineLiters', 'fuel', 'powerHp', 'transmission']) {
    const raw = String(data.get(field) ?? '').trim();
    values[field] = raw === '' ? undefined : numeric.has(field) ? Number(raw) : raw.toLowerCase();
  }
  return values;
}

function clearAfterPrefill() {
  state.options = [];
  state.selectedOptionId = null;
  byId('catalog-options').replaceChildren();
  byId('confirm-option').disabled = true;
  byId('repair-path').className = 'empty-state';
  byId('repair-path').replaceChildren(
    Object.assign(document.createElement('div'), { className: 'empty-icon', textContent: '→' }),
    Object.assign(document.createElement('p'), { textContent: 'Confirm a synthetic catalog option to reveal the node, path, parts, and provenance.' })
  );
  byId('path-status').textContent = 'Awaiting confirmation';
  byId('path-status').className = 'status-pill neutral';
}

async function runPrefill(mode, button) {
  setBusy(button, true, mode === 'ai' ? 'Requesting structured prefill…' : 'Parsing locally…');
  writeStatus('intake-status', '');
  try {
    const { prefill } = await request('/api/prefill', {
      method: 'POST',
      body: JSON.stringify({
        mode,
        text: byId('request-text').value,
        clientId: anonymousClientId()
      })
    });
    state.prefill = prefill;
    setFormValues(prefill);
    clearAfterPrefill();
    byId('find-options').disabled = false;
    const source = mode === 'ai' ? `${state.config.model} Structured Output` : 'deterministic local parser';
    writeStatus('intake-status', `Prefill ready via ${source}. Confidence indicator: ${Math.round(prefill.confidence * 100)}%. Review it below.`, 'success');
    byId('confirm').scrollIntoView({ behavior: 'smooth', block: 'start' });
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
  setBusy(button, true, 'Building source union…');
  writeStatus('confirm-status', '');
  try {
    const { options } = await request('/api/catalog-options', {
      method: 'POST',
      body: JSON.stringify({ values: readFormValues() })
    });
    state.options = options;
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
  byId('path-status').textContent = 'Confirmed path';
  byId('path-status').className = 'status-pill available';
}

async function confirmOption() {
  const button = byId('confirm-option');
  if (!state.selectedOptionId) return;
  setBusy(button, true, 'Building confirmed path…');
  try {
    const result = await request('/api/confirm', {
      method: 'POST',
      body: JSON.stringify({
        selectedOptionId: state.selectedOptionId,
        values: readFormValues(),
        repairNodeId: form.elements.repairNodeId.value,
        explicitConfirmation: true
      })
    });
    renderRepairPath(result.path, result.confirmation);
    writeStatus('confirm-status', 'Selection confirmed. The repair path is now tied to that exact synthetic option.', 'success');
    byId('path').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    writeStatus('confirm-status', error.message, 'error');
  } finally {
    setBusy(button, false);
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
      ? `${state.config.model} available · store:false`
      : 'Offline mode ready · AI optional';
    status.classList.toggle('available', state.config.aiPrefillAvailable);
    aiButton.disabled = !state.config.aiPrefillAvailable;
    aiButton.textContent = `Prefill with ${state.config.model}`;
  } catch {
    byId('ai-status').textContent = 'Offline mode ready';
  }
}

byId('local-prefill').addEventListener('click', () => runPrefill('local', byId('local-prefill')));
aiButton.addEventListener('click', () => runPrefill('ai', aiButton));
byId('find-options').addEventListener('click', findOptions);
byId('confirm-option').addEventListener('click', confirmOption);
byId('open-report').addEventListener('click', () => byId('report-dialog').showModal());
byId('close-report').addEventListener('click', () => byId('report-dialog').close());
byId('cancel-report').addEventListener('click', () => byId('report-dialog').close());
byId('report-form').addEventListener('submit', submitReport);

initialize();
