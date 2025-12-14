/**
 * Agentic RAG + Agent Runtime Integration Example
 * Shows how to integrate Agentic RAG with @hazeljs/agent
 */

// Load environment variables
import * as dotenv from 'dotenv';
dotenv.config();

import { Agent, Tool, AgentRuntime } from '@hazeljs/agent';
import {
  AgenticRAGService,
  QueryPlanner,
  SelfReflective,
  AdaptiveRetrieval,
  HyDE,
  ContextAware,
  Cached,
} from '@hazeljs/rag/src/agentic';
import { MemoryVectorStore } from '@hazeljs/rag/src/vector-stores/memory-vector-store';
import { OpenAIEmbeddings } from '@hazeljs/rag/src/embeddings/openai-embeddings';
import { MemoryManager, BufferMemory } from '@hazeljs/rag';
import { Document } from '@hazeljs/rag/src/types';

/**
 * Research Agent with Agentic RAG capabilities
 */
@Agent({
  name: 'research-agent',
  description: 'AI research assistant with advanced agentic RAG capabilities',
  systemPrompt: 'You are an expert research assistant with access to a knowledge base. Use your tools to find accurate information.',
})
class ResearchAgent {
  constructor(private agenticRAG: AgenticRAGService) {}

  @Tool({
    description: 'Search the knowledge base for information',
    parameters: [
      {
        name: 'query',
        type: 'string',
        required: true,
        description: 'Search query',
      },
    ],
  })
  async search(input: { query: string }) {
    const results = await this.agenticRAG.retrieve(input.query, { topK: 3 });
    
    return {
      results: results.map(r => ({
        content: r.content,
        source: r.metadata?.source,
        score: r.score,
      })),
      count: results.length,
    };
  }

  @Tool({
    description: 'Perform deep research with multi-hop reasoning',
    parameters: [
      {
        name: 'query',
        type: 'string',
        required: true,
        description: 'Complex research question',
      },
    ],
  })
  async deepResearch(input: { query: string }) {
    const chain = await this.agenticRAG.deepRetrieve(input.query);
    
    return {
      answer: chain.finalAnswer || 'Research completed',
      hops: chain.hops?.length || 0,
      confidence: chain.confidence || 0,
      sources: chain.sources?.slice(0, 5).map(s => s.content.slice(0, 100)),
    };
  }

  @Tool({
    description: 'Search with HyDE for abstract or conceptual queries',
    parameters: [
      {
        name: 'query',
        type: 'string',
        required: true,
        description: 'Abstract or conceptual query',
      },
    ],
  })
  async conceptualSearch(input: { query: string }) {
    const results = await this.agenticRAG.hydeRetrieve(input.query, { topK: 3 });
    
    return {
      results: results.map(r => r.content.slice(0, 150)),
      technique: 'HyDE (Hypothetical Document Embeddings)',
    };
  }

  @Tool({
    description: 'Get verified information with source citations',
    parameters: [
      {
        name: 'query',
        type: 'string',
        required: true,
        description: 'Query requiring verified sources',
      },
    ],
  })
  async verifiedSearch(input: { query: string }) {
    const results = await this.agenticRAG.verifiedRetrieve(input.query, { topK: 3 });
    
    return {
      results: results.map(r => ({
        content: r.content.slice(0, 150),
        source: r.metadata?.source,
        verified: (r as any).verification?.verified || false,
        authorityScore: (r as any).verification?.authorityScore || 0,
      })),
    };
  }
}

async function integrationExample() {
  console.log('🤝 Agentic RAG + Agent Runtime Integration Example\n');

  // 1. Setup Agentic RAG
  const embeddings = new OpenAIEmbeddings({
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'text-embedding-3-small',
  });
  const vectorStore = new MemoryVectorStore(embeddings);
  await vectorStore.initialize();

  // Add knowledge base
  const documents: Document[] = [
    {
      id: '1',
      content: 'Quantum computing uses quantum bits (qubits) that can exist in superposition, enabling parallel computation.',
      metadata: { source: 'quantum-computing.pdf', timestamp: new Date() },
    },
    {
      id: '2',
      content: 'Blockchain is a distributed ledger technology that ensures transparency and immutability through cryptographic hashing.',
      metadata: { source: 'blockchain-guide.pdf', timestamp: new Date() },
    },
    {
      id: '3',
      content: 'Edge computing processes data near the source rather than in centralized data centers, reducing latency.',
      metadata: { source: 'edge-computing.pdf', timestamp: new Date() },
    },
    {
      id: '4',
      content: 'Federated learning trains machine learning models across decentralized devices while keeping data localized.',
      metadata: { source: 'federated-learning.pdf', timestamp: new Date() },
    },
    {
      id: '5',
      content: 'Zero-knowledge proofs allow one party to prove knowledge of information without revealing the information itself.',
      metadata: { source: 'zkp-intro.pdf', timestamp: new Date() },
    },
  ];

  await vectorStore.addDocuments(documents);
  console.log(`✅ Knowledge base indexed with ${documents.length} documents\n`);

  const agenticRAG = new AgenticRAGService({
    vectorStore,
    enableAllFeatures: true,
  });

  // 2. Setup Agent Runtime
  const bufferStore = new BufferMemory({ maxSize: 100 });
  await bufferStore.initialize();

  const memoryManager = new MemoryManager(bufferStore, {
    maxConversationLength: 20,
  });

  const runtime = new AgentRuntime({
    memoryManager,
    defaultMaxSteps: 10,
    enableObservability: true,
  });

  // 3. Register Research Agent
  runtime.registerAgent(ResearchAgent);
  const agent = new ResearchAgent(agenticRAG);
  runtime.registerAgentInstance('research-agent', agent);

  console.log('✅ Research Agent registered with Agentic RAG capabilities\n');

  // 4. Example Queries
  console.log('📝 Example 1: Simple Search\n');
  const result1 = await runtime.execute(
    'research-agent',
    'What is quantum computing?',
    { sessionId: 'demo-session' }
  );
  console.log('Response:', result1);

  console.log('\n📝 Example 2: Deep Research\n');
  const result2 = await runtime.execute(
    'research-agent',
    'Explain the relationship between blockchain and zero-knowledge proofs',
    { sessionId: 'demo-session' }
  );
  console.log('Response:', result2);

  console.log('\n📝 Example 3: Conceptual Search with HyDE\n');
  const result3 = await runtime.execute(
    'research-agent',
    'How do decentralized technologies preserve privacy?',
    { sessionId: 'demo-session' }
  );
  console.log('Response:', result3);

  console.log('\n📝 Example 4: Verified Search\n');
  const result4 = await runtime.execute(
    'research-agent',
    'What are the benefits of edge computing?',
    { sessionId: 'demo-session' }
  );
  console.log('Response:', result4);

  console.log('\n✅ Integration example completed!\n');
  console.log('🎯 Integration Benefits:');
  console.log('   ✓ Agentic RAG as agent tools');
  console.log('   ✓ Autonomous research capabilities');
  console.log('   ✓ Multi-hop reasoning for complex questions');
  console.log('   ✓ Source verification and citations');
  console.log('   ✓ Context-aware conversational memory\n');
}

// Run example
if (require.main === module) {
  integrationExample().catch(console.error);
}

export { integrationExample, ResearchAgent };
