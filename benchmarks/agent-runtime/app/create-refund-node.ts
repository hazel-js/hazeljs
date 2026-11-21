/**
 * Hazeld factory for the conformance suite.
 * Tools come from ./agent.ts (@Agent / @Tool) via projectRoot — not skillHandlers.
 */
import * as fs from 'fs';
import * as path from 'path';
import { HazeldServer, type HazeldServerOptions } from '@hazeljs/agent';
import { AGENT_NAME } from '../agent';
import { scriptedRefundLlm } from './scripted-llm';

export { AGENT_NAME };

/** Suite root = hazel project (agent.ts + package.json). */
export const PROJECT_ROOT = path.resolve(__dirname, '..');

export interface RefundAppOptions {
  home: string;
  durableDir: string;
  socketPath: string;
  workerId: string;
  fakeBaseUrl: string;
  authHeader: string;
  orderId: string;
  amountMinor: number;
  operationKey: string;
  /** Optional policy JSON path — { "allowRefund": false } blocks at tool boundary. */
  policyPath?: string;
  runLeaseTtlMs?: number;
}

/** DNA catalog aligned with @Tool names on RefundConformanceAgent. */
export function refundDna() {
  return {
    name: AGENT_NAME,
    mission: 'Read the order, then propose a bounded refund when asked.',
    skills: [
      { name: 'read_order', description: 'Read an order' },
      {
        name: 'refund',
        description: 'Issue a bounded refund',
        requiresApproval: true,
      },
    ],
  };
}

/** Push run config into env so agent.ts @Tool handlers can read it. */
export function applyRefundEnv(opts: RefundAppOptions): void {
  process.env.FAKE_BASE_URL = opts.fakeBaseUrl;
  process.env.AUTH_HEADER = opts.authHeader;
  process.env.ORDER_ID = opts.orderId;
  process.env.AMOUNT_MINOR = String(opts.amountMinor);
  process.env.OPERATION_KEY = opts.operationKey;
  if (opts.policyPath) {
    process.env.POLICY_PATH = opts.policyPath;
  } else {
    delete process.env.POLICY_PATH;
  }
  delete process.env.ALLOW_REFUND;
}

export function createRefundHazeld(opts: RefundAppOptions): HazeldServer {
  fs.mkdirSync(opts.home, { recursive: true });
  fs.mkdirSync(opts.durableDir, { recursive: true });
  fs.mkdirSync(path.dirname(opts.socketPath), { recursive: true });
  applyRefundEnv(opts);

  const serverOpts: HazeldServerOptions = {
    home: opts.home,
    projectRoot: PROJECT_ROOT,
    socketPath: opts.socketPath,
    durableDir: opts.durableDir,
    workerId: opts.workerId,
    gatekeeperEnabled: false,
    jobTickMs: 60_000,
    reconcileMs: 60_000,
    llmProvider: scriptedRefundLlm(opts.orderId, opts.amountMinor),
    runtime: {
      runLeaseTtlMs: opts.runLeaseTtlMs ?? 5_000,
      enableRetry: false,
      enableCircuitBreaker: false,
    },
  };
  return new HazeldServer(serverOpts);
}
