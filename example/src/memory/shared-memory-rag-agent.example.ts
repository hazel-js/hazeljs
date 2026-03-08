/**
 * Shared Memory: RAG + Agent (in-process)
 *
 * Demonstrates one MemoryManager shared by RAG and Agent in the same process.
 * Same sessionId => same conversation and context. No HTTP, no separate service.
 *
 * This example uses BufferMemory so it runs without building @hazeljs/memory.
 * To use @hazeljs/memory instead: install @hazeljs/memory, then:
 *   import { MemoryService, createDefaultMemoryStore } from '@hazeljs/memory';
 *   import { createHazelMemoryStoreAdapter } from '@hazeljs/rag/memory-hazel';
 *   const hazelStore = createDefaultMemoryStore();
 *   const memoryService = new MemoryService(hazelStore);
 *   const ragStore = createHazelMemoryStoreAdapter(memoryService);
 *   const memoryManager = new MemoryManager(ragStore, { ... });
 *
 * Run: npm run memory:shared
 */

import {
  MemoryManager,
  RAGPipelineWithMemory,
  MemoryVectorStore,
  OpenAIEmbeddings,
  BufferMemory,
} from '@hazeljs/rag';
import { Agent, AgentRuntime } from '@hazeljs/agent';

const SESSION_ID = 'shared-demo-session';
const USER_ID = 'demo-user';

// Minimal agent that uses shared memory (conversation history loaded by context builder)
@Agent({
  name: 'shared-memory-agent',
  description: 'Agent that shares memory with RAG',
  systemPrompt:
    'You have access to the same conversation memory as the RAG pipeline. When the user asks what was discussed, refer to the conversation history.',
  enableMemory: true,
})
class SharedMemoryAgent {}

async function main() {
  console.log('🔄 Shared Memory: RAG + Agent (in-process)\n');
  console.log('  One store → one MemoryManager → RAG + Agent (same session)\n');

  // 1. Central memory: one store, one MemoryManager (in-process, no HTTP)
  // Using BufferMemory here; replace with createHazelMemoryStoreAdapter(memoryService) for @hazeljs/memory
  const ragStore = new BufferMemory({ maxSize: 50 });
  const memoryManager = new MemoryManager(ragStore, {
    maxConversationLength: 30,
  });

  await memoryManager.initialize();

  // 2. Mock LLM (no API key required)
  const mockLlm = async (prompt: string): Promise<string> => {
    if (prompt.includes('HazelJS') || prompt.includes('What is')) {
      return 'HazelJS is a TypeScript framework for AI-native apps with RAG and memory support.';
    }
    return "I see we've been discussing HazelJS and memory. I have access to the same conversation.";
  };

  // 3. RAG pipeline using the shared MemoryManager
  const embeddings = new OpenAIEmbeddings({
    apiKey: process.env.OPENAI_API_KEY || 'mock-key',
    model: 'text-embedding-3-small',
  });
  const documentVectorStore = new MemoryVectorStore(embeddings);

  const rag = new RAGPipelineWithMemory(
    {
      vectorStore: documentVectorStore,
      embeddingProvider: embeddings,
      topK: 3,
    },
    memoryManager,
    mockLlm
  );
  await rag.initialize();
  await rag.addDocuments([
    {
      content: 'HazelJS provides in-process shared memory between RAG and agents via one MemoryManager.',
      metadata: { source: 'docs' },
    },
  ]);

  // 4. User asks RAG → stored in shared memory
  console.log('📤 Step 1: User asks RAG (message stored in shared memory)');
  const ragResponse = await rag.queryWithMemory(
    'What is HazelJS?',
    SESSION_ID,
    USER_ID
  );
  console.log(`   User: "What is HazelJS?"`);
  console.log(`   RAG:  "${ragResponse.answer.substring(0, 60)}..."\n`);

  // 5. Agent runtime with the *same* MemoryManager
  const runtime = new AgentRuntime({
    memoryManager,
    llmProvider: {
      chat: async (opts: { messages: { role: string; content: string }[] }) => {
        const last = opts.messages[opts.messages.length - 1];
        const reply = await mockLlm(last?.content ?? '');
        return { content: reply, tool_calls: [] };
      },
    },
  });
  runtime.registerAgent(SharedMemoryAgent);
  runtime.registerAgentInstance('shared-memory-agent', new SharedMemoryAgent());

  // 6. Agent runs with same sessionId → sees RAG conversation
  console.log('📤 Step 2: User asks Agent (same session → sees RAG conversation)');
  const agentResult = await runtime.execute(
    'shared-memory-agent',
    'What did we just discuss?',
    { sessionId: SESSION_ID, userId: USER_ID, enableMemory: true }
  );
  console.log(`   User: "What did we just discuss?"`);
  console.log(`   Agent: "${(agentResult.response || '').substring(0, 60)}..."\n`);

  // 7. Prove shared memory: one conversation history for both
  console.log('📜 Shared conversation history (same for RAG and Agent):');
  const history = await memoryManager.getConversationHistory(SESSION_ID, 10);
  history.forEach((msg, i) => {
    console.log(`   ${i + 1}. ${msg.role}: ${msg.content.substring(0, 55)}${msg.content.length > 55 ? '...' : ''}`);
  });

  console.log('\n✅ In-process shared memory: one MemoryManager, one session, RAG + Agent see the same data.\n');
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

export { main as sharedMemoryRagAgentExample };
