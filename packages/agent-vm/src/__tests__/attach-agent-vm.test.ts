import { AgentRuntime, AgentStateManager } from '@hazeljs/agent';
import {
  attachAgentVm,
  attachAndBindAgentVm,
  createAgentVmFromRuntime,
  getBoundAgentVm,
} from '../runtime/attach-agent-vm';

describe('attachAgentVm', () => {
  function makeRuntime(): AgentRuntime {
    return new AgentRuntime({
      stateManager: new AgentStateManager(),
      enableMetrics: false,
      enableRetry: false,
      enableCircuitBreaker: false,
      enableAgentRuns: false,
    });
  }

  it('createAgentVmFromRuntime resolves state from runtime', () => {
    const runtime = makeRuntime();
    const vm = createAgentVmFromRuntime(runtime);
    expect(vm.effectGate).toBeDefined();
    expect(vm.journal).toBeDefined();
    expect(vm.coordinator).toBeDefined();
    expect(vm.scheduler).toBeDefined();
  });

  it('attachAgentVm wires setEffectGate', () => {
    const runtime = makeRuntime();
    const setSpy = jest.spyOn(runtime, 'setEffectGate');
    const vm = attachAgentVm(runtime, { barrierMode: 'abort' });
    expect(setSpy).toHaveBeenCalledWith(vm.effectGate);
  });

  it('attachAndBindAgentVm stores bundle for getBoundAgentVm', () => {
    const runtime = makeRuntime();
    const vm = attachAndBindAgentVm(runtime);
    expect(getBoundAgentVm(runtime)).toBe(vm);
  });
});
