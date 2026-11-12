/* Block III Navigator – 3D view + UI. Map data: data/block3.js, routing: js/graph.js */
(function () {
  const B = window.BLOCK3, NG = window.NavGraph;
  const g = NG.build(B);
  const H = B.FLOOR_HEIGHT;
  const $ = (id) => document.getElementById(id);
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

  // ---------- places / search ----------
  const places = g.places.filter((p) => !/^(L\d)@/.test(p.id) || true);
  const byId = new Map(places.map((p) => [p.id, p]));
  const urlId = (id) => id.replace('@', '-at-');
  const fromUrlId = (s) => s.replace('-at-', '@');
  const floorLabel = (c) => (c === 'G' ? 'Ground floor' : `Floor ${c}`);
  const typeColor = {
    classroom: 0x8fb3d9, lab: 0x6cc4a1, hall: 0xb39ddb, office: 0xf2c879, library: 0xe39b7b,
    toilet: 0xb8c2cc, lobby: 0xd9dee4, stairs: 0x55606e, lift: 0x2f3a48,
  };
  const typeName = { classroom: 'Classroom', lab: 'Lab', hall: 'Hall', office: 'Office', library: 'Library', toilet: 'Toilet', stairs: 'Stairs', lift: 'Lift' };

  function search(q) {
    q = q.trim().toLowerCase();
    const words = q.split(/\s+/).filter(Boolean);
    const scored = [];
    for (const p of places) {
      if (p.id.includes('~')) continue;
      const hay = `${p.name} ${p.no} ${floorLabel(p.floor)} ${p.floor} ${typeName[p.type] || ''}`.toLowerCase();
      if (words.every((w) => hay.includes(w) || (w === p.floor.toLowerCase()))) {
        let s = 0;
        if (p.no && p.no.toLowerCase() === q) s -= 100;
        if (p.name.toLowerCase().startsWith(q)) s -= 10;
        if (p.landmark) s += 2;
        scored.push([s + p.fi * 0.01, p]);
      }
    }
    return scored.sort((a, b) => a[0] - b[0]).slice(0, 40).map((x) => x[1]);
  }
  const display = (p) => `${p.no ? p.no + ' · ' : ''}${p.name} · ${p.floor === 'G' ? 'Ground' : 'Floor ' + p.floor}`;

  // ---------- state ----------
  const state = { from: null, to: null, floor: 'G', all: false, res: null, steps: [], activeStep: -1 };

  // ---------- three.js scene ----------
  const mapEl = $('map'), labelsEl = $('labels');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  mapEl.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 2000);
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.47; controls.minDistance = 15; controls.maxDistance = 260;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 0.85));
  const sun = new THREE.DirectionalLight(0xffffff, 0.55); sun.position.set(-40, 80, 60); scene.add(sun);

  // building coords (x east, y north) -> three (X, Y up, Z south)
  const CX = 28.75, CY = 20;
  const gap = () => (state.all ? H * 2.4 : H);
  const V = (x, y, fi, up = 0) => new THREE.Vector3(x - CX, fi * gap() + up, -(y - CY));

  const floorGroups = [];
  const mats = []; // [{mat, base, fi, kind}]
  function mat(color, opacity, fi, kind) {
    const m = new THREE.MeshLambertMaterial({ color, transparent: true, opacity, depthWrite: opacity > 0.9 });
    mats.push({ m, base: opacity, fi, kind }); return m;
  }
  function lineMat(color, fi) {
    const m = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 });
    mats.push({ m, base: 0.9, fi, kind: 'line' }); return m;
  }

  function buildFloors() {
    const ink = new THREE.Color(css('--ink') || '#17233a');
    const slabColor = new THREE.Color(document.documentElement.dataset.theme === 'dark' || matchMedia('(prefers-color-scheme: dark)').matches && document.documentElement.dataset.theme !== 'light' ? 0x223047 : 0xffffff);
    B.floors.forEach((F, fi) => {
      const grp = new THREE.Group(); grp.userData.fi = fi; floorGroups.push(grp); scene.add(grp);
      // slab
      const shape = new THREE.Shape(B.outline.map(([x, y]) => new THREE.Vector2(x - CX, y - CY)));
      const slab = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.25, bevelEnabled: false }), mat(slabColor, 1, fi, 'slab'));
      slab.rotation.x = -Math.PI / 2; slab.position.y = -0.25; grp.add(slab);
      const edge = new THREE.LineSegments(new THREE.EdgesGeometry(slab.geometry), lineMat(ink, fi));
      edge.rotation.x = -Math.PI / 2; edge.position.y = -0.25; grp.add(edge);
      // rooms as low blocks
      const blocks = F.rooms.map((rm) => ({ rects: [rm.rect, ...(rm.extra || [])], type: rm.type, id: rm.id }))
        .concat(B.connectors.map((c) => ({ rects: [c.rect], type: c.kind, id: `${c.id}@${F.code}` })));
      blocks.forEach((b) => {
        b.rects.forEach(([x, y, w, h]) => {
          const hgt = b.type === 'lobby' ? 0.05 : b.type === 'stairs' || b.type === 'lift' ? 1.6 : 1.1;
          const geo = new THREE.BoxGeometry(w - 0.3, hgt, h - 0.3);
          const mesh = new THREE.Mesh(geo, mat(typeColor[b.type] || 0xcccccc, b.type === 'lobby' ? 0.5 : 0.82, fi, 'room'));
          mesh.position.set(x + w / 2 - CX, hgt / 2, -(y + h / 2 - CY));
          mesh.userData.placeId = b.id; grp.add(mesh);
          const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), lineMat(ink, fi));
          e.position.copy(mesh.position); grp.add(e);
        });
      });
    });
  }
  buildFloors();

  // route objects
  const routeGroup = new THREE.Group(); scene.add(routeGroup);
  let routeArrows = [];

  function clearRoute() {
    while (routeGroup.children.length) {
      const c = routeGroup.children.pop(); c.geometry && c.geometry.dispose();
    }
    routeArrows = [];
  }

  function drawRoute() {
    clearRoute();
    floorGroups.forEach((grp, fi) => { grp.position.y = fi * gap(); });
    if (!state.res) return;
    const P = state.res.path.filter((n, i, a) => i === 0 || Math.hypot(n.x - a[i - 1].x, n.y - a[i - 1].y) > 0.01 || n.fi !== a[i - 1].fi);
    const green = new THREE.Color(css('--exit') || '#138a4a');
    const pts = P.map((n) => V(n.x, n.y, n.fi, 0.9));
    // per-segment tubes, coloured faint when off the focused floor
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      if (a.distanceTo(b) < 0.01) continue;
      const fiA = P[i - 1].fi, fiB = P[i].fi;
      const onFocus = state.all || (fiA === fidx(state.floor) && fiB === fiA) || (fiA !== fiB && (fiA === fidx(state.floor) || fiB === fidx(state.floor)));
      if (!onFocus && fiA === fiB) continue; // other floors' walking legs would clutter this floor
      const geo = new THREE.TubeGeometry(new THREE.LineCurve3(a, b), 1, onFocus ? 0.38 : 0.2, 8, false);
      const m = new THREE.MeshBasicMaterial({ color: green, transparent: !onFocus, opacity: onFocus ? 1 : 0.35, depthTest: onFocus ? true : false });
      const mesh = new THREE.Mesh(geo, m); mesh.renderOrder = 5; routeGroup.add(mesh);
      // joints
      const j = new THREE.Mesh(new THREE.SphereGeometry(onFocus ? 0.38 : 0.2, 10, 8), m); j.position.copy(b); routeGroup.add(j);
    }
    // moving chevrons along the route
    const curve = new THREE.CurvePath();
    for (let i = 1; i < pts.length; i++) if (pts[i - 1].distanceTo(pts[i]) > 0.01) curve.add(new THREE.LineCurve3(pts[i - 1], pts[i]));
    const total = curve.getLength();
    const count = Math.max(4, Math.round(total / 6));
    const arrowGeo = new THREE.ConeGeometry(0.55, 1.4, 12); arrowGeo.rotateX(Math.PI / 2);
    const arrowMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (let k = 0; k < count; k++) {
      const a = new THREE.Mesh(arrowGeo, arrowMat); a.renderOrder = 6; a.userData.u = k / count; routeGroup.add(a); routeArrows.push(a);
    }
    routeGroup.userData.curve = curve;
    // pins
    const pin = (n, color) => {
      const grp = new THREE.Group();
      const ball = new THREE.Mesh(new THREE.SphereGeometry(1.1, 20, 14), new THREE.MeshLambertMaterial({ color }));
      ball.position.y = 3.2; grp.add(ball);
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 3, 8), new THREE.MeshLambertMaterial({ color }));
      stick.position.y = 1.5; grp.add(stick);
      grp.position.copy(V(n.x, n.y, n.fi, 0)); routeGroup.add(grp);
    };
    pin(P[0], new THREE.Color(css('--here') || '#d98a00'));
    pin(P[P.length - 1], green);
  }

  const fidx = (code) => B.floors.findIndex((f) => f.code === code);

  function applyFloorVisibility() {
    const f = fidx(state.floor);
    mats.forEach(({ m, base, fi, kind }) => {
      let o;
      if (state.all) o = base * (kind === 'line' ? 0.5 : 0.55);
      else if (fi === f) o = base;
      else if (fi < f) o = kind === 'line' ? 0.12 : base * 0.08;
      else o = 0;
      // an opaque slab must render in the opaque pass, or it paints over the rooms sitting on it
      const solid = o > 0.999;
      if (m.transparent === solid) { m.transparent = !solid; m.needsUpdate = true; }
      m.opacity = o; m.visible = o > 0.001; m.depthWrite = solid || (kind === 'room' && o > 0.5);
    });
  }

  // ---------- camera ----------
  const camGoal = { target: new THREE.Vector3(), pos: null, t: 1 };
  function frame(animate = true) {
    const f = fidx(state.floor);
    const tY = state.all ? (B.floors.length - 1) * gap() / 2 : f * gap();
    const target = new THREE.Vector3(0, tY, 0);
    const narrow = mapEl.clientWidth < 600;
    const dist = state.all ? 150 : narrow ? 105 : 80;
    const dir = new THREE.Vector3(0.0, state.all ? 0.55 : 0.95, 0.75).normalize();
    const pos = target.clone().add(dir.multiplyScalar(dist));
    if (!animate) { controls.target.copy(target); camera.position.copy(pos); camGoal.t = 1; return; }
    camGoal.fromT = controls.target.clone(); camGoal.fromP = camera.position.clone();
    camGoal.target = target; camGoal.pos = pos; camGoal.t = 0;
  }

  // ---------- labels ----------
  let labelNodes = [];
  function buildLabels() {
    labelsEl.innerHTML = '';
    labelNodes = [];
    const f = fidx(state.floor);
    const fl = B.floors[f];
    const show = state.all ? [] : fl.rooms.map((rm) => ({ id: rm.id, name: rm.name, no: rm.no, x: rm.rect[0] + rm.rect[2] / 2, y: rm.rect[1] + rm.rect[3] / 2, fi: f }));
    if (!state.all) B.connectors.filter((c) => c.kind === 'stairs').forEach((c) => show.push({ id: `${c.id}@${fl.code}`, name: c.name.replace(' Staircase', ' stairs'), x: c.rect[0] + c.rect[2] / 2, y: c.rect[1] + c.rect[3] / 2, fi: f }));
    if (state.all && state.res) {
      const P = state.res.path; [P[0], P[P.length - 1]].forEach((n) => show.push({ id: n.ref && n.ref.id ? (n.kind === 'room' ? n.ref.id : n.id) : n.id, name: n.ref ? n.ref.name : '', x: n.x, y: n.y, fi: n.fi }));
    }
    show.forEach((s) => {
      const d = document.createElement('div');
      d.className = 'lbl';
      const fromId = state.from && state.from.id, toId = state.to && state.to.id;
      if (s.id === toId) d.classList.add('hit');
      if (s.id === fromId) d.classList.add('src');
      d.textContent = s.name;
      if (s.no) { const sm = document.createElement('small'); sm.textContent = s.no; d.appendChild(sm); }
      labelsEl.appendChild(d);
      labelNodes.push({ el: d, v: () => V(s.x, s.y, s.fi, s.id && s.id.includes('LOBBY') ? 0.4 : 1.4) });
    });
  }
  function placeLabels() {
    const w = mapEl.clientWidth, h = mapEl.clientHeight;
    labelNodes.forEach(({ el, v }) => {
      const p = v().project(camera);
      const vis = p.z < 1 && Math.abs(p.x) < 1.05 && Math.abs(p.y) < 1.05;
      el.hidden = !vis;
      if (vis) { el.style.left = `${(p.x + 1) / 2 * w}px`; el.style.top = `${(1 - p.y) / 2 * h}px`; }
    });
  }

  // ---------- floor rail ----------
  function buildRail() {
    const rail = $('rail'); rail.innerHTML = '';
    const onRoute = new Set(state.res ? state.res.path.map((n) => n.floor) : []);
    const all = document.createElement('button');
    all.textContent = 'All'; all.title = 'Show all floors'; all.className = state.all ? 'on' : '';
    all.onclick = () => { state.all = !state.all; refreshView(true); };
    rail.appendChild(all);
    const sep = document.createElement('div'); sep.className = 'sep'; rail.appendChild(sep);
    [...B.floors].reverse().forEach((F) => {
      const b = document.createElement('button');
      b.textContent = F.code; b.title = floorLabel(F.code);
      b.className = (!state.all && F.code === state.floor ? 'on ' : '') + (onRoute.has(F.code) ? 'onroute' : '');
      b.onclick = () => { state.all = false; state.floor = F.code; refreshView(true); };
      rail.appendChild(b);
    });
    $('floorcap').textContent = state.all ? 'All floors' : floorLabel(state.floor);
  }

  function refreshView(animate) {
    applyFloorVisibility(); drawRoute(); buildLabels(); buildRail(); frame(animate);
  }

  // ---------- legend ----------
  $('legend').innerHTML = ['classroom', 'lab', 'hall', 'office', 'library', 'toilet', 'stairs', 'lift']
    .map((t) => `<span><i style="background:#${typeColor[t].toString(16).padStart(6, '0')}"></i>${typeName[t]}</span>`).join('');

  // ---------- routing UI ----------
  const icons = {
    start: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="4" fill="currentColor"/></svg>',
    end: '<svg viewBox="0 0 16 16"><path d="M3 8.5l3 3 7-7" stroke="currentColor" stroke-width="2" fill="none"/></svg>',
    walk: '<svg viewBox="0 0 16 16"><path d="M8 13V3M4 7l4-4 4 4" stroke="currentColor" stroke-width="1.8" fill="none"/></svg>',
    left: '<svg viewBox="0 0 16 16"><path d="M11 14V8a2 2 0 00-2-2H3M6 3L3 6l3 3" stroke="currentColor" stroke-width="1.8" fill="none"/></svg>',
    right: '<svg viewBox="0 0 16 16"><path d="M5 14V8a2 2 0 012-2h6M10 3l3 3-3 3" stroke="currentColor" stroke-width="1.8" fill="none"/></svg>',
    back: '<svg viewBox="0 0 16 16"><path d="M5 14V6a3 3 0 016 0v2M8 6l3 3 3-3" stroke="currentColor" stroke-width="1.8" fill="none"/></svg>',
    stairs: '<svg viewBox="0 0 16 16"><path d="M2 14h3v-3h3V8h3V5h3V2" stroke="currentColor" stroke-width="1.8" fill="none"/></svg>',
    lift: '<svg viewBox="0 0 16 16"><rect x="3" y="2" width="10" height="12" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M6 7l2-2 2 2M6 9l2 2 2-2" stroke="currentColor" stroke-width="1.4" fill="none"/></svg>',
  };

  function compute() {
    state.res = null; state.steps = []; state.activeStep = -1;
    if (state.from && state.to && state.from.id !== state.to.id) {
      const opts = { avoidStairs: $('noStairs').checked, avoidLifts: $('noLifts').checked };
      state.res = NG.route(g, state.from.id, state.to.id, opts);
      if (state.res) state.steps = NG.directions(g, state.res, B);
    }
    renderSteps();
    if (state.res) {
      const floors = new Set(state.res.path.map((n) => n.floor));
      state.floor = state.from.floor;
      state.all = floors.size > 1; // show the whole trip first; tap a step to zoom to its floor
    } else if (state.to) state.floor = state.to.floor;
    else if (state.from) state.floor = state.from.floor;
    refreshView(true);
    writeUrl();
  }

  function renderSteps() {
    const ol = $('steps'); ol.innerHTML = '';
    $('empty').hidden = !!state.res;
    $('summary').hidden = !state.res;
    if (state.from && state.to && !state.res) {
      $('empty').hidden = false;
      $('empty').textContent = state.from.id === state.to.id ? 'You are already there.' : 'No route found with these options. Try allowing stairs or lifts.';
    } else if (!state.res) {
      $('empty').textContent = "Pick where you are and where you want to go. Scanning a room's QR code fills in the first box for you.";
    }
    if (!state.res) return;
    const walk = NG.totalWalk(state.res);
    const P = state.res.path;
    let floorsMoved = 0, usedLift = null, usedStairs = null;
    for (let i = 1; i < P.length; i++) if (P[i].floor !== P[i - 1].floor) { floorsMoved++; if (P[i].kind === 'lift') usedLift = P[i].ref.name; else usedStairs = P[i].ref.name; }
    const secs = walk / 1.2 + (usedLift ? 40 + floorsMoved * 4 : 0) + (usedStairs ? floorsMoved * 15 : 0);
    $('sumMetres').textContent = `${Math.round(walk)} m`;
    const via = usedLift ? `via ${usedLift}` : usedStairs ? `via the ${usedStairs.toLowerCase()}` : 'same floor';
    $('sumMeta').textContent = `about ${Math.max(1, Math.round(secs / 60))} min · ${via}`;
    state.steps.forEach((s, i) => {
      const li = document.createElement('li');
      li.dataset.icon = s.icon; li.tabIndex = 0;
      li.innerHTML = `<span class="ico">${icons[s.icon] || icons.walk}</span><span class="stxt"></span><span class="sfl">${s.floor}</span>`;
      li.querySelector('.stxt').textContent = s.text;
      const go = () => { state.activeStep = i; [...ol.children].forEach((c, k) => c.classList.toggle('active', k === i)); state.all = false; state.floor = s.floor; refreshView(true); };
      li.onclick = go; li.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
      ol.appendChild(li);
    });
  }

  function combo(inputId, listId, key) {
    const input = $(inputId), list = $(listId);
    let items = [], sel = 0;
    const show = () => {
      items = search(input.value);
      list.innerHTML = '';
      if (!items.length) { list.innerHTML = '<div class="empty" style="padding:8px">No match. Try a room name, lab or floor.</div>'; }
      items.forEach((p, i) => {
        const b = document.createElement('button');
        b.type = 'button'; b.setAttribute('aria-selected', i === sel ? 'true' : 'false');
        b.innerHTML = `<span class="fl">${p.floor === 'G' ? 'G' : 'F' + p.floor}</span><span></span>`;
        b.lastChild.textContent = (p.no ? p.no + ' · ' : '') + p.name;
        b.onmousedown = (e) => { e.preventDefault(); pick(p); };
        list.appendChild(b);
      });
      list.hidden = false;
    };
    const pick = (p) => { state[key] = p; input.value = display(p); list.hidden = true; input.blur(); compute(); };
    input.addEventListener('focus', () => { input.select(); sel = 0; show(); });
    input.addEventListener('input', () => { sel = 0; show(); });
    input.addEventListener('blur', () => { setTimeout(() => { list.hidden = true; if (state[key]) input.value = display(state[key]); }, 120); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { sel = Math.min(items.length - 1, sel + 1); show(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); show(); e.preventDefault(); }
      else if (e.key === 'Enter' && items[sel]) { pick(items[sel]); e.preventDefault(); }
      else if (e.key === 'Escape') { list.hidden = true; input.blur(); }
    });
    return { set: (p) => { state[key] = p; input.value = p ? display(p) : ''; } };
  }
  const fromBox = combo('from', 'from-s', 'from');
  const toBox = combo('to', 'to-s', 'to');
  $('swap').onclick = () => { const f = state.from, t = state.to; fromBox.set(t); toBox.set(f); compute(); };
  $('noStairs').onchange = () => { if ($('noStairs').checked) $('noLifts').checked = false; compute(); };
  $('noLifts').onchange = () => { if ($('noLifts').checked) $('noStairs').checked = false; compute(); };

  // ---------- URL: ?from=6-T1&to=6-IOT  or  #from-6-T1 ----------
  function readUrl() {
    let from = null, to = null;
    try {
      const q = new URLSearchParams(location.search);
      from = q.get('from'); to = q.get('to');
    } catch (e) { /* ignore */ }
    const h = (location.hash || '').slice(1);
    if (h.startsWith('from-')) from = h.slice(5);
    else if (h.startsWith('to-')) to = h.slice(3);
    return { from: from && byId.get(fromUrlId(from)), to: to && byId.get(fromUrlId(to)) };
  }
  function writeUrl() {
    try {
      if (!/^https?:$/.test(location.protocol) || /claude\.ai|claudeusercontent/.test(location.host)) return;
      const q = new URLSearchParams();
      if (state.from) q.set('from', urlId(state.from.id));
      if (state.to) q.set('to', urlId(state.to.id));
      history.replaceState(null, '', `${location.pathname}?${q}`);
    } catch (e) { /* ignore */ }
  }
  window.addEventListener('hashchange', () => { const u = readUrl(); if (u.from) fromBox.set(u.from); if (u.to) toBox.set(u.to); compute(); });

  // ---------- QR sheet ----------
  const qrFloor = $('qrFloor');
  B.floors.forEach((F) => { const o = document.createElement('option'); o.value = F.code; o.textContent = floorLabel(F.code); qrFloor.appendChild(o); });
  const defaultBase = (() => {
    try {
      if (/^https?:$/.test(location.protocol) && !/claude\.ai|claudeusercontent/.test(location.host)) return location.origin + location.pathname;
    } catch (e) { /* ignore */ }
    return 'https://athithijain21.github.io/HospitalNavi/';
  })();
  $('qrBase').value = defaultBase;
  function renderQR() {
    const grid = $('qrGrid'); grid.innerHTML = '';
    const base = $('qrBase').value.trim() || defaultBase;
    places.filter((p) => p.floor === qrFloor.value && !p.id.includes('~')).forEach((p) => {
      const url = `${base}${base.includes('?') ? '&' : '?'}from=${encodeURIComponent(urlId(p.id))}`;
      const card = document.createElement('div'); card.className = 'qr';
      card.innerHTML = '<div class="code"></div><b></b><span></span>';
      card.querySelector('b').textContent = `${p.no ? p.no + ' · ' : ''}${p.name}`;
      card.querySelector('span').textContent = `from=${urlId(p.id)}`;
      grid.appendChild(card);
      if (window.QRCode) new QRCode(card.querySelector('.code'), { text: url, width: 240, height: 240, correctLevel: QRCode.CorrectLevel.M });
      else card.querySelector('.code').textContent = url;
    });
  }
  $('qrBtn').onclick = () => { qrFloor.value = state.floor; $('sheet').hidden = false; renderQR(); };
  $('sheetClose').onclick = () => { $('sheet').hidden = true; };
  $('sheet').onclick = (e) => { if (e.target.id === 'sheet') $('sheet').hidden = true; };
  qrFloor.onchange = renderQR; $('qrBase').onchange = renderQR;

  const unverified = places.filter((p) => p.verify && !p.id.includes('@') && !p.id.includes('~')).length;
  $('dataNote').textContent = `${places.filter((p) => !p.id.includes('~') && !p.landmark).length} rooms on ${B.floors.length} floors · ${unverified} names to confirm`;

  // ---------- tap a room on the map to set destination ----------
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
  let downAt = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
    const r = renderer.domElement.getBoundingClientRect();
    mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, camera);
    const f = fidx(state.floor);
    const targets = state.all ? floorGroups.flatMap((gp) => gp.children) : floorGroups[f].children;
    const hit = ray.intersectObjects(targets.filter((o) => o.isMesh && o.userData.placeId && o.material.visible), false)[0];
    if (!hit) return;
    const p = byId.get(hit.object.userData.placeId);
    if (!p) return;
    if (!state.from) fromBox.set(p); else toBox.set(p);
    compute();
  });

  // ---------- live position hook (for step tracking / AR later) ----------
  // window.BlockNav.setStart('6-T1') or .setPosition({floor:'6', x: 20, y: 11.6})
  window.BlockNav = {
    graph: g, data: B, scene,
    setStart(id) { const p = byId.get(fromUrlId(id)); if (p) { fromBox.set(p); compute(); } },
    setDestination(id) { const p = byId.get(fromUrlId(id)); if (p) { toBox.set(p); compute(); } },
    setPosition({ floor, x, y }) {
      let best = null;
      g.nodes.forEach((n) => { if (n.floor === floor && n.kind === 'corridor') { const d = Math.hypot(n.x - x, n.y - y); if (!best || d < best.d) best = { d, n }; } });
      if (!best) return;
      const p = { id: best.n.id, floor, fi: best.n.fi, name: 'Your position', no: '', type: 'here', landmark: true };
      byId.set(p.id, p); best.n.ref = best.n.ref || { name: 'your position' };
      fromBox.set(p); compute();
    },
  };

  // ---------- render loop ----------
  function resize() {
    const w = mapEl.clientWidth, h = mapEl.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix();
  }
  new ResizeObserver(() => { resize(); }).observe(mapEl);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let last = performance.now();
  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (camGoal.t < 1) {
      camGoal.t = reduce ? 1 : Math.min(1, camGoal.t + dt * 1.8);
      const e = 1 - Math.pow(1 - camGoal.t, 3);
      controls.target.lerpVectors(camGoal.fromT, camGoal.target, e);
      camera.position.lerpVectors(camGoal.fromP, camGoal.pos, e);
    }
    controls.update();
    const curve = routeGroup.userData.curve;
    if (curve && routeArrows.length) {
      routeArrows.forEach((a) => {
        if (!reduce) a.userData.u = (a.userData.u + dt * 6 / Math.max(1, curve.getLength())) % 1;
        const u = a.userData.u, p = curve.getPointAt(u), t = curve.getTangentAt(u);
        a.position.copy(p); a.lookAt(p.clone().add(t));
      });
    }
    renderer.render(scene, camera);
    placeLabels();
    requestAnimationFrame(tick);
  }

  // ---------- start ----------
  resize();
  const u = readUrl();
  fromBox.set(u.from || byId.get('G-LOBBY'));
  toBox.set(u.to || (u.from ? null : byId.get('6-IOT')));
  compute();
  frame(false);
  requestAnimationFrame(tick);
})();
