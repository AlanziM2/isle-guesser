(function () {
  const $ = (id) => document.getElementById(id);
  const FLY = { classic: 6, timed: 4 };              // seconds of auto-zoom
  const ROUND_MS = 30000;                              // Time Attack: time per island
  const HINT_MS = 7000;                                // Time Attack: what a hint costs
  const MIN_BACK_MS = 8000;                            // a skipped island comes back with at least this
  const POOL_NAMES = { all: 'all islands', nation: 'nations', territory: 'territories' };
  const LAND = ['#f1e7cc', '#ece0c1', '#f4ecd5', '#eee3c7'];   // atlas sand tones
  const BORDER = '#c9b48c';

  // ISO 3166 numeric code per flag code, used to find each island's shape.
  const ISO = {
    jp: 392, ph: 608, id: 360, lk: 144, mv: 462, mg: 450, mu: 480, sc: 690, km: 174, cv: 132, st: 678,
    is: 352, ie: 372, gb: 826, mt: 470, cy: 196, bh: 48, sg: 702, tl: 626, pg: 598, nz: 554, fj: 242,
    ws: 882, to: 776, vu: 548, sb: 90, ki: 296, tv: 798, nr: 520, mh: 584, fm: 583, pw: 585, tw: 158,
    cu: 192, jm: 388, ht: 332, do: 214, bs: 44, bb: 52, tt: 780, gd: 308, lc: 662, vc: 670, dm: 212,
    ag: 28, kn: 659, gl: 304, fo: 234, ax: 248, im: 833, je: 832, gg: 831, bm: 60, ky: 136, vg: 92,
    tc: 796, ai: 660, ms: 500, fk: 238, sh: 654, pn: 612, pr: 630, vi: 850, gu: 316, mp: 580, as: 16,
    aw: 533, cw: 531, sx: 534, pf: 258, nc: 540, wf: 876, pm: 666, ck: 184, nu: 570, tk: 772, nf: 574,
    cx: 162, cc: 166
  };
  const flagUrl = (isl) => 'https://flagcdn.com/' + isl.flag + '.svg';
  const isoOf = (isl) => String(ISO[isl.flag] || '').padStart(3, '0');

  // ---------- Map ----------
  const map = L.map('map', {
    zoomControl: false, zoomSnap: 0, zoomDelta: 1, wheelPxPerZoomLevel: 40, wheelDebounceTime: 20,
    worldCopyJump: false, minZoom: 1.5, maxZoom: 15, keyboard: false
  });
  map.createPane('land').style.zIndex = 350;
  map.createPane('relief').style.zIndex = 360;
  map.createPane('sat').style.zIndex = 380;
  const landPane = map.getPane('land'), satPane = map.getPane('sat'), reliefPane = map.getPane('relief');
  reliefPane.style.mixBlendMode = 'multiply';
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}', {
    pane: 'relief', maxZoom: 19, maxNativeZoom: 13, opacity: 0.45
  }).addTo(map);
  const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    pane: 'sat', maxZoom: 19, attribution: 'Imagery &copy; Esri · Natural Earth'
  }).addTo(map);
  satPane.style.opacity = 0;

  const layersById = new Map();
  let targetLayers = [];
  // Five side-by-side copies of the world, so a long drag or fling never runs off the edge.
  const COPIES = [-720, -360, 0, 360, 720];
  // After any pan, quietly hop back to the same spot on the middle copy. Every copy
  // looks identical, so the hop is invisible and the map feels endless.
  let hopping = false;
  map.on('moveend', () => {
    if (hopping || S.auto) return;
    const lng = map.getCenter().lng;
    if (Math.abs(lng) <= 180) return;
    const z = map.getZoom();
    const ww = map.project([0, 180], z).x - map.project([0, -180], z).x;
    hopping = true;
    map.panBy([lng > 0 ? -ww : ww, 0], { animate: false });
    hopping = false;
  });
  fetch('https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json')
    .then(r => r.json())
    .then(topo => {
      const geo = topojson.feature(topo, topo.objects.countries);
      // Rings that straddle the 180° line get unwrapped so they don't streak across the map.
      const unwrap = (ring) => {
        let min = 180, max = -180;
        ring.forEach(p => { min = Math.min(min, p[0]); max = Math.max(max, p[0]); });
        if (max - min > 300) ring.forEach(p => { if (p[0] < 0) p[0] += 360; });
      };
      geo.features.forEach(f => {
        if (f.id === '010' || !f.geometry) return;           // leave Antarctica alone
        const g = f.geometry;
        const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
        polys.forEach(poly => poly.forEach(unwrap));
      });
      const tone = (f) => {
        let h = 0; for (const ch of String(f.id || (f.properties && f.properties.name) || '')) h = (h * 31 + ch.charCodeAt(0)) | 0;
        return LAND[Math.abs(h) % LAND.length];
      };
      const shiftCoords = (c, dx) => typeof c[0] === 'number' ? [c[0] + dx, c[1]] : c.map(x => shiftCoords(x, dx));
      const copyOf = (dx) => dx === 0 ? geo : {
        type: 'FeatureCollection',
        features: geo.features.map(f => Object.assign({}, f, { geometry: f.geometry && { type: f.geometry.type, coordinates: shiftCoords(f.geometry.coordinates, dx) } }))
      };
      // Three side-by-side copies of the world: panning past the date line is seamless.
      COPIES.forEach(dx => L.geoJSON(copyOf(dx), {
        pane: 'land', interactive: false,
        style: (f) => ({ fillColor: tone(f), fillOpacity: 1, color: BORDER, weight: 0.8, className: 'land' }),
        onEachFeature: (f, layer) => {
          if (!f.id) return;
          if (!layersById.has(f.id)) layersById.set(f.id, []);
          layersById.get(f.id).push(layer);
          layer.baseStyle = { fillColor: layer.options.fillColor, color: BORDER, weight: 0.8 };
        }
      }).addTo(map));
      if (S.current) highlight(S.current);
    })
    .catch(() => toast('Could not load the map shapes. Check your connection.'));

  function highlight(isl) {
    targetLayers.forEach(l => { l.setStyle(l.baseStyle); l._path && l._path.classList.remove('target-land'); });
    targetLayers = isl ? (layersById.get(isoOf(isl)) || []) : [];
    targetLayers.forEach(l => {
      l.setStyle({ fillColor: '#ef7a5a', color: '#8a3a28', weight: 2 });
      l.bringToFront();
      l._path && l._path.classList.add('target-land');
    });
  }

  const pinIcon = L.divIcon({
    className: '', iconSize: [22, 29], iconAnchor: [11, 29],
    html: '<div class="pin"><svg width="22" height="29" viewBox="0 0 34 44">' +
      '<path d="M17 42C17 42 3 26 3 16a14 14 0 0 1 28 0c0 10-14 26-14 26z" fill="#ff8f6b" stroke="#3b3247" stroke-width="2.5" stroke-linejoin="round"/>' +
      '<circle cx="17" cy="16" r="6" fill="#fffaf0" stroke="#3b3247" stroke-width="2"/>' +
      '<path d="M9 12a9 9 0 0 1 5-5" stroke="#ffc7b5" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>' +
      '</div>'
  });
  let marker = null;

  // The island should sit in the open space between the top bar and the card.
  function framedCenter(latlng, zoom) {
    const H = window.innerHeight;
    const topEdge = window.innerWidth <= 760 ? 120 : 84;
    const visible = ['menu', 'ask', 'reveal', 'end'].map($).find(el => !el.hidden);
    const cardTop = visible ? visible.getBoundingClientRect().top : H;
    const freeMid = (topEdge + Math.max(topEdge + 80, cardTop - 10)) / 2;
    const shift = H / 2 - freeMid;
    return map.unproject(map.project(latlng, zoom).add([0, shift]), zoom);
  }

  function worldZoom() {
    return Math.max(1.5, Math.log2(window.innerWidth / 256) - 0.05);
  }
  // The copy of a longitude closest to where the camera is now.
  function near(lng) {
    const c = map._loaded ? map.getCenter().lng : 0;
    return lng + 360 * Math.round((c - lng) / 360);
  }
  // Pull back to the whole world: a smooth glide when zoomed in, instant otherwise.
  function worldView(animate) {
    map.stop();
    const z = worldZoom();
    const c = framedCenter([22, near(12)], z);
    if (animate && map._loaded) {
      map.flyTo(c, z, { duration: 1.1, easeLinearity: 0.3 });
    } else {
      map.setView(c, z, { animate: false });
      satPane.style.opacity = 0; landPane.style.opacity = 1; reliefPane.style.opacity = 1;
    }
    return z;
  }
  const zoomedIn = () => map._loaded && map.getZoom() > worldZoom() + 0.3;

  // ---------- State ----------
  const S = {
    mode: null, pool: 'all', queue: [], idx: 0, total: 0, current: null, phase: 'menu',
    score: 0, streak: 0, bestStreak: 0, correct: 0, skips: 0,
    startTime: 0, clockId: null, flyTimer: null, z0: 1, auto: false, revealedAt: 0
  };
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  const bestKey = () => 'isle-best-' + S.pool;
  const getBest = () => +store.get(bestKey()) || 0;
  function fmt(ms, tenths) {
    const s = Math.floor(ms / 1000), m = Math.floor(s / 60);
    return m + ':' + String(s % 60).padStart(2, '0') + (tenths ? '.' + Math.floor((ms % 1000) / 100) : '');
  }
  const poolList = () => ISLANDS.filter(i => S.pool === 'all' || i.type === S.pool);

  function show(id) { ['menu', 'ask', 'reveal', 'end'].forEach(p => $(p).hidden = p !== id); document.body.dataset.phase = id; }
  function pop(el) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
  let toastT;
  function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 1900); }

  function hud() {
    $('count').textContent = S.correct + S.skipped;
    $('total').textContent = S.total;
    $('bar-ok').style.width = (S.correct / S.total * 100) + '%';
    $('bar-skip').style.width = (S.skipped / S.total * 100) + '%';
    $('score').textContent = S.score;
    $('streak-pill').hidden = S.streak < 2;
    $('streak').textContent = '×' + S.streak;
  }
  function menuLabels() {
    ['all', 'nation', 'territory'].forEach(p => { $('n-' + p).textContent = ISLANDS.filter(i => p === 'all' || i.type === p).length; });
    const b = getBest();
    $('best').textContent = b ? 'Best (' + POOL_NAMES[S.pool] + '): ' + fmt(b, true) : '';
  }
  function stopTimers() {
    clearTimeout(S.flyTimer); S.flyTimer = null;
    clearInterval(S.clockId); S.clockId = null;
    S.auto = false; map.stop();
  }

  // ---------- Flight & manual control ----------
  function progress() {
    if (!S.current) return 0;
    const span = Math.max(0.5, S.current.zoom - S.z0);
    return Math.min(1, Math.max(0, (map.getZoom() - S.z0) / span));
  }
  function fly(seconds) {
    const isl = S.current;
    S.auto = true;
    $('autozoom').hidden = true;
    map.flyTo(framedCenter([isl.lat, near(isl.lng)], isl.zoom), isl.zoom, { duration: Math.max(0.8, seconds), easeLinearity: 0.25 });
  }
  map.on('zoom move', () => {
    if (!S.current) {
      // Gliding back out to the menu or results: let the satellite melt away as we rise.
      const cur = parseFloat(satPane.style.opacity) || 0;
      if (!cur) return;
      const s = Math.min(cur, Math.max(0, (map.getZoom() - worldZoom() - 0.3) / 3));
      satPane.style.opacity = s;
      landPane.style.opacity = 1 - s * 0.85;
      reliefPane.style.opacity = 1 - s;
      return;
    }
    const p = progress();
    const s = Math.min(1, Math.max(0, (p - 0.2) / 0.55));
    satPane.style.opacity = s;
    landPane.style.opacity = 1 - s * 0.85;
    reliefPane.style.opacity = 1 - s;
    document.querySelectorAll('.pin').forEach(pin => pin.classList.toggle('faded', p > 0.8));
  });
  // Is the island framed up close right now?
  function atTarget() {
    if (!S.current) return true;
    const pt = map.latLngToContainerPoint([S.current.lat, near(S.current.lng)]);
    const sz = map.getSize();
    const inView = pt.x > 40 && pt.y > 80 && pt.x < sz.x - 40 && pt.y < sz.y - 40;
    return inView && progress() > 0.92;
  }
  function refreshFlyBack() {
    const playing = S.phase === 'guess' || S.phase === 'reveal';
    $('autozoom').hidden = !playing || S.auto || !!S.flyTimer || atTarget();
  }
  map.on('moveend zoomend', () => {
    if (S.auto && progress() >= 0.99) S.auto = false;
    refreshFlyBack();
  });

  // Touching the map hands the camera to the player.
  function takeControl() {
    if (S.phase !== 'guess' && S.phase !== 'reveal') return;
    clearTimeout(S.flyTimer); S.flyTimer = null;
    if (S.auto) map.stop();
    S.auto = false;
    $('map-tip').hidden = true;
    refreshFlyBack();
  }
  ['mousedown', 'wheel', 'touchstart', 'dblclick'].forEach(ev =>
    $('map').addEventListener(ev, takeControl, { capture: true, passive: true }));
  $('zin').addEventListener('click', () => { takeControl(); Sound.play('tap'); map.zoomIn(1.5); });
  $('zout').addEventListener('click', () => { takeControl(); Sound.play('tap'); map.zoomOut(1.5); });
  function flyBack() {
    if (!S.current) return;
    Sound.play('tap');
    fly(Math.min(2.5, Math.max(1, FLY[S.mode] * (1 - progress()))));
  }
  $('autozoom').addEventListener('click', flyBack);
  $('ztarget').addEventListener('click', flyBack);

  // ---------- Game flow ----------
  // ---------- History ----------
  const HKEY = 'isle-history';
  function loadRuns() { try { return JSON.parse(store.get(HKEY)) || []; } catch (e) { return []; } }
  function saveRun(finished) {
    if (!S.mode || S.saved || S.phase === 'menu') return;
    if (S.correct + S.skips === 0 && !finished) return;      // nothing played yet
    S.saved = true;
    const runs = loadRuns();
    runs.unshift({
      at: S.started || Date.now(), mode: S.mode, pool: S.pool, finished,
      ms: Math.round(performance.now() - S.startTime), total: S.total,
      correct: S.correct, skipped: S.mode === 'timed' ? S.skips : S.skipped,
      hints: S.hints, streak: S.bestStreak, score: S.score, missed: S.missed || 0
    });
    store.set(HKEY, JSON.stringify(runs.slice(0, 50)));
  }
  function showHistory() {
    Sound.play('flip');
    const runs = loadRuns();
    const sum = (k) => runs.reduce((a, r) => a + (r[k] || 0), 0);
    const fastest = runs.filter(r => r.mode === 'timed' && r.finished).sort((a, b) => a.ms - b.ms)[0];
    $('hist-summary').innerHTML = tile(runs.length, 'runs') + tile(fmt(sum('ms')), 'time played') +
      tile(Math.max(0, ...runs.map(r => r.streak || 0)), 'longest streak', true) + tile(sum('correct'), 'islands named') +
      tile(fastest ? fmt(fastest.ms, true) : '–', 'fastest full run');
    const when = (t) => new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    $('hist-list').innerHTML = runs.length ? runs.map(r =>
      '<div class="hist-row">' +
        '<div class="hr-main"><b>' + (r.mode === 'timed' ? 'Time Attack' : 'Classic') + '</b> <span>' + POOL_NAMES[r.pool] + '</span>' +
        (r.finished ? '' : '<em>left early</em>') + '<small>' + when(r.at) + '</small></div>' +
        '<div class="hr-stats">' +
          '<span><b>' + fmt(r.ms) + '</b>time</span>' +
          '<span><b>' + r.correct + '/' + r.total + '</b>named</span>' +
          '<span><b>' + r.skipped + '</b>skipped</span>' +
          '<span><b>' + r.streak + '</b>streak</span>' +
          '<span><b>' + (r.hints || 0) + '</b>hints</span>' +
        '</div></div>').join('')
      : '<p class="lede">No runs yet. Finish or restart a game and it will show up here.</p>';
    $('history-box').hidden = false;
  }
  function closeHistory() { $('history-box').hidden = true; }

  // ---------- Hints ----------
  function giveHint() {
    if (S.phase !== 'guess' || !S.clues || S.clueAt >= S.clues.length) return;
    const clue = S.clues[S.clueAt++];
    S.hints++;
    const hadStreak = S.streak > 0;
    S.streak = 0; hud();
    Sound.play('near');
    let cost = '';
    if (S.mode === 'timed') {
      const now = performance.now();
      const before = S.roundEnd;
      S.roundEnd = Math.max(now + 3000, S.roundEnd - HINT_MS);
      const lost = Math.round((before - S.roundEnd) / 1000);
      if (lost > 0) {
        cost = ' −' + lost + ' seconds.';
        const pen = $('cd-pen'); pen.textContent = '−' + lost + 's'; pop(pen);
        const cd = $('countdown'); cd.classList.remove('hit'); void cd.offsetWidth; cd.classList.add('hit');
      }
      paintCountdown();
    }
    const li = document.createElement('li');
    li.textContent = clue;
    if (S.clueAt === S.clues.length) li.className = 'pattern';
    $('clues').appendChild(li);
    const left = S.clues.length - S.clueAt;
    $('hint-btn').disabled = left === 0;
    $('hint-btn').lastChild.textContent = left ? 'Another hint' : 'No more hints';
    if (hadStreak || cost) toast('Hint used.' + (hadStreak ? ' Streak reset.' : '') + cost);
    $('answer').focus({ preventScroll: true });
  }

  function startGame(mode) {
    S.saved = false;
    stopTimers();
    S.mode = mode;
    S.queue = Match.shuffle(poolList());
    S.total = S.queue.length; S.idx = 0;
    S.score = 0; S.streak = 0; S.bestStreak = 0; S.correct = 0; S.skips = 0; S.skipped = 0; S.hints = 0;
    S.missed = 0; S.leftover = {};
    $('hud').hidden = false;
    $('clock').textContent = '0:00';
    S.startTime = performance.now(); S.started = Date.now();
    S.clockId = setInterval(tick, 100);
    nextRound();
  }

  // ---------- Time Attack countdown ----------
  function tick() {
    const now = performance.now();
    $('clock').textContent = fmt(now - S.startTime);
    if (S.mode !== 'timed' || S.phase !== 'guess') return;
    const left = S.roundEnd - now;
    paintCountdown();
    const sec = Math.ceil(left / 1000);
    if (left > 0 && sec <= 5 && sec !== S.lastBeep) { S.lastBeep = sec; Sound.play('tick'); }
    if (left <= 0) timeUp();
  }
  function paintCountdown() {
    const left = Math.max(0, S.roundEnd - performance.now());
    $('cd-bar').style.width = Math.min(100, left / ROUND_MS * 100) + '%';
    $('cd-num').textContent = Math.ceil(left / 1000) + 's';
    $('countdown').classList.toggle('low', left < 8000);
  }
  function timeUp() {
    if (S.phase !== 'guess') return;
    Sound.play('wrong');
    S.streak = 0; S.skipped++; S.missed++;
    $('cd-bar').style.width = '0%'; $('cd-num').textContent = '0s';
    reveal(false, '', 0, 'Time’s up! It was…');
  }
  const currentIsland = () => S.mode === 'timed' ? S.queue[0] : S.queue[S.idx];

  function nextRound() {
    clearTimeout(S.flyTimer); S.auto = false;
    const isl = currentIsland();
    if (!isl) return endGame();
    show('ask');
    S.current = null;
    const glide = zoomedIn();
    S.z0 = worldView(glide);
    S.current = isl; S.phase = 'guess';
    highlight(isl);
    if (marker) marker.remove();
    marker = L.layerGroup(COPIES.map(dx =>
      L.marker([isl.lat, isl.lng + dx], { icon: pinIcon, interactive: false, keyboard: false }))).addTo(map);
    $('autozoom').hidden = true;
    const tip = $('map-tip'); tip.hidden = false; tip.style.animation = 'none'; void tip.offsetWidth; tip.style.animation = '';

    $('flag').src = flagUrl(isl);
    const card = $('flag').parentElement; card.classList.remove('flip'); void card.offsetWidth; card.classList.add('flip');
    const input = $('answer'); input.value = ''; input.className = '';
    setHint('', '');
    const timed = S.mode === 'timed';
    $('countdown').hidden = !timed;
    if (timed) {
      const kept = S.leftover[isl.flag];
      delete S.leftover[isl.flag];
      S.roundEnd = performance.now() + (kept ? Math.max(MIN_BACK_MS, kept) : ROUND_MS);
      S.lastBeep = 0;
      $('countdown').classList.remove('hit');
      $('cd-pen').textContent = '';
      paintCountdown();
    }
    $('hint-btn').title = timed ? 'Costs your streak and ' + HINT_MS / 1000 + ' seconds' : 'Costs your streak';
    S.clues = Clues.forIsland(isl); S.clueAt = 0;
    $('clues').innerHTML = '';
    $('hint-btn').disabled = false;
    $('hint-btn').lastChild.textContent = 'Hint';
    $('skip').textContent = S.mode === 'timed' ? 'Skip for now' : 'Skip';
    hud();
    Sound.play('flip');
    setTimeout(() => input.focus({ preventScroll: true }), 30);

    S.flyTimer = setTimeout(() => {
      S.flyTimer = null;
      if (S.current !== isl || S.phase !== 'guess') return;
      Sound.play('whoosh');
      fly(FLY[S.mode]);
    }, glide ? 1500 : 500);
  }

  function setHint(text, cls) { const h = $('hint'); h.textContent = text; h.className = 'hint ' + cls; }

  function submit(e) {
    e.preventDefault();
    if (S.phase !== 'guess') return;
    const input = $('answer');
    const val = input.value.trim();
    if (!val) return;
    const r = Match.checkGuess(val, S.current);
    if (r === 'correct') {
      S.streak++; S.correct++;
      S.bestStreak = Math.max(S.bestStreak, S.streak);
      const gain = 100 + Math.min(S.streak - 1, 10) * 10;
      S.score += gain;
      Sound.play(S.streak >= 3 ? 'streak' : 'correct');
      const exact = [S.current.name].concat(S.current.aliases).some(n => Match.normalize(n) === Match.normalize(val));
      reveal(true, exact ? '' : 'Auto-corrected from “' + val + '”', gain);
      confetti();
    } else {
      input.classList.remove('shake', 'close'); void input.offsetWidth;
      const sug = Match.suggest(val, ISLANDS);
      if (sug && Match.normalize(sug) !== Match.normalize(val)) {
        Sound.play('near'); input.classList.add('close');
        input.value = sug;
        setHint('Did you mean “' + sug + '”? Press Enter to guess it.', 'near');
        input.focus(); input.setSelectionRange(sug.length, sug.length);
        return;
      } else {
        Sound.play('wrong'); input.classList.add('shake');
        if (S.streak) { S.streak = 0; hud(); }
        setHint('Not that one. Zoom in for a closer look.', 'bad');
      }
      input.select();
    }
  }

  function skip() {
    if (S.phase !== 'guess') return;
    Sound.play('skip');
    S.streak = 0; S.skips++;
    if (S.mode === 'timed') {
      if (S.queue.length > 1) {
        S.leftover[S.current.flag] = S.roundEnd - performance.now();
        S.queue.push(S.queue.shift()); toast('Skipped. It comes back later with its time left.');
      }
      nextRound();
    } else { S.skipped++; reveal(false, '', 0); }
  }

  function reveal(ok, fixedNote, gain, missText) {
    S.phase = 'reveal'; S.revealedAt = performance.now();
    clearTimeout(S.flyTimer); S.auto = false;
    const isl = S.current;
    $('autozoom').hidden = true; $('map-tip').hidden = true;
    const v = $('verdict');
    v.textContent = ok ? (S.streak >= 3 ? 'Correct! You\'re on a roll' : 'Correct!') : (missText || 'This one was…');
    v.className = 'tier ' + (ok ? 'ok' : 'miss');
    $('reveal-name').textContent = isl.name;
    $('reveal-flag').src = flagUrl(isl);
    $('reveal-meta').textContent = isl.type === 'territory' ? 'Self-governing territory · ' + isl.sovereign : 'Island nation';
    $('fixed').textContent = fixedNote; $('fixed').hidden = !fixedNote;
    const g = $('gain'); g.hidden = !gain; g.textContent = '+' + gain;
    $('reveal-fact').textContent = isl.fact;
    const remaining = S.mode === 'timed' ? S.queue.length - 1 : S.total - S.idx - 1;
    $('next').textContent = remaining > 0 ? 'Next island' : 'See results';
    show('reveal'); hud();
    pop($('score-pill'));
    map.stop();
    fly(1.2);
    $('next').focus({ preventScroll: true });
  }

  function advance() {
    if (S.phase !== 'reveal') return;
    Sound.play('tap');
    if (S.mode === 'timed') S.queue.shift(); else S.idx++;
    nextRound();
  }

  const tile = (value, label, gold) => '<div class="tile' + (gold ? ' gold' : '') + '"><b>' + value + '</b><span>' + label + '</span></div>';

  function endGame() {
    saveRun(true);
    stopTimers();
    S.phase = 'end'; S.current = null;
    highlight(null);
    if (marker) { marker.remove(); marker = null; }
    $('end-tag').textContent = (S.mode === 'timed' ? 'Time Attack · ' : 'Classic · ') + POOL_NAMES[S.pool];
    if (S.mode === 'timed') {
      const ms = performance.now() - S.startTime;
      // Only a clean run (no island's clock ran out) can set a record.
      const prev = getBest(), record = !S.missed && (!prev || ms < prev);
      if (record) store.set(bestKey(), String(Math.round(ms)));
      $('clock').textContent = fmt(ms);
      $('end-title').textContent = S.missed ? S.correct + ' of ' + S.total + ' named' : record ? 'New record!' : 'Every island found!';
      $('end-tiles').innerHTML = tile(fmt(ms, true), 'your time', record) +
        tile(prev || record ? fmt(record ? ms : prev, true) : '–', 'best time') + tile(S.missed, 'ran out of time') +
        tile(S.skips, 'skips') + tile(S.bestStreak, 'longest streak');
      $('end-text').textContent = S.missed ? 'Name every island before its clock runs out to set a record.' :
        record && prev ? 'You beat your old best by ' + fmt(prev - ms, true) + '.' :
        prev && !record ? fmt(ms - prev, true) + ' off your best. One more go?' : 'Now try to beat it.';
    } else {
      const pct = Math.round(S.correct / S.total * 100);
      $('end-title').textContent = pct === 100 ? 'A perfect voyage!' : pct >= 70 ? 'Seasoned navigator' : pct >= 40 ? 'Finding your sea legs' : 'Lost at sea… for now';
      $('end-tiles').innerHTML = tile(S.score, 'points', true) + tile(S.correct + '/' + S.total, 'named') +
        tile(S.skipped, 'skipped') + tile(S.bestStreak, 'longest streak') + tile(fmt(performance.now() - S.startTime), 'time played');
      $('end-text').textContent = 'Play again for a fresh shuffle.';
    }
    show('end');
    worldView(zoomedIn());
    menuLabels();
    Sound.play('win');
    confetti(50);
  }

  function toMenu() {
    saveRun(false);
    stopTimers();
    S.phase = 'menu'; S.current = null; S.mode = null;
    highlight(null);
    if (marker) { marker.remove(); marker = null; }
    $('hud').hidden = true;
    $('autozoom').hidden = true; $('map-tip').hidden = true;
    menuLabels();
    show('menu');
    worldView(zoomedIn());
  }

  // ---------- Confetti ----------
  function confetti(n = 26) {
    const card = ['ask', 'reveal', 'end'].map($).find(el => !el.hidden) || document.body;
    const r = card.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + 20;
    const colors = ['#ff8f6b', '#ffd36b', '#7cc576', '#7cc0e4', '#c9b8ff'];
    for (let i = 0; i < n; i++) {
      const s = document.createElement('div');
      s.className = 'confetti';
      s.style.background = colors[i % colors.length];
      s.style.left = cx + 'px'; s.style.top = cy + 'px';
      document.body.appendChild(s);
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4, d = 100 + Math.random() * 170;
      s.animate([
        { transform: 'translate(0,0) rotate(0)', opacity: 1 },
        { transform: `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d}px) rotate(${Math.random() * 360}deg)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${Math.cos(a) * d * 1.2}px, ${Math.sin(a) * d + 170}px) rotate(${Math.random() * 720}deg)`, opacity: 0 }
      ], { duration: 1100 + Math.random() * 500, easing: 'cubic-bezier(.2,.7,.4,1)' }).onfinish = () => s.remove();
    }
  }

  // ---------- Wiring ----------
  $('answer-form').addEventListener('submit', submit);
  $('answer').addEventListener('input', () => { $('answer').classList.remove('close'); Sound.play('key'); });
  $('skip').addEventListener('click', skip);
  $('next').addEventListener('click', advance);
  $('again').addEventListener('click', () => { Sound.play('tap'); startGame(S.lastMode); });
  $('to-menu').addEventListener('click', () => { Sound.play('tap'); toMenu(); });
  $('home').addEventListener('click', (e) => { e.preventDefault(); Sound.play('tap'); toMenu(); });
  $('restart').addEventListener('click', () => {
    Sound.play('tap');
    if (S.mode) { saveRun(false); startGame(S.mode); toast('Shuffled. The clock restarts.'); } else toMenu();
  });
  document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {
    Sound.play('tap'); S.lastMode = b.dataset.mode; startGame(b.dataset.mode);
  }));
  document.querySelectorAll('[data-pool]').forEach(b => b.addEventListener('click', () => {
    Sound.play('tap');
    document.querySelectorAll('[data-pool]').forEach(x => x.classList.toggle('on', x === b));
    S.pool = b.dataset.pool; menuLabels();
  }));
  const paintMute = () => {
    $('ico-on').hidden = Sound.muted; $('ico-off').hidden = !Sound.muted;
    $('mute').setAttribute('aria-label', Sound.muted ? 'Unmute sound' : 'Mute sound');
  };
  $('mute').addEventListener('click', () => { Sound.toggle(); paintMute(); Sound.play('tap'); });
  paintMute();
  // ---------- Flag viewer ----------
  function openFlag(withName) {
    if (!S.current) return;
    Sound.play('flip');
    $('lb-img').src = flagUrl(S.current);
    $('lb-img').alt = withName ? 'Flag of ' + S.current.name : 'Flag of the mystery island';
    $('lb-cap').textContent = withName ? S.current.name : '';
    $('lightbox').hidden = false;
  }
  function closeFlag() {
    if ($('lightbox').hidden) return;
    $('lightbox').hidden = true;
    if (S.phase === 'guess') $('answer').focus({ preventScroll: true });
    else if (S.phase === 'reveal') $('next').focus({ preventScroll: true });
  }
  $('flag-btn').addEventListener('click', () => openFlag(false));
  $('hint-btn').addEventListener('click', giveHint);
  $('history').addEventListener('click', showHistory);
  $('hist-close').addEventListener('click', closeHistory);
  $('history-box').addEventListener('click', (e) => { if (e.target === $('history-box')) closeHistory(); });
  $('hist-clear').addEventListener('click', () => {
    if (!confirm('Clear all past runs? This cannot be undone.')) return;
    store.set(HKEY, '[]'); showHistory();
  });
  $('reveal-flag-btn').addEventListener('click', () => openFlag(true));
  $('lightbox').addEventListener('click', closeFlag);
  document.addEventListener('keydown', (e) => {
    if (!$('lightbox').hidden && (e.key === 'Escape' || e.key === 'Enter')) { e.preventDefault(); e.stopImmediatePropagation(); closeFlag(); }
    else if (!$('history-box').hidden && e.key === 'Escape') { e.preventDefault(); closeHistory(); }
  }, true);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && S.phase === 'reveal' && performance.now() - S.revealedAt > 350) { e.preventDefault(); advance(); }
  });
  window.addEventListener('resize', () => { if (S.phase === 'menu' || S.phase === 'end') worldView(); });
  // Phones: lift the card above the on-screen keyboard.
  if (window.visualViewport) {
    const vv = window.visualViewport;
    const lift = () => {
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      document.documentElement.style.setProperty('--kb', (kb > 60 ? kb : 0) + 'px');
    };
    vv.addEventListener('resize', lift); vv.addEventListener('scroll', lift);
  }
  toMenu();
})();
