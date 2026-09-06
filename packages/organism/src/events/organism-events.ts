/**
 * Organism domain events (namespaced; separate from AgentEventType).
 */

export enum OrganismEventType {
  ORGANISM_CREATED = 'organism.created',
  ORGANISM_STARTED = 'organism.started',
  ORGANISM_PAUSED = 'organism.paused',
  ORGANISM_RESUMED = 'organism.resumed',
  ORGANISM_COMPLETED = 'organism.completed',
  ORGANISM_TERMINATED = 'organism.terminated',
  ORGANISM_EMERGENCY_STOP = 'organism.emergency_stop',

  ENVIRONMENT_SIGNAL_RECEIVED = 'environment.signal.received',
  ORGANISM_NEED_DETECTED = 'organism.need.detected',

  ORGANISM_AGENT_BORN = 'organism.agent.born',
  ORGANISM_AGENT_SPECIALIZED = 'organism.agent.specialized',
  ORGANISM_AGENT_REPRODUCED = 'organism.agent.reproduced',
  ORGANISM_AGENT_MUTATED = 'organism.agent.mutated',
  ORGANISM_AGENT_SUSPENDED = 'organism.agent.suspended',
  ORGANISM_AGENT_TERMINATED = 'organism.agent.terminated',

  ORGANISM_RESOURCE_ALLOCATED = 'organism.resource.allocated',
  ORGANISM_RESOURCE_DENIED = 'organism.resource.denied',
  ORGANISM_RESOURCE_BID = 'organism.resource.bid',
  ORGANISM_MARKET_CLEARED = 'organism.market.cleared',
  ORGANISM_NEGOTIATION = 'organism.negotiation',
  ORGANISM_UTILITY_FORECAST = 'organism.utility.forecast',

  ORGANISM_REPUTATION_CHANGED = 'organism.reputation.changed',
  ORGANISM_UTILITY_CALCULATED = 'organism.utility.calculated',

  ORGANISM_GENERATION_CREATED = 'organism.generation.created',
  ORGANISM_STRATEGY_PROMOTED = 'organism.strategy.promoted',

  ORGANISM_CONSTITUTION_VIOLATION = 'organism.constitution.violation',
  ORGANISM_MISSION_PROGRESS = 'organism.mission.progress',
  ORGANISM_MISSION_COMPLETED = 'organism.mission.completed',

  ORGANISM_DECISION = 'organism.decision',
}

export interface OrganismEvent<T = unknown> {
  type: OrganismEventType;
  organismId: string;
  timestamp: Date;
  data: T;
  metadata?: Record<string, unknown>;
}

type EventHandler<T = unknown> = (event: OrganismEvent<T>) => void | Promise<void>;

export class OrganismEventEmitter {
  private handlers = new Map<OrganismEventType, Set<EventHandler>>();
  private wildcardHandlers = new Set<EventHandler>();
  private history: OrganismEvent[] = [];
  private maxHistory: number;

  constructor(options: { maxHistory?: number } = {}) {
    this.maxHistory = options.maxHistory ?? 500;
  }

  on<T = unknown>(type: OrganismEventType, handler: EventHandler<T>): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler as EventHandler);
  }

  onAny(handler: EventHandler): void {
    this.wildcardHandlers.add(handler);
  }

  off(type: OrganismEventType, handler: EventHandler): void {
    this.handlers.get(type)?.delete(handler);
  }

  offAny(handler: EventHandler): void {
    this.wildcardHandlers.delete(handler);
  }

  async emit<T = unknown>(
    type: OrganismEventType,
    organismId: string,
    data: T,
    metadata?: Record<string, unknown>
  ): Promise<OrganismEvent<T>> {
    const event: OrganismEvent<T> = {
      type,
      organismId,
      timestamp: new Date(),
      data,
      metadata,
    };
    this.history.push(event as OrganismEvent);
    if (this.history.length > this.maxHistory) {
      this.history.splice(0, this.history.length - this.maxHistory);
    }

    const typed = this.handlers.get(type);
    if (typed) {
      for (const handler of typed) {
        await handler(event);
      }
    }
    for (const handler of this.wildcardHandlers) {
      await handler(event as OrganismEvent);
    }
    return event;
  }

  getHistory(limit?: number): OrganismEvent[] {
    if (limit == null) return [...this.history];
    return this.history.slice(-limit);
  }

  clearHistory(): void {
    this.history = [];
  }
}
