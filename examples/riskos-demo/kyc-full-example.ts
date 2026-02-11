/**
 * RiskOS - Comprehensive KYC Individual Onboarding Example
 *
 * Full flow: questions -> validation -> sanctions check -> doc verify (optional) -> decision
 */

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
  type KycFlowConfig,
  type KycSession,
} from '@hazeljs/riskos';
import { DecisionStatus } from '@hazeljs/contracts';

// ═══════════════════════════════════════════════════════════════════════════════
// KYC Question Set - Individual Onboarding (SE/UK/EU style)
// ═══════════════════════════════════════════════════════════════════════════════

const KYC_QUESTIONS: KycFlowConfig['steps'] = [
  // --- Personal info ---
  {
    type: 'ask',
    config: {
      fieldPath: 'fullName',
      message: 'What is your full legal name as it appears on your ID?',
      inputType: 'text',
    },
  },
  {
    type: 'ask',
    config: {
      fieldPath: 'email',
      message: 'Please provide your email address.',
      inputType: 'text',
    },
  },
  {
    type: 'ask',
    config: {
      fieldPath: 'dateOfBirth',
      message: 'What is your date of birth? (YYYY-MM-DD)',
      inputType: 'text',
    },
  },
  {
    type: 'ask',
    config: {
      fieldPath: 'nationality',
      message: 'What is your nationality?',
      inputType: 'select',
      options: ['SE', 'NO', 'DK', 'FI', 'DE', 'UK', 'US', 'OTHER'],
    },
  },

  // --- Address ---
  {
    type: 'ask',
    config: {
      fieldPath: 'address.street',
      message: 'What is your residential address (street and number)?',
      inputType: 'text',
    },
  },
  {
    type: 'ask',
    config: {
      fieldPath: 'address.city',
      message: 'City?',
      inputType: 'text',
    },
  },
  {
    type: 'ask',
    config: {
      fieldPath: 'address.postalCode',
      message: 'Postal / ZIP code?',
      inputType: 'text',
    },
  },
  {
    type: 'ask',
    config: {
      fieldPath: 'address.country',
      message: 'Country of residence?',
      inputType: 'select',
      options: ['SE', 'NO', 'DK', 'FI', 'DE', 'UK', 'US', 'OTHER'],
    },
  },

  // --- ID document ---
  {
    type: 'ask',
    config: {
      fieldPath: 'idType',
      message: 'What type of ID will you use for verification?',
      inputType: 'select',
      options: ['passport', 'national_id', 'drivers_license'],
    },
  },
  {
    type: 'ask',
    config: {
      fieldPath: 'idNumber',
      message: 'Enter your ID document number (last 4 digits only for demo).',
      inputType: 'text',
    },
  },

  // --- Compliance ---
  {
    type: 'ask',
    config: {
      fieldPath: 'taxResidence',
      message: 'Which country is your tax residence?',
      inputType: 'select',
      options: ['SE', 'NO', 'DK', 'FI', 'DE', 'UK', 'US', 'OTHER'],
    },
  },
  {
    type: 'ask',
    config: {
      fieldPath: 'employmentStatus',
      message: 'What is your employment status?',
      inputType: 'select',
      options: ['employed', 'self_employed', 'student', 'retired', 'unemployed', 'other'],
    },
  },
  {
    type: 'ask',
    config: {
      fieldPath: 'sourceOfFunds',
      message: 'What is your primary source of funds?',
      inputType: 'select',
      options: ['salary', 'business', 'investment', 'inheritance', 'savings', 'other'],
    },
  },
  {
    type: 'ask',
    config: {
      fieldPath: 'isPep',
      message: 'Are you a Politically Exposed Person (PEP) or close associate of a PEP?',
      inputType: 'select',
      options: ['no', 'yes'],
    },
  },
  {
    type: 'ask',
    config: {
      fieldPath: 'purposeOfAccount',
      message: 'What is the main purpose of this account?',
      inputType: 'select',
      options: ['personal_banking', 'investments', 'business', 'receiving_payments', 'other'],
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// Validation, API, Transform, Verify, Decide steps
// ═══════════════════════════════════════════════════════════════════════════════

const PERSONAL_INFO_SCHEMA = {
  type: 'object',
  properties: {
    fullName: { type: 'string', minLength: 2 },
    email: { type: 'string', format: 'email' },
    dateOfBirth: { type: 'string', format: 'date' },
    nationality: { type: 'string' },
  },
  required: ['fullName', 'email', 'dateOfBirth', 'nationality'],
};

const ADDRESS_SCHEMA = {
  type: 'object',
  properties: {
    address: {
      type: 'object',
      properties: {
        street: { type: 'string', minLength: 2 },
        city: { type: 'string', minLength: 2 },
        postalCode: { type: 'string', minLength: 2 },
        country: { type: 'string' },
      },
      required: ['street', 'city', 'postalCode', 'country'],
    },
  },
  required: ['address'],
};

const FULL_KYC_FLOW: KycFlowConfig = {
  steps: [
    ...KYC_QUESTIONS,

    // Validate personal info
    {
      type: 'validate',
      config: { from: 'answers', schema: PERSONAL_INFO_SCHEMA },
    },
    // Validate address
    {
      type: 'validate',
      config: { from: 'answers', schema: ADDRESS_SCHEMA },
    },

    // Sanctions / AML check - uses name, dob, nationality from answers
    {
      type: 'apiCall',
      config: {
        provider: 'sanctions',
        operation: {
          method: 'POST',
          path: '/v1/screen',
          body: {
            name: '{{answers.fullName}}',
            dob: '{{answers.dateOfBirth}}',
            nationality: '{{answers.nationality}}',
          },
        },
        storeAt: 'sanctions',
      },
    },

    // Optional doc verify (mock)
    {
      type: 'apiCall',
      config: {
        provider: 'docVerify',
        operation: {
          method: 'POST',
          path: '/v1/verify',
          body: {
            idType: '{{answers.idType}}',
            idNumber: '{{answers.idNumber}}',
          },
        },
        storeAt: 'docVerify',
      },
    },

    // Transform API responses to normalized structure
    {
      type: 'transform',
      config: {
        mappings: [
          { from: 'sanctions.match', to: 'sanctionsMatch' },
          { from: 'sanctions.status', to: 'sanctionsStatus' },
          { from: 'docVerify.verified', to: 'docVerified' },
        ],
      },
    },

    // Verify checks
    {
      type: 'verify',
      config: {
        checkType: 'sanctions',
        resultPath: 'sanctions',
        checkName: 'sanctions_check',
      },
    },
    {
      type: 'verify',
      config: {
        checkType: 'doc_verify',
        resultPath: 'docVerify',
        checkName: 'doc_verify_check',
      },
    },

    // Final decision
    {
      type: 'decide',
      config: {
        ruleset: {
          rules: [
            {
              when: { path: 'sanctionsMatch', eq: true },
              reason: 'Sanctions list match - requires manual review',
              status: 'REVIEW',
            },
            {
              when: { path: 'isPep', eq: 'yes' },
              reason: 'PEP status - enhanced due diligence required',
              status: 'REVIEW',
            },
            {
              when: { path: 'docVerified', eq: false },
              reason: 'ID verification failed',
              status: 'REJECTED',
            },
            {
              when: { path: 'sanctionsStatus', eq: 'clear' },
              reason: 'All checks passed',
              status: 'APPROVED',
            },
          ],
          defaultStatus: 'REVIEW',
        },
      },
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// Demo runner
// ═══════════════════════════════════════════════════════════════════════════════

/** Simulated user answers for demo */
const DEMO_ANSWERS: Record<string, unknown> = {
  fullName: 'Anna Andersson',
  email: 'anna.andersson@example.com',
  dateOfBirth: '1985-03-15',
  nationality: 'SE',
  'address.street': 'Storgatan 42',
  'address.city': 'Stockholm',
  'address.postalCode': '111 22',
  'address.country': 'SE',
  idType: 'passport',
  idNumber: '****1234',
  taxResidence: 'SE',
  employmentStatus: 'employed',
  sourceOfFunds: 'salary',
  isPep: 'no',
  purposeOfAccount: 'personal_banking',
};

async function runFullKycExample() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  RiskOS - Full KYC Individual Onboarding Example');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // 1. Setup
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

  const store = new MemoryKycStore();
  const providers = {
    sanctions: new MockHttpProvider('sanctions', {
      mockResponse: {
        match: false,
        status: 'clear',
        screenedAt: new Date().toISOString(),
      },
    }),
    docVerify: new MockHttpProvider('docVerify', {
      mockResponse: {
        verified: true,
        confidence: 0.95,
        idType: 'passport',
      },
    }),
  };

  const kycEngine = new KycEngine(store, providers);

  // 2. Create session
  const session = await kycEngine.createSession('tenant-acme');
  console.log('Session created:', session.id);
  console.log('Tenant: tenant-acme\n');

  // 3. Chat-based question loop - simulate user answering each question
  console.log('--- Step 1: Collecting information ---\n');
  let turn = nextChatTurn(session, FULL_KYC_FLOW);
  let stepNum = 1;

  while (turn && turn.message) {
    const fieldPath = turn.fieldPath;
    const answer = DEMO_ANSWERS[fieldPath];
    const displayValue = answer ?? '(demo: using default)';

    console.log(`  Q${stepNum}: ${turn.message}`);
    console.log(`      → ${fieldPath}: ${displayValue}\n`);

    await kycEngine.answer(session.id, fieldPath, answer ?? `demo-${fieldPath}`);
    const updated = await kycEngine.getSession(session.id);
    if (!updated) break;
    turn = nextChatTurn(updated, FULL_KYC_FLOW);
    stepNum++;
  }

  console.log(`  ✓ All ${stepNum - 1} questions answered.\n`);

  // 4. Run validation and backend steps (no more ask steps)
  console.log('--- Step 2: Validation & backend checks ---\n');

  await riskos.run(
    'kyc.onboarding.complete',
    {
      tenantId: 'tenant-acme',
      actor: { userId: 'sys', role: 'admin' },
      purpose: 'kyc',
    },
    async () => {
      await kycEngine.runFlow(session.id, FULL_KYC_FLOW);
      return null;
    },
  );

  const finalSession = await kycEngine.getSession(session.id);
  if (!finalSession) throw new Error('Session lost');

  // 5. Output summary
  console.log('--- Step 3: Result ---\n');
  console.log('  Sanctions check:', finalSession.raw?.sanctions);
  console.log('  Doc verify:', finalSession.raw?.docVerify);
  console.log('  Checks:', JSON.stringify(finalSession.checks, null, 2));
  console.log('  Decision:', finalSession.decision);
  console.log('');

  // 6. Evidence pack
  const pack = await auditSink.buildEvidencePack({ tenantId: 'tenant-acme' });
  console.log('--- Evidence ---');
  console.log('  Pack:', pack.id);
  console.log('  Traces:', pack.manifest.traceCount);
}

runFullKycExample().catch(console.error);
