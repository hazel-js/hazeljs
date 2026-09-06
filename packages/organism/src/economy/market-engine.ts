/**
 * Phase 4 — internal resource market: bids, clearing, peer negotiation.
 */

import type {
  AgentResourceWallet,
  MarketClearingResult,
  MarketConfig,
  NegotiationOffer,
  NegotiationResult,
  OrganismRecord,
  ResourceBid,
  ResourceRequest,
  RuntimeAgentRecord,
} from '../types/organism.types';
import { DEFAULT_MARKET_CONFIG } from '../types/organism.types';
import { OrganismEventEmitter, OrganismEventType } from '../events/organism-events';
import { ResourceAllocator } from './resource-allocator';
import { UtilityForecaster } from './utility-forecaster';

let bidSeq = 0;

export function resetBidSeqForTests(): void {
  bidSeq = 0;
}

/**
 * Deterministic sealed-bid style clearing:
 * rank by forecast net value + price + urgency − opportunity cost.
 */
export class MarketEngine {
  private openBids = new Map<string, ResourceBid>();
  private history: MarketClearingResult[] = [];
  private readonly config: MarketConfig;

  constructor(
    private readonly events: OrganismEventEmitter,
    private readonly allocator: ResourceAllocator,
    private readonly forecaster: UtilityForecaster,
    private readonly organismId: string,
    private readonly now: () => Date = () => new Date(),
    config: Partial<MarketConfig> = {}
  ) {
    this.config = { ...DEFAULT_MARKET_CONFIG, ...config };
  }

  placeBid(input: {
    agentId: string;
    reason: string;
    requested: ResourceRequest;
    expectedValue: number;
    confidence: number;
    urgency?: number;
    bidPrice?: number;
    ttlMs?: number;
  }): ResourceBid {
    bidSeq += 1;
    const createdAt = this.now();
    const ttl = input.ttlMs ?? this.config.defaultBidTtlMs;
    const bid: ResourceBid = {
      id: `bid_${bidSeq}`,
      agentId: input.agentId,
      reason: input.reason,
      requested: { ...input.requested },
      expectedValue: input.expectedValue,
      confidence: input.confidence,
      urgency: input.urgency ?? 0.5,
      bidPrice: input.bidPrice,
      createdAt,
      expiresAt: new Date(createdAt.getTime() + ttl),
      status: 'open',
    };
    this.openBids.set(bid.id, bid);
    void this.events.emit(OrganismEventType.ORGANISM_RESOURCE_BID, this.organismId, bid);
    return bid;
  }

  listOpenBids(): ResourceBid[] {
    this.expireBids();
    return Array.from(this.openBids.values()).filter((b) => b.status === 'open');
  }

  cancelBid(bidId: string): boolean {
    const bid = this.openBids.get(bidId);
    if (!bid || bid.status !== 'open') return false;
    bid.status = 'cancelled';
    return true;
  }

  /**
   * Clear all open (non-expired) bids against the organism pool.
   * Higher clearing score wins until pool is exhausted.
   */
  clearMarket(input: {
    record: OrganismRecord;
    agents: Map<string, RuntimeAgentRecord>;
  }): MarketClearingResult {
    this.expireBids();
    const roundId = `mkt_${Date.now().toString(36)}_${bidSeq}`;
    const open = this.listOpenBids();

    type Ranked = {
      bid: ResourceBid;
      agent: RuntimeAgentRecord;
      forecast: ReturnType<UtilityForecaster['forecast']>;
      clearingScore: number;
    };

    const ranked: Ranked[] = [];
    for (const bid of open) {
      const agent = input.agents.get(bid.agentId);
      if (!agent || agent.status === 'terminated') {
        bid.status = 'lost';
        continue;
      }
      const forecast = this.forecaster.forecast({
        agent,
        record: input.record,
        requested: bid.requested,
        expectedValue: bid.expectedValue,
        confidence: bid.confidence,
        urgency: bid.urgency,
      });
      const priceScore = (bid.bidPrice ?? 0) / Math.max(1, bid.expectedValue);
      const clearingScore =
        forecast.netExpectedValue * (1 - this.config.priceWeight) +
        priceScore * bid.expectedValue * this.config.priceWeight +
        bid.urgency * 10 +
        agent.reputation.score * 5;
      ranked.push({ bid, agent, forecast, clearingScore });
    }

    ranked.sort((a, b) => b.clearingScore - a.clearingScore);

    const awarded: MarketClearingResult['awarded'] = [];
    const denied: MarketClearingResult['denied'] = [];
    let opportunityCostTotal = 0;

    for (const item of ranked) {
      if (item.forecast.netExpectedValue < this.config.minNetExpectedValue) {
        item.bid.status = 'lost';
        denied.push({
          bidId: item.bid.id,
          agentId: item.bid.agentId,
          reason: `Net expected value ${item.forecast.netExpectedValue.toFixed(2)} below minimum`,
          forecast: item.forecast,
        });
        continue;
      }

      const allocation = this.allocator.allocate(input.record, {
        agentId: item.bid.agentId,
        requestedResources: item.bid.requested,
        expectedUtility: item.forecast.expectedUtility,
        confidence: item.bid.confidence,
        urgency: item.bid.urgency,
        reputationScore: item.agent.reputation.score,
      });

      if (!allocation.approved) {
        item.bid.status = 'lost';
        denied.push({
          bidId: item.bid.id,
          agentId: item.bid.agentId,
          reason: allocation.reason,
          forecast: item.forecast,
        });
        continue;
      }

      // Charge bid price from agent wallet if present
      if (item.bid.bidPrice && item.bid.bidPrice > 0) {
        const money = item.agent.wallet.moneyRemaining?.amount ?? 0;
        if (money >= item.bid.bidPrice) {
          item.agent.wallet = {
            ...item.agent.wallet,
            moneyRemaining: {
              amount: money - item.bid.bidPrice,
              currency:
                item.agent.wallet.moneyRemaining?.currency ??
                input.record.pool.moneyRemaining.currency,
            },
          };
          input.record.pool.moneyRemaining.amount += item.bid.bidPrice;
        }
      }

      item.bid.status = 'won';
      opportunityCostTotal += item.forecast.opportunityCost;
      awarded.push({
        bidId: item.bid.id,
        agentId: item.bid.agentId,
        wallet: allocation.wallet,
        forecast: item.forecast,
      });
    }

    // Mark any remaining open as lost
    for (const bid of this.openBids.values()) {
      if (bid.status === 'open') {
        bid.status = 'lost';
        denied.push({
          bidId: bid.id,
          agentId: bid.agentId,
          reason: 'Not selected in clearing round',
        });
      }
    }

    const result: MarketClearingResult = {
      roundId,
      awarded,
      denied,
      opportunityCostTotal,
    };
    this.history.push(result);
    if (this.history.length > 100) this.history.splice(0, this.history.length - 100);

    void this.events.emit(OrganismEventType.ORGANISM_MARKET_CLEARED, this.organismId, result);
    return result;
  }

  /**
   * Peer negotiation: transfer resources from one agent wallet to another
   * when forecast justifies it and donor has balance.
   */
  negotiate(input: {
    offer: NegotiationOffer;
    from: RuntimeAgentRecord;
    to: RuntimeAgentRecord;
    record: OrganismRecord;
  }): NegotiationResult {
    const { offer, from, to, record } = input;
    if (from.id === to.id) {
      return { approved: false, reason: 'Cannot negotiate with self' };
    }
    if (from.status === 'terminated' || to.status === 'terminated') {
      return { approved: false, reason: 'Agent not active' };
    }

    const tokens = offer.transfer.tokens ?? 0;
    const money = offer.transfer.money ?? 0;
    const fromTokens = from.wallet.tokensRemaining ?? 0;
    const fromMoney = from.wallet.moneyRemaining?.amount ?? 0;

    if (tokens > fromTokens || money > fromMoney) {
      const result: NegotiationResult = {
        approved: false,
        reason: 'Donor insufficient resources',
      };
      void this.events.emit(OrganismEventType.ORGANISM_NEGOTIATION, this.organismId, {
        ...offer,
        ...result,
      });
      return result;
    }

    const forecast = this.forecaster.forecast({
      agent: to,
      record,
      requested: offer.transfer,
      expectedValue: offer.expectedValue ?? tokens * 0.001 + money * 2,
      confidence: offer.confidence ?? 0.6,
    });

    if (forecast.netExpectedValue < this.config.minNetExpectedValue) {
      const result: NegotiationResult = {
        approved: false,
        reason: `Forecast net value too low (${forecast.netExpectedValue.toFixed(2)})`,
      };
      void this.events.emit(OrganismEventType.ORGANISM_NEGOTIATION, this.organismId, {
        ...offer,
        ...result,
        forecast,
      });
      return result;
    }

    const currency = from.wallet.moneyRemaining?.currency ?? record.pool.moneyRemaining.currency;

    from.wallet = {
      ...from.wallet,
      tokensRemaining: fromTokens - tokens,
      moneyRemaining: { amount: fromMoney - money, currency },
    };
    to.wallet = {
      ...to.wallet,
      tokensRemaining: (to.wallet.tokensRemaining ?? 0) + tokens,
      moneyRemaining: {
        amount: (to.wallet.moneyRemaining?.amount ?? 0) + money,
        currency: to.wallet.moneyRemaining?.currency ?? currency,
      },
    };

    const result: NegotiationResult = {
      approved: true,
      reason: 'Transfer approved',
      transfer: offer.transfer,
      fromWallet: from.wallet,
      toWallet: to.wallet,
    };
    void this.events.emit(OrganismEventType.ORGANISM_NEGOTIATION, this.organismId, {
      ...offer,
      ...result,
      forecast,
    });
    return result;
  }

  getHistory(limit = 20): MarketClearingResult[] {
    return this.history.slice(-limit);
  }

  private expireBids(): void {
    const now = this.now().getTime();
    for (const bid of this.openBids.values()) {
      if (bid.status === 'open' && bid.expiresAt && bid.expiresAt.getTime() < now) {
        bid.status = 'expired';
      }
    }
  }
}

export type { ResourceRequest, AgentResourceWallet };
