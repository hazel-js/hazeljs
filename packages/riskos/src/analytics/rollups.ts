/**
 * Analytics rollup interfaces - implementations in @hazeljs/analytics when installed
 */

/** Aggregation result for metric rollups */
export interface RollupResult {
  name: string;
  value: number;
  bucket?: string;
  dimensions?: Record<string, string>;
}
