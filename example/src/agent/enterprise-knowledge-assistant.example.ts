/**
 * Example: Internal Enterprise Knowledge Assistant (Corporate Copilot)
 * 
 * Real-world use case: Employees need quick answers to internal questions:
 * - "How do I deploy service X?"
 * - "What's our refund policy?"
 * - "Who owns service Y?"
 * - "What's the process for requesting PTO?"
 * 
 * This example demonstrates:
 * - RAG integration for knowledge base search
 * - Memory for conversation context
 * - Tool system for accessing internal systems
 * - Human-in-the-loop for sensitive operations
 */

import { Agent, Tool, AgentRuntime, AgentEventType } from '@hazeljs/agent';
import { MemoryManager, BufferMemory } from '@hazeljs/rag';
import { OpenAIProvider } from '@hazeljs/ai';

/**
 * Mock Services (replace with real implementations)
 */
class KnowledgeBaseService {
  async search(params: { query: string; category: string; limit: number }) {
    return [
      {
        title: 'Refund Policy - Customer Service Guide',
        summary:
          'Full refunds within 30 days, partial refunds up to 90 days. Requires manager approval for amounts over $500.',
        category: 'policies',
        lastUpdated: new Date('2024-12-01'),
        url: 'https://docs.acme.com/policies/refunds',
        score: 0.95,
      },
      {
        title: 'Deployment Runbook - Production Services',
        summary:
          'Step-by-step guide for deploying services to production. Includes rollback procedures and health checks.',
        category: 'runbooks',
        lastUpdated: new Date('2024-11-15'),
        url: 'https://docs.acme.com/runbooks/deployment',
        score: 0.88,
      },
    ];
  }

  async findExperts(topic: string) {
    return [
      {
        name: 'Alice Johnson',
        title: 'Senior SRE',
        team: 'Platform Engineering',
        expertise: ['Kubernetes', 'AWS', 'Terraform'],
        slackHandle: '@alice',
        email: 'alice@acme.com',
        availability: 'Available for questions',
      },
    ];
  }

  async getIncidentProcedure(severity: string) {
    return {
      immediateActions: [
        'Create incident in PagerDuty',
        'Join #incident-response Slack channel',
        'Page on-call engineer',
      ],
      escalationPath: ['On-call SRE', 'Engineering Manager', 'VP Engineering'],
      communicationPlan: 'Update status page every 15 minutes',
      postmortemRequired: severity === 'P0' || severity === 'P1',
      incidentChannel: '#incident-response',
      onCallContacts: ['sre-oncall@acme.com'],
      runbookUrl: 'https://docs.acme.com/incidents',
    };
  }
}

class ServiceRegistryService {
  async findService(name: string) {
    if (name.toLowerCase().includes('payment')) {
      return {
        name: 'payment-service',
        description: 'Handles payment processing and billing',
        ownerTeam: 'Payments Team',
        teamLead: 'Bob Smith',
        contactEmail: 'payments-team@acme.com',
        slackChannel: '#team-payments',
        currentOnCall: 'Carol Davis',
        onCallSchedule: 'https://pagerduty.com/schedules/payments',
        escalationPolicy: 'Payments → Engineering Manager → VP Eng',
        repoUrl: 'https://github.com/acme/payment-service',
        docsUrl: 'https://docs.acme.com/services/payment-service',
        healthStatus: 'healthy',
      };
    }
    return null;
  }

  async suggestSimilar(name: string) {
    return ['payment-service', 'payment-gateway', 'billing-service'];
  }
}

class HRSystemService {
  async searchPolicies(topic: string) {
    if (topic.toLowerCase().includes('pto')) {
      return {
        title: 'Paid Time Off (PTO) Policy',
        summary: 'Employees accrue 15 days of PTO per year, prorated monthly.',
        details:
          'PTO requests must be submitted at least 2 weeks in advance for periods longer than 3 days. Manager approval required. Unused PTO rolls over up to 5 days per year.',
        effectiveDate: new Date('2024-01-01'),
        category: 'Time Off',
        related: ['Holiday Schedule', 'Sick Leave Policy'],
        contactPerson: 'HR Team (hr@acme.com)',
        url: 'https://hr.acme.com/policies/pto',
      };
    }
    return null;
  }

  async submitPTO(params: {
    startDate: Date;
    endDate: Date;
    reason?: string;
  }) {
    const days = Math.ceil(
      (params.endDate.getTime() - params.startDate.getTime()) /
        (1000 * 60 * 60 * 24)
    );
    return {
      id: 'PTO-' + Date.now(),
      status: 'pending',
      daysRequested: days,
      remainingBalance: 12,
      approver: 'Jane Manager',
    };
  }
}

class DeploymentService {
  async getInstructions(serviceName: string, environment: string) {
    return {
      prerequisites: [
        'Ensure all tests pass',
        'Get code review approval',
        'Check service health dashboard',
      ],
      steps: [
        'Run: npm run build',
        'Run: npm run test',
        'Run: npm run deploy:' + environment,
        'Monitor logs for 5 minutes',
        'Run smoke tests',
      ],
      rollback: 'Run: npm run rollback:' + environment,
      estimatedDuration: '15 minutes',
      pipelineUrl: `https://ci.acme.com/pipelines/${serviceName}`,
      runbookUrl: `https://docs.acme.com/runbooks/${serviceName}`,
    };
  }

  async trigger(params: {
    service: string;
    environment: string;
    version: string;
  }) {
    return {
      id: 'DEPLOY-' + Date.now(),
      status: 'running',
      pipelineUrl: `https://ci.acme.com/deployments/DEPLOY-${Date.now()}`,
      estimatedCompletion: new Date(Date.now() + 15 * 60 * 1000),
      triggeredBy: 'enterprise-assistant',
      notificationChannel: '#deployments',
    };
  }
}

class SlackService {
  async notify(params: {
    channel: string;
    message: string;
    metadata?: any;
  }) {
    console.log(`[Slack] ${params.channel}: ${params.message}`);
    return { success: true };
  }
}

/**
 * Enterprise Knowledge Assistant Agent
 * Helps employees find information and perform common tasks
 */
@Agent({
  name: 'enterprise-assistant',
  description: 'Internal knowledge assistant for employee questions and tasks',
  systemPrompt: `You are a helpful enterprise knowledge assistant for Acme Corp employees.
You have access to:
- Company documentation and policies
- Service ownership information
- Deployment guides and runbooks
- HR policies and procedures

Always be professional, accurate, and cite your sources. If you're not sure about something,
say so and suggest who the employee should contact. For sensitive operations, explain why
approval is needed.`,
  enableMemory: true,
  enableRAG: true,
  ragTopK: 5,
  maxSteps: 15,
  temperature: 0.3, // Lower temperature for more factual responses
})
export class EnterpriseKnowledgeAssistant {
  constructor(
    private knowledgeBase: KnowledgeBaseService,
    private serviceRegistry: ServiceRegistryService,
    private hrSystem: HRSystemService,
    private deploymentService: DeploymentService,
    private slackService: SlackService
  ) {}

  /**
   * Search company documentation and policies
   */
  @Tool({
    description: 'Search company documentation, policies, runbooks, and guides',
    parameters: [
      {
        name: 'query',
        type: 'string',
        description: 'Search query (e.g., "refund policy", "deployment process")',
        required: true,
      },
      {
        name: 'category',
        type: 'string',
        description: 'Document category: policies, runbooks, guides, or all',
        required: false,
      },
    ],
  })
  async searchDocumentation(input: { query: string; category?: string }) {
    const results = await this.knowledgeBase.search({
      query: input.query,
      category: input.category || 'all',
      limit: 5,
    });

    return {
      found: results.length > 0,
      results: results.map((doc) => ({
        title: doc.title,
        summary: doc.summary,
        category: doc.category,
        lastUpdated: doc.lastUpdated,
        url: doc.url,
        relevanceScore: doc.score,
      })),
      message:
        results.length > 0
          ? `Found ${results.length} relevant documents`
          : 'No documents found. Try rephrasing your query.',
    };
  }

  /**
   * Look up service ownership and contact information
   */
  @Tool({
    description: 'Find who owns a service, team contact info, and on-call rotation',
    parameters: [
      {
        name: 'serviceName',
        type: 'string',
        description: 'Name of the service (e.g., "payment-service", "user-api")',
        required: true,
      },
    ],
  })
  async lookupServiceOwnership(input: { serviceName: string }) {
    const service = await this.serviceRegistry.findService(input.serviceName);

    if (!service) {
      return {
        found: false,
        message: `Service "${input.serviceName}" not found in registry. Try searching for similar names.`,
        suggestions: await this.serviceRegistry.suggestSimilar(input.serviceName),
      };
    }

    return {
      found: true,
      service: {
        name: service.name,
        description: service.description,
        owner: {
          team: service.ownerTeam,
          lead: service.teamLead,
          email: service.contactEmail,
          slackChannel: service.slackChannel,
        },
        onCall: {
          current: service.currentOnCall,
          schedule: service.onCallSchedule,
          escalation: service.escalationPolicy,
        },
        repository: service.repoUrl,
        documentation: service.docsUrl,
        status: service.healthStatus,
      },
    };
  }

  /**
   * Get deployment instructions for a service
   */
  @Tool({
    description: 'Get step-by-step deployment instructions for a service',
    parameters: [
      {
        name: 'serviceName',
        type: 'string',
        description: 'Name of the service to deploy',
        required: true,
      },
      {
        name: 'environment',
        type: 'string',
        description: 'Target environment: dev, staging, or production',
        required: true,
      },
    ],
  })
  async getDeploymentInstructions(input: {
    serviceName: string;
    environment: string;
  }) {
    const instructions = await this.deploymentService.getInstructions(
      input.serviceName,
      input.environment
    );

    if (!instructions) {
      return {
        found: false,
        message: `No deployment instructions found for ${input.serviceName} in ${input.environment}`,
      };
    }

    return {
      found: true,
      service: input.serviceName,
      environment: input.environment,
      prerequisites: instructions.prerequisites,
      steps: instructions.steps,
      rollbackProcedure: instructions.rollback,
      estimatedDuration: instructions.estimatedDuration,
      requiredApprovals:
        input.environment === 'production'
          ? ['team-lead', 'sre-on-call']
          : [],
      cicdPipeline: instructions.pipelineUrl,
      runbook: instructions.runbookUrl,
    };
  }

  /**
   * Trigger a deployment (requires approval for production)
   */
  @Tool({
    description: 'Trigger a deployment for a service',
    requiresApproval: true, // Always requires approval
    parameters: [
      {
        name: 'serviceName',
        type: 'string',
        description: 'Name of the service to deploy',
        required: true,
      },
      {
        name: 'environment',
        type: 'string',
        description: 'Target environment: dev, staging, or production',
        required: true,
      },
      {
        name: 'version',
        type: 'string',
        description: 'Version/tag to deploy',
        required: true,
      },
    ],
  })
  async triggerDeployment(input: {
    serviceName: string;
    environment: string;
    version: string;
  }) {
    const deployment = await this.deploymentService.trigger({
      service: input.serviceName,
      environment: input.environment,
      version: input.version,
    });

    // Notify team
    await this.slackService.notify({
      channel: deployment.notificationChannel,
      message: `🚀 Deployment started: ${input.serviceName} v${input.version} → ${input.environment}`,
      metadata: {
        deploymentId: deployment.id,
        triggeredBy: deployment.triggeredBy,
      },
    });

    return {
      success: true,
      deploymentId: deployment.id,
      status: deployment.status,
      pipelineUrl: deployment.pipelineUrl,
      estimatedCompletion: deployment.estimatedCompletion,
      message: `Deployment triggered successfully. Track progress at ${deployment.pipelineUrl}`,
    };
  }

  /**
   * Look up HR policies and procedures
   */
  @Tool({
    description: 'Search HR policies, benefits, PTO, expenses, and procedures',
    parameters: [
      {
        name: 'topic',
        type: 'string',
        description:
          'HR topic (e.g., "PTO", "expense reimbursement", "benefits")',
        required: true,
      },
    ],
  })
  async lookupHRPolicy(input: { topic: string }) {
    const policy = await this.hrSystem.searchPolicies(input.topic);

    if (!policy) {
      return {
        found: false,
        message: `No HR policy found for "${input.topic}". Contact hr@acme.com for assistance.`,
      };
    }

    return {
      found: true,
      policy: {
        title: policy.title,
        summary: policy.summary,
        details: policy.details,
        effectiveDate: policy.effectiveDate,
        category: policy.category,
        relatedPolicies: policy.related,
        contactPerson: policy.contactPerson,
        documentUrl: policy.url,
      },
    };
  }

  /**
   * Submit a PTO request
   */
  @Tool({
    description: 'Submit a paid time off (PTO) request',
    requiresApproval: true,
    parameters: [
      {
        name: 'startDate',
        type: 'string',
        description: 'Start date (YYYY-MM-DD)',
        required: true,
      },
      {
        name: 'endDate',
        type: 'string',
        description: 'End date (YYYY-MM-DD)',
        required: true,
      },
      {
        name: 'reason',
        type: 'string',
        description: 'Reason for PTO (optional)',
        required: false,
      },
    ],
  })
  async submitPTORequest(input: {
    startDate: string;
    endDate: string;
    reason?: string;
  }) {
    const request = await this.hrSystem.submitPTO({
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
      reason: input.reason,
    });

    return {
      success: true,
      requestId: request.id,
      status: request.status,
      daysRequested: request.daysRequested,
      remainingBalance: request.remainingBalance,
      approver: request.approver,
      message: `PTO request submitted. Your manager (${request.approver}) will review it.`,
    };
  }

  /**
   * Find an expert or team for a specific topic
   */
  @Tool({
    description: 'Find internal experts or teams for a specific technology or domain',
    parameters: [
      {
        name: 'topic',
        type: 'string',
        description:
          'Technology or domain (e.g., "Kubernetes", "machine learning", "payments")',
        required: true,
      },
    ],
  })
  async findExpert(input: { topic: string }) {
    const experts = await this.knowledgeBase.findExperts(input.topic);

    return {
      found: experts.length > 0,
      experts: experts.map((expert) => ({
        name: expert.name,
        title: expert.title,
        team: expert.team,
        expertise: expert.expertise,
        slackHandle: expert.slackHandle,
        email: expert.email,
        availability: expert.availability,
      })),
      message:
        experts.length > 0
          ? `Found ${experts.length} experts in ${input.topic}`
          : `No experts found. Try posting in #engineering-help on Slack.`,
    };
  }

  /**
   * Get incident response procedures
   */
  @Tool({
    description: 'Get incident response procedures and escalation paths',
    parameters: [
      {
        name: 'severity',
        type: 'string',
        description: 'Incident severity: P0 (critical), P1 (high), P2 (medium), P3 (low)',
        required: true,
      },
    ],
  })
  async getIncidentProcedure(input: { severity: string }) {
    const procedure = await this.knowledgeBase.getIncidentProcedure(
      input.severity
    );

    return {
      severity: input.severity,
      procedure: {
        immediateActions: procedure.immediateActions,
        escalationPath: procedure.escalationPath,
        communicationPlan: procedure.communicationPlan,
        postmortemRequired: procedure.postmortemRequired,
        slackChannel: procedure.incidentChannel,
        onCallContacts: procedure.onCallContacts,
        runbookUrl: procedure.runbookUrl,
      },
      message: `Retrieved ${input.severity} incident response procedure`,
    };
  }
}

/**
 * Main Example
 */
async function main() {
  console.log('🏢 Enterprise Knowledge Assistant - Corporate Copilot\n');

  // Initialize services
  const knowledgeBase = new KnowledgeBaseService();
  const serviceRegistry = new ServiceRegistryService();
  const hrSystem = new HRSystemService();
  const deploymentService = new DeploymentService();
  const slackService = new SlackService();

  // Initialize memory manager (with RAG)
  const bufferStore = new BufferMemory({ maxSize: 100 });
  await bufferStore.initialize();
  
  const memoryManager = new MemoryManager(bufferStore, {
    maxConversationLength: 20,
    summarizeAfter: 50,
  });

  // Initialize OpenAI provider
  const openaiProvider = new OpenAIProvider(process.env.OPENAI_API_KEY, {
    defaultModel: 'gpt-4-turbo-preview',
  });

  // Create LLM provider adapter for agent runtime
  const llmProvider = {
    chat: async (options: any) => {
      const response = await openaiProvider.complete({
        messages: options.messages,
        temperature: 0.3,
        maxTokens: 2000,
      });

      // Convert OpenAI response to agent runtime format
      return {
        content: response.content,
        tool_calls: response.functionCall
          ? [
              {
                id: response.id,
                type: 'function' as const,
                function: {
                  name: response.functionCall.name,
                  arguments: response.functionCall.arguments,
                },
              },
            ]
          : [],
      };
    },
  };

  // Initialize agent runtime
  const runtime = new AgentRuntime({
    memoryManager,
    llmProvider,
    defaultMaxSteps: 15,
    enableObservability: true,
  });

  // Register agent class and create instance
  runtime.registerAgent(EnterpriseKnowledgeAssistant as any);
  
  const assistant = new EnterpriseKnowledgeAssistant(
    knowledgeBase,
    serviceRegistry,
    hrSystem,
    deploymentService,
    slackService
  );

  runtime.registerAgentInstance('enterprise-assistant', assistant);

  // Handle approval requests
  runtime.on(AgentEventType.TOOL_APPROVAL_REQUESTED, async (event: any) => {
    console.log('\n⚠️  Approval Required:');
    console.log('Tool:', event.data.toolName);
    console.log('Input:', JSON.stringify(event.data.input, null, 2));
    console.log('\nSimulating manager approval in 2 seconds...');

    setTimeout(() => {
      runtime.approveToolExecution(event.data.requestId, 'manager-user-789');
      console.log('✅ Approved by manager\n');
    }, 2000);
  });

  // Log all events
  runtime.onAny((event: any) => {
    if (event.type !== 'agent.step.started' && event.type !== 'agent.step.completed') {
      console.log(`[${event.type}]`, event.data);
    }
  });

  // Example 1: Ask about refund policy
  console.log('📝 Example 1: "What\'s our refund policy?"\n');
  const result1 = await runtime.execute(
    'enterprise-assistant',
    "What's our refund policy?",
    {
      sessionId: 'employee-session-123',
      userId: 'employee-456',
      enableMemory: true,
      enableRAG: true,
    }
  );
  console.log('\n✅ Response:', result1.response);
  console.log(`Completed in ${result1.steps.length} steps (${result1.duration}ms)\n`);

  // Example 2: Ask about service ownership
  console.log('\n---\n');
  console.log('📝 Example 2: "Who owns the payment service?"\n');
  const result2 = await runtime.execute(
    'enterprise-assistant',
    'Who owns the payment service?',
    {
      sessionId: 'employee-session-123',
      userId: 'employee-456',
      enableMemory: true,
    }
  );
  console.log('\n✅ Response:', result2.response);
  console.log(`Completed in ${result2.steps.length} steps (${result2.duration}ms)\n`);

  // Example 3: Ask about deployment
  console.log('\n---\n');
  console.log('📝 Example 3: "How do I deploy the payment service to staging?"\n');
  const result3 = await runtime.execute(
    'enterprise-assistant',
    'How do I deploy the payment service to staging?',
    {
      sessionId: 'employee-session-123',
      userId: 'employee-456',
      enableMemory: true,
    }
  );
  console.log('\n✅ Response:', result3.response);
  console.log(`Completed in ${result3.steps.length} steps (${result3.duration}ms)\n`);

  console.log('\n🎉 Enterprise Knowledge Assistant examples completed!');
}

if (require.main === module) {
  main().catch(console.error);
}
