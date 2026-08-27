/**
 * Context-Aware Decorator
 * Maintains conversation context for improved retrieval
 */

import 'reflect-metadata';
import { Context, Entity, Topic } from '../types';

export interface ContextAwareConfig {
  windowSize?: number;
  entityTracking?: boolean;
  topicModeling?: boolean;
  sessionId?: string;
}

const CONTEXT_METADATA_KEY = Symbol('contextAware');
const contextStore = new Map<string, Context>();

export function ContextAware(config: ContextAwareConfig = {}): MethodDecorator {
  return function (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]): Promise<unknown> {
      const query = args[0] as string;
      const sessionId =
        (typeof args[1] === 'object' && args[1] !== null && 'sessionId' in args[1]
          ? (args[1] as { sessionId?: string }).sessionId
          : undefined) ||
        config.sessionId ||
        'default';

      // Get or create context
      let context = contextStore.get(sessionId);
      if (!context) {
        context = {
          sessionId,
          conversationHistory: [],
          entities: [],
          topics: [],
          metadata: {},
        };
        contextStore.set(sessionId, context);
      }

      // Update context with current query
      context.conversationHistory.push({
        role: 'user',
        content: query,
        timestamp: new Date(),
      });

      // Maintain window size
      const windowSize = config.windowSize || 5;
      if (context.conversationHistory.length > windowSize * 2) {
        context.conversationHistory = context.conversationHistory.slice(-windowSize * 2);
      }

      // Extract entities if enabled
      if (config.entityTracking) {
        const entities = extractEntities(query);
        updateEntities(context, entities);
      }

      // Extract topics if enabled
      if (config.topicModeling) {
        const topics = extractTopics(query, context);
        updateTopics(context, topics);
      }

      // Enhance query with context
      const enhancedQuery = enhanceQueryWithContext(query, context);

      // Execute with enhanced query
      const modifiedArgs = [enhancedQuery, ...args.slice(1)];
      const results = await originalMethod.apply(this, modifiedArgs);

      // Store assistant response in context
      if (results) {
        context.conversationHistory.push({
          role: 'assistant',
          content: JSON.stringify(results).slice(0, 500),
          timestamp: new Date(),
        });
      }

      Reflect.defineMetadata(CONTEXT_METADATA_KEY, context, target, propertyKey);

      return results;
    };

    return descriptor;
  };
}

function extractEntities(text: string): Entity[] {
  const entities: Entity[] = [];

  // Simple named entity extraction (capitalized words)
  const words = text.split(/\s+/);
  const capitalizedWords = words.filter((w) => /^[A-Z][a-z]+/.test(w));

  const entityCounts = new Map<string, number>();
  capitalizedWords.forEach((word) => {
    entityCounts.set(word, (entityCounts.get(word) || 0) + 1);
  });

  entityCounts.forEach((count, name) => {
    entities.push({
      name,
      type: 'UNKNOWN',
      mentions: count,
      lastSeen: new Date(),
      attributes: {},
    });
  });

  return entities;
}

function updateEntities(context: Context, newEntities: Entity[]): void {
  newEntities.forEach((newEntity) => {
    const existing = context.entities.find((e) => e.name === newEntity.name);
    if (existing) {
      existing.mentions += newEntity.mentions;
      existing.lastSeen = new Date();
    } else {
      context.entities.push(newEntity);
    }
  });

  // Keep only recent entities
  context.entities = context.entities
    .sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime())
    .slice(0, 20);
}

function extractTopics(query: string, _context: Context): Topic[] {
  const topics: Topic[] = [];

  // Extract keywords
  const words = query.toLowerCase().split(/\s+/);
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for']);
  const keywords = words.filter((w) => w.length > 3 && !stopWords.has(w));

  // Group into topics
  const topicMap = new Map<string, string[]>();
  keywords.forEach((keyword) => {
    const topic = keyword.slice(0, 5); // Simple topic grouping
    if (!topicMap.has(topic)) {
      topicMap.set(topic, []);
    }
    topicMap.get(topic)!.push(keyword);
  });

  topicMap.forEach((keywords, name) => {
    topics.push({
      name,
      relevance: keywords.length / words.length,
      keywords,
    });
  });

  return topics;
}

function updateTopics(context: Context, newTopics: Topic[]): void {
  newTopics.forEach((newTopic) => {
    const existing = context.topics.find((t) => t.name === newTopic.name);
    if (existing) {
      existing.relevance = (existing.relevance + newTopic.relevance) / 2;
      existing.keywords = [...new Set([...existing.keywords, ...newTopic.keywords])];
    } else {
      context.topics.push(newTopic);
    }
  });

  // Keep top topics
  context.topics = context.topics.sort((a, b) => b.relevance - a.relevance).slice(0, 10);
}

function enhanceQueryWithContext(query: string, context: Context): string {
  const enhancements: string[] = [query];

  // Add recent entities
  const topEntities = context.entities.slice(0, 3).map((e) => e.name);
  if (topEntities.length > 0) {
    enhancements.push(`Context entities: ${topEntities.join(', ')}`);
  }

  // Add recent topics
  const topTopics = context.topics.slice(0, 2).map((t) => t.keywords[0]);
  if (topTopics.length > 0) {
    enhancements.push(`Related topics: ${topTopics.join(', ')}`);
  }

  return enhancements.join(' | ');
}

export function getContext(target: object, propertyKey: string | symbol): Context | undefined {
  return Reflect.getMetadata(CONTEXT_METADATA_KEY, target, propertyKey);
}

export function clearContext(sessionId: string): void {
  contextStore.delete(sessionId);
}
