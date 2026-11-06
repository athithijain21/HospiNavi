import en from "../locales/en.json";
import kn from "../locales/kn.json";

export type Language = "en" | "kn";
export type TranslationKey = keyof typeof en;
type TranslationValues = Record<string, string | number>;

const dictionaries: Record<Language, Record<string, string>> = { en, kn };

export function translateText(
  key: string,
  language: Language,
  values: TranslationValues = {},
) {
  let text = dictionaries[language][key] ?? translateDynamicText(key, language);
  for (const [name, value] of Object.entries(values)) {
    text = text.replaceAll(`{{${name}}}`, String(value));
  }
  return text;
}

function translateDynamicText(text: string, language: Language) {
  if (language === "en") return text;
  const reasonSeparator = text.indexOf(": ");
  if (reasonSeparator > 0) {
    const departmentName = text.slice(0, reasonSeparator);
    if (departmentName in kn) {
      return `${translateText(departmentName, language)}: ${translateText(text.slice(reasonSeparator + 2), language)}`;
    }
  }
  const patterns: [RegExp, (match: RegExpMatchArray) => string][] = [
    [/^I could not match “(.+)” to a configured department or facility\. Please clarify the service or ask hospital staff\.$/u, (m) => `“${m[1]}” ವಿನಂತಿಗೆ ಹೊಂದುವ ಸಂರಚಿಸಿದ ವಿಭಾಗ ಅಥವಾ ಸೌಲಭ್ಯ ಸಿಗಲಿಲ್ಲ. ಸೇವೆಯನ್ನು ಸ್ಪಷ್ಟಪಡಿಸಿ ಅಥವಾ ಆಸ್ಪತ್ರೆಯ ಸಿಬ್ಬಂದಿಯನ್ನು ಕೇಳಿ.`],
    [/^I matched a general consultation to General Medicine\. Did you mean a specific configured specialty\?$/u, () => "ಸಾಮಾನ್ಯ ವೈದ್ಯಕೀಯ ವಿಭಾಗಕ್ಕೆ ಸಾಮಾನ್ಯ ಸಲಹೆಯನ್ನು ಹೊಂದಿಸಲಾಗಿದೆ. ನೀವು ನಿರ್ದಿಷ್ಟ ಸಂರಚಿಸಿದ ವಿಶೇಷ ವಿಭಾಗವನ್ನು ಉದ್ದೇಶಿಸಿದ್ದೀರಾ?"],
    [/^Which configured destination did you mean(?:: (.+))?\?$/u, (m) => `ನೀವು ಯಾವ ಸಂರಚಿಸಿದ ಗಮ್ಯಸ್ಥಾನವನ್ನು ಉದ್ದೇಶಿಸಿದ್ದೀರಿ${m[1] ? `: ${m[1].split(", ").map((name) => translateText(name, language)).join(", ")}` : ""}?`],
    [/^Indoor location detected · Building (.+) · (.+)$/u, (m) => `ಒಳಾಂಗಣ ಸ್ಥಳ ಪತ್ತೆಯಾಗಿದೆ · ಕಟ್ಟಡ ${m[1]} · ${translateText(m[2], language)}`],
    [/^Outdoor GPS matched to (.+) · Building (.+)$/u, (m) => `ಹೊರಾಂಗಣ GPS ${translateText(m[1], language)} ಗೆ ಹೊಂದಿದೆ · ಕಟ್ಟಡ ${m[2]}`],
    [/^GPS places you within the approximate (.+) \((.+) m radius\); this does not confirm physical entry or a building$/u, (m) => `GPS ಪ್ರಕಾರ ನೀವು ಅಂದಾಜು ${m[1]} ಸಮೀಪದಲ್ಲಿದ್ದೀರಿ (${m[2]} ಮೀ ವ್ಯಾಪ್ತಿ); ಇದು ಆಸ್ಪತ್ರೆ ಪ್ರವೇಶ ಅಥವಾ ಕಟ್ಟಡವನ್ನು ದೃಢೀಕರಿಸುವುದಿಲ್ಲ`],
    [/^GPS places you outside the approximate (.+) \((.+) m from its reference point\)$/u, (m) => `GPS ಪ್ರಕಾರ ನೀವು ಅಂದಾಜು ${m[1]} ಪ್ರದೇಶದ ಹೊರಗಿದ್ದೀರಿ (ಉಲ್ಲೇಖ ಬಿಂದುವಿನಿಂದ ${m[2]} ಮೀ)`],
    [/^GPS accuracy overlaps the approximate campus boundary; entry is unconfirmed \(±(.+) m\)$/u, (m) => `GPS ನಿಖರತೆ ಅಂದಾಜು ಆವರಣದ ಗಡಿಯನ್ನು ದಾಟುತ್ತದೆ; ಪ್ರವೇಶ ದೃಢೀಕರಿಸಿಲ್ಲ (±${m[1]} ಮೀ)`],
    [/^GPS available · no hospital proximity area is configured$/u, () => "GPS ಲಭ್ಯವಿದೆ · ಆಸ್ಪತ್ರೆಯ ಸಮೀಪ ಪ್ರದೇಶವನ್ನು ಸಂರಚಿಸಿಲ್ಲ"],
    [/^GPS available · waiting for a fresh, accurate fix to classify campus proximity$/u, () => "GPS ಲಭ್ಯವಿದೆ · ಆವರಣದ ಸಮೀಪವನ್ನು ನಿರ್ಧರಿಸಲು ಹೊಸ ನಿಖರ ಸ್ಥಳಕ್ಕಾಗಿ ಕಾಯಲಾಗುತ್ತಿದೆ"],
    [/^GPS tracking stopped · showing the last known fix$/u, () => "GPS ಟ್ರ್ಯಾಕಿಂಗ್ ನಿಲ್ಲಿಸಲಾಗಿದೆ · ಕೊನೆಯದಾಗಿ ತಿಳಿದ ಸ್ಥಳವನ್ನು ತೋರಿಸಲಾಗುತ್ತಿದೆ"],
    [/^GPS tracking stopped · last fix is not a live location$/u, () => "GPS ಟ್ರ್ಯಾಕಿಂಗ್ ನಿಲ್ಲಿಸಲಾಗಿದೆ · ಕೊನೆಯ ಸ್ಥಳವು ಪ್ರಸ್ತುತ ಸ್ಥಳವಲ್ಲ"],
    [/^Detecting your location…$/u, () => "ನಿಮ್ಮ ಸ್ಥಳವನ್ನು ಪತ್ತೆಹಚ್ಚಲಾಗುತ್ತಿದೆ…"],
    [/^Waiting for a fresh GPS location fix$/u, () => "ಹೊಸ GPS ಸ್ಥಳಕ್ಕಾಗಿ ಕಾಯಲಾಗುತ್ತಿದೆ"],
    [/^Detecting indoor location…$/u, () => "ಒಳಾಂಗಣ ಸ್ಥಳವನ್ನು ಪತ್ತೆಹಚ್ಚಲಾಗುತ್ತಿದೆ…"],
    [/^Waiting for a reliable indoor location$/u, () => "ವಿಶ್ವಾಸಾರ್ಹ ಒಳಾಂಗಣ ಸ್ಥಳಕ್ಕಾಗಿ ಕಾಯಲಾಗುತ್ತಿದೆ"],
    [/^Indoor positioning unavailable$/u, () => "ಒಳಾಂಗಣ ಸ್ಥಳ ಪತ್ತೆ ಲಭ್ಯವಿಲ್ಲ"],
    [/^Waiting for a reliable location$/u, () => "ವಿಶ್ವಾಸಾರ್ಹ ಸ್ಥಳಕ್ಕಾಗಿ ಕಾಯಲಾಗುತ್ತಿದೆ"],
    [/^GPS available · accuracy ±(.+) m is too low to classify campus proximity$/u, (m) => `GPS ಲಭ್ಯವಿದೆ · ±${m[1]} ಮೀ ನಿಖರತೆ ಆವರಣದ ಸಮೀಪವನ್ನು ನಿರ್ಧರಿಸಲು ಸಾಲದು`],
    [/^Latitude: (.+)$/u, (m) => `ಅಕ್ಷಾಂಶ: ${m[1]}`],
    [/^Longitude: (.+)$/u, (m) => `ರೇಖಾಂಶ: ${m[1]}`],
    [/^Last fix: (.+)$/u, (m) => `ಕೊನೆಯ ಸ್ಥಳ: ${m[1]}`],
  ];
  for (const [pattern, render] of patterns) {
    const match = text.match(pattern);
    if (match) return render(match);
  }
  return text;
}

export function translateDepartmentName(name: string, language: Language) {
  return translateText(name, language);
}

export function translateNavigationText(text: string, language: Language) {
  if (language === "en") return text;
  const commandResponses: [RegExp, (match: RegExpMatchArray) => string][] = [
    [
      /^No surveyed elevator route to (.+) is available from the confirmed starting point\.$/u,
      (match) => `ದೃಢೀಕರಿಸಿದ ಪ್ರಾರಂಭದ ಸ್ಥಳದಿಂದ ${translateText(match[1], language)} ಗೆ ಸಮೀಕ್ಷಿತ ಲಿಫ್ಟ್ ಮಾರ್ಗ ಲಭ್ಯವಿಲ್ಲ.`,
    ],
    [
      /^I found multiple configured destinations: (.+)\. Please specify the department and building you want\.$/u,
      (match) => `ಹಲವು ಸಂರಚಿಸಿದ ಗಮ್ಯಸ್ಥಾನಗಳು ಕಂಡುಬಂದಿವೆ: ${match[1].split("; ").map((item) => {
        const [name, building, floor, room] = item.split(", ");
        return `${translateText(name, language)}, ${building}, ${translateText(floor, language)}, ${translateText(room, language)}`;
      }).join("; ")}. ದಯವಿಟ್ಟು ವಿಭಾಗ ಮತ್ತು ಕಟ್ಟಡವನ್ನು ನಿರ್ದಿಷ್ಟಪಡಿಸಿ.`,
    ],
    [
      /^Your selected location is building (.+), (.+)\.$/u,
      (match) => `ನೀವು ಆಯ್ಕೆ ಮಾಡಿದ ಸ್ಥಳ: ಕಟ್ಟಡ ${match[1]}, ${translateText(match[2], language)}.`,
    ],
    [
      /^You are in building (.+), (.+)\.$/u,
      (match) => `ನೀವು ಕಟ್ಟಡ ${match[1]}, ${translateText(match[2], language)} ಯಲ್ಲಿದ್ದೀರಿ.`,
    ],
    [
      /^Simulated location: building (.+), (.+)\. This is not your actual location\.$/u,
      (match) => `ಅನುಕರಿಸಿದ ಸ್ಥಳ: ಕಟ್ಟಡ ${match[1]}, ${translateText(match[2], language)}. ಇದು ನಿಮ್ಮ ನೈಜ ಸ್ಥಳವಲ್ಲ.`,
    ],
    [
      /^Your selected floor is (.+), building (.+)\.$/u,
      (match) => `ನೀವು ಆಯ್ಕೆ ಮಾಡಿದ ಮಹಡಿ ${translateText(match[1], language)}, ಕಟ್ಟಡ ${match[2]}.`,
    ],
    [
      /^You are on (.+), building (.+)\.$/u,
      (match) => `ನೀವು ಕಟ್ಟಡ ${match[2]} ರ ${translateText(match[1], language)} ಯಲ್ಲಿದ್ದೀರಿ.`,
    ],
    [
      /^Starting directions to (.+), (.+), (.+), room (.+)\.$/u,
      (match) => `${translateText(match[1], language)} ಗೆ ಮಾರ್ಗದರ್ಶನ ಪ್ರಾರಂಭಿಸಲಾಗುತ್ತಿದೆ; ಕಟ್ಟಡ ${match[2]}, ${translateText(match[3], language)}, ಕೊಠಡಿ ${match[4]}.`,
    ],
    [
      /^(.+) is selected, but no verified indoor route is available from the confirmed starting point\.$/u,
      (match) => `${translateText(match[1], language)} ಆಯ್ಕೆಮಾಡಲಾಗಿದೆ, ಆದರೆ ದೃಢೀಕರಿಸಿದ ಪ್ರಾರಂಭದ ಸ್ಥಳದಿಂದ ಪರಿಶೀಲಿತ ಒಳಾಂಗಣ ಮಾರ್ಗ ಲಭ್ಯವಿಲ್ಲ.`,
    ],
    [
      /^Navigation stopped\.$/u,
      () => "ಮಾರ್ಗದರ್ಶನ ನಿಲ್ಲಿಸಲಾಗಿದೆ.",
    ],
  ];
  for (const [pattern, render] of commandResponses) {
    const match = text.match(pattern);
    if (match) return render(match);
  }
  const elevator = text.match(
    /^(SAMPLE ROUTE: Take the simulated elevator|Take the elevator) from (.+) to (.+) in building (.+?)(?: via (.+))?\.$/u,
  );
  if (elevator) {
    return `${elevator[1].startsWith("SAMPLE")
      ? "ಮಾದರಿ ಮಾರ್ಗ: ಅನುಕರಿಸಿದ ಲಿಫ್ಟ್‌ನಲ್ಲಿ"
      : "ಲಿಫ್ಟ್‌ನಲ್ಲಿ"} ${translateText(elevator[2], language)} ಇಂದ ${translateText(elevator[3], language)} ಗೆ, ಕಟ್ಟಡ ${elevator[4]} ನಲ್ಲಿ ಹೋಗಿ${elevator[5] ? ` (${elevator[5]})` : ""}.`;
  }
  const stairs = text.match(
    /^(SAMPLE ROUTE: Use the simulated stairs|Use the stairs) from (.+) to (.+) in building (.+?)(?: via (.+))?\.$/u,
  );
  if (stairs) {
    return `${stairs[1].startsWith("SAMPLE")
      ? "ಮಾದರಿ ಮಾರ್ಗ: ಅನುಕರಿಸಿದ ಮೆಟ್ಟಿಲುಗಳನ್ನು"
      : "ಮೆಟ್ಟಿಲುಗಳನ್ನು"} ಬಳಸಿ ${translateText(stairs[2], language)} ಇಂದ ${translateText(stairs[3], language)} ಗೆ, ಕಟ್ಟಡ ${stairs[4]} ನಲ್ಲಿ ಹೋಗಿ${stairs[5] ? ` (${stairs[5]})` : ""}.`;
  }
  const arrival = text.match(/^(You have arrived at|SAMPLE ROUTE: Simulated destination reached) (.+)\.$/u);
  if (arrival) {
    return `${arrival[1].startsWith("SAMPLE") ? "ಮಾದರಿ ಮಾರ್ಗ: ಅನುಕರಿಸಿದ ಗಮ್ಯಸ್ಥಾನ ತಲುಪಲಾಗಿದೆ" : "ಗಮ್ಯಸ್ಥಾನ ತಲುಪಲಾಗಿದೆ"}: ${arrival[2]}.`;
  }
  const corridor = text.match(/^(.*?) (along the surveyed corridor|into the configured corridor connection)(?: via (.+))?\.$/u);
  if (corridor) {
    const turns = corridor[1].split(" and ").map((turn) => {
      const label = turn.trim().toLowerCase();
      return label === "turn left" ? "ಎಡಕ್ಕೆ ತಿರುಗಿ" : label === "turn right" ? "ಬಲಕ್ಕೆ ತಿರುಗಿ" : label === "continue straight" ? "ನೇರವಾಗಿ ಮುಂದುವರಿಯಿರಿ" : translateText(turn, language);
    }).join(" ಮತ್ತು ");
    const via = corridor[3] ? ` (${corridor[3]})` : "";
    return `${turns ? `${turns} ` : ""}${translateText(corridor[2], language)}${via}.`;
  }
  const connection = text.match(/^Follow the configured corridor connection from (.+) to (.+)\.(.*)$/u);
  if (connection) {
    return `${translateText("Follow the configured corridor connection", language)} ${connection[1]} ಇಂದ ${connection[2]} ಗೆ.${connection[3]}`;
  }
  const samplePath = text.match(/^SAMPLE ROUTE: Follow the illustrative map path from (.+) to (.+)\.(.*)$/u);
  if (samplePath) {
    return `${translateText("Follow the illustrative map path", language)} ${samplePath[1]} ಇಂದ ${samplePath[2]} ಗೆ.${samplePath[3]}`;
  }
  const building = text.match(/^(Follow the configured building connection|SAMPLE ROUTE: Follow the simulated campus connection) from (.+) to (.+)\.(.*)$/u);
  if (building) {
    return `${translateText(building[1], language)} ${building[2]} ಇಂದ ${building[3]} ಗೆ.${building[4]}`;
  }
  const straight = text.match(/^Continue along the surveyed corridor(?: via (.+))?\.$/u);
  if (straight) return `ಸಮೀಕ್ಷಿತ ಕಾರಿಡಾರ್‌ನಲ್ಲಿ ನೇರವಾಗಿ ಮುಂದುವರಿಯಿರಿ${straight[1] ? ` (${straight[1]})` : ""}.`;
  return translateText(text, language);
}
