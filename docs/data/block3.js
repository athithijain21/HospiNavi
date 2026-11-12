/*
 * Academic Block III – map data
 * ------------------------------------------------------------
 * Traced from the architect's floor plans (Saldanha & Associates)
 * and the 6th-floor fire escape plan.
 *
 * Units: metres. x runs west -> east, y runs south -> north.
 * Origin (0,0) = south-west corner of the lobby / classroom wing.
 *
 * HOW TO EDIT
 *  - Change a room's name:      edit `name`
 *  - Add the real room number:  fill `no` (e.g. '3602'); it becomes searchable
 *  - Add a room:                copy a line in that floor's `rooms` list
 *  - `verify: true` means the name came from the architect's drawing and
 *    may not match what the room is used for today. Check on site.
 */

window.BLOCK3 = (function () {
  const FLOOR_HEIGHT = 3.6;

  // ---- Shared structural grid (same on every floor) -----------------
  const G = {
    bandS: [0, 10.07],          // classroom band, south side
    corr: [10.07, 13.12],       // main E-W corridor (3.05 m wide)
    mid: [13.12, 23.41],        // halls band
    north: [23.41, 33.70],      // north wing rooms
    ncorr: [33.70, 37.70],      // north corridor (4.00 m wide)
    xW: 2.14, xE: 53.84,        // classroom band west / east walls (51.70 m)
    xEast: 57.50,               // east toilet strip edge (+3.66 m)
    hallW: [9.80, 30.16],       // west hall (20.36 m)
    cc: [30.16, 33.21],         // central N-S corridor (3.05 m)
    hallE: [33.21, 53.57],      // east hall (20.36 m)
    roomNW: [20.09, 30.16],     // north-west room (10.07 m)
    roomNE: [33.21, 43.28],     // north-east room (10.07 m)
  };

  // Corridor centre-lines. Doors snap to the nearest one.
  const corridors = [
    [[1.6, 11.6], [55.6, 11.6]],        // main corridor
    [[31.69, 11.6], [31.69, 35.7]],     // central corridor
    [[17.7, 35.7], [35.6, 35.7]],       // north corridor
    [[5.5, 11.6], [5.5, 18.6]],         // lobby, up to stairs and lifts
    [[55.6, 11.6], [55.6, 9.2]],        // to boys' toilet
  ];

  // Outline of one floor slab, used for drawing.
  const outline = [
    [0, 10.07], [G.xW, 10.07], [G.xW, 0], [G.xE, 0],
    [G.xEast, 0], [G.xEast, 13.12], [G.hallE[1], 13.12], [G.hallE[1], 23.41],
    [G.roomNE[1], 23.41], [G.roomNE[1], 33.70], [45.0, 33.70], [45.0, 37.70],
    [20.09, 37.70], [20.09, 40.21], [15.38, 40.21], [15.38, 31.0], [20.09, 31.0],
    [20.09, 23.41], [9.80, 23.41], [3.0, 23.41], [3.0, 19.5], [0, 19.5],
  ];

  const r = (x0, x1, y0, y1) => [x0, y0, x1 - x0, y1 - y0]; // rect [x,y,w,h]

  // Rooms that sit in the same place on every floor.
  const fixed = (f) => [
    { id: `${f}-GT`, name: "Girls' Toilet", type: 'toilet', rect: r(35.5, 44.6, 33.7, 37.46), door: [35.6, 35.7] },
    { id: `${f}-BT`, name: "Boys' Toilet", type: 'toilet', rect: r(G.xE, G.xEast, 2.5, 9.2), door: [55.6, 9.2] },
    { id: `${f}-LOBBY`, name: f === 'G' ? 'Main Lobby (entrance)' : 'Lift Lobby', type: 'lobby', rect: r(0, 7.6, 10.07, 19.5), door: [3.0, 15.0], landmark: true },
  ];

  // Classroom band split into n equal rooms along the corridor.
  const band = (f, n, mk) => {
    const w = (G.xE - G.xW) / n, out = [];
    for (let i = 0; i < n; i++) {
      const x0 = G.xW + i * w;
      out.push(Object.assign({ type: 'classroom', rect: r(x0, x0 + w, 0, G.bandS[1]), door: [x0 + 1.4, G.bandS[1]] }, mk(i + 1)));
    }
    return out;
  };

  const halls = (f, west, east) => [
    Object.assign({ id: `${f}-HW`, type: 'hall', rect: r(G.hallW[0], G.hallW[1], G.mid[0], G.mid[1]), door: [28.6, G.mid[0]] }, west),
    Object.assign({ id: `${f}-HE`, type: 'lab', rect: r(G.hallE[0], G.hallE[1], G.mid[0], G.mid[1]), door: [35.0, G.mid[0]] }, east),
  ];
  const northRooms = (f, nw, ne) => [
    Object.assign({ id: `${f}-NW`, type: 'office', rect: r(G.roomNW[0], G.roomNW[1], G.north[0], G.north[1]), door: [G.roomNW[1], 32.3] }, nw),
    Object.assign({ id: `${f}-NE`, type: 'office', rect: r(G.roomNE[0], G.roomNE[1], G.north[0], G.north[1]), door: [G.roomNE[0], 32.3] }, ne),
  ];
  const pad = (n) => String(n).padStart(2, '0');

  // ---- Floors -------------------------------------------------------
  const floors = [
    {
      code: 'G', label: 'Ground', rooms: [
        ...northRooms('G', { name: 'HOD Room' }, { name: 'Staff Room' }),
        ...halls('G', { name: 'Physics Lab 01', type: 'lab' }, { name: 'Physics Lab 02' }),
        ...band('G', 5, (i) => ({ id: `G-C${i}`, name: `1st Year Classroom ${pad(i)}` })),
        ...fixed('G'),
      ],
    },
    {
      code: '1', label: 'First', rooms: [
        ...northRooms('1', { name: 'Maths HOD' }, { name: 'Maths Staff Room' }),
        ...halls('1', { name: 'Seminar Hall' }, { name: 'CAD Lab' }),
        ...band('1', 5, (i) => ({ id: `1-C${i}`, name: `1st Year Classroom ${pad(i + 5)}` })),
        ...fixed('1'),
      ],
    },
    {
      code: '2', label: 'Second', rooms: [
        { id: '2-LIB', name: 'Library', type: 'library', rect: r(G.hallW[0], G.hallE[1], G.mid[0], G.mid[1]), extra: [r(G.roomNW[0], G.roomNE[1], G.north[0], G.north[1])], door: [31.69, G.mid[0]] },
        { id: '2-CCC', name: 'Central Computer Center', type: 'lab', rect: r(G.xW, G.xE, 0, G.bandS[1]), door: [27.0, G.bandS[1]] },
        ...fixed('2'),
      ],
    },
    {
      code: '3', label: 'Third', rooms: [
        ...northRooms('3', { name: 'MBA HOD' }, { name: 'MBA Staff Room' }),
        ...halls('3', { name: 'MBA Seminar Hall' }, { name: 'MBA Lab' }),
        ...band('3', 5, (i) => ({ id: `3-C${i}`, name: `MBA Classroom ${pad(i)}` })),
        ...fixed('3'),
      ],
    },
    ...['4', '5', '7'].map((f) => ({
      code: f, label: { 4: 'Fourth', 5: 'Fifth', 7: 'Seventh' }[f], rooms: [
        ...northRooms(f, { name: 'HOD Room', verify: true }, { name: 'Staff Room', verify: true }),
        ...halls(f, { name: 'Seminar Hall (West)', verify: true }, { name: 'Seminar Hall (East)', type: 'hall', verify: true }),
        ...band(f, 6, (i) => ({ id: `${f}-T${i}`, name: `Tutorial Room ${i}`, verify: true })),
        ...fixed(f),
      ],
    })),
    {
      code: '6', label: 'Sixth', rooms: [
        ...northRooms('6', { name: 'CSE Staff Room (North-west)' }, { name: 'CSE Staff Room (North-east)' }),
        { id: '6-HW', name: 'Webinar Hall', type: 'hall', rect: r(G.hallW[0], G.hallW[1], G.mid[0], G.mid[1]), door: [28.6, G.mid[0]] },
        { id: '6-CISCO', name: 'Cisco Center of Excellence', type: 'lab', rect: r(G.hallE[0], 43.4, G.mid[0], G.mid[1]), door: [35.0, G.mid[0]] },
        { id: '6-IOT', name: 'Internet of Things Lab', type: 'lab', rect: r(43.4, G.hallE[1], G.mid[0], G.mid[1]), door: [45.0, G.mid[0]] },
        ...band('6', 6, (i) => ({ id: `6-T${i}`, name: `Tutorial Room ${i}` })),
        ...fixed('6'),
      ],
    },
  ];
  // keep floors in vertical order
  const order = ['G', '1', '2', '3', '4', '5', '6', '7'];
  floors.sort((a, b) => order.indexOf(a.code) - order.indexOf(b.code));

  // ---- Vertical connections ----------------------------------------
  // `door` = where you enter it on each floor. `cost` = metres-equivalent per floor.
  const connectors = [
    { id: 'STA', name: 'Main Staircase', kind: 'stairs', rect: r(3.0, 9.8, 19.5, 23.41), door: [5.5, 19.5], costPerFloor: 14 },
    { id: 'STB', name: 'North-west Staircase', kind: 'stairs', rect: r(15.38, 20.09, 33.7, 40.21), door: [17.7, 35.7], costPerFloor: 14, verify: true },
    { id: 'L1', name: 'Lift 1', kind: 'lift', rect: r(7.6, 9.8, 13.4, 16.1), door: [7.6, 14.75], costPerFloor: 3, waitCost: 24 },
    { id: 'L2', name: 'Lift 2', kind: 'lift', rect: r(7.6, 9.8, 16.1, 18.8), door: [7.6, 17.45], costPerFloor: 3, waitCost: 24 },
  ];

  return { name: 'Academic Block III', campus: 'St Joseph Engineering College', FLOOR_HEIGHT, grid: G, corridors, outline, floors, connectors };
})();
