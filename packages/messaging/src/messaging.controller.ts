/**
 * Messaging Controller - Webhook endpoints for each channel
 * In Kafka mode: produces to topic and returns 200 immediately (async processing)
 * In sync mode: processes inline and responds
 */
import {
  Controller,
  Post,
  Get,
  Req,
  Res,
  Param,
  BadRequestException,
  Inject,
  logger,
} from '@hazeljs/core';
import type { Request, HazelResponse } from '@hazeljs/core';
import { MessagingService } from './messaging.service';
import type { IChannelAdapter, IncomingMessage } from './types/message.types';
import { MESSAGING_INCOMING_TOPIC, type MessagingIncomingPayload } from './messaging-kafka.types';

export const MESSAGING_ADAPTERS = Symbol('MESSAGING_ADAPTERS');
export const MESSAGING_USE_KAFKA = Symbol('MESSAGING_USE_KAFKA');
export const MESSAGING_KAFKA_PRODUCER = Symbol('MESSAGING_KAFKA_PRODUCER');
const CHANNEL_PARAM = 'channel';

@Controller('api/messaging')
export class MessagingController {
  private adapters: Map<string, IChannelAdapter>;
  private useKafka: boolean;
  private producer?: {
    send: (
      topic: string,
      messages: { key?: string; value: string } | Array<{ key?: string; value: string }>
    ) => Promise<void>;
  };

  constructor(
    private readonly messagingService: MessagingService,
    @Inject(MESSAGING_ADAPTERS) adapterList: IChannelAdapter[] = [],
    @Inject(MESSAGING_USE_KAFKA) useKafka = false,
    @Inject(MESSAGING_KAFKA_PRODUCER)
    producer?: {
      send: (
        topic: string,
        messages: { key?: string; value: string } | Array<{ key?: string; value: string }>
      ) => Promise<void>;
    }
  ) {
    this.adapters = new Map(adapterList.map((a) => [a.channel, a]));
    this.useKafka = useKafka;
    this.producer = producer;
  }

  /** GET webhook - WhatsApp verification, etc. */
  @Get(`/webhook/:${CHANNEL_PARAM}`)
  async webhookGet(
    @Param(CHANNEL_PARAM) channel: string,
    @Req() req: Request,
    @Res() res: HazelResponse
  ): Promise<void> {
    if (channel !== 'whatsapp') {
      res.status(404).setHeader('Content-Type', 'text/plain');
      res.write('Not found');
      res.end();
      return;
    }
    const adapter = this.adapters.get('whatsapp');
    if (!adapter?.verifyWebhook) {
      res.status(404).setHeader('Content-Type', 'text/plain');
      res.write('Not found');
      res.end();
      return;
    }
    const q = req.query as Record<string, string>;
    if (adapter.verifyWebhook(q, req.headers as Record<string, string>)) {
      const challenge = q['hub.challenge'];
      if (challenge) {
        res.status(200);
        res.setHeader('Content-Type', 'text/plain');
        res.write(challenge);
        res.end();
        return;
      }
    }
    res.status(403).setHeader('Content-Type', 'text/plain');
    res.write('Verification failed');
    res.end();
  }

  /** Generic webhook - route by path param: POST /api/messaging/webhook/:channel */
  @Post(`/webhook/:${CHANNEL_PARAM}`)
  async webhookPost(
    @Param(CHANNEL_PARAM) channel: string,
    @Req() req: Request,
    @Res() res: HazelResponse
  ): Promise<void> {
    const adapter = this.adapters.get(channel);
    if (!adapter) {
      throw new BadRequestException(`Unsupported channel: ${channel}`);
    }

    let payload: unknown;
    try {
      const body = (req as Request & { body?: unknown }).body;
      payload = typeof body === 'object' && body !== null ? body : {};
    } catch {
      payload = {};
    }

    const messages = this.normalizeMessages(adapter.parseIncoming(payload));
    if (messages.length === 0) {
      res.status(200).json({ ok: true });
      return;
    }

    if (this.useKafka && this.producer) {
      // Async: produce to Kafka, return immediately (horizontally scalable)
      for (const msg of messages) {
        try {
          const payload: MessagingIncomingPayload = { message: msg, channel };
          await this.producer.send(MESSAGING_INCOMING_TOPIC, {
            key: msg.sessionId ?? msg.conversationId,
            value: JSON.stringify(payload),
          });
        } catch (err) {
          logger.error(`Messaging Kafka produce error for ${channel}:`, err);
        }
      }
      res.status(200).json({ ok: true });
      return;
    }

    // Sync: process inline
    for (const msg of messages) {
      try {
        const response = await this.messagingService.handleMessage(msg);
        if (response) {
          await adapter.send({
            conversationId: msg.conversationId,
            text: response,
            replyToMessageId: msg.id,
          });
        }
      } catch (err) {
        logger.error(`Messaging webhook error for ${channel}:`, err);
      }
    }

    res.status(200).json({ ok: true });
  }

  private normalizeMessages(result: IncomingMessage | IncomingMessage[] | null): IncomingMessage[] {
    if (!result) return [];
    return Array.isArray(result) ? result : [result];
  }
}
