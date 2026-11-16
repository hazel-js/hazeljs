import type { EmailDocument } from '../types/email-document';
import type {
  DeliveryPolicyOptions,
  PolicyDecision,
  QuietHoursOptions,
  RateLimitOptions,
} from '../types/policy.types';
import { extractEmail, formatAddresses, isValidEmailAddress } from '../render/address';

export class DeliveryPolicy {
  private readonly buckets = new Map<string, number[]>();

  constructor(private readonly options: DeliveryPolicyOptions = {}) {}

  async evaluate(doc: EmailDocument): Promise<PolicyDecision> {
    if (this.options.validate !== false) {
      this.validate(doc);
    }

    const recipients = formatAddresses(doc.to).map((a) => extractEmail(a));
    const allowed: string[] = [];
    const suppressed: string[] = [];

    for (const recipient of recipients) {
      if (this.options.suppress && (await this.options.suppress(recipient, doc))) {
        suppressed.push(recipient);
      } else {
        allowed.push(recipient);
      }
    }

    if (allowed.length === 0) {
      return {
        action: 'suppress',
        reason: 'All recipients suppressed',
        recipients: suppressed,
      };
    }

    const quiet = this.matchQuietHours(doc);
    if (quiet) {
      return {
        action: 'defer',
        reason: `Quiet hours for category ${doc.category}`,
        retryAfterMs: this.msUntilQuietEnd(quiet),
      };
    }

    if (this.options.rateLimit) {
      for (const recipient of allowed) {
        if (!this.consumeRateLimit(doc, recipient, this.options.rateLimit)) {
          return {
            action: 'defer',
            reason: 'Rate limit exceeded',
            retryAfterMs: this.options.rateLimit.periodMs ?? 60_000,
          };
        }
      }
    }

    const intercept = this.options.intercept;
    if (intercept?.enabled) {
      const filtered: string[] = [];
      for (const recipient of allowed) {
        if (intercept.allow && (await intercept.allow(recipient))) {
          filtered.push(recipient);
        }
      }
      if (filtered.length === 0) {
        const interceptTo = Array.isArray(intercept.to) ? intercept.to : [intercept.to];
        return {
          action: 'intercept',
          recipients: interceptTo.map((a) => extractEmail(a)),
          originalRecipients: allowed,
          subjectPrefix: intercept.subjectPrefix ?? '[INTERCEPTED] ',
        };
      }
      return { action: 'allow', recipients: filtered };
    }

    return { action: 'allow', recipients: allowed };
  }

  private validate(doc: EmailDocument): void {
    if (!doc.subject || /[\r\n]/.test(doc.subject)) {
      throw new Error('Invalid email subject');
    }
    for (const addr of formatAddresses(doc.to)) {
      if (!isValidEmailAddress(addr)) {
        throw new Error(`Invalid recipient address: ${addr}`);
      }
    }
    for (const [name, value] of Object.entries(doc.headers ?? {})) {
      if (!/^[A-Za-z0-9-]+$/.test(name) || /[\r\n]/.test(value)) {
        throw new Error(`Invalid header: ${name}`);
      }
    }
  }

  private matchQuietHours(doc: EmailDocument): QuietHoursOptions | undefined {
    const rules = this.options.quietHours
      ? Array.isArray(this.options.quietHours)
        ? this.options.quietHours
        : [this.options.quietHours]
      : [];
    const hour = new Date().getHours();
    for (const rule of rules) {
      const cats = Array.isArray(rule.category) ? rule.category : [rule.category];
      if (!cats.includes(doc.category)) {
        continue;
      }
      if (this.inQuietWindow(hour, rule.start, rule.end)) {
        return rule;
      }
    }
    return undefined;
  }

  private inQuietWindow(hour: number, start: number, end: number): boolean {
    if (start === end) {
      return false;
    }
    if (start < end) {
      return hour >= start && hour < end;
    }
    return hour >= start || hour < end;
  }

  private msUntilQuietEnd(rule: QuietHoursOptions): number {
    const now = new Date();
    const end = new Date(now);
    end.setMinutes(0, 0, 0);
    end.setHours(rule.end);
    if (end <= now) {
      end.setDate(end.getDate() + 1);
    }
    return end.getTime() - now.getTime();
  }

  private consumeRateLimit(
    doc: EmailDocument,
    recipient: string,
    limit: RateLimitOptions
  ): boolean {
    const period = limit.periodMs ?? 60_000;
    const keyFn = limit.key ?? 'recipient';
    const key =
      typeof keyFn === 'function'
        ? keyFn(doc)
        : keyFn === 'tenant'
          ? String(doc.tags?.tenantId ?? recipient)
          : recipient;
    const now = Date.now();
    const bucket = (this.buckets.get(key) ?? []).filter((t) => now - t < period);
    if (bucket.length >= limit.maxMessages) {
      this.buckets.set(key, bucket);
      return false;
    }
    bucket.push(now);
    this.buckets.set(key, bucket);
    return true;
  }
}
