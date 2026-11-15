/*
 * Navigation graph + route finding for the building data.
 * No 3D code in here, so the same logic can be reused later
 * (live tracking, a Unity version, a server, tests).
 */
window.NavGraph = (function () {
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  function projectOnSeg(p, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const L2 = dx * dx + dy * dy || 1e-9;
    let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2;
    t = Math.max(0, Math.min(1, t));
    return { x: a[0] + t * dx, y: a[1] + t * dy, t };
  }

  function build(B) {
    const nodes = new Map();   // id -> {id, floor, fi, x, y, kind, ref}
    const adj = new Map();     // id -> [{to, w, kind}]
    const places = [];         // searchable destinations / start points

    const addNode = (n) => { nodes.set(n.id, n); adj.set(n.id, []); return n; };
    const link = (a, b, w, kind) => {
      adj.get(a).push({ to: b, w, kind });
      adj.get(b).push({ to: a, w, kind });
    };

    B.floors.forEach((F, fi) => {
      // things on this floor that must connect to a corridor
      const attach = [];
      F.rooms.forEach((rm) => {
        const [rx, ry, rw, rh] = rm.rect;
        const centre = addNode({ id: `${rm.id}`, floor: F.code, fi, x: rx + rw / 2, y: ry + rh / 2, kind: 'room', ref: rm });
        const door = addNode({ id: `${rm.id}#door`, floor: F.code, fi, x: rm.door[0], y: rm.door[1], kind: 'door', ref: rm });
        link(centre.id, door.id, dist(centre, door) * 0.5, 'inside');
        attach.push(door);
        places.push({ id: rm.id, floor: F.code, fi, name: rm.name, no: rm.no || '', type: rm.type, verify: !!rm.verify, landmark: !!rm.landmark });
      });
      B.connectors.forEach((c) => {
        const n = addNode({ id: `${c.id}@${F.code}`, floor: F.code, fi, x: c.door[0], y: c.door[1], kind: c.kind, ref: c });
        attach.push(n);
        places.push({ id: n.id, floor: F.code, fi, name: c.name, no: '', type: c.kind, landmark: true, verify: !!c.verify });
      });

      // split each corridor at the projections of everything attached to it
      const cuts = B.corridors.map((seg) => [{ x: seg[0][0], y: seg[0][1], t: 0 }, { x: seg[1][0], y: seg[1][1], t: 1 }]);
      const attachTo = []; // [nodeId, corridorIndex, point]
      attach.forEach((n) => {
        let best = null;
        B.corridors.forEach((seg, ci) => {
          const p = projectOnSeg([n.x, n.y], seg[0], seg[1]);
          const d = Math.hypot(p.x - n.x, p.y - n.y);
          if (!best || d < best.d) best = { d, ci, p };
        });
        cuts[best.ci].push(best.p);
        attachTo.push([n.id, best.ci, best.p]);
      });
      // corridor junctions: endpoints of one corridor lying on another
      B.corridors.forEach((s1, i) => {
        [s1[0], s1[1]].forEach((pt) => {
          B.corridors.forEach((s2, j) => {
            if (i === j) return;
            const p = projectOnSeg(pt, s2[0], s2[1]);
            if (Math.hypot(p.x - pt[0], p.y - pt[1]) < 0.05) cuts[j].push(p);
          });
        });
      });

      // create corridor nodes (merged by position) and chain them
      const key = (p) => `${F.code}:${p.x.toFixed(2)},${p.y.toFixed(2)}`;
      const cnode = (p) => nodes.get(key(p)) || addNode({ id: key(p), floor: F.code, fi, x: +p.x.toFixed(2), y: +p.y.toFixed(2), kind: 'corridor' });
      cuts.forEach((list) => {
        list.sort((a, b) => a.t - b.t);
        for (let i = 1; i < list.length; i++) {
          const a = cnode(list[i - 1]), b = cnode(list[i]);
          if (a.id !== b.id) link(a.id, b.id, dist(a, b), 'walk');
        }
      });
      attachTo.forEach(([id, , p]) => {
        const c = cnode(p), n = nodes.get(id);
        if (c.id !== id) link(id, c.id, dist(n, c), 'walk');
      });
    });

    // vertical links. Lifts get a "car" node per floor so boarding costs
    // the waiting time once, however many floors you ride.
    B.connectors.forEach((c) => {
      const shaft = (F) => {
        if (c.kind !== 'lift') return `${c.id}@${F.code}`;
        const id = `${c.id}~${F.code}`;
        if (!nodes.has(id)) {
          const fi = B.floors.indexOf(F);
          addNode({ id, floor: F.code, fi, x: c.door[0], y: c.door[1], kind: 'lift', ref: c, car: true });
          link(`${c.id}@${F.code}`, id, (c.waitCost || 0) / 2, 'lift');
        }
        return id;
      };
      for (let i = 1; i < B.floors.length; i++) {
        link(shaft(B.floors[i - 1]), shaft(B.floors[i]), c.costPerFloor, c.kind);
      }
    });

    return { nodes, adj, places };
  }

  // Dijkstra with options: {avoidStairs, avoidLifts}
  function route(g, from, to, opts = {}) {
    const D = new Map([[from, 0]]), prev = new Map(), done = new Set();
    const pq = [[0, from]];
    while (pq.length) {
      pq.sort((a, b) => a[0] - b[0]);
      const [d, u] = pq.shift();
      if (done.has(u)) continue;
      done.add(u);
      if (u === to) break;
      for (const e of g.adj.get(u)) {
        if (opts.avoidStairs && e.kind === 'stairs') continue;
        if (opts.avoidLifts && e.kind === 'lift') continue;
        const nd = d + e.w;
        if (nd < (D.get(e.to) ?? Infinity)) { D.set(e.to, nd); prev.set(e.to, u); pq.push([nd, e.to]); }
      }
    }
    if (!D.has(to)) return null;
    const path = [];
    for (let c = to; c !== undefined; c = prev.get(c)) path.unshift(g.nodes.get(c));
    return { path, cost: D.get(to) };
  }

  // Turn a path into human directions.
  function directions(g, res, B) {
    const P = res.path, steps = [];
    if (P.length < 2) return steps;
    const fidx = (c) => B.floors.findIndex((f) => f.code === c);
    const floorName = (c) => (c === 'G' ? 'the ground floor' : `floor ${c}`);
    const dirOf = (a, b) => { const l = Math.hypot(b.x - a.x, b.y - a.y) || 1; return { x: (b.x - a.x) / l, y: (b.y - a.y) / l }; };
    const len = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
    const compass = (h) => Math.abs(h.x) > Math.abs(h.y) ? (h.x > 0 ? 'east' : 'west') : (h.y > 0 ? 'north' : 'south');
    const hint = { west: 'towards the lobby', east: 'towards the far east end', north: 'towards the staff rooms', south: 'towards the main corridor' };
    const turn = (h1, h2) => {
      const ang = Math.atan2(h1.x * h2.y - h1.y * h2.x, h1.x * h2.x + h1.y * h2.y) * 180 / Math.PI;
      if (Math.abs(ang) < 25) return 'straight';
      if (Math.abs(ang) > 155) return 'back';
      return ang > 0 ? 'left' : 'right'; // y points north, so +angle = counter-clockwise = left
    };
    const m = (x) => `${Math.max(1, Math.round(x))} m`;

    const first = P[0], last = P[P.length - 1];
    const startRoom = first.kind === 'room' && !first.ref.landmark;
    const endRoom = last.kind === 'room';
    const s = first.kind === 'room' ? 1 : 0;
    const e = endRoom ? P.length - 2 : P.length - 1;
    const startName = first.ref ? first.ref.name : 'your position';
    steps.push({ icon: 'start', text: `Start at ${startName}, ${floorName(first.floor)}.`, floor: first.floor, at: P[0] });

    // split into same-floor legs with vertical moves in between
    const legs = [[P[s]]], moves = [];
    for (let k = s + 1; k <= e; k++) {
      if (P[k].floor !== P[k - 1].floor) {
        const conn = P[k - 1].ref; let j = k;
        while (j + 1 <= e && P[j + 1].floor !== P[j].floor) j++;
        moves.push({ conn, from: P[k - 1].floor, to: P[j].floor });
        legs.push([P[j]]); k = j; continue;
      }
      legs[legs.length - 1].push(P[k]);
    }

    legs.forEach((raw, li) => {
      const isFirst = li === 0, isLast = li === legs.length - 1;
      // drop duplicate and collinear points
      const pts = [];
      raw.forEach((p) => { if (!pts.length || len(pts[pts.length - 1], p) > 0.05) pts.push(p); });
      for (let i = pts.length - 2; i >= 1; i--) {
        if (turn(dirOf(pts[i - 1], pts[i]), dirOf(pts[i], pts[i + 1])) === 'straight') pts.splice(i, 1);
      }
      // fold tiny jogs (< 1.2 m) into the next segment
      for (let i = 1; i < pts.length - 1;) {
        if (len(pts[i - 1], pts[i]) < 1.2 && !(i === 1 && isFirst && startRoom)) pts.splice(i, 1); else i++;
      }
      for (let i = pts.length - 2; i >= 1; i--) {
        if (turn(dirOf(pts[i - 1], pts[i]), dirOf(pts[i], pts[i + 1])) === 'straight') pts.splice(i, 1);
      }
      const floor = raw[0].floor;
      const stopAt = isLast && endRoom ? pts.length - 2 : pts.length - 1; // last segment = into the room
      let i = 0, heading = null;

      if (pts.length < 2) { /* nothing to walk on this floor */ }
      else if (isFirst && startRoom) {
        heading = dirOf(pts[0], pts[1]); // stepping out through the door
        i = 1;
        if (stopAt <= 0) { /* door to door */ }
        else if (i < stopAt) {
          const t = turn(heading, dirOf(pts[1], pts[2]));
          const w = len(pts[1], pts[2]);
          const into = t === 'left' || t === 'right' ? `turn ${t}` : 'go straight on';
          steps.push({ icon: t === 'straight' ? 'walk' : t, text: `Leave ${first.ref.name}, ${into} into the corridor and walk about ${m(w)}.`, floor, at: pts[0] });
          heading = dirOf(pts[1], pts[2]); i = 2;
        } else {
          steps.push({ icon: 'walk', text: `Leave ${first.ref.name} into the corridor.`, floor, at: pts[0] });
        }
      } else if (stopAt >= 1) {
        heading = dirOf(pts[0], pts[1]);
        const c = compass(heading);
        const lead = isFirst ? 'Head' : `Come out of the ${moves[li - 1].conn.kind === 'lift' ? 'lift' : 'stairs'} and head`;
        if (isFirst && !isLast && stopAt === 1) {
          const cn = moves[li].conn;
          steps.push({ icon: 'walk', text: `Walk to ${cn.kind === 'lift' ? cn.name : 'the ' + cn.name} (about ${m(len(pts[0], pts[1]))}).`, floor, at: pts[0] });
        } else {
          steps.push({ icon: 'walk', text: `${lead} ${c} (${hint[c]}) for about ${m(len(pts[0], pts[1]))}.`, floor, at: pts[0] });
        }
        i = 1;
      }

      for (; heading && i < stopAt; i++) {
        const h = dirOf(pts[i], pts[i + 1]), t = turn(heading, h);
        const w = len(pts[i], pts[i + 1]);
        const lead = t === 'back' ? 'Turn around' : t === 'straight' ? 'Carry on' : `Turn ${t}`;
        steps.push({ icon: t === 'straight' ? 'walk' : t, text: `${lead} and walk about ${m(w)}.`, floor, at: pts[i] });
        heading = h;
      }

      if (isLast && endRoom && !heading && pts.length >= 2) {
        const h = dirOf(pts[pts.length - 2], pts[pts.length - 1]), c = compass(h);
        const lead = isFirst ? 'Head' : `Come out of the ${moves[li - 1].conn.kind === 'lift' ? 'lift' : 'stairs'} and head`;
        steps.push({ icon: 'walk', text: `${lead} ${c} (${hint[c]}) for about ${m(len(pts[pts.length - 2], pts[pts.length - 1]))}.`, floor, at: pts[pts.length - 2] });
      }
      if (isLast && endRoom) {
        let side = 'ahead';
        if (heading && pts.length >= 2) {
          const t = turn(heading, dirOf(pts[pts.length - 2], pts[pts.length - 1]));
          side = t === 'left' ? 'on your left' : t === 'right' ? 'on your right' : t === 'back' ? 'behind you' : 'ahead';
        }
        steps.push({ icon: 'end', text: `${last.ref.name} is ${side}.`, floor, at: pts[pts.length - 1] });
      } else if (isLast) {
        steps.push({ icon: 'end', text: `You have arrived at ${last.ref ? last.ref.name : 'your destination'}.`, floor, at: pts[pts.length - 1] });
      } else {
        const mv = moves[li];
        const up = fidx(mv.to) > fidx(mv.from) ? 'up' : 'down';
        const what = mv.conn.kind === 'lift' ? mv.conn.name : `the ${mv.conn.name}`;
        steps.push({ icon: mv.conn.kind, text: `Take ${what} ${up} to ${floorName(mv.to)}.`, floor: mv.to, at: pts[pts.length - 1], vertical: true, toFloor: mv.to });
      }
    });
    return steps;
  }

  function totalWalk(res) {
    let m = 0;
    for (let k = 1; k < res.path.length; k++) {
      const a = res.path[k - 1], b = res.path[k];
      if (a.floor === b.floor) m += Math.hypot(b.x - a.x, b.y - a.y);
    }
    return m;
  }

  return { build, route, directions, totalWalk };
})();
