# Block III Navigator (web version)

Indoor navigation for Academic Block III, SJEC. Opens in any phone browser:
pick where you are and where you want to go, then tap **Start walking** and
a blue dot follows you along the route as you walk.

## Files

| File | What it is |
|---|---|
| `index.html` | The page: layout, styles, and the libraries it loads |
| `data/block3.js` | **The map.** Floors, rooms, corridors, stairs, lifts in metres |
| `js/graph.js` | Route finding and turn-by-turn directions |
| `js/app.js` | 3D view, search boxes, floor buttons, QR code sheet |
| `js/tracking.js` | **Live tracking by counting footsteps** (phone motion sensor) |

## How the live tracking works

1. The phone's accelerometer reports movement about 60 times a second.
2. Each footstep makes a small bounce. Every bounce bigger than the threshold = 1 step.
3. Each step moves the dot forward along the route by the step length (default 0.70 m).
   The dot is locked to the route line, so it always stays in the corridor.
4. At a lift or staircase the dot waits (steps on the stairs don't move it).
   Tap **"I'm on floor X"** when you arrive.
5. If the dot drifts, tap the direction you're actually at in the list to snap it there,
   or scan the nearest door's QR code.

Tuning: if the dot runs ahead, make the step length shorter; if it lags, make it longer.
If steps are missed, choose **Light steps**; if it counts steps while standing, choose **Firm steps**.

Testing on a laptop: there's no motion sensor, so a **+1 step** button appears
(or press Space / ↑).

Needs HTTPS (GitHub Pages is fine). iPhones ask for "Motion & Orientation" permission when you tap Start walking.

## Put it online

Copy this `docs` folder into the root of the `HospiNavi` repo, then
`git add docs`, `git commit -m "..."`, `git push`. GitHub Pages serves it at
`https://athithijain21.github.io/HospiNavi/`.
