import type { HospitalDepartment } from "../data/hospitalMapData";
import {
  orderDepartmentsByWorkflow,
  type HospitalWorkflow,
} from "./hospitalWorkflowService";
import {
  recognizeNavigationIntent,
  type NavigationIntent,
} from "./intentRecognitionService";

export type RequirementPlan = {
  departmentIds: number[];
  clarification: string | null;
  rationale: string;
  workflowNote: string;
  intent: "navigation" | "service-request" | "multi-stop" | "unknown";
  requirements: StructuredRequirement[];
};

export type StructuredRequirement = {
  requestedText: string;
  departmentId: number | null;
  departmentName: string | null;
  intent: "consultation" | "diagnostic" | "facility" | "department" | "unknown";
  confidence: number;
  matchedTerms: string[];
  status: "matched" | "ambiguous" | "unmatched" | "workflow-prerequisite";
  candidateDepartmentIds: number[];
};

export type RequirementAnalysis = {
  plan: RequirementPlan;
  source: "ai-backend" | "rule-based";
  backendMessage?: string;
};

type BackendPlan = {
  departmentIds?: unknown;
  clarification?: unknown;
  rationale?: unknown;
  intent?: unknown;
  requirements?: unknown;
};

function getSecureRequirementEndpoint(endpoint: string) {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://localhost";
  let url: URL;
  try {
    url = new URL(endpoint, origin);
  } catch {
    throw new Error("Requirement backend URL is invalid.");
  }
  const isLocalDevelopmentHost = ["localhost", "127.0.0.1", "[::1]"].includes(
    url.hostname,
  );
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLocalDevelopmentHost)) {
    throw new Error(
      "Requirement backend must use HTTPS. HTTP is allowed only for localhost development.",
    );
  }
  return url.toString();
}

export type PatientRequirementOptions = {
  endpoint?: string;
  fetcher?: typeof fetch;
  workflows?: HospitalWorkflow[];
};
type RequirementLanguage = "en" | "kn";

const departmentAliases: Record<string, string[]> = {
  "General Medicine": [
    "general medicine", "general physician", "doctor", "physician", "consult",
    "consultation", "medical consultation", "ವೈದ್ಯರು", "ವೈದ್ಯರನ್ನು", "ಡಾಕ್ಟರ್",
    "ಸಾಮಾನ್ಯ ವೈದ್ಯಕೀಯ", "ವೈದ್ಯರನ್ನು ಭೇಟಿ",
  ],
  Laboratory: [
    "laboratory", "lab", "blood test", "blood work", "test sample", "blood check",
    "ರಕ್ತ ಪರೀಕ್ಷೆ", "ರಕ್ತ ತಪಾಸಣೆ", "ಪ್ರಯೋಗಾಲಯ", "ಲ್ಯಾಬ್", "ರಕ್ತ ಪರೀಕ್ಷೆ ಮಾಡಿಸಬೇಕು",
  ],
  Radiology: [
    "radiology", "x-ray", "xray", "imaging", "scan", "ಮೆಡಿಕಲ್ ಸ್ಕ್ಯಾನ್",
    "ಎಕ್ಸ್ ರೇ", "ಎಕ್ಸ್-ರೇ", "ಸ್ಕ್ಯಾನ್",     "ರೇಡಿಯಾಲಜಿ", "ವಿಕಿರಣಶಾಸ್ತ್ರ ವಿಭಾಗ",
  ],
  Cardiology: [
    "cardiology", "heart doctor", "heart specialist", "cardiologist",
    "ಹೃದಯ", "ಹೃದಯ ತಜ್ಞ", "ಹೃದಯ ವೈದ್ಯ", "ಕಾರ್ಡಿಯಾಲಜಿ", "ಹೃದ್ರೋಗ ವಿಭಾಗ",
  ],
  Neurology: [
    "neurology", "neurologist", "brain specialist", "ನರವಿಜ್ಞಾನ", "ನರರೋಗ",
    "ನರವೈದ್ಯ", "ನ್ಯೂರಾಲಜಿ", "ನರರೋಗ ವಿಭಾಗ",
  ],
  Emergency: [
    "emergency", "urgent care", "emergency room", "ತುರ್ತು", "ತುರ್ತು ವಿಭಾಗ",
    "ತುರ್ತು ಚಿಕಿತ್ಸೆ", "ತುರ್ತು ಚಿಕಿತ್ಸಾ ವಿಭಾಗ",
  ],
  Pharmacy: [
    "pharmacy", "medicine pickup", "prescription", "medicine", "medication",
    "drug store", "ಔಷಧಿ", "ಔಷಧಾಲಯ", "ಔಷಧಿ ಪಡೆಯಬೇಕು",
  ],
  "Billing Counter": [
    "billing counter", "billing", "bill payment", "pay bill", "payment counter",
    "ಬಿಲ್ಲಿಂಗ್", "ಬಿಲ್ಲಿಂಗ್ ವಿಭಾಗ", "ಬಿಲ್ ಪಾವತಿ", "ಹಣ ಪಾವತಿ", "ಬಿಲ್ ಕಟ್ಟಬೇಕು",
  ],
  Orthopaedics: [
    "orthopaedics", "orthopedics", "bone doctor", "bone specialist", "joint doctor",
    "ಮೂಳೆ", "ಮೂಳೆ ವೈದ್ಯ", "ಆರ್ಥೋಪೆಡಿಕ್ಸ್",
  ],
  Cafeteria: [
    "cafeteria", "food", "cafe", "canteen", "eat", "ಊಟ", "ಆಹಾರ", "ಕ್ಯಾಂಟೀನ್",
  ],
};

const stopWords = new Set([
  "i", "need", "want", "would", "like", "to", "the", "a", "an", "and", "then",
  "please", "take", "me", "find", "where", "is", "can", "get", "for", "my",
  "ನನಗೆ", "ಬೇಕು", "ಮತ್ತು", "ನಂತರ", "ದಯವಿಟ್ಟು", "ಗೆ", "ಒಂದು",
]);

type MatchCandidate = {
  department: HospitalDepartment;
  confidence: number;
  alias: string;
};

const normalizeText = (value: string) =>
  value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

function splitRequirements(input: string) {
  return input
    .normalize("NFKC")
    .toLocaleLowerCase()
    .split(/[.!?;,\n]+/u)
    .flatMap((sentence) =>
      sentence.split(/\s+(?:and then|then|and|also|ಮತ್ತು|ನಂತರ)\s+/u),
    )
    .map(normalizeText)
    .filter(Boolean);
}

function editSimilarity(left: string, right: string) {
  if (!left || !right) return 0;
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    let diagonal = previous[0];
    previous[0] = row;
    for (let column = 1; column <= right.length; column += 1) {
      const old = previous[column];
      previous[column] = Math.min(
        previous[column] + 1,
        previous[column - 1] + 1,
        diagonal + (left[row - 1] === right[column - 1] ? 0 : 1),
      );
      diagonal = old;
    }
  }
  return 1 - previous[right.length] / Math.max(left.length, right.length);
}

function aliasMatch(
  text: string,
  alias: string,
): number {
  const normalizedAlias = normalizeText(alias);
  const isKannada = /[\u0c80-\u0cff]/u.test(normalizedAlias);
  const phraseMatch = isKannada
    ? text.includes(normalizedAlias)
    : new RegExp(
        `(^|[^\\p{L}\\p{N}])${escapeRegex(normalizedAlias)}($|[^\\p{L}\\p{N}])`,
        "u",
      ).test(text);
  if (phraseMatch) {
    const genericAlias = ["doctor", "consult", "consultation", "ವೈದ್ಯರು"].includes(
      normalizedAlias,
    );
    return genericAlias ? 0.8 : 0.98;
  }
  const textTokens = text
    .split(" ")
    .filter((token) => token.length > 2 && !stopWords.has(token));
  const aliasTokens = normalizedAlias
    .split(" ")
    .filter((token) => token.length > 2 && !stopWords.has(token));
  if (isKannada || aliasTokens.length === 0) return 0;
  const best = aliasTokens.map((aliasToken) =>
    Math.max(
      ...textTokens.map((token) =>
        token.length >= 3 && aliasToken.length >= 4
          ? Math.max(
              editSimilarity(token, aliasToken),
              token.length >= 3 && aliasToken.startsWith(token) ? 0.82 : 0,
            )
          : 0,
      ),
      0,
    ),
  );
  const coverage = best.filter((score) => score >= 0.76).length / aliasTokens.length;
  if (aliasTokens.length > 1 && coverage < 1) return 0;
  const average = best.reduce((sum, score) => sum + score, 0) / best.length;
  const score = 0.58 + coverage * 0.22 + average * 0.15;
  return score >= 0.78 ? Math.min(score, 0.89) : 0;
}

function getCandidates(text: string, departments: HospitalDepartment[]) {
  const candidates: MatchCandidate[] = [];
  for (const department of departments) {
    const aliases = [
      department.name,
      ...(departmentAliases[department.name] ?? []),
    ];
    let best: MatchCandidate | null = null;
    for (const alias of aliases) {
      const confidence = aliasMatch(text, alias);
      if (confidence > (best?.confidence ?? 0)) {
        best = { department, confidence, alias };
      }
    }
    if (best) candidates.push(best);
  }
  return candidates.sort((left, right) => right.confidence - left.confidence);
}

function getRequirementIntent(department: HospitalDepartment | null): StructuredRequirement["intent"] {
  if (!department) return "unknown";
  if (department.category === "Facility") return "facility";
  if (["Diagnostic", "Laboratory"].includes(department.category)) return "diagnostic";
  if (department.category === "Consultation") return "consultation";
  return "department";
}

function getAnalysisIntent(
  input: string,
  requirements: StructuredRequirement[],
): RequirementPlan["intent"] {
  if (requirements.filter((requirement) => requirement.status === "matched").length > 1) {
    return "multi-stop";
  }
  if (/\b(take me|navigate|guide|where is|find|how do i reach)\b/u.test(normalizeText(input))) {
    return "navigation";
  }
  return requirements.some((requirement) => requirement.status === "matched")
    ? "service-request"
    : "unknown";
}

function clarifyUnresolvedRequirements(
  requirements: StructuredRequirement[],
  departments: HospitalDepartment[],
) {
  const ambiguous = requirements.filter((item) => item.status === "ambiguous");
  const unmatched = requirements.filter((item) => item.status === "unmatched");
  const messages: string[] = [];
  if (ambiguous.length > 0) {
    const candidates = [...new Set(
      ambiguous.flatMap((item) =>
        item.candidateDepartmentIds
          .map((id) => departments.find((department) => department.id === id)?.name)
          .filter((name): name is string => Boolean(name)),
      ),
    )];
    messages.push(
      `Which configured destination did you mean${candidates.length ? `: ${candidates.join(", ")}` : ""}?`,
    );
  }
  if (unmatched.length > 0) {
    messages.push(
      `I could not match “${unmatched.map((item) => item.requestedText).join("; ")}” to a configured department or facility. Please clarify the service or ask hospital staff.`,
    );
  }
  return messages.length > 0 ? messages.join(" ") : null;
}

function matchRequirements(
  input: string,
  departments: HospitalDepartment[],
): StructuredRequirement[] {
  const parts = splitRequirements(input);
  return parts.map((part) => {
    const asksForAnySpecialist =
      /\b(specialist|specialty|speciality)\b/u.test(part) ||
      part.includes("ತಜ್ಞ");
    const candidates = getCandidates(part, departments);
    const best = candidates[0];
    const hasSpecificMatch = Boolean(best && best.confidence >= 0.78);
    const asksForUnspecifiedTest =
      (/\b(test|diagnostic test)\b/u.test(part) || part.includes("ಪರೀಕ್ಷೆ")) &&
      !/(blood test|blood work|ರಕ್ತ ಪರೀಕ್ಷೆ|ರಕ್ತ ತಪಾಸಣೆ)/u.test(part);
    const contextualCandidates = !hasSpecificMatch && asksForAnySpecialist
      ? departments.filter((department) => department.category === "Speciality")
      : !hasSpecificMatch && asksForUnspecifiedTest
        ? departments.filter((department) => department.category === "Diagnostic")
        : [];
    if (contextualCandidates.length > 1) {
      return {
        requestedText: part,
        departmentId: null,
        departmentName: null,
        intent: "unknown",
        confidence: 0.8,
        matchedTerms: [asksForAnySpecialist ? "specialist" : "test"],
        status: "ambiguous",
        candidateDepartmentIds: contextualCandidates.map(
          (department) => department.id,
        ),
      };
    }
    if (contextualCandidates.length === 1) {
      const department = contextualCandidates[0];
      return {
        requestedText: part,
        departmentId: department.id,
        departmentName: department.name,
        intent: getRequirementIntent(department),
        confidence: 0.8,
        matchedTerms: [asksForAnySpecialist ? "specialist" : "test"],
        status: "matched",
        candidateDepartmentIds: [department.id],
      };
    }
    if (!best) {
      return {
        requestedText: part,
        departmentId: null,
        departmentName: null,
        intent: "unknown",
        confidence: 0,
        matchedTerms: [],
        status: "unmatched",
        candidateDepartmentIds: [],
      };
    }
    const closeMatches = candidates.filter(
      (candidate) =>
        candidate.confidence >= 0.78 &&
        best.confidence - candidate.confidence < 0.07,
    );
    if (closeMatches.length > 1) {
      return {
        requestedText: part,
        departmentId: null,
        departmentName: null,
        intent: "unknown",
        confidence: best.confidence,
        matchedTerms: closeMatches.map((candidate) => candidate.alias),
        status: "ambiguous",
        candidateDepartmentIds: closeMatches.map(
          (candidate) => candidate.department.id,
        ),
      };
    }
    return {
      requestedText: part,
      departmentId: best.department.id,
      departmentName: best.department.name,
      intent: getRequirementIntent(best.department),
      confidence: best.confidence,
      matchedTerms: [best.alias],
      status: "matched",
      candidateDepartmentIds: [best.department.id],
    };
  });
}

export function createPatientRequirementService({
  endpoint = import.meta.env.VITE_PATIENT_REQUIREMENTS_ENDPOINT,
  fetcher = fetch,
  workflows,
}: PatientRequirementOptions = {}) {
  const analyzeWithBackend = async (
    input: string,
    departments: HospitalDepartment[],
    language: RequirementLanguage,
  ): Promise<RequirementAnalysis> => {
    if (!endpoint) throw new Error("AI requirement backend is not configured.");
    const secureEndpoint = getSecureRequirementEndpoint(endpoint);
    const response = await fetcher(secureEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requirement: input,
        responseLanguage: language === "kn" ? "Kannada" : "English",
        departments: departments.map(({ id, name, building, floor, room, category }) => ({
          id,
          name,
          building,
          floor,
          room,
          category,
        })),
        instruction:
          `Understand English or Kannada text, synonyms, and multiple requests. Write all patient-facing text fields (clarification, rationale, and requirement labels) in ${language === "kn" ? "Kannada" : "English"}. Match only the supplied configured hospital department/facility catalog. Never invent services, departments, workflow prerequisites, or destinations; do not diagnose. Return JSON with intent, requirements [{requestedText, departmentId, confidence, matchedTerms, status}], departmentIds, clarification, and rationale. Every departmentId must be from the supplied catalog. Confidence is a 0..1 language-match score, not a medical confidence.`,
      }),
    });
    if (!response.ok) {
      throw new Error(`Requirement backend returned HTTP ${response.status}.`);
    }
    const body = (await response.json()) as BackendPlan;
    const knownIds = new Set(departments.map((department) => department.id));
    const ids = Array.isArray(body.departmentIds)
      ? body.departmentIds.filter(
          (id): id is number => typeof id === "number" && knownIds.has(id),
        )
      : [];
    const requestedIds = [...new Set(ids)];
    const orderedIds = orderDepartmentsByWorkflow(
      requestedIds,
      departments,
      workflows,
    );
    const recognized = matchRequirements(input, departments);
    const requirements = recognized.filter(
      (requirement) =>
        requirement.status === "matched" &&
        requirement.departmentId !== null &&
        orderedIds.includes(requirement.departmentId),
    );
    const recognizedIds = new Set(
      requirements.map((requirement) => requirement.departmentId),
    );
    for (const id of requestedIds) {
      if (recognizedIds.has(id)) continue;
      const department = departments.find((item) => item.id === id);
      if (!department) continue;
      requirements.push({
        requestedText: input.trim(),
        departmentId: id,
        departmentName: department.name,
        intent: getRequirementIntent(department),
        confidence: 0.75,
        matchedTerms: [],
        status: "matched",
        candidateDepartmentIds: [id],
      });
    }
    for (const id of orderedIds) {
      if (requestedIds.includes(id)) continue;
      const department = departments.find((item) => item.id === id);
      if (!department) continue;
      requirements.push({
        requestedText: `Prerequisite for ${department.name}`,
        departmentId: id,
        departmentName: department.name,
        intent: getRequirementIntent(department),
        confidence: 1,
        matchedTerms: ["configured hospital workflow"],
        status: "workflow-prerequisite",
        candidateDepartmentIds: [id],
      });
    }
    const invalidSuggestions =
      Array.isArray(body.departmentIds) &&
      body.departmentIds.length > 0 &&
      requestedIds.length === 0;
    const workflowApplied =
      orderedIds.length !== requestedIds.length ||
      orderedIds.some((id, index) => id !== requestedIds[index]);
    return {
      plan: {
        departmentIds: orderedIds,
        intent: getAnalysisIntent(input, requirements),
        requirements,
        clarification:
          invalidSuggestions
            ? "The AI suggestion did not match a configured hospital department. Please try a department name or ask hospital staff."
            : typeof body.clarification === "string"
              ? body.clarification
              : clarifyUnresolvedRequirements(recognized, departments),
        rationale:
          typeof body.rationale === "string"
            ? body.rationale
            : "Suggested from the configured hospital department list.",
        workflowNote: workflowApplied
          ? "Configured hospital workflow prerequisites were applied to this visit sequence."
          : "No configured hospital workflow prerequisites were applied.",
      },
      source: "ai-backend",
    };
  };

  return {
    isAIConfigured: Boolean(endpoint),

    recognizeIntent(
      input: string,
      departments: HospitalDepartment[],
    ): NavigationIntent {
      return recognizeNavigationIntent(input, departments);
    },

    async analyze(
        input: string,
        departments: HospitalDepartment[],
        language: RequirementLanguage = "en",
      ): Promise<RequirementAnalysis> {
        if (!endpoint) {
          return {
            ...(await analyzeWithRules(input, departments, workflows)),
            source: "rule-based",
          };
        }
        try {
          return await analyzeWithBackend(input, departments, language);
        } catch (error) {
          return {
            ...(await analyzeWithRules(input, departments, workflows)),
            source: "rule-based",
            backendMessage:
              error instanceof Error ? error.message : "AI service unavailable.",
          };
        }
    },

  };
}

async function analyzeWithRules(
  input: string,
  departments: HospitalDepartment[],
  workflows?: HospitalWorkflow[],
): Promise<Omit<RequirementAnalysis, "source">> {
  const text = input.trim();
  if (!text) {
    return {
      plan: {
        departmentIds: [],
        clarification: "Describe the hospital services you need.",
        rationale: "No requirement was provided.",
        workflowNote: "No configured hospital workflow prerequisites were applied.",
        intent: "unknown",
        requirements: [],
      },
    };
  }

  const requirements = matchRequirements(text, departments);
  const selectedIds = new Set(
    requirements.flatMap((requirement) =>
      requirement.status === "matched" && requirement.departmentId !== null
        ? [requirement.departmentId]
        : [],
    ),
  );
  const asksForConsultation =
    /\b(doctor|physician|consult|consultation)\b/u.test(normalizeText(text)) ||
    ["ವೈದ್ಯರು", "ವೈದ್ಯರನ್ನು", "ಡಾಕ್ಟರ್"].some((term) =>
      normalizeText(text).includes(term),
    );
  const mentionsSpecialty = requirements.some((requirement) => {
    const department = departments.find(
      (item) => item.id === requirement.departmentId,
    );
    return department?.category === "Speciality";
  });
  const generalMedicine = departments.find(
    (department) =>
      department.name.toLowerCase() === "general medicine" &&
      [...selectedIds].some(
        (id) =>
          departments.find((item) => item.id === id)?.category === "Speciality",
      ) === false,
  );
  if (asksForConsultation && !mentionsSpecialty && generalMedicine) {
    selectedIds.add(generalMedicine.id);
    if (!requirements.some((item) => item.departmentId === generalMedicine.id)) {
      requirements.push({
        requestedText: text,
        departmentId: generalMedicine.id,
        departmentName: generalMedicine.name,
        intent: "consultation",
        confidence: 0.8,
        matchedTerms: ["general consultation"],
        status: "matched",
        candidateDepartmentIds: [generalMedicine.id],
      });
    }
  }

  const clarificationParts = [
    clarifyUnresolvedRequirements(requirements, departments),
  ].filter((message): message is string => message !== null);
  if (asksForConsultation && !mentionsSpecialty && generalMedicine) {
    clarificationParts.push(
      "I matched a general consultation to General Medicine. Did you mean a specific configured specialty?",
    );
  }

  const requestedIds = [...selectedIds];
  const orderedIds = orderDepartmentsByWorkflow(
    requestedIds,
    departments,
    workflows,
  );
  const workflowApplied =
    orderedIds.length !== requestedIds.length ||
    orderedIds.some((id, index) => id !== requestedIds[index]);
  const knownIds = new Set(departments.map((department) => department.id));
  const structuredRequirements = requirements.filter(
    (requirement) =>
      requirement.departmentId === null ||
      knownIds.has(requirement.departmentId),
  );
  for (const id of orderedIds) {
    if (requestedIds.includes(id)) continue;
    const department = departments.find((item) => item.id === id);
    if (!department) continue;
    structuredRequirements.push({
      requestedText: `Prerequisite for ${department.name}`,
      departmentId: id,
      departmentName: department.name,
      intent: getRequirementIntent(department),
      confidence: 1,
      matchedTerms: ["configured hospital workflow"],
      status: "workflow-prerequisite",
      candidateDepartmentIds: [id],
    });
  }
  const unmatchedOnly =
    selectedIds.size === 0 &&
    requirements.some((requirement) => requirement.status === "unmatched");
  const clarification =
    clarificationParts.length > 0
      ? clarificationParts.join(" ")
      : unmatchedOnly
        ? "I could not match the request to a configured hospital department or facility."
        : null;
  return {
    plan: {
      departmentIds: orderedIds,
      clarification,
      intent: getAnalysisIntent(text, structuredRequirements),
      requirements: structuredRequirements,
      rationale:
        "Natural-language matches use configured department names and service aliases only. Confidence is a matching score, not a clinical assessment.",
      workflowNote: workflowApplied
        ? "Configured hospital workflow prerequisites were applied to this visit sequence."
        : "No configured hospital workflow prerequisites were applied.",
    },
  };
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const patientRequirementService = createPatientRequirementService();
