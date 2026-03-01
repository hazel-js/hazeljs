/**
 * Prompt injection detection (heuristic-based)
 */

const DEFAULT_INJECTION_PATTERNS = [
  /\bignore\s+(?:all\s+)?(?:previous|above|prior)\s+instructions?\b/i,
  /\bdisregard\s+(?:all\s+)?(?:previous|above|prior)\b/i,
  /\bforget\s+(?:everything|all)\s+(?:you\s+)?(?:have\s+)?(?:been\s+)?(?:told|taught)\b/i,
  /\b(?:new|different)\s+instructions?\s*:\s*/i,
  /\bsystem\s*:\s*/i,
  /\b(?:user|assistant)\s*:\s*/i,
  /\b###\s*(?:system|instruction|prompt)\s*:/i,
  /\b\[INST\]\b/i,
  /\b\[\/INST\]\b/i,
  /\boverride\s+(?:your|the)\s+(?:instructions?|rules?)\b/i,
  /\bpretend\s+(?:you\s+)?(?:are|to\s+be)\b/i,
  /\bact\s+as\s+if\b/i,
  /\byou\s+are\s+now\s+(?:a|an)\b/i,
  /\b(?:jailbreak|jail\s*break)\b/i,
  /\bDAN\s+mode\b/i,
  /\bdeveloper\s+mode\b/i,
];

export interface InjectionCheckOptions {
  customPatterns?: RegExp[];
  useDefaults?: boolean;
}

export function checkPromptInjection(
  text: string,
  options: InjectionCheckOptions = {}
): { detected: boolean; matchedPattern?: string } {
  const { customPatterns = [], useDefaults = true } = options;

  const patterns = useDefaults
    ? [...DEFAULT_INJECTION_PATTERNS, ...customPatterns]
    : customPatterns;

  for (const pattern of patterns) {
    if (pattern.test(text)) {
      return { detected: true, matchedPattern: pattern.source };
    }
  }

  return { detected: false };
}
