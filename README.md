# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

You can also install [eslint-plugin-react-x](https://npmx.dev/package/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://npmx.dev/package/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

## HospiNav outdoor navigation

The Outdoor Navigation view uses the browser Geolocation API for live GPS
updates and React Leaflet for the OpenStreetMap view. Location access requires
user permission and a secure context (HTTPS, or localhost during development).
The app requests location on launch and shares tracking across its navigation
views. Tracking stops when the user stops it or closes/unmounts the app.

Add **verified entrance coordinates** for the campus buildings in
`src/data/hospitalOutdoorData.ts`. Coordinates are intentionally unset until
the hospital's actual building locations are known; outdoor building markers
and building-to-building directions are unavailable for entries without them.
Do not use the 3D illustration's positions as geographic coordinates.

Walking routes are requested from the community OpenStreetMap foot-routing
service at `routing.openstreetmap.de`; no API key is embedded in the frontend.
The service is external and its availability and usage limits are outside this
application. OpenStreetMap tile attribution is shown on the map.

The indoor 3D hospital map and its department wayfinding remain separate from
GPS. Indoor floor selection can use BLE when the browser exposes foreground
advertisement scanning and the hospital's beacon database is configured.
Browser BLE support is limited: Web Bluetooth is not available in every
browser, needs a secure context and user permission, and does not provide
unrestricted/background scanning. In particular, ordinary browser pages cannot
reliably scan all nearby iBeacon advertisements. For production deployments,
use a supported native Android BLE scanner and provide readings through the
`BeaconScannerAdapter` contract in `src/services/indoorPositioningService.ts`.

Before deploying automatic positioning:

1. Install BLE beacons on each intended floor. Survey their actual UUID, major,
   minor, building, and floor; then configure them in
   `src/data/bleBeaconData.ts`. Use consistent transmit power and placement,
   and validate the RSSI calibration throughout corridors and stair/lift areas.
2. Tune and field-test the confidence/stability policy in
   `src/services/floorDetectionService.ts`. The current confidence is a
   signal-ranking heuristic, not a guarantee of physical location.
3. Use a native Wi-Fi scanner to collect calibrated access-point identifiers
   and RSSI, configure them in `src/data/wifiAccessPointData.ts`, and deploy a
   positioning backend. Set `VITE_INDOOR_WIFI_ENDPOINT` to its HTTPS endpoint.
   The backend must validate requests and return a known `buildingId`, `floor`,
   and confidence in the documented response shape in
   `src/services/wifiPositioningService.ts`. A native adapter can submit calibrated
   readings through `useIndoorPosition().submitWiFiReadings`; the same confidence
   and stability gate then controls map updates. Do not put backend secrets in
   frontend environment variables.
4. Replace the illustrative sample floor layouts with surveyed floor plans and
   map coordinates before presenting room-level user positions. Current
   detection is building/floor-level only; it does not invent an in-room dot.

The Indoor Positioning panel includes a clearly labelled **SIMULATED POSITION**
mode to test stable floor/building changes, weak readings, conflicting floor
signals, and manual override without physical hardware. Sample readings are generated only
inside the simulator and are never presented as live BLE/Wi-Fi readings.
Selecting a building/floor manually overrides automatic switching until
automatic detection is resumed. GPS remains an outdoor-only signal and is not
used to identify indoor floors.

Run `npm run dev` for local development, `npm run lint` for linting, and
`npm run build` for the production TypeScript/Vite build.

## Patient requirements and voice navigation

### English and Kannada

The header language selector switches the existing interface between English
and Kannada without reloading. English is used for first-time visitors; the
selection is saved in `localStorage` and restored on the next visit. Shared
translations live in `src/locales/en.json` and `src/locales/kn.json`, and
components access them through `useLanguage`.

The patient assistant matches English and Kannada service requests against the
configured department catalog while retaining the original department and
route IDs. When an AI requirements endpoint is configured, its request includes
the selected response language. Voice recognition requests `en-IN` or `kn-IN`
from the browser, and route announcements use the same selected language. If a
Kannada speech voice is not installed, the Kannada directions remain available
on screen.

The Indoor Navigation screen includes a text/voice requirement panel. Its
rule-based fallback maps requests only to `hospitalDepartments` entries in
`src/data/hospitalMapData.ts`. The current catalog does not contain individual
doctors, appointment availability, or all possible hospital services; the UI
asks for clarification or reports no match rather than inventing them.
Recommendations are navigation assistance only, not medical advice.

Configure operational visit prerequisites in
`src/services/hospitalWorkflowService.ts`. Keep this list empty until the
hospital confirms the workflow.

The current map catalog contains building/floor labels and department room
numbers. The 3D floor spaces are generated sample placements; they do not
contain surveyed corridors, junctions, entrances, lift or stair locations, or
walkable connections. They cannot support valid indoor directions by
themselves. The former route implementation guessed floor and building links;
those assumptions have been removed.

Indoor routing now runs Dijkstra only over explicitly configured edges in
`src/data/hospitalRouteGraphData.ts`. That file intentionally starts with an
empty graph. Before enabling directions, the hospital must provide:

- surveyed route nodes for corridor segments, intersections, entrances,
  elevator/stair landings, and department entrances;
- surveyed, positive distances and only physically walkable edges, including
  approved floor/building transitions;
- verified travel direction for each edge (`bidirectional` or forward-only);
- department node IDs linked to existing department IDs;
- accessible flags for each connection, based on a facilities review;
- exact route-origin nodes, linked to calibrated BLE/Wi-Fi positioning IDs or
  selected by the user as a confirmed starting point;
- optional 3D map positions and surveyed corridor polylines, including each
  segment's endpoints, in the verified floor-plan coordinate system before a
  path is drawn on the 3D map.

The 3D map also allows placing a blue, visual-only start marker by selecting
“Place start point on map” and clicking an open floor area. It is an approximate
point on the illustrative model, is not saved as a route node, and never enables
route calculation or represents a detected physical location.

For demonstrations, the Indoor Navigation assistant has an opt-in
“Use sample starting point” mode. It provides simulated entrances, corridors,
elevators, campus transitions, and example routes to the configured directory.
The sample graph is isolated from the surveyed route graph and the interface
labels its paths and instructions as simulated. It must not be used to guide
real patients or treated as a surveyed representation of the hospital.

Route graph validation rejects unknown node references, invalid distances,
unmarked floor changes, and unmarked building transitions. The Accessible
route option searches only edges marked accessible. If no confirmed origin or
configured graph route exists, the app still displays catalog-matched
destinations and workflow order, but disables starting the journey and does
not draw a fabricated route.

When graph data is available, route stops are ordered by measured graph
distance while respecting configured workflow prerequisites. Turn
instructions require surveyed path geometry; without it, instructions only
name configured graph connections and do not infer left/right turns.
The Indoor Navigation assistant can navigate to catalog destinations, find a
configured nearest elevator, or route to an elevator landing on a named floor.
It renders the current route's surveyed corridor geometry and transition
markers on the existing 3D map. BLE/Wi-Fi route recalculation occurs when a
confidence-gated reading maps to a different configured graph node; it cannot
provide continuous room-level movement unless the hospital deploys calibrated
positioning nodes and floor-plan coordinates. Arrival is announced only when
the final route node has a matching configured positioning ID and confidence
meets the detection threshold. Route distance is shown from measured graph
edges; estimated travel time is omitted because no walking-speed model is
configured.
The requirement understanding and route orchestration are centralized in
`src/services/aiNavigationAssistant.ts`; intent matching, AI fallback, and
workflow configuration remain in their existing reusable services.

No AI backend was present in the project. To enable one, set
`VITE_PATIENT_REQUIREMENTS_ENDPOINT` to an HTTPS endpoint managed by your
organization. The frontend sends the user's text and the configured department
catalog; the backend must return JSON in this shape:

```json
{
  "departmentIds": [3, 5],
  "clarification": null,
  "rationale": "Matched configured services."
}
```

Only IDs already present in the department catalog are accepted. If the
endpoint is unset or unavailable, the UI labels results as rule-based fallback.
Keep credentials and private AI-provider keys on the backend, never in Vite
frontend environment variables. User text may contain sensitive information;
avoid entering personal identifiers or medical details, and review the
organization's backend privacy and retention policy before enabling it.

Voice recognition uses `SpeechRecognition` or
`webkitSpeechRecognition` when supported; browser implementations and
microphone permission requirements vary. Some browser speech services send
audio to their provider. A text input and command processor remain available
when speech recognition is unsupported or permission is denied. Speech
synthesis speaks one route step at a time as configured positioning nodes
confirm progress, and announces confirmed BLE/Wi-Fi floor changes. Commands
include destination search, “Find the nearest lift”, “How do I reach the
second floor?”, repeat, pause, resume, and stop. Multilingual support can be
selected in the app header; the assistant requests `en-IN` and `kn-IN` voice
recognition according to that selection.

Requirement matching normalizes text, handles common English/Kannada service
phrases and spelling variants, splits conjunctions and sentences into multiple
requested stops, and emits structured requirement records with match confidence
and clarification status. The match vocabulary is mapped only to configured
department records in `hospitalMapData.ts`; it is not a clinical classifier.
The current project has no live hospital database integration, so this
configured directory is the authoritative local catalog. If the optional
requirements endpoint is configured, it receives the same catalog and its
suggestions are restricted to IDs from those records. Configured workflow
prerequisites and the existing indoor route planner remain responsible for
ordering and route readiness; no workflow or route is inferred by language
matching.

The assistant text matcher supports English and Kannada aliases. The selected
language requests `en-IN` or `kn-IN` from browser speech recognition and speech
synthesis; actual Kannada voice support depends on the browser and installed
device voices. Typed input remains available regardless of browser voice
support.

## Automatic position detection

The app starts a browser `watchPosition` GPS session after launch and shares
that fix with the outdoor map. The user can retry or stop tracking. GPS
coordinates and accuracy are browser readings. The supplied Father Muller
Medical College coordinate (12.8660778, 74.8623117) is configured as a campus
reference point. A configurable 250 m circle around it is only an approximate
proximity area, not a surveyed property boundary. Its inside/outside result
accounts for the reported GPS accuracy; fixes with accuracy over 50 m or fixes
whose uncertainty overlaps the circle boundary are not classified. Entry and
exit transitions require consecutive accurate fixes and describe only crossing
that proximity circle, not confirmed physical entry into the hospital.
The proximity radius and maximum usable GPS accuracy are configurable in
`src/data/hospitalOutdoorData.ts`.

The map displays the campus reference and approximate circle separately from
building markers. No building entrance coordinates are configured, so GPS
cannot identify a building or floor, and outdoor building-to-building routing
is unavailable until entrances are surveyed.

Automatic route-origin matching accepts only:

- Fresh, confidence-qualified BLE/Wi-Fi readings that match an explicitly
  configured walkable route node; or
- A high-accuracy GPS fix close to an entrance node with surveyed geographic
  coordinates.

The Real Hospital Mode uses only the configured real route graph and genuine
GPS/BLE/Wi-Fi readings. The real indoor route graph is intentionally empty
until the hospital supplies surveyed nodes and walkable connections. GPS
building entrances, BLE beacon records, and Wi-Fi access-point records also
remain unconfigured. If no reliable route node is matched, Start Journey
remains disabled. Manual building/floor selection is labelled as a selection,
not detected positioning, and cannot make an unverified route ready.

Demo Mode uses a separate simulated route graph and simulated distances; it is
explicitly labelled and is never treated as real hospital routing. Simulated
indoor positioning controls are available only in Demo Mode, and switching
back to Real Hospital Mode clears simulated position estimates. The local
department directory is not connected to a live hospital database and has not
been independently verified against current hospital records. No hospital-
approved workflow prerequisites are configured.

Browser GPS works on HTTPS or localhost after permission is granted. Ordinary
web pages cannot reliably perform background BLE or Wi-Fi scanning. BLE
automatic startup is available only through the optional native host bridge
`window.hospiNavPositioning.startBLEScan`; a native host must provide genuine
readings corresponding to configured beacon IDs. Wi-Fi positioning likewise
requires a calibrated native scanner and configured backend. Neither indoor
floor detection nor automatic route readiness can be verified without those
surveys, integrations, and physical hardware. The current building/floor
catalog is not a surveyed seven-floor navigation dataset; do not infer missing
floors or inter-building routes from the illustrative 3D layout.
