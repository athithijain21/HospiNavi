import assert from "node:assert/strict";
import fs from "node:fs";

const localeFiles = ["en", "kn", "hi", "ml"].map(
  (language) => `src/locales/${language}.json`,
);
const locales = localeFiles.map((file) => JSON.parse(fs.readFileSync(file, "utf8")));
const keys = Object.keys(locales[0]).sort();
for (const locale of locales.slice(1)) {
  assert.deepEqual(Object.keys(locale).sort(), keys, "Locale keys must stay in sync");
}

const mapData = fs.readFileSync("src/data/hospitalMapData.ts", "utf8");
for (const department of ["Emergency", "Laboratory", "Radiology", "Pharmacy", "Billing Counter"]) {
  assert.ok(mapData.includes(`name: "${department}"`), `Missing configured destination: ${department}`);
}

const outdoor = fs.readFileSync(
  "src/components/outdoor-navigation/OutdoorNavigation.tsx",
  "utf8",
);
assert.match(outdoor, /router\.project-osrm\.org/);
assert.match(outdoor, /Retry road route/);
console.log("Reliability checks passed.");
