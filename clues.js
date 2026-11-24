// Hint material: where each island is, and its capital or main town.
// Capitals that would give the answer away (Singapore, São Tomé…) are left out.
window.Clues = (function () {
  const REGION_OF = {};
  const REGIONS = {
    'the Caribbean': 'cu jm ht do bs bb tt gd lc vc dm ag kn ky vg tc ai ms pr vi aw cw sx',
    'the North Atlantic': 'is ie gb fo im je gg bm gl pm',
    'the Baltic Sea': 'ax',
    'the Mediterranean': 'mt cy',
    'the Indian Ocean': 'lk mv mg mu sc km cx cc',
    'the Atlantic, off West Africa': 'cv st',
    'the South Atlantic': 'sh fk',
    'the Persian Gulf': 'bh',
    'Southeast Asia': 'ph id sg tl',
    'East Asia': 'jp tw',
    'the Pacific Ocean': 'pg nz fj ws to vu sb ki tv nr mh fm pw gu mp as pf nc wf ck nu tk pn nf'
  };
  Object.entries(REGIONS).forEach(([r, codes]) => codes.split(' ').forEach(c => { REGION_OF[c] = r; }));

  const CAPITAL = {
    jp: 'Tokyo', ph: 'Manila', id: 'Jakarta', lk: 'Colombo', mv: 'Malé', mg: 'Antananarivo', mu: 'Port Louis',
    sc: 'Victoria', km: 'Moroni', cv: 'Praia', is: 'Reykjavík', ie: 'Dublin', gb: 'London', mt: 'Valletta',
    cy: 'Nicosia', bh: 'Manama', tl: 'Dili', pg: 'Port Moresby', nz: 'Wellington', fj: 'Suva', ws: 'Apia',
    to: 'Nukuʻalofa', vu: 'Port Vila', sb: 'Honiara', ki: 'South Tarawa', tv: 'Funafuti', nr: 'Yaren',
    mh: 'Majuro', fm: 'Palikir', pw: 'Ngerulmud', tw: 'Taipei', cu: 'Havana', jm: 'Kingston',
    ht: 'Port-au-Prince', do: 'Santo Domingo', bs: 'Nassau', bb: 'Bridgetown', tt: 'Port of Spain',
    gd: "St. George's", lc: 'Castries', vc: 'Kingstown', dm: 'Roseau', ag: "St. John's", kn: 'Basseterre',
    gl: 'Nuuk', fo: 'Tórshavn', ax: 'Mariehamn', im: 'Douglas', je: 'St Helier', gg: 'St Peter Port',
    bm: 'Hamilton', ky: 'George Town', vg: 'Road Town', tc: 'Cockburn Town', ai: 'The Valley',
    ms: 'Brades', fk: 'Stanley', sh: 'Jamestown', pn: 'Adamstown', pr: 'San Juan', vi: 'Charlotte Amalie',
    gu: 'Hagåtña', mp: 'Capitol Hill', as: 'Pago Pago', aw: 'Oranjestad', cw: 'Willemstad', sx: 'Philipsburg',
    pf: 'Papeete', nc: 'Nouméa', wf: 'Mata-Utu', ck: 'Avarua', nu: 'Alofi', nf: 'Kingston',
    cx: 'Flying Fish Cove', cc: 'West Island'
  };

  function letters(name) {
    const words = name.replace(/[()]/g, '').split(/[\s-]+/).filter(Boolean);
    if (words.length === 1) return words[0].length + ' letters';
    return words.length + ' words (' + words.map(w => w.length).join(' + ') + ' letters)';
  }
  // "J _ m _ i _ a": every other letter shown, spaces kept.
  function pattern(name) {
    let i = 0;
    return name.split('').map(ch => {
      if (!/\p{L}/u.test(ch)) return ch === ' ' ? '   ' : ch;
      return (i++ % 2 === 0) ? ch.toUpperCase() : '_';
    }).join(' ').replace(/ {4,}/g, '   ');
  }

  // The ordered list of clues for an island, gentlest first.
  function forIsland(isl) {
    const region = REGION_OF[isl.flag] || 'the ocean';
    const list = [];
    list.push(isl.type === 'territory'
      ? 'A self-governing territory (' + isl.sovereign + ') in ' + region + '.'
      : 'An island nation in ' + region + '.');
    list.push('Starts with “' + isl.name[0].toUpperCase() + '”, ' + letters(isl.name) + '.');
    if (CAPITAL[isl.flag]) list.push((isl.type === 'territory' ? 'Its main town is ' : 'Its capital is ') + CAPITAL[isl.flag] + '.');
    list.push(pattern(isl.name));
    return list;
  }

  return { forIsland };
})();
