// The topics of the Explore view: hand-picked groups of table families (by stem, see TableClassifier) with a
// plain-language explanation and an icon (SVG path, 24x24, stroked). A family not listed here lands in the last one.

export const REGIONS = [
  {
    id: 'products',
    icon: 'M3 7.5 12 3l9 4.5-9 4.5-9-4.5Z M3 7.5v9l9 4.5 9-4.5v-9 M12 12v9',
    name: 'Products',
    color: '#3b82f6',
    description: 'Everything about the items the store sells: codes, names, departments, categories, kits and where they sit on the shelf.',
    stems: ['OBJ', 'POS', 'ALT', 'KIT', 'LIKE', 'FAM', 'CAT', 'DEPT', 'SDP', 'RPC', 'UNT', 'BTL', 'LOC', 'SHF',
      'ASSRT', 'MOD', 'MOD_ITM', 'RES', 'RENT', 'ITD', 'ITZ', 'NACS', 'BMP'],
  },
  {
    id: 'prices',
    icon: 'M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z M7.5 7.5h.01',
    name: 'Prices & promotions',
    color: '#f59e0b',
    description: 'What the customer pays: regular prices, sales, temporary price reductions (TPR), price levels, coupons, mix & match and loyalty points.',
    stems: ['PRICE', 'GPRICE', 'SPRICE', 'TPRICE', 'INSTORE', 'LVL', 'MIX', 'PID', 'REDEEM', 'ECL', 'CPN', 'OFR', 'PUB'],
  },
  {
    id: 'costs',
    icon: 'M2 6h12v10H2Z M14 10h4l3 3v3h-7 M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z M17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
    name: 'Costs & vendors',
    color: '#10b981',
    description: 'What the store pays: suppliers, item costs, allowances, bill-backs, quantity breaks, discounts, rebates and deliveries.',
    stems: ['COST', 'GCOST', 'VENDOR', 'ALLOW', 'BBACK', 'CSTBRK', 'DISC', 'REBATE', 'DELV', 'ROUTE'],
  },
  {
    id: 'customers',
    icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M4 21a8 8 0 0 1 16 0',
    name: 'Customers',
    color: '#ec4899',
    description: 'Loyalty customers: their cards, groups, shopper levels, risk levels and the items they buy.',
    stems: ['CLT', 'CLT_ITM', 'CLL', 'CLG', 'CLF', 'CLF_SDP', 'CLR', 'CLS', 'BIO'],
  },
  {
    id: 'sales',
    icon: 'M3 4h2.5l2.2 11h10.6L21 7H6.3 M9 20.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z M18 20.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
    name: 'Sales & checkout',
    color: '#8b5cf6',
    description: 'What happens at the register: sale transactions, payments, totals (totalizers), register functions and account postings.',
    stems: ['SAL', 'TRS', 'HOOK', 'PAY', 'TLZ', 'TZS', 'FCT', 'FCZ', 'CKZ', 'ACC', 'EXC', 'DATA'],
  },
  {
    id: 'inventory',
    icon: 'M3 21V8.5L12 4l9 4.5V21 M7 21v-8h10v8 M7 17h10',
    name: 'Inventory & receiving',
    color: '#14b8a6',
    description: 'Stock on hand, inventory counts and the goods received from suppliers.',
    stems: ['INV', 'REC', 'RCP', 'RCP_ITM', 'RCP_DET', 'DSD', 'LST', 'LIST'],
  },
  {
    id: 'scales',
    icon: 'M12 3v17 M6 21h12 M5 7h14 M5 7l-3 7a3 3 0 0 0 6 0Z M19 7l-3 7a3 3 0 0 0 6 0Z',
    name: 'Scales & labels',
    color: '#f97316',
    description: 'Data sent to the scales (tare, nutrition, ingredients, texts) and the shelf labels printed for the items.',
    stems: ['SCL', 'SCL_CCT', 'SCL_CPT', 'SCL_CSL', 'SCL_CTX', 'SCL_NUT', 'SCL_STO', 'SCL_TXT', 'TAR', 'LABEL'],
  },
  {
    id: 'reports',
    icon: 'M4 20V11 M10 20V4 M16 20v-6 M21 20H3',
    name: 'Reports',
    color: '#65a30d',
    description: 'Sales already added up per day, week, month and year: by item, department, customer, cashier, vendor or hour.',
    stems: [], // every RPT_* family, see regionOf
  },
  {
    id: 'system',
    icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M12 2v3 M12 19v3 M4.9 4.9 7 7 M17 17l2.1 2.1 M2 12h3 M19 12h3 M4.9 19.1 7 17 M17 7l2.1-2.1',
    name: 'Store & system',
    color: '#64748b',
    description: 'The stores, terminals and cashiers, permissions and settings, and the internal machinery SMS uses to move changes around.',
    stems: [],
  },
];

const BY_STEM = new Map(REGIONS.flatMap(region => region.stems.map(stem => [stem, region])));
const REPORTS = REGIONS.find(r => r.id === 'reports');
const FALLBACK = REGIONS.at(-1);

export function regionOf(stem) {
  return BY_STEM.get(stem) ?? (stem.startsWith('RPT_') ? REPORTS : FALLBACK);
}
