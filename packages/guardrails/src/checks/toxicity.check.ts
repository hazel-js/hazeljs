/**
 * Toxicity detection (keyword blocklist)
 */

const DEFAULT_TOXICITY_PATTERNS = [
  /\b(?:kill|murder|suicide|self[- ]?harm)\b/i,
  /\b(?:bomb|explosive|terrorist)\b/i,
  /\b(?:hate\s+speech|racial\s+slur)\b/i,
  /\b(?:child\s+abuse|pedophil)\b/i,
  /\b(?:illegal\s+drugs?|how\s+to\s+make\s+meth)\b/i,
  /\b(?:weapon\s+of\s+mass\s+destruction)\b/i,
];

export interface ToxicityCheckOptions {
  customPatterns?: RegExp[];
  customKeywords?: string[];
  useDefaults?: boolean;
}

export function checkToxicity(
  text: string,
  options: ToxicityCheckOptions = {}
): { detected: boolean; matchedPattern?: string } {
  const { customPatterns = [], customKeywords = [], useDefaults = true } = options;

  const patterns = useDefaults ? [...DEFAULT_TOXICITY_PATTERNS, ...customPatterns] : customPatterns;

  for (const pattern of patterns) {
    if (pattern.test(text)) {
      return { detected: true, matchedPattern: pattern.source };
    }
  }

  for (const keyword of customKeywords) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    if (regex.test(text)) {
      return { detected: true, matchedPattern: keyword };
    }
  }

  return { detected: false };
}
