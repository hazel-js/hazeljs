import 'reflect-metadata';
import { runTravelSpeculationDemo } from '../demo/travel-agent.demo';

describe('Travel Agent (describeAgent-style)', () => {
  it('releases losing branch holds after speculation', async () => {
    const result = await runTravelSpeculationDemo(3);
    expect(result.rolledBackBranches).toHaveLength(2);
    expect(result.releasedHolds).toBe(2);
    expect(result.activeHolds).toBe(1);
  });
});
