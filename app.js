// SMS Squema: browses data/schema.json, written by the SmsSquema.Exporter project.
// Routes live in the hash so every view can be linked. Explore (explore.js): #/, #/topic/prices, #/topic/prices/PRICE.
// Reference: #/list, #/table/PRICE_TAB, #/field/F140, #/search/package.

import { createExplorer } from './explore.js';

const KINDS = [
  { id: 'Main', css: 'main', label: 'Main', help: 'Data tables, NAME_TAB.' },
  { id: 'Deleted', css: 'deleted', label: 'Deleted', help: 'Rows deleted from a main table, NAME_DEL.' },
  { id: 'Revision', css: 'revision', label: 'Revision', help: 'Revisions of a main table, NAME_REV.' },
  { id: 'Batch', css: 'batch', label: 'Batch', help: 'Batches of pending changes, NAME_BAT (F… future, O… old values).' },
  { id: 'Report', css: 'report', label: 'Report', help: 'Report totals per period, RPT_*.' },
  { id: 'Temporary', css: 'temporary', label: 'Temporary', help: 'Work tables, TMP_*.' },
  { id: 'Other', css: 'other', label: 'Other', help: 'Tables outside these conventions (headers, registers, …).' },
];
const KIND_BY_ID = new Map(KINDS.map(k => [k.id, k]));
const STORAGE_KEY = 'sms-squema.kinds';
const RESULT_LIMIT = 60;

const state = {
  data: null,
  tables: new Map(), // NAME -> table
  usage: new Map(), // COLUMN NAME -> [{ table, column }]
  kinds: loadKinds(),
  query: '',
  explorer: null,
};

const el = {
  meta: document.getElementById('meta'),
  search: document.getElementById('search'),
  kinds: document.getElementById('kinds'),
  count: document.getElementById('count'),
  list: document.getElementById('table-list'),
  main: document.getElementById('main'),
  nav: document.querySelectorAll('[data-nav]'),
  theme: document.getElementById('theme-toggle'),
};

setUpThemeToggle();

init();

async function init() {
  try {
    const response = await fetch('data/schema.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.data = await response.json();
  } catch (error) {
    el.meta.textContent = '';
    el.main.innerHTML = `<p class="error">Could not load <code>data/schema.json</code> (${esc(error.message)}).
      Run the exporter first, and serve this folder over HTTP rather than opening the file directly.</p>`;
    return;
  }

  for (const table of state.data.tables) {
    state.tables.set(table.name.toUpperCase(), table);
    for (const column of table.columns) {
      const code = column.name.toUpperCase();
      if (!state.usage.has(code)) state.usage.set(code, []);
      state.usage.get(code).push({ table, column });
    }
  }

  const exported = new Date(state.data.generatedAt);
  el.meta.textContent = `${state.data.database} · ${state.data.tables.length} tables · exported ${exported.toLocaleDateString()}`;

  renderKindChips();
  el.search.addEventListener('input', debounce(onSearchInput, 120));
  el.search.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      el.search.value = '';
      onSearchInput();
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === '/' && !(event.target instanceof HTMLInputElement)) {
      event.preventDefault();
      (document.body.classList.contains('explore-mode') ? el.main.querySelector('#finder') ?? el.search : el.search)?.focus();
    }
  });
  window.addEventListener('hashchange', route);
  route();
}

// ---------------------------------------------------------------- routing

function route() {
  const [, view = '', rawArg = '', rawArg2 = ''] = location.hash.split('/');
  const arg = decodeURIComponent(rawArg);

  const exploring = view === '' || view === 'topic';
  document.body.classList.toggle('explore-mode', exploring);
  el.nav.forEach(link => link.setAttribute('aria-current', (link.dataset.nav === 'explore') === exploring ? 'page' : 'false'));
  if (exploring) {
    renderExplore(view, arg, decodeURIComponent(rawArg2));
    window.scrollTo(0, 0);
    return;
  }

  if (view === 'search') {
    state.query = arg;
    if (el.search.value !== arg) el.search.value = arg;
  } else {
    state.query = '';
    if (document.activeElement !== el.search) el.search.value = '';
  }

  let current = null;
  if (view === 'table') {
    current = state.tables.get(arg.toUpperCase()) ?? null;
    current ? renderTable(current) : renderNotFound(`There is no table named ${arg}.`);
  } else if (view === 'field') {
    renderField(arg.toUpperCase());
  } else if (view === 'search' && arg.trim()) {
    renderSearch(arg);
  } else {
    renderHome();
  }

  renderList(current);
  el.main.scrollTop = 0;
  if (view !== 'search') window.scrollTo(0, 0);
}

function onSearchInput() {
  const query = el.search.value.trim();
  if (query) {
    history.replaceState(null, '', `#/search/${encodeURIComponent(query)}`);
  } else if (location.hash.startsWith('#/search')) {
    history.replaceState(null, '', '#/list');
  }
  route();
}

// ---------------------------------------------------------------- sidebar

function renderKindChips() {
  const counts = countBy(state.data.tables, t => t.kind);
  el.kinds.innerHTML = KINDS.map(kind => `
    <button type="button" class="chip" data-kind="${kind.id}" aria-pressed="${state.kinds.has(kind.id)}" title="${esc(kind.help)}">
      <span class="dot ${kind.css}"></span>${kind.label} <span>${counts.get(kind.id) ?? 0}</span>
    </button>`).join('');

  el.kinds.addEventListener('click', event => {
    const chip = event.target.closest('.chip');
    if (!chip) return;
    const kind = chip.dataset.kind;
    state.kinds.has(kind) ? state.kinds.delete(kind) : state.kinds.add(kind);
    chip.setAttribute('aria-pressed', state.kinds.has(kind));
    saveKinds();
    route();
  });
}

function renderList(current) {
  const words = terms(state.query);
  const visible = state.data.tables.filter(table =>
    state.kinds.has(table.kind) && words.every(w => table.name.toLowerCase().includes(w) || (table.alias ?? '').toLowerCase().includes(w)));

  el.count.textContent = `${visible.length} of ${state.data.tables.length} tables`;
  el.list.innerHTML = visible.length
    ? visible.map(table => `
      <a href="#/table/${encodeURIComponent(table.name)}" ${table === current ? 'aria-current="page"' : ''}>
        <span class="dot ${kindCss(table.kind)}" title="${esc(table.kind)}"></span>
        <span class="name">${highlight(table.name, words)}</span>
        ${table.alias ? `<span class="alias">${highlight(table.alias, words)}</span>` : ''}
      </a>`).join('')
    : `<p class="empty">${words.length ? 'No table name matches the search; see the fields on the right.' : 'No table of the selected kinds.'}</p>`;

  el.list.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest' });
}

// ---------------------------------------------------------------- views

function renderExplore(view, topic, stem) {
  state.explorer ??= createExplorer(state.data);
  if (view === 'topic' && state.explorer.renderTopic(el.main, topic, stem)) return;
  state.explorer.renderHome(el.main);
}

function renderHome() {
  document.title = 'SMS Squema';
  const tables = state.data.tables;
  const columns = tables.reduce((sum, t) => sum + t.columns.length, 0);
  const described = tables.reduce((sum, t) => sum + t.columns.filter(c => describe(c)).length, 0);
  const counts = countBy(tables, t => t.kind);
  const main = tables.filter(t => t.kind === 'Main');

  el.main.innerHTML = `
    <h1>SMS database reference</h1>
    <p class="lead">Every table and column of the SMS database <code>${esc(state.data.database)}</code>, with the descriptions
      SMS keeps in its own dictionary (<code>RB_TABLES</code>, <code>RB_FIELDS</code>, <code>RB_JOINS</code>).
      A field code such as <a href="#/field/F01"><code>F01</code></a> means the same in every table, so each one has its own page
      listing where it is used. Press <kbd>/</kbd> to search.</p>

    <div class="stats">
      ${stat(tables.length, 'tables')}
      ${stat(columns.toLocaleString(), 'columns')}
      ${stat(Object.keys(state.data.fields).length.toLocaleString(), 'described field codes')}
      ${stat(`${Math.round(100 * described / Math.max(columns, 1))}%`, 'columns with a description')}
    </div>

    <h2>Kinds of table</h2>
    <ul class="kind-legend">
      ${KINDS.map(k => `<li><span class="badge ${k.css}">${k.label}</span><span>${esc(k.help)}</span><span class="n">${counts.get(k.id) ?? 0}</span></li>`).join('')}
    </ul>

    <h2>Main tables <small class="none">(${main.length})</small></h2>
    <div class="cards">
      ${main.map(t => `<a class="card" href="#/table/${encodeURIComponent(t.name)}">
        <div class="name">${esc(t.name)}</div><div class="alias">${esc(t.alias ?? '—')}</div></a>`).join('')}
    </div>

    ${state.data.joins.length ? `<h2>Relationships declared by SMS</h2>${joinsTable(state.data.joins)}` : ''}`;
}

function renderTable(table) {
  document.title = `${table.name} · SMS Squema`;
  const kind = KIND_BY_ID.get(table.kind) ?? KINDS.at(-1);
  const key = keyIndex(table);
  const keyColumns = new Set((key?.columns ?? []).map(c => c.toUpperCase()));
  const family = state.data.tables.filter(t => t.stem === table.stem && t.kind !== 'Temporary');
  const joins = state.data.joins.filter(j => sameName(j.table1, table.name) || sameName(j.table2, table.name));

  el.main.innerHTML = `
    <div class="crumbs"><a href="#/list">Tables</a> / ${esc(kind.label)}</div>
    <h1 class="code">${esc(table.name)}</h1>
    <p class="subtitle">${table.alias ? esc(table.alias) : '<span class="none">SMS has no description for this table</span>'}</p>
    <div class="row">
      <span class="badge ${kind.css}" title="${esc(kind.help)}">${kind.label}</span>
      <span>${table.columns.length} columns</span>
      ${key ? `<span>Key: ${key.columns.map(c => `<a class="mono key" href="#/field/${encodeURIComponent(c)}">${esc(c)}</a>`).join(' + ')}</span>` : '<span class="none">No unique key</span>'}
    </div>
    ${family.length > 1 ? `<ul class="family" aria-label="Tables of the same family">
      ${family.map(t => t === table
        ? `<li><span><span class="dot ${kindCss(t.kind)}"></span>${esc(t.name)}</span></li>`
        : `<li><a href="#/table/${encodeURIComponent(t.name)}"><span class="dot ${kindCss(t.kind)}"></span>${esc(t.name)}</a></li>`).join('')}
    </ul>` : ''}

    <div class="toolbar">
      <h2>Columns</h2>
      <div class="row">
        <input id="column-filter" type="search" placeholder="Filter columns" aria-label="Filter columns">
        <button type="button" class="action" id="copy-select">Copy SELECT</button>
      </div>
    </div>
    <div class="panel scroll">
      <table>
        <thead><tr><th>#</th><th>Column</th><th>Description</th><th>Type</th><th>Null</th><th>Used in</th></tr></thead>
        <tbody id="column-rows"></tbody>
      </table>
    </div>

    <h2>Indexes</h2>
    ${table.indexes.length ? `<div class="panel scroll"><table>
      <thead><tr><th>Name</th><th>Kind</th><th>Columns</th></tr></thead>
      <tbody>${table.indexes.map(i => `<tr>
        <td class="mono">${esc(i.name)}</td>
        <td>${i.isPrimaryKey ? '<span class="key">Primary key</span>' : i.isUnique ? 'Unique' : 'Index'}</td>
        <td>${i.columns.map(c => `<a class="mono" href="#/field/${encodeURIComponent(c)}">${esc(c)}</a>`).join(', ')}</td>
      </tr>`).join('')}</tbody></table></div>` : '<p class="none">This table has no indexes.</p>'}

    ${joins.length ? `<h2>Relationships declared by SMS</h2>${joinsTable(joins)}` : ''}`;

  const rows = document.getElementById('column-rows');
  const filter = document.getElementById('column-filter');
  const draw = () => {
    const words = terms(filter.value);
    const matching = table.columns
      .map((column, index) => ({ column, index }))
      .filter(({ column }) => words.every(w =>
        column.name.toLowerCase().includes(w) || (describe(column) ?? '').toLowerCase().includes(w) || column.type.includes(w)));
    rows.innerHTML = matching.length
      ? matching.map(({ column, index }) => columnRow(column, index, keyColumns, words)).join('')
      : '<tr><td colspan="6" class="none">No column matches.</td></tr>';
  };
  filter.addEventListener('input', draw);
  draw();

  document.getElementById('copy-select').addEventListener('click', event =>
    copy(event.currentTarget, `SELECT ${table.columns.map(c => c.name).join(', ')}\nFROM dbo.${table.name}`));
}

function columnRow(column, index, keyColumns, words) {
  const code = column.name.toUpperCase();
  const description = describe(column);
  const others = (state.usage.get(code)?.length ?? 1) - 1;
  return `<tr>
    <td class="num">${index + 1}</td>
    <td><a class="mono ${keyColumns.has(code) ? 'key' : ''}" href="#/field/${encodeURIComponent(column.name)}"
      title="${keyColumns.has(code) ? 'Part of the key' : ''}">${highlight(column.name, words)}</a></td>
    <td>${description ? highlight(description, words) : '<span class="none">No description</span>'}</td>
    <td class="type">${esc(column.type)}</td>
    <td>${column.nullable ? 'yes' : '<strong>no</strong>'}</td>
    <td>${others > 0 ? `<a href="#/field/${encodeURIComponent(column.name)}">${others} other${others === 1 ? '' : 's'}</a>` : '<span class="none">only here</span>'}</td>
  </tr>`;
}

function renderField(code) {
  const uses = state.usage.get(code) ?? [];
  const description = state.data.fields[code];
  if (!uses.length && !description) {
    renderNotFound(`No table has a column named ${code}.`);
    return;
  }
  document.title = `${code} · SMS Squema`;
  const types = [...countBy(uses, u => u.column.type)].sort((a, b) => b[1] - a[1]);

  el.main.innerHTML = `
    <div class="crumbs"><a href="#/list">Tables</a> / Field</div>
    <h1 class="code">${esc(code)}</h1>
    <p class="subtitle">${description ? esc(description) : '<span class="none">SMS has no description for this field</span>'}</p>
    <div class="row">
      <span>Used in <strong>${uses.length}</strong> table${uses.length === 1 ? '' : 's'}</span>
      ${types.length ? `<span>Types: ${types.map(([type, n]) => `<code>${esc(type)}</code>${types.length > 1 ? ` <span class="none">×${n}</span>` : ''}`).join(', ')}</span>` : ''}
    </div>

    <h2>Tables</h2>
    ${uses.length ? `<div class="panel scroll"><table>
      <thead><tr><th>Table</th><th>Description of the table</th><th>Kind</th><th>Type</th><th>Null</th></tr></thead>
      <tbody>${uses.map(({ table, column }) => `<tr>
        <td><a class="mono" href="#/table/${encodeURIComponent(table.name)}">${esc(table.name)}</a>
          ${column.description ? `<div class="none">Here: ${esc(column.description)}</div>` : ''}</td>
        <td>${table.alias ? esc(table.alias) : '<span class="none">—</span>'}</td>
        <td><span class="badge ${kindCss(table.kind)}">${esc(table.kind)}</span></td>
        <td class="type">${esc(column.type)}</td>
        <td>${column.nullable ? 'yes' : '<strong>no</strong>'}</td>
      </tr>`).join('')}</tbody></table></div>` : '<p class="none">No table of this database has this column.</p>'}`;
}

function renderSearch(query) {
  document.title = `${query} · SMS Squema`;
  const words = terms(query);
  const needle = query.trim().toUpperCase();

  const tables = state.data.tables
    .filter(t => words.every(w => t.name.toLowerCase().includes(w) || (t.alias ?? '').toLowerCase().includes(w)))
    .map(t => ({ t, score: t.name.toUpperCase() === needle ? 0 : t.name.toUpperCase().startsWith(needle) ? 1 : t.kind === 'Main' ? 2 : 3 }))
    .sort((a, b) => a.score - b.score || a.t.name.localeCompare(b.t.name))
    .map(x => x.t);

  const codes = new Set([...Object.keys(state.data.fields), ...state.usage.keys()]);
  const fields = [...codes]
    .map(code => ({ code, description: state.data.fields[code] ?? '' }))
    .filter(f => words.every(w => f.code.toLowerCase().includes(w) || f.description.toLowerCase().includes(w)))
    .map(f => ({ ...f, score: f.code === needle ? 0 : f.code.startsWith(needle) ? 1 : 2 }))
    .sort((a, b) => a.score - b.score || (state.usage.get(b.code)?.length ?? 0) - (state.usage.get(a.code)?.length ?? 0));

  el.main.innerHTML = `
    <div class="results">
      <h1>Results for “${esc(query)}”</h1>
      <h2>Tables <small>(${tables.length})</small></h2>
      ${tables.length ? `<div class="cards">${tables.slice(0, RESULT_LIMIT).map(t => `
        <a class="card" href="#/table/${encodeURIComponent(t.name)}">
          <div class="row"><span class="name">${highlight(t.name, words)}</span><span class="badge ${kindCss(t.kind)}">${esc(t.kind)}</span></div>
          <div class="alias">${t.alias ? highlight(t.alias, words) : '—'}</div></a>`).join('')}</div>
        ${more(tables.length)}` : '<p class="empty">No table matches.</p>'}

      <h2>Fields <small>(${fields.length})</small></h2>
      ${fields.length ? `<div class="panel scroll"><table>
        <thead><tr><th>Code</th><th>Description</th><th>Used in</th></tr></thead>
        <tbody>${fields.slice(0, RESULT_LIMIT).map(f => `<tr>
          <td><a class="mono" href="#/field/${encodeURIComponent(f.code)}">${highlight(f.code, words)}</a></td>
          <td>${f.description ? highlight(f.description, words) : '<span class="none">No description</span>'}</td>
          <td class="num">${state.usage.get(f.code)?.length ?? 0}</td></tr>`).join('')}</tbody></table></div>
        ${more(fields.length)}` : '<p class="empty">No field matches.</p>'}
    </div>`;
}

function renderNotFound(message) {
  document.title = 'Not found · SMS Squema';
  el.main.innerHTML = `<h1>Not found</h1><p class="lead">${esc(message)}</p><p><a href="#/list">Back to all tables</a></p>`;
}

// ---------------------------------------------------------------- helpers

function joinsTable(joins) {
  return `<div class="panel scroll"><table>
    <thead><tr><th>Table</th><th>Columns</th><th></th><th>Table</th><th>Columns</th><th>Join</th></tr></thead>
    <tbody>${joins.map(j => `<tr>
      <td>${tableLink(j.table1)}</td><td class="mono">${esc(j.columns1)}</td>
      <td class="mono">${esc(j.operators)}</td>
      <td>${tableLink(j.table2)}</td><td class="mono">${esc(j.columns2)}</td>
      <td>${esc(j.joinType)}</td></tr>`).join('')}</tbody></table></div>`;
}

function tableLink(name) {
  return state.tables.has(name.toUpperCase())
    ? `<a class="mono" href="#/table/${encodeURIComponent(name)}">${esc(name)}</a>`
    : `<span class="mono">${esc(name)}</span>`;
}

function keyIndex(table) {
  return table.indexes.find(i => i.isPrimaryKey) ?? table.indexes.find(i => i.isUnique) ?? null;
}

function describe(column) {
  return column.description ?? state.data.fields[column.name.toUpperCase()] ?? null;
}

function stat(value, label) {
  return `<div class="stat"><div class="value">${esc(String(value))}</div><div class="label">${esc(label)}</div></div>`;
}

function more(total) {
  return total > RESULT_LIMIT ? `<p class="none">Showing ${RESULT_LIMIT} of ${total}. Add words to narrow the search.</p>` : '';
}

function kindCss(kind) {
  return (KIND_BY_ID.get(kind) ?? KINDS.at(-1)).css;
}

function sameName(a, b) {
  return a.toUpperCase() === b.toUpperCase();
}

function terms(text) {
  return text.toLowerCase().split(/\s+/).filter(Boolean);
}

function highlight(text, words) {
  if (!words.length) return esc(text);
  const lower = text.toLowerCase();
  const marks = new Array(text.length).fill(false);
  for (const word of words) {
    for (let at = lower.indexOf(word); at !== -1; at = lower.indexOf(word, at + word.length)) {
      marks.fill(true, at, at + word.length);
    }
  }
  let html = '';
  for (let i = 0; i < text.length;) {
    let j = i;
    while (j < text.length && marks[j] === marks[i]) j++;
    const part = esc(text.slice(i, j));
    html += marks[i] ? `<mark>${part}</mark>` : part;
    i = j;
  }
  return html;
}

function countBy(items, keyOf) {
  const counts = new Map();
  for (const item of items) {
    const key = keyOf(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

async function copy(button, text) {
  const label = button.textContent;
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = 'Copied';
  } catch {
    button.textContent = 'Copy failed';
  }
  setTimeout(() => { button.textContent = label; }, 1500);
}

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

function esc(value) {
  return String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

// The kind filter is only a per-visitor convenience: without storage, every kind but Temporary is shown.
function loadKinds() {
  const fallback = new Set(KINDS.map(k => k.id).filter(id => id !== 'Temporary'));
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    return Array.isArray(saved) ? new Set(saved.filter(id => KIND_BY_ID.has(id))) : fallback;
  } catch {
    return fallback;
  }
}

function saveKinds() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...state.kinds]));
  } catch {
    // Storage blocked: the filter simply resets on the next visit.
  }
}

// Light by default; the choice is a per-visitor convenience, so a blocked storage only loses the preference.
function setUpThemeToggle() {
  const apply = theme => {
    document.documentElement.dataset.theme = theme;
    el.theme.setAttribute('aria-pressed', theme === 'dark');
    el.theme.title = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  };
  apply(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  el.theme.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    apply(next);
    try {
      localStorage.setItem('sms-squema.theme', next);
    } catch {
      // Storage blocked: the page simply opens light next time.
    }
  });
}
