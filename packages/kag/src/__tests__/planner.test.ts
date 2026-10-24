import { HeuristicQueryPlanner } from '../planner/heuristic-query-planner';
import {
  COMMERCE_INDUSTRY_PROFILE,
  GENERIC_INDUSTRY_PROFILE,
  mergeIndustryProfiles,
} from '../planner/industry-profiles';

describe('HeuristicQueryPlanner industry profiles', () => {
  const entities = [
    {
      id: 'merchant-123',
      type: 'merchant',
      properties: { name: 'Demo Restaurant' },
    },
  ];

  it('defaults to generic profile without commerce relation filters', async () => {
    const planner = new HeuristicQueryPlanner();
    expect(planner.getIndustryId()).toBe('generic');
    const plan = await planner.plan('Why did this change?', {
      scope: { tenantId: 't1' },
      entities,
    });
    expect(plan.template).toBe('causal');
    expect(plan.relationTypes).toBeUndefined();
  });

  it('applies commerce relation filters when opted in', async () => {
    const planner = new HeuristicQueryPlanner({
      industry: [GENERIC_INDUSTRY_PROFILE, COMMERCE_INDUSTRY_PROFILE],
    });
    const plan = await planner.plan('Why was Demo Restaurant settlement lower yesterday?', {
      scope: { tenantId: 't1' },
      entities,
    });
    expect(plan.template).toBe('settlement');
    expect(plan.relationTypes).toContain('HAS_REFUND');
    expect(plan.seedIds).toContain('merchant-123');
  });

  it('supports custom industry profiles', async () => {
    const healthcare = {
      id: 'healthcare',
      defaultDepth: 2,
      templates: [
        {
          name: 'adverse-event',
          pattern: /adverse|side effect|contraindication/i,
          relationTypes: ['TREATED_WITH', 'HAS_REACTION', 'PRESCRIBED'],
          depth: 3,
        },
      ],
    };
    const planner = new HeuristicQueryPlanner({ industry: healthcare });
    const plan = await planner.plan('Any adverse reaction?', {
      scope: { tenantId: 't1' },
      entities: [],
    });
    expect(plan.template).toBe('adverse-event');
    expect(plan.relationTypes).toEqual(['TREATED_WITH', 'HAS_REACTION', 'PRESCRIBED']);
  });

  it('mergeIndustryProfiles layers domain over generic', () => {
    const merged = mergeIndustryProfiles(GENERIC_INDUSTRY_PROFILE, COMMERCE_INDUSTRY_PROFILE);
    expect(merged.id).toBe('generic+commerce');
    expect(merged.templates.some((t) => t.name === 'settlement')).toBe(true);
    expect(merged.templates.some((t) => t.name === 'causal')).toBe(true);
  });
});
