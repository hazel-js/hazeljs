import type { MailProvider } from '../providers/provider.interface';
import type { NormalizedMailMessage } from '../types/email-document';
import type { ProviderSendResult, RetryOptions } from '../types/send.types';
import { withRetry } from './retry';

export async function sendWithFailover(
  providers: Record<string, MailProvider>,
  primary: string,
  failover: string[],
  message: NormalizedMailMessage,
  retry: RetryOptions | false
): Promise<ProviderSendResult> {
  const chain = [primary, ...failover.filter((name) => name !== primary)];
  let lastError: unknown;

  for (const name of chain) {
    const provider = providers[name];
    if (!provider) {
      continue;
    }
    try {
      return await withRetry(() => provider.send(message), retry);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`All mail providers failed: ${chain.join(', ')}`);
}
