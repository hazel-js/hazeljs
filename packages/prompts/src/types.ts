/**
 * Metadata attached to every PromptTemplate.
 */
export interface PromptMetadata {
  /** Unique human-readable name for this prompt. */
  name: string;
  /** Optional short description of what this prompt does. */
  description?: string;
  /**
   * Semantic version string (e.g. '1.0.0').
   * Bump when the prompt text changes meaningfully to aid debugging.
   */
  version?: string;
}
