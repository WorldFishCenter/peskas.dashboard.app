// STAGE 2 STEP 2.7.3: Resolve user-entered semantic category labels against observed
// aggregate portal values without fuzzy search or LLM-authored database values. The
// resolver intentionally supports only harmless case/spacing/punctuation normalization
// plus a conservative unique-prefix rule for common taxon wording (for example,
// "Octopus" -> "Octopuses nei" when that is the only observed prefix match).
export type SemanticCategoryResolution = {
  requested: string;
  resolved: string | null;
  method: "exact" | "case_insensitive" | "normalized" | "unique_prefix" | "none" | "ambiguous";
  candidates: string[];
};

// STAGE 2 STEP 2.7.3: Collapse presentation-only differences while preserving the
// lexical content. This makes values such as Gillnet, Gill Net, gill-net and GILL_NET
// comparable without allowing edit-distance or semantic guessing.
export function semanticCategoryKey(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

// STAGE 2 STEP 2.7.3: Resolve exactly one canonical observed category or fail closed.
// Prefix resolution is deliberately limited to reasonably specific terms and is accepted
// only when there is one unique candidate; ambiguous matches are never auto-selected.
export function resolveSemanticCategoryValue(
  requested: string,
  observedValues: string[],
): SemanticCategoryResolution {
  const observed = Array.from(new Set(observedValues.filter((value) => value.trim().length > 0)));

  const exact = observed.find((value) => value === requested);
  if (exact) {
    return { requested, resolved: exact, method: "exact", candidates: [exact] };
  }

  const caseInsensitive = observed.filter(
    (value) => value.trim().toLowerCase() === requested.trim().toLowerCase(),
  );
  if (caseInsensitive.length === 1) {
    return {
      requested,
      resolved: caseInsensitive[0],
      method: "case_insensitive",
      candidates: caseInsensitive,
    };
  }

  const requestedKey = semanticCategoryKey(requested);
  const normalized = observed.filter((value) => semanticCategoryKey(value) === requestedKey);
  if (normalized.length === 1) {
    return { requested, resolved: normalized[0], method: "normalized", candidates: normalized };
  }
  if (normalized.length > 1) {
    return { requested, resolved: null, method: "ambiguous", candidates: normalized };
  }

  // STAGE 2 STEP 2.7.3: A minimum normalized length prevents broad tokens such as
  // "net" or "ray" from selecting an arbitrary category. The rule is directional:
  // a concise user label may prefix a longer observed label, but not vice versa.
  const prefixMatches = requestedKey.length >= 6
    ? observed.filter((value) => semanticCategoryKey(value).startsWith(requestedKey))
    : [];
  if (prefixMatches.length === 1) {
    return {
      requested,
      resolved: prefixMatches[0],
      method: "unique_prefix",
      candidates: prefixMatches,
    };
  }
  if (prefixMatches.length > 1) {
    return { requested, resolved: null, method: "ambiguous", candidates: prefixMatches };
  }

  return { requested, resolved: null, method: "none", candidates: [] };
}


// STAGE 3 STEP 3.3: Geographic labels such as Kenya BMUs use a stricter resolver
// than taxon/gear categories. Exact, case-insensitive, and punctuation/spacing-normalized
// matches are allowed; prefix/fuzzy matching is deliberately forbidden for geography.
export function resolveExactSemanticCategoryValue(
  requested: string,
  observedValues: string[],
): SemanticCategoryResolution {
  const exact = observedValues.find((value) => value === requested);
  if (exact) return { resolved: exact, method: "exact", candidates: [exact] };

  const caseInsensitive = observedValues.filter(
    (value) => value.toLocaleLowerCase() === requested.toLocaleLowerCase(),
  );
  if (caseInsensitive.length === 1) {
    return { resolved: caseInsensitive[0]!, method: "case_insensitive", candidates: caseInsensitive };
  }

  const normalizedKey = semanticCategoryKey(requested);
  const normalized = observedValues.filter(
    (value) => semanticCategoryKey(value) === normalizedKey,
  );
  if (normalized.length === 1) {
    return { resolved: normalized[0]!, method: "normalized", candidates: normalized };
  }
  if (caseInsensitive.length > 1 || normalized.length > 1) {
    const candidates = caseInsensitive.length > 1 ? caseInsensitive : normalized;
    return { resolved: null, method: "ambiguous", candidates };
  }
  return { resolved: null, method: "none", candidates: [] };
}
