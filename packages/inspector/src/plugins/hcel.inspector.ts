/**
 * HCEL trace inspector — requires @hazeljs/ai
 */

import type { HazelInspectorPlugin, InspectorEntry } from '../contracts/types';

function tryGetAI(): boolean {
  try {
    require.resolve('@hazeljs/ai');
    return true;
  } catch {
    return false;
  }
}

export const hcelInspector: HazelInspectorPlugin = {
  name: 'hcel',
  version: '1.0.0',
  supports: () => tryGetAI(),
  inspect: async (): Promise<InspectorEntry[]> => {
    if (!tryGetAI()) return [];
    try {
      const ai = require('@hazeljs/ai') as {
        getHCELTraceSnapshot?: () => unknown[];
        setHCELGlobalTraceEnabled?: (v: boolean) => void;
      };
      ai.setHCELGlobalTraceEnabled?.(true);
      const trace = ai.getHCELTraceSnapshot?.() ?? [];
      return [
        {
          id: 'hcel:trace',
          kind: 'decorator',
          packageName: '@hazeljs/ai',
          decoratorName: 'HCELTrace',
          targetType: 'class',
          targetClass: 'HCELEngine',
          decoratorArguments: [{ bufferedEvents: trace.length }],
        },
      ];
    } catch {
      return [];
    }
  },
};
