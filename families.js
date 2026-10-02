// Groups the tables into families (one per stem, see TableClassifier) and deduces how families connect.

import { regionOf } from './regions.js';

// Field codes that identify a family but would connect almost everything to it without meaning much.
const IGNORED_IDENTIFIERS = new Set(['F902']); // "Batch identifier", owned by SYS_TAB
const KIND_ORDER = ['Main', 'Other', 'Batch', 'Report', 'Revision', 'Deleted'];

/**
 * One family per stem (temporary tables left out), each with its region and its connections.
 * A family "owns" a field code when its main table is identified by that code alone (OBJ_TAB by F01, the UPC
 * code; VENDOR_TAB by F27...); every other family with that column is connected to the owner.
 */
export function buildFamilies(data) {
  const byStem = new Map();
  for (const table of data.tables) {
    if (table.kind === 'Temporary') continue;
    if (!byStem.has(table.stem)) byStem.set(table.stem, []);
    byStem.get(table.stem).push(table);
  }

  const families = [...byStem].map(([stem, tables]) => {
    tables.sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.name.localeCompare(b.name));
    const main = tables[0];
    return {
      stem,
      tables,
      main,
      name: main.alias ?? tables.find(t => t.alias)?.alias ?? readable(stem),
      region: regionOf(stem),
      size: main.columns.length,
      links: [],
      usedBy: [],
    };
  });

  const owners = new Map();
  for (const family of families) {
    const key = family.main.kind === 'Main' ? keyOf(family.main) : null;
    if (key?.columns.length !== 1) continue;
    const code = key.columns[0].toUpperCase();
    if (IGNORED_IDENTIFIERS.has(code)) continue;
    owners.set(code, owners.has(code) ? null : family); // two owners: ambiguous, connect nobody
  }

  for (const family of families) {
    const seen = new Set();
    for (const column of family.main.columns) {
      const code = column.name.toUpperCase();
      const target = owners.get(code);
      if (!target || target === family || seen.has(target)) continue;
      seen.add(target);
      const link = { from: family, to: target, code, label: data.fields[code] ?? code };
      family.links.push(link);
      target.usedBy.push(link);
    }
  }

  // Central families first: the ones many others depend on (Item main, Target list), then the biggest.
  const weight = f => f.size + 10 * f.usedBy.length;
  families.sort((a, b) => weight(b) - weight(a) || a.name.localeCompare(b.name));
  return families;
}

export function keyOf(table) {
  return table.indexes.find(i => i.isPrimaryKey) ?? table.indexes.find(i => i.isUnique) ?? null;
}

/** What a table of a family holds, in plain words. */
export function kindInWords(table) {
  switch (table.kind) {
    case 'Main': return 'The current records';
    case 'Deleted': return 'Records that were deleted, kept for history';
    case 'Revision': return 'History of changes';
    case 'Report': return 'Totals already added up';
    case 'Batch':
      if (table.name.startsWith('F')) return 'Changes scheduled for the future';
      if (table.name.startsWith('O')) return 'Previous values, before the last change';
      return 'Changes waiting to be applied';
    default: return 'Supporting data';
  }
}

function readable(stem) {
  return stem.charAt(0) + stem.slice(1).toLowerCase().replace(/_/g, ' ');
}
