import type { EmailDocument } from '../types/email-document';
import type { NormalizedMailMessage } from '../types/email-document';

export interface MailQueueClient {
  add: (
    queueName: string,
    jobName: string,
    data?: unknown,
    options?: Record<string, unknown>
  ) => Promise<{ id: string | undefined }>;
}

export interface MailQueueJobPayload {
  document?: EmailDocument;
  message?: NormalizedMailMessage;
}

export async function enqueueMail(
  queue: MailQueueClient,
  queueName: string,
  jobName: string,
  payload: MailQueueJobPayload
): Promise<{ id: string | undefined }> {
  return queue.add(queueName, jobName, payload);
}
