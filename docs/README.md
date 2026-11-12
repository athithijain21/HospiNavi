# Block III Navigator (web version)

Indoor navigation for Academic Block III, SJEC. Opens in any phone browser:
pick where you are, pick where you want to go, and follow the route on a 3D
model of the block, with step-by-step directions across all 8 floors.

## Files

| File | What it is |
|---|---|
| `index.html` | The page: layout, styles, and the libraries it loads |
| `data/block3.js` | **The map.** Every floor, room, corridor, staircase and lift, in metres. Edit this to fix names or add room numbers. |
| `js/graph.js` | Route finding (Dijkstra) and the turn-by-turn directions. No 3D code, so it can be reused for live tracking later. |
| `js/app.js` | The 3D view (Three.js), search boxes, floor buttons and QR code sheet. |

## Run it on your laptop

Open the folder in VS Code, install the **Live Server** extension, right-click
`index.html` → **Open with Live Server**.

## Put it online (free, GitHub Pages)

1. Copy this `docs` folder into the root of the `HospitalNavi` repo.
2. `git add docs` → `git commit -m "Add web navigator"` → `git push`
3. On GitHub: **Settings → Pages → Source: Deploy from a branch → Branch: `main`, folder: `/docs` → Save**.
4. After a minute it is live at `https://athithijain21.github.io/HospitalNavi/`.

## QR codes

Click **QR codes** in the app, pick a floor and print the sheet. Each code opens
the site with that room already set as the starting point
(`?from=6-T1`). Stick each one next to its door. Lifts and both staircases get codes too.

## Fixing the map data

Open `data/block3.js`:

- `name` – what the room is called on the app
- `no` – the real room number (e.g. `'3605'`); add it and people can search by number
- `verify: true` – the name came from the architect's drawing and should be checked on site
- `door` – where the room's door is, `[x, y]` in metres

## Live tracking later

`js/app.js` exposes `window.BlockNav.setPosition({ floor: '6', x: 20, y: 11.6 })`.
A step counter, Wi-Fi/BLE positioning or the Unity AR app can call this to move
the start point and re-route as the person walks.
