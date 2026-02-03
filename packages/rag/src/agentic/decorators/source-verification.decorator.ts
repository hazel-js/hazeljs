/**
 * Source Verification Decorator
 * Verifies source quality and generates citations
 */

import 'reflect-metadata';
import { VerifiedResponse, VerifiedSource, SourceVerification, Citation } from '../types';

export interface SourceVerificationConfig {
  checkFreshness?: boolean;
  verifyAuthority?: boolean;
  requireCitations?: boolean;
  freshnessThresholdDays?: number;
}

const VERIFICATION_METADATA_KEY = Symbol('sourceVerification');

export function SourceVerification(config: SourceVerificationConfig = {}): MethodDecorator {
  return function (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]): Promise<unknown> {
      const results = await originalMethod.apply(this, args);

      if (!Array.isArray(results)) {
        return results;
      }

      // Verify each source
      const verifiedSources: VerifiedSource[] = await Promise.all(
        results.map((result) => verifySource(result, config))
      );

      // Generate citations
      const citations = config.requireCitations ? generateCitations(verifiedSources) : [];

      // Calculate overall confidence
      const overallConfidence = calculateOverallConfidence(verifiedSources);

      const verifiedResponse: VerifiedResponse = {
        answer: '', // Would be filled by calling code
        sources: verifiedSources,
        overallConfidence,
        citations,
      };

      Reflect.defineMetadata(VERIFICATION_METADATA_KEY, verifiedResponse, target, propertyKey);

      return verifiedSources;
    };

    return descriptor;
  };
}

async function verifySource(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  source: any,
  config: SourceVerificationConfig
): Promise<VerifiedSource> {
  const verification: SourceVerification = {
    authorityScore: 0.7,
    freshnessScore: 0.7,
    relevanceScore: source.score || 0.5,
    verified: true,
    issues: [],
  };

  // Check freshness
  if (config.checkFreshness && source.metadata?.timestamp) {
    const freshnessScore = calculateFreshnessScore(
      source.metadata.timestamp,
      config.freshnessThresholdDays || 365
    );
    verification.freshnessScore = freshnessScore;

    if (freshnessScore < 0.5) {
      verification.issues.push('Content may be outdated');
    }
  }

  // Check authority
  if (config.verifyAuthority && source.metadata?.source) {
    const authorityScore = calculateAuthorityScore(source.metadata.source);
    verification.authorityScore = authorityScore;

    if (authorityScore < 0.5) {
      verification.issues.push('Source authority uncertain');
    }
  }

  // Overall verification
  const avgScore =
    (verification.authorityScore + verification.freshnessScore + verification.relevanceScore) / 3;

  verification.verified = avgScore >= 0.6 && verification.issues.length === 0;

  return {
    ...source,
    verification,
  };
}

function calculateFreshnessScore(timestamp: string | Date, thresholdDays: number): number {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  const now = new Date();
  const ageInDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);

  if (ageInDays <= 30) return 1.0;
  if (ageInDays <= 90) return 0.9;
  if (ageInDays <= 180) return 0.8;
  if (ageInDays <= 365) return 0.7;
  if (ageInDays <= thresholdDays) return 0.5;

  return 0.3;
}

function calculateAuthorityScore(source: string): number {
  const lowerSource = source.toLowerCase();

  // High authority domains
  const highAuthority = ['.edu', '.gov', '.org', 'wikipedia', 'scholar'];
  if (highAuthority.some((domain) => lowerSource.includes(domain))) {
    return 0.9;
  }

  // Medium authority
  const mediumAuthority = ['.com', 'blog', 'medium'];
  if (mediumAuthority.some((domain) => lowerSource.includes(domain))) {
    return 0.7;
  }

  return 0.5;
}

function generateCitations(sources: VerifiedSource[]): Citation[] {
  return sources
    .filter((s) => s.verification.verified)
    .map((source, index) => ({
      text: source.content.slice(0, 100) + '...',
      sourceId: source.id,
      position: index + 1,
      confidence: source.verification.relevanceScore,
    }));
}

function calculateOverallConfidence(sources: VerifiedSource[]): number {
  if (sources.length === 0) return 0;

  const verifiedCount = sources.filter((s) => s.verification.verified).length;
  const avgRelevance =
    sources.reduce((sum, s) => sum + s.verification.relevanceScore, 0) / sources.length;

  return (verifiedCount / sources.length) * avgRelevance;
}

export function getVerifiedResponse(
  target: object,
  propertyKey: string | symbol
): VerifiedResponse | undefined {
  return Reflect.getMetadata(VERIFICATION_METADATA_KEY, target, propertyKey);
}
