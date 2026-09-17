// STAGE 2 STEP 2.7.3: Standalone deterministic regression checks for governed semantic
// category resolution. These tests use synthetic aggregate labels only and access no DB.
import {
  resolveSemanticCategoryValue,
  semanticCategoryKey,
} from "../apps/isomorphic-i18n/src/askfish/category-resolution";

// STAGE 2 STEP 2.7.3: Fail loudly without a test framework so the script can be run
// with the repository's normal TypeScript runner during local acceptance.
function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

// STAGE 2 STEP 2.7.3: Presentation-only differences must resolve deterministically.
assert(semanticCategoryKey("Gill Net") === "gillnet", "Gill Net normalization failed.");
assert(
  resolveSemanticCategoryValue("gillnet", ["Gill Net", "Hand Line"]).resolved === "Gill Net",
  "gillnet should resolve to the observed Gill Net category.",
);

// STAGE 2 STEP 2.7.3: Conservative unique-prefix matching supports common taxon wording
// while preserving fail-closed behavior when more than one observed value could match.
assert(
  resolveSemanticCategoryValue("Octopus", ["Octopuses nei", "Hilsa kelee"]).resolved ===
    "Octopuses nei",
  "Octopus should resolve only when one observed prefix candidate exists.",
);
assert(
  resolveSemanticCategoryValue("Parrotfish", ["Parrotfishes nei", "Hilsa kelee"]).resolved ===
    "Parrotfishes nei",
  "Parrotfish should resolve only when one observed prefix candidate exists.",
);
assert(
  resolveSemanticCategoryValue("Octopus", ["Octopuses nei", "Octopus cyanea"]).method ===
    "ambiguous",
  "Ambiguous taxon prefixes must not be auto-selected.",
);
assert(
  resolveSemanticCategoryValue("net", ["Gill Net", "Lift Net"]).method === "none",
  "Broad short category tokens must not use prefix matching.",
);

console.log("Stage 2.7.3 semantic category resolution regression passed.");
