(function (root) {
  function normalize(s) {
    return String(s || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/\bst\.?(?=\s)/g, 'saint')
      .replace(/^\s*the\s+/, '')
      .replace(/[^a-z0-9]/g, '');
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(
          prev[j] + 1,
          cur[j - 1] + 1,
          prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
        );
      }
      prev = cur;
    }
    return prev[b.length];
  }

  function tol(len) {
    if (len <= 4) return 0;
    if (len <= 7) return 1;
    if (len <= 11) return 2;
    return 3;
  }

  function checkGuess(guess, island) {
    const g = normalize(guess);
    if (!g) return 'wrong';
    const names = [island.name].concat(island.aliases || []).map(normalize);
    let best = 'wrong';
    for (const n of names) {
      if (g === n) return 'correct';
      const d = levenshtein(g, n);
      const t = tol(n.length);
      if (d <= t) return 'correct';
      if (d <= t + 2 && g.length >= 3) best = 'close';
    }
    return best;
  }

  // Closest island name to a misspelled guess, for "Did you mean…?".
  function suggest(guess, islands) {
    const g = normalize(guess);
    if (g.length < 3) return null;
    let best = null, bestD = Infinity;
    for (const isl of islands) {
      for (const n of [isl.name].concat(isl.aliases || [])) {
        const nn = normalize(n);
        if (nn === g) return null;              // they typed a real name exactly
        const d = levenshtein(g, nn);
        if (d <= tol(nn.length) + 2 && d < bestD) { bestD = d; best = isl.name; }
      }
    }
    return best;
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const api = { normalize, levenshtein, checkGuess, suggest, shuffle };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Match = api;
})(this);
