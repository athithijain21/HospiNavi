/*
 * Live tracking by counting footsteps (pedestrian dead reckoning, snapped to the route).
 *
 * How it works
 *  1. The phone's accelerometer gives ~60 readings a second.
 *  2. Every step makes a bump in the total acceleration. We detect each bump = 1 step.
 *  3. Each step moves the blue "you" dot ~0.7 m forward ALONG THE ROUTE, so it
 *     always stays in the corridors and the directions tick off as you walk.
 *  4. At a lift or staircase the dot waits; steps on the stairs don't count.
 *     Tap "I'm on floor X" (or scan that floor's QR code) to carry on.
 *  5. If the dot drifts, tap any direction in the list to snap it there.
 *
 * Needs: HTTPS (GitHub Pages is fine). iPhones ask for permission when you tap Start.
 */
(function () {
  const NAV = window.BlockNav;
  if (!NAV) return;
  const $ = (id) => document.getElementById(id);

  // ---------- settings ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };
  let stride = store.get('nav.stride', 0.7);            // metres per step
  const SENS = { low: 1.6, normal: 1.1, high: 0.7 };    // bump size (m/s²) that counts as a step
  let sens = store.get('nav.sens', 'normal');

  // ---------- route geometry ----------
  let route = null;   // { segs, stops, stepDist, stepStage, total }
  function buildRoute(res, steps) {
    if (!res) return null;
    const P = res.path;
    const cum = [0], segs = [], stops = [];
    let d = 0, stage = 0;
    for (let i = 1; i < P.length; i++) {
      const a = P[i - 1], b = P[i];
      if (a.floor !== b.floor) {
        // collapse a run of floor changes (a lift ride) into one stop
        if (!stops.length || stops[stops.length - 1].endIdx !== i - 1) {
          stops.push({ d, startIdx: i - 1, endIdx: i, kind: a.kind, name: a.ref ? a.ref.name : '', stage });
          stage++;
        }
        stops[stops.length - 1].endIdx = i;
        stops[stops.length - 1].toFloor = b.floor;
        stops[stops.length - 1].toFi = b.fi;
      } else {
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        if (len > 0.01) segs.push({ a, b, d0: d, len, stage });
        d += len;
      }
      cum[i] = d;
    }
    // where each direction applies, and which floor-stage it belongs to
    const stepDist = [], stepStage = [];
    let st = 0;
    steps.forEach((s, i) => {
      const idx = Math.max(0, P.indexOf(s.at));
      stepDist[i] = s.at ? cum[idx] : 0;
      stepStage[i] = st;
      if (s.vertical) st++;
    });
    return { P, segs, stops, stepDist, stepStage, total: d, startFi: P[0].fi };
  }

  function positionAt(d, stage) {
    const segs = route.segs.filter((s) => s.stage === stage);
    if (!segs.length) {
      // standing at a lift/stairs with no walking on this floor
      const stop = route.stops[stage - 1] || route.stops[stage];
      const n = stop ? route.P[stage === 0 ? stop.startIdx : stop.endIdx] : route.P[0];
      return { fi: n.fi, x: n.x, y: n.y, floor: n.floor };
    }
    let s = segs[0];
    for (const sg of segs) { if (d >= sg.d0 - 1e-6) s = sg; }
    const t = Math.max(0, Math.min(1, (d - s.d0) / s.len));
    return { fi: s.a.fi, floor: s.a.floor, x: s.a.x + (s.b.x - s.a.x) * t, y: s.a.y + (s.b.y - s.a.y) * t };
  }

  // ---------- tracking state ----------
  const T = { on: false, d: 0, stage: 0, steps: 0, holding: null, arrived: false, gotSensor: false, wake: null };

  function reset() {
    const r = NAV.getRoute();
    route = buildRoute(r.res, r.steps);
    T.d = 0; T.stage = 0; T.steps = 0; T.holding = null; T.arrived = false;
    $('walkBtn').hidden = !route;
    if (T.on && !route) stop();
    if (T.on) update(true);
  }

  // ---------- compass: which way is the person walking? ----------
  // The map's "north" is not real north, so we learn the offset between the
  // phone's compass and the map from the first few steps (people start by
  // walking forward), then keep nudging it so steel/wiring drift is corrected.
  const C = { heading: null, offset: null, samples: [], dir: 'forward' };
  const wrap = (a) => ((a % 360) + 540) % 360 - 180;            // -180..180
  const circMean = (arr) => { let x = 0, y = 0; arr.forEach((a) => { x += Math.cos(a * Math.PI / 180); y += Math.sin(a * Math.PI / 180); }); return Math.atan2(y, x) * 180 / Math.PI; };
  function onOrient(e) {
    let h = null;
    if (typeof e.webkitCompassHeading === 'number') h = e.webkitCompassHeading;        // iPhone
    else if (e.absolute && typeof e.alpha === 'number') h = (360 - e.alpha) % 360;     // Android
    if (h === null || isNaN(h)) return;
    // smooth it a little
    C.heading = C.heading === null ? h : (C.heading + wrap(h - C.heading) * 0.25 + 360) % 360;
  }
  const bearingOf = (sg) => Math.atan2(sg.b.x - sg.a.x, sg.b.y - sg.a.y) * 180 / Math.PI;
  function segsAround() {
    // the route segment the dot is on now, plus the ones before and after it
    const segs = route.segs.filter((sg) => sg.stage === T.stage);
    if (!segs.length) return null;
    let k = 0;
    segs.forEach((x, i) => { if (T.d >= x.d0 - 1e-6) k = i; });
    if (k > 0 && T.d <= segs[k].d0 + 1e-6) k = k; // exactly on a corner: count as the new segment
    return { prev: segs[k - 1], cur: segs[k], next: segs[k + 1] };
  }
  function stepDirection() {
    const S = segsAround();
    if (C.heading === null || !S) return 1;                         // no compass: assume forward
    const seg = bearingOf(S.cur);
    if (C.offset === null) {                                        // still learning
      C.samples.push(wrap(C.heading - seg));
      if (C.samples.length >= 4) C.offset = circMean(C.samples);
      return 1;
    }
    const walk = C.heading - C.offset;                              // walking direction in map terms
    const rel = wrap(walk - seg);
    if (Math.abs(rel) < 50) { C.offset += wrap(C.heading - seg - C.offset) * 0.05; return 1; }   // forward (and refine)
    if (Math.abs(rel) > 130) return -1;                             // walking back
    // sideways to this segment: people turn corners a little early or late
    const toCornerAhead = S.cur.d0 + S.cur.len - T.d, fromCornerBehind = T.d - S.cur.d0;
    if (S.next && toCornerAhead < 4 && Math.abs(wrap(walk - bearingOf(S.next))) < 60) return 1;
    if (S.prev && fromCornerBehind < 4 && Math.abs(wrap(walk - bearingOf(S.prev) - 180)) < 60) return -1;
    // very short stubs (a doorway) can't be judged by compass: keep going
    if (S.cur.len < 3) return 1;
    return 0;                                                       // turning on the spot
  }

  function stageStart() { return T.stage === 0 ? 0 : route.stops[T.stage - 1].d; }

  function addSteps(n) {
    if (!T.on || !route) return;
    if (T.arrived && stepDirection() !== -1) return;
    if (T.arrived) T.arrived = false;
    T.steps += n;
    const dir = stepDirection();
    C.dir = dir === 1 ? 'forward' : dir === -1 ? 'back' : 'turning';
    if (T.holding) {
      // at a lift/stairs: only walking away (back) moves the dot again
      if (dir === -1) { T.holding = null; T.d = Math.max(stageStart(), T.d - n * stride); update(false); } else render();
      return;
    }
    T.d = Math.max(stageStart(), T.d + dir * n * stride);
    update(false);
  }

  function update(force) {
    const stop = route.stops[T.stage];
    if (stop && T.d >= stop.d) { T.d = stop.d; T.holding = stop; }
    if (!stop && T.d >= route.total - 0.8) {
      T.d = route.total;
      if (!T.arrived) { T.arrived = true; try { navigator.vibrate && navigator.vibrate([120, 80, 120]); } catch (e) { /* ignore */ } }
    }
    const pos = positionAt(T.d, T.stage);
    NAV.showYou(pos);
    NAV.focusFloor(pos.floor, force);
    render();
  }

  function passStop() {
    if (!T.holding) return;
    T.stage++; T.holding = null;
    try { navigator.vibrate && navigator.vibrate(60); } catch (e) { /* ignore */ }
    update(true);
  }

  // ---------- UI ----------
  function currentStepIndex() {
    let cur = 0;
    route.stepDist.forEach((sd, i) => { if (route.stepStage[i] <= T.stage && sd <= T.d + 0.3) cur = i; });
    return cur;
  }

  function render() {
    if (!T.on || !route) return;
    const steps = NAV.getRoute().steps;
    const cur = currentStepIndex();
    NAV.highlightStep(cur);
    let head = '', main = '';
    if (T.arrived) {
      head = 'Arrived'; main = steps[steps.length - 1].text;
    } else if (T.holding) {
      head = T.holding.kind === 'lift' ? 'In the lift' : 'On the stairs';
      main = `${steps[cur].text} Tap the button when you get there.`;
    } else {
      let next = cur + 1;
      while (next < steps.length && route.stepStage[next] > T.stage) next = steps.length; // beyond a lift/stairs
      if (next < steps.length) {
        const left = Math.max(0, route.stepDist[next] - T.d);
        head = left < 2 ? 'Now' : `In ${Math.round(left)} m`;
        main = steps[next].text;
      } else {
        head = `In ${Math.max(1, Math.round(route.total - T.d))} m`; main = steps[cur].text;
      }
    }
    $('wkHead').textContent = head;
    $('wkText').textContent = main;
    const compass = C.heading === null ? 'no compass' : C.offset === null ? 'learning direction…' : C.dir === 'back' ? 'walking back' : C.dir === 'turning' ? 'turning' : 'walking forward';
    $('wkCount').textContent = `${T.steps} steps · ${Math.round(T.d)} of ${Math.round(route.total)} m · ${compass}`;
    const fb = $('wkFloor');
    fb.hidden = !T.holding;
    if (T.holding) fb.textContent = `I'm on ${T.holding.toFloor === 'G' ? 'the ground floor' : 'floor ' + T.holding.toFloor}`;
    $('wkStride').textContent = `${stride.toFixed(2)} m`;
    // phone: small card on the map, so the directions panel can stay closed
    $('wcHead').textContent = head;
    $('wcText').textContent = main.replace(' Tap the button when you get there.', '');
    $('wcFloor').hidden = !T.holding;
    if (T.holding) $('wcFloor').textContent = fb.textContent;
    $('walk').classList.toggle('done', T.arrived);
  }

  // ---------- step detection ----------
  const det = { g: 9.81, lp: 0, armed: true, last: 0, samples: 0 };
  function onMotion(e) {
    const a = e.accelerationIncludingGravity;
    if (!a || a.x === null) return;
    if (!T.gotSensor) { T.gotSensor = true; $('wkSensor').textContent = 'Motion sensor on'; $('wkSim').hidden = true; }
    const mag = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
    det.g = det.g * 0.98 + mag * 0.02;          // slowly-moving gravity baseline
    det.lp = det.lp * 0.7 + (mag - det.g) * 0.3; // smoothed bounce
    const now = e.timeStamp || performance.now();
    if (det.armed && det.lp > SENS[sens] && now - det.last > 300) {
      det.armed = false; det.last = now; addSteps(1);
    } else if (!det.armed && det.lp < 0.2) {
      det.armed = true;
    }
  }

  async function start() {
    if (!route) return;
    // iPhone: permission must be asked inside the tap
    try {
      if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        const r = await DeviceMotionEvent.requestPermission();
        if (r !== 'granted') { $('wkSensor').textContent = 'Motion access was denied. Allow it in Settings → Safari → Motion & Orientation.'; }
      }
    } catch (e) { /* older browsers */ }
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') await DeviceOrientationEvent.requestPermission();
    } catch (e) { /* older browsers */ }
    window.addEventListener('devicemotion', onMotion);
    window.addEventListener('deviceorientationabsolute', onOrient);
    window.addEventListener('deviceorientation', onOrient);
    C.offset = null; C.samples = []; C.heading = null;
    try { T.wake = await navigator.wakeLock.request('screen'); } catch (e) { T.wake = null; }
    T.on = true;
    document.getElementById('panel').classList.add('walking');
    $('walk').hidden = false; $('walkBtn').hidden = true; $('walkChip').hidden = false;
    if (NAV.closeDrawer) NAV.closeDrawer();
    $('wkSensor').textContent = 'Waiting for motion sensor…';
    $('wkSim').hidden = true;
    setTimeout(() => {
      if (T.on && !T.gotSensor) { $('wkSensor').textContent = 'No motion sensor found. Use "+1 step" to test.'; $('wkSim').hidden = false; }
    }, 2500);
    NAV.setFollow(true);
    reset();
    update(true);
  }

  function stop() {
    T.on = false;
    window.removeEventListener('devicemotion', onMotion);
    window.removeEventListener('deviceorientationabsolute', onOrient);
    window.removeEventListener('deviceorientation', onOrient);
    try { T.wake && T.wake.release(); } catch (e) { /* ignore */ }
    document.getElementById('panel').classList.remove('walking');
    $('walk').hidden = true; $('walkBtn').hidden = !route; $('walkChip').hidden = true;
    NAV.setFollow(false); NAV.showYou(null);
  }

  $('walkBtn').onclick = start;
  $('wkStop').onclick = stop;
  $('wkFloor').onclick = passStop;
  $('wcFloor').onclick = passStop;
  $('wcStop').onclick = stop;
  $('wkSim').onclick = () => addSteps(1);
  $('wkMinus').onclick = () => { stride = Math.max(0.4, +(stride - 0.05).toFixed(2)); store.set('nav.stride', stride); render(); };
  $('wkPlus').onclick = () => { stride = Math.min(1.1, +(stride + 0.05).toFixed(2)); store.set('nav.stride', stride); render(); };
  const sensSel = $('wkSens');
  sensSel.value = sens;
  sensSel.onchange = () => { sens = sensSel.value; store.set('nav.sens', sens); };

  // tap a direction while walking = "I'm here now" (fixes drift)
  $('steps').addEventListener('click', (e) => {
    if (!T.on || !route) return;
    const li = e.target.closest('li'); if (!li) return;
    const i = [...li.parentNode.children].indexOf(li);
    T.stage = route.stepStage[i]; T.d = route.stepDist[i]; T.holding = null; T.arrived = false;
    setTimeout(() => update(true), 0);
  });

  // laptop testing: Space or ↑ = one step
  window.addEventListener('keydown', (e) => {
    if (!T.on || /input|select|textarea/i.test(document.activeElement.tagName)) return;
    if (e.key === ' ' || e.key === 'ArrowUp') { e.preventDefault(); addSteps(1); }
  });

  NAV.onRoute(reset);
  reset();
  window.BlockNav.tracking = { start, stop, addSteps, state: T };
})();
