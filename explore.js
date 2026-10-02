// The Explore view, for readers who do not know SQL: a home page with one card per topic (regions.js), and a page
// per topic listing its table families, with the chosen family explained in plain words next to the list.
// Routes: #/ (home), #/topic/ID, #/topic/ID/STEM.

import { REGIONS } from './regions.js';
import { buildFamilies, kindInWords } from './families.js';

const USED_BY_SHOWN = 12;
const SEARCH_RESULTS = 8;

export function createExplorer(data) {
  const families = buildFamilies(data);
  const byStem = new Map(families.map(f => [f.stem, f]));
  const byRegion = new Map(REGIONS.map(r => [r.id, families.filter(f => f.region === r)]));
  const tableCount = families.reduce((sum, f) => sum + f.tables.length, 0);
  const workTables = data.tables.length - tableCount;

  function renderHome(main) {
    document.title = 'SMS Squema';
    main.innerHTML = `
      <section class="explore">
        <header class="hero">
          <p class="eyebrow">SMS database guide</p>
          <h1>What do you want to explore?</h1>
          <p class="hero-lead">The SMS database has ${data.tables.length} tables. Leaving aside ${workTables} temporary work
            tables, the other ${tableCount} are grouped here by topic and explained in plain words: pick a topic to see what
            it stores and how it connects to the rest.</p>
          <div class="finder">
            <label class="search">
              <span class="visually-hidden">Find a topic or a table</span>
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
              <input type="search" id="finder" placeholder="Find anything: price, customer, vendor, PRICE_TAB…"
                autocomplete="off" spellcheck="false" aria-controls="finder-results">
            </label>
            <ul class="finder-results" id="finder-results" hidden></ul>
          </div>
        </header>

        <div class="topic-grid">
          ${REGIONS.map(region => topicCard(region)).join('')}
        </div>

        <p class="explore-foot">Looking for an exact column or field code such as <code>F01</code>?
          The <a href="#/list">Reference</a> lists every table and column.</p>
      </section>`;

    const input = main.querySelector('#finder');
    const results = main.querySelector('#finder-results');
    input.addEventListener('input', () => showResults(input.value, results));
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        const first = results.querySelector('a');
        if (first) location.hash = first.getAttribute('href');
      } else if (event.key === 'Escape') {
        input.value = '';
        showResults('', results);
      }
    });
  }

  function topicCard(region) {
    const members = byRegion.get(region.id);
    const tables = members.reduce((sum, f) => sum + f.tables.length, 0);
    return `
      <a class="topic-card" href="#/topic/${region.id}" style="--topic:${region.color}">
        <span class="topic-icon">${icon(region)}</span>
        <h2>${esc(region.name)}</h2>
        <p>${esc(region.description)}</p>
        <ul class="topic-sample">${members.slice(0, 3).map(f => `<li>${esc(f.name)}</li>`).join('')}</ul>
        <span class="topic-count">${members.length} families · ${tables} tables <span aria-hidden="true">→</span></span>
      </a>`;
  }

  function showResults(query, list) {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) {
      list.hidden = true;
      list.innerHTML = '';
      return;
    }
    const found = families.filter(f => words.every(w =>
      f.name.toLowerCase().includes(w) || f.stem.toLowerCase().includes(w) || f.region.name.toLowerCase().includes(w)
      || f.tables.some(t => t.name.toLowerCase().includes(w) || (t.alias ?? '').toLowerCase().includes(w))));
    const reference = `<li class="finder-more"><a href="#/search/${encodeURIComponent(query.trim())}">
      Search “${esc(query.trim())}” in every column and field code →</a></li>`;
    list.hidden = false;
    list.innerHTML = found.slice(0, SEARCH_RESULTS).map(f => `
      <li><a href="${familyHref(f)}" style="--topic:${f.region.color}">
        <span class="topic-icon small">${icon(f.region)}</span>
        <span><strong>${esc(f.name)}</strong><small>${esc(f.region.name)} · <code>${esc(f.stem)}</code></small></span>
      </a></li>`).join('') + reference;
  }

  function renderTopic(main, regionId, stem) {
    const region = REGIONS.find(r => r.id === regionId);
    if (!region) return false;
    const members = byRegion.get(region.id);
    const family = (stem && byStem.get(stem.toUpperCase())) || members[0];
    if (family && family.region !== region) {
      location.replace(familyHref(family));
      return true;
    }
    document.title = `${family ? `${family.name} · ` : ''}${region.name} · SMS Squema`;
    const tables = members.reduce((sum, f) => sum + f.tables.length, 0);

    main.innerHTML = `
      <section class="explore topic" style="--topic:${region.color}">
        <nav class="topic-tabs" aria-label="Topics">
          ${REGIONS.map(r => `<a href="#/topic/${r.id}" style="--topic:${r.color}" ${r === region ? 'aria-current="page"' : ''}>
            <span class="topic-icon tiny">${icon(r)}</span>${esc(r.name)}</a>`).join('')}
        </nav>

        <header class="topic-head">
          <span class="topic-icon large">${icon(region)}</span>
          <div>
            <div class="crumbs"><a href="#/">Explore</a> <span aria-hidden="true">›</span> ${esc(region.name)}</div>
            <h1>${esc(region.name)}</h1>
            <p>${esc(region.description)}</p>
            <p class="topic-stats">${members.length} families · ${tables} tables</p>
          </div>
        </header>

        <div class="topic-body">
          <nav class="family-list" aria-label="Families of ${esc(region.name)}">
            ${members.map(f => `
              <a class="family-item" href="${familyHref(f)}" ${f === family ? 'aria-current="true"' : ''}>
                <strong>${esc(f.name)}</strong>
                <span><code>${esc(f.stem)}</code> · ${f.tables.length} table${f.tables.length === 1 ? '' : 's'}
                  ${f.links.length ? `· ${f.links.length} connection${f.links.length === 1 ? '' : 's'}` : ''}</span>
              </a>`).join('')}
          </nav>
          <article class="family-detail" id="family-detail" tabindex="-1">${family ? familyDetail(family) : ''}</article>
        </div>
      </section>`;

    main.querySelector('.topic-tabs [aria-current]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
    main.querySelector('.family-list [aria-current]')?.scrollIntoView({ block: 'nearest' });
    const more = main.querySelector('.show-more');
    more?.addEventListener('click', () => {
      main.querySelectorAll('.used-by li[hidden]').forEach(li => { li.hidden = false; });
      more.remove();
    });
    // On a phone the detail sits under the list: bring it into view when a family was picked.
    if (stem && window.innerWidth <= 860) {
      main.querySelector('#family-detail').scrollIntoView({ block: 'start' });
    }
    return true;
  }

  function familyDetail(family) {
    const usedBy = family.usedBy.slice().sort((a, b) => a.from.name.localeCompare(b.from.name));
    return `
      <p class="eyebrow">Family <code>${esc(family.stem)}</code></p>
      <h2>${esc(family.name)}</h2>
      <p class="family-summary">${family.tables.length} table${family.tables.length === 1 ? '' : 's'}.
        The main one, <a href="#/table/${encodeURIComponent(family.main.name)}"><code>${esc(family.main.name)}</code></a>,
        has ${family.main.columns.length} columns.</p>

      <h3>Connects to</h3>
      ${family.links.length ? `<ul class="connections">${family.links.map(l => connection(l.to, l)).join('')}</ul>`
        : '<p class="muted">It does not point to any other family.</p>'}

      <h3>What is inside</h3>
      <ul class="inside">
        ${family.tables.map(t => `<li>
          <a href="#/table/${encodeURIComponent(t.name)}"><code>${esc(t.name)}</code></a>
          <span>${esc(kindInWords(t))}</span>
          <span class="muted">${t.columns.length} columns</span>
        </li>`).join('')}
      </ul>

      <h3>Used by ${usedBy.length ? `<span class="muted">(${usedBy.length})</span>` : ''}</h3>
      ${usedBy.length ? `<ul class="used-by">${usedBy.map((l, i) => `<li ${i >= USED_BY_SHOWN ? 'hidden' : ''}>
          <a href="${familyHref(l.from)}" style="--topic:${l.from.region.color}"><span class="dot"></span>${esc(l.from.name)}</a></li>`).join('')}
        </ul>
        ${usedBy.length > USED_BY_SHOWN ? `<button type="button" class="action show-more">Show all ${usedBy.length}</button>` : ''}`
        : '<p class="muted">No other family points to it.</p>'}

      <a class="primary" href="#/table/${encodeURIComponent(family.main.name)}">See every column of ${esc(family.main.name)} →</a>`;
  }

  function connection(target, link) {
    return `<li><a href="${familyHref(target)}" style="--topic:${target.region.color}">
      <span class="topic-icon small">${icon(target.region)}</span>
      <span><strong>${esc(target.name)}</strong>
        <small>${esc(target.region.name)} · linked by ${esc(link.label)} <code>${esc(link.code)}</code></small></span>
      <span class="arrow" aria-hidden="true">→</span>
    </a></li>`;
  }

  return { renderHome, renderTopic };
}

function familyHref(family) {
  return `#/topic/${family.region.id}/${encodeURIComponent(family.stem)}`;
}

function icon(region) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${region.icon}"/></svg>`;
}

function esc(value) {
  return String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}
