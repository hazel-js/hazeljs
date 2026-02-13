/**
 * RiskOS Interactive Chat - Full KYC Onboarding + Investigator
 * Do KYC onboarding via chat, then ask investigator questions with streaming AI
 *
 * Run: npm run chat
 * Requires: OPENAI_API_KEY (for investigator mode)
 */

import * as readline from 'readline';
import { AIEnhancedService } from '@hazeljs/ai';
import {
  createKycToolFromStore,
  createEvidenceToolFromAuditSink,
} from '@hazeljs/riskos-agent';
import {
  createRiskOS,
  MemoryEventBus,
  MemoryAuditSink,
  MemoryKycStore,
  KycEngine,
  MockHttpProvider,
  nextChatTurn,
  requireTenant,
  PolicyEngine,
} from '@hazeljs/riskos';
import { FULL_KYC_FLOW, getValidationCheckpoint } from './kyc-flow-config';
import type { KycSession } from '@hazeljs/riskos';

function ajvPathToFieldPath(path: string): string {
  return path.replace(/^\//, '').replace(/\//g, '.');
}

function getAskStepForFieldPath(fieldPath: string) {
  const step = FULL_KYC_FLOW.steps.find(
    (s) => s.type === 'ask' && s.config.fieldPath === fieldPath
  );
  return step?.type === 'ask' ? step.config : null;
}

const SYSTEM_PROMPT = `You are a compliance investigator assistant for banking and fintech.
You help analysts investigate cases using KYC status, evidence packs, and risk data.
Be concise and professional. Cite sources when you have data.`;

type Message = { role: 'system' | 'user' | 'assistant'; content: string };

type ChatState = 'idle' | 'kyc' | 'kyc_complete';

async function buildContext(
  kycStore: MemoryKycStore,
  auditSink: MemoryAuditSink,
  kycTool: ReturnType<typeof createKycToolFromStore>,
  sessionId: string
): Promise<string> {
  const parts: string[] = ['## Current Context\n'];

  try {
    const kycStatus = await kycTool.getKycStatus(sessionId);
    parts.push(`### KYC (${sessionId}): status=${kycStatus.status}, decision=${kycStatus.decision ?? 'N/A'}`);
  } catch {
    parts.push('### KYC: No data');
  }

  try {
    const pack = await auditSink.buildEvidencePack({});
    parts.push(`\n### Audit: ${pack.manifest.traceCount} traces`);
    if (pack.traces.length > 0) {
      const recent = pack.traces.slice(0, 3).map((t: { requestId?: string; actionName?: string }) =>
        `${t.requestId} (${t.actionName})`
      );
      parts.push(`Recent: ${recent.join(', ')}`);
    }
  } catch {
    parts.push('\n### Audit: No traces');
  }

  return parts.join('\n');
}

async function streamResponse(
  ai: AIEnhancedService,
  messages: Message[],
  model = 'gpt-4'
): Promise<string> {
  let fullContent = '';
  process.stdout.write('Assistant: ');

  for await (const chunk of ai.streamComplete(
    { messages, model },
    { provider: 'openai' }
  )) {
    if (chunk.delta) {
      process.stdout.write(chunk.delta);
      fullContent += chunk.delta;
    }
  }
  process.stdout.write('\n\n');
  return fullContent;
}

function parseSelectAnswer(input: string, options?: string[]): string | null {
  const trimmed = input.trim();
  if (!options?.length) return trimmed || null;
  const idx = parseInt(trimmed, 10);
  if (!isNaN(idx) && idx >= 1 && idx <= options.length) {
    return options[idx - 1];
  }
  const match = options.find((o) => o.toLowerCase() === trimmed.toLowerCase());
  return match ?? (trimmed ? trimmed : null);
}

async function main() {
  console.log('🔍 RiskOS Chat - KYC Onboarding + Investigator\n');
  console.log('Commands:');
  console.log('  /start kyc    - Begin KYC onboarding');
  console.log('  /quit         - Exit');
  if (process.env.OPENAI_API_KEY) {
    console.log('  /refresh      - Refresh investigator context (after KYC)');
  }
  console.log('');

  const bus = new MemoryEventBus();
  const auditSink = new MemoryAuditSink();
  const policyEngine = new PolicyEngine();
  policyEngine.addPolicy(requireTenant());

  const riskos = createRiskOS({
    bus,
    auditSink,
    policyEngine,
    enforcePolicies: true,
  });

  const kycStore = new MemoryKycStore();
  const providers = {
    sanctions: new MockHttpProvider('sanctions', {
      mockResponse: { match: false, status: 'clear', screenedAt: new Date().toISOString() },
    }),
    docVerify: new MockHttpProvider('docVerify', {
      mockResponse: { verified: true, confidence: 0.95, idType: 'passport' },
    }),
  };

  const kycEngine = new KycEngine(kycStore, providers);
  const kycTool = createKycToolFromStore(kycStore);

  let state: ChatState = 'idle';
  let session: KycSession | null = null;
  let currentTurn: ReturnType<typeof nextChatTurn> | null = null;
  let lastPassedValidationIndex = 0;
  const conversation: Message[] = [];
  const ai = process.env.OPENAI_API_KEY ? new AIEnhancedService() : null;

  const getSystemMessage = async () => {
    if (!session) return SYSTEM_PROMPT;
    const ctx = await buildContext(kycStore, auditSink, kycTool, session.id);
    return `${SYSTEM_PROMPT}\n\n${ctx}`;
  };

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const promptUser = async () => {
    rl.question('You: ', async (input) => {
      const trimmed = input.trim();
      if (!trimmed) {
        promptUser();
        return;
      }

      if (trimmed === '/quit' || trimmed === '/exit') {
        console.log('👋 Goodbye!');
        rl.close();
        return;
      }

      if (trimmed === '/refresh' && state === 'kyc_complete' && ai) {
        console.log('✅ Context refreshed.\n');
        promptUser();
        return;
      }

      if ((trimmed === '/start kyc' || trimmed === 'start kyc') && state === 'idle') {
        session = await kycEngine.createSession('tenant-1');
        state = 'kyc';
        lastPassedValidationIndex = 0;
        currentTurn = nextChatTurn(session, FULL_KYC_FLOW);
        console.log(`\n📋 KYC Onboarding started. Session: ${session.id}\n`);
        if (currentTurn?.message) {
          const opts = currentTurn.options?.length
            ? ` (options: ${currentTurn.options.map((o, i) => `${i + 1}=${o}`).join(', ')})`
            : '';
          console.log(`Q: ${currentTurn.message}${opts}\n`);
        }
        promptUser();
        return;
      }

      if (state === 'kyc' && session && currentTurn) {
        const fieldPath = currentTurn.fieldPath;
        const parsed = currentTurn.options
          ? parseSelectAnswer(trimmed, currentTurn.options)
          : trimmed;
        if (parsed === null && currentTurn.options) {
          console.log(`Please choose from: ${currentTurn.options.join(', ')}\n`);
          promptUser();
          return;
        }

        await kycEngine.answer(session.id, fieldPath, parsed ?? trimmed);
        let updated = await kycEngine.getSession(session.id);
        if (!updated) {
          console.log('Session error.\n');
          promptUser();
          return;
        }
        session = updated;

        // Run validation when we have all required fields for the next checkpoint
        const checkpointResult = getValidationCheckpoint(session.answers as Record<string, unknown>, lastPassedValidationIndex);
        if (checkpointResult) {
          const { checkpoint, index } = checkpointResult;
          const result = await kycEngine.validate(session.id, {
            from: checkpoint.from,
            schema: checkpoint.schema,
          });
          if (!result.valid && result.errors?.length) {
            const firstErr = result.errors[0];
            const errFieldPath = ajvPathToFieldPath(firstErr.path);
            const askConfig = getAskStepForFieldPath(errFieldPath);
            console.log(`⚠️  ${firstErr.message}`);
            if (result.errors.length > 1) {
              console.log(`   Other issues: ${result.errors.slice(1).map((e) => ajvPathToFieldPath(e.path)).join(', ')}`);
            }
            if (askConfig) {
              currentTurn = {
                message: askConfig.message,
                inputType: askConfig.inputType ?? 'text',
                fieldPath: askConfig.fieldPath,
                options: askConfig.options,
              };
              const opts = currentTurn.options?.length
                ? ` (options: ${currentTurn.options.map((o, i) => `${i + 1}=${o}`).join(', ')})`
                : '';
              console.log(`\nQ: ${currentTurn.message}${opts}\n`);
            }
            promptUser();
            return;
          }
          lastPassedValidationIndex = index + 1;
        }

        currentTurn = nextChatTurn(updated, FULL_KYC_FLOW);

        if (currentTurn?.message) {
          const opts = currentTurn.options?.length
            ? ` (options: ${currentTurn.options.map((o, i) => `${i + 1}=${o}`).join(', ')})`
            : '';
          console.log(`Q: ${currentTurn.message}${opts}\n`);
          promptUser();
          return;
        }

        console.log('✓ All questions answered. Running validation and checks...\n');

        await riskos.run(
          'kyc.onboarding.complete',
          { tenantId: 'tenant-1', actor: { userId: 'user', role: 'applicant' }, purpose: 'kyc' },
          async () => {
            await kycEngine.runFlow(session!.id, FULL_KYC_FLOW);
            return null;
          }
        );

        const final = await kycEngine.getSession(session.id);
        if (!final) throw new Error('Session lost');
        session = final;
        state = 'kyc_complete';
        currentTurn = null;

        console.log('--- KYC Result ---');
        console.log(`Decision: ${final.decision?.status ?? 'N/A'}`);
        console.log(`Reasons: ${(final.decision?.reasons ?? []).join(', ')}`);
        console.log('');
        console.log('You can now ask the investigator anything about your session.\n');

        promptUser();
        return;
      }

      if (state === 'kyc_complete' && ai) {
        conversation.push({ role: 'user', content: trimmed });
        const systemContent = await getSystemMessage();
        const requestMessages: Message[] = [
          { role: 'system', content: systemContent },
          ...conversation,
        ];

        try {
          const response = await streamResponse(ai, requestMessages, 'gpt-4');
          conversation.push({ role: 'assistant', content: response });
        } catch (err) {
          console.error('Error:', err instanceof Error ? err.message : err);
          conversation.pop();
        }
        promptUser();
        return;
      }

      if (state === 'idle' && !session && trimmed !== '/start kyc') {
        if (ai) {
          console.log('Type /start kyc to begin KYC onboarding first.\n');
        } else {
          console.log('Type /start kyc to begin KYC onboarding. Set OPENAI_API_KEY for investigator chat.\n');
        }
      }

      promptUser();
    });
  };

  promptUser();
}

main().catch(console.error);
