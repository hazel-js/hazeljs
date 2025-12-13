/**
 * Chatbot with Memory Example
 * Demonstrates building a context-aware chatbot using memory features
 */

import {
  RAGPipelineWithMemory,
  MemoryManager,
  HybridMemory,
  BufferMemory,
  VectorMemory,
  MemoryVectorStore,
  OpenAIEmbeddings,
  MemoryType,
} from '@hazeljs/rag';
import * as readline from 'readline';

class MemoryChatbot {
  private rag: RAGPipelineWithMemory;
  private memoryManager: MemoryManager;
  private sessionId: string;
  private userId: string;

  constructor(
    rag: RAGPipelineWithMemory,
    memoryManager: MemoryManager,
    sessionId: string,
    userId: string
  ) {
    this.rag = rag;
    this.memoryManager = memoryManager;
    this.sessionId = sessionId;
    this.userId = userId;
  }

  async chat(userMessage: string): Promise<string> {
    // Query with memory context
    const response = await this.rag.queryWithMemory(
      userMessage,
      this.sessionId,
      this.userId
    );

    return response.answer;
  }

  async rememberFact(fact: string): Promise<void> {
    await this.memoryManager.storeFact(fact, {
      sessionId: this.sessionId,
      userId: this.userId,
    });
  }

  async trackEntity(name: string, type: string, attributes: Record<string, any>): Promise<void> {
    await this.memoryManager.trackEntity({
      name,
      type,
      attributes,
      relationships: [],
      firstSeen: new Date(),
      lastSeen: new Date(),
      mentions: 1,
    });
  }

  async getConversationHistory(): Promise<any[]> {
    return this.memoryManager.getConversationHistory(this.sessionId);
  }

  async getStats(): Promise<any> {
    return this.memoryManager.getStats(this.sessionId);
  }

  async searchMemories(query: string): Promise<any[]> {
    return this.memoryManager.relevantMemories(query, {
      sessionId: this.sessionId,
      topK: 5,
    });
  }
}

async function chatbotWithMemoryExample() {
  console.log('💬 Chatbot with Memory Example\n');

  // Check for API key
  if (!process.env.OPENAI_API_KEY) {
    console.log('⚠️  OPENAI_API_KEY not found in environment variables.');
    console.log('   This example will run in demo mode with mock responses.\n');
  }

  // 1. Setup components
  console.log('🔧 Setting up chatbot...');
  
  const embeddings = new OpenAIEmbeddings({
    apiKey: process.env.OPENAI_API_KEY || 'mock-key',
    model: 'text-embedding-3-small',
  });

  const buffer = new BufferMemory({ maxSize: 50 });
  const memoryVectorStore = new MemoryVectorStore(embeddings);
  const vectorMemory = new VectorMemory(memoryVectorStore, embeddings);
  const hybridMemory = new HybridMemory(buffer, vectorMemory, {
    archiveThreshold: 30,
  });

  const memoryManager = new MemoryManager(hybridMemory, {
    maxConversationLength: 20,
    summarizeAfter: 50,
    entityExtraction: true,
    importanceScoring: true,
  });

  const documentVectorStore = new MemoryVectorStore(embeddings);

  // Mock LLM function for demo
  const llmFunction = async (prompt: string): Promise<string> => {
    // In production, this would call OpenAI API
    const responses = [
      "I'm a helpful AI assistant with memory capabilities. I can remember our conversations and help you with various tasks.",
      "Based on our previous conversation, I understand you're interested in learning about AI and memory systems.",
      "I remember that! We discussed that earlier. Let me provide more details based on what we've talked about.",
      "That's a great question! From what I know about you and our conversation history, here's what I think...",
      "I've stored that information in my memory. I'll remember it for our future conversations.",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  };

  const rag = new RAGPipelineWithMemory(
    {
      vectorStore: documentVectorStore,
      embeddingProvider: embeddings,
      topK: 3,
    },
    memoryManager,
    llmFunction
  );

  await rag.initialize();

  // 2. Add knowledge base
  await rag.addDocuments([
    {
      content: 'HazelJS is an AI-native TypeScript framework with built-in memory management.',
      metadata: { source: 'docs' },
    },
    {
      content: 'Memory systems help AI applications maintain context across conversations.',
      metadata: { source: 'docs' },
    },
  ]);

  // 3. Create chatbot instance
  const sessionId = `session-${Date.now()}`;
  const userId = 'demo-user';
  const chatbot = new MemoryChatbot(rag, memoryManager, sessionId, userId);

  console.log('✅ Chatbot ready!\n');

  // 4. Simulate conversation
  console.log('🤖 Starting demo conversation...\n');
  console.log('─'.repeat(60));

  const demoConversation = [
    { user: "Hi! I'm Sarah, a software engineer at TechCorp.", action: 'chat' },
    { user: "I'm interested in learning about AI memory systems.", action: 'chat' },
    { user: "Can you remember my name?", action: 'chat' },
    { user: "What company do I work for?", action: 'chat' },
    { action: 'remember', fact: 'Sarah prefers Python for AI development' },
    { action: 'entity', name: 'Sarah', type: 'person', attrs: { role: 'engineer', company: 'TechCorp' } },
    { user: "Tell me about HazelJS", action: 'chat' },
    { action: 'stats' },
    { action: 'search', query: 'Sarah and her work' },
  ];

  for (const step of demoConversation) {
    if (step.action === 'chat' && step.user) {
      console.log(`\n👤 User: ${step.user}`);
      const response = await chatbot.chat(step.user);
      console.log(`🤖 Bot: ${response}`);
    } else if (step.action === 'remember' && step.fact) {
      console.log(`\n💾 Storing fact: "${step.fact}"`);
      await chatbot.rememberFact(step.fact);
      console.log('✅ Fact stored in memory');
    } else if (step.action === 'entity' && step.name) {
      console.log(`\n👤 Tracking entity: ${step.name} (${step.type})`);
      await chatbot.trackEntity(step.name, step.type!, step.attrs!);
      console.log('✅ Entity tracked');
    } else if (step.action === 'stats') {
      console.log('\n📊 Memory Statistics:');
      const stats = await chatbot.getStats();
      console.log(`   Total memories: ${stats.totalMemories}`);
      console.log(`   Conversations: ${stats.byType[MemoryType.CONVERSATION]}`);
      console.log(`   Facts: ${stats.byType[MemoryType.FACT]}`);
      console.log(`   Entities: ${stats.byType[MemoryType.ENTITY]}`);
    } else if (step.action === 'search' && step.query) {
      console.log(`\n🔍 Searching memories for: "${step.query}"`);
      const memories = await chatbot.searchMemories(step.query);
      console.log(`   Found ${memories.length} relevant memories:`);
      memories.slice(0, 3).forEach((mem, i) => {
        console.log(`   ${i + 1}. [${mem.type}] ${mem.content.substring(0, 50)}...`);
      });
    }

    // Small delay for readability
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n─'.repeat(60));
  console.log('\n✅ Demo conversation completed!\n');

  // 5. Show conversation history
  console.log('📜 Full Conversation History:');
  const history = await chatbot.getConversationHistory();
  history.forEach((msg, i) => {
    console.log(`   ${i + 1}. ${msg.role}: ${msg.content.substring(0, 60)}...`);
  });

  console.log('\n💡 Interactive Mode:');
  console.log('   To run this chatbot interactively, uncomment the interactive mode below.\n');

  // Interactive mode (commented out by default)
  // await runInteractiveMode(chatbot);
}

// Interactive mode function
async function runInteractiveMode(chatbot: MemoryChatbot) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('\n💬 Interactive Chatbot Mode');
  console.log('Commands:');
  console.log('  - Type your message to chat');
  console.log('  - /history - Show conversation history');
  console.log('  - /stats - Show memory statistics');
  console.log('  - /search <query> - Search memories');
  console.log('  - /exit - Exit chatbot\n');

  const askQuestion = () => {
    rl.question('You: ', async (input) => {
      const trimmed = input.trim();

      if (trimmed === '/exit') {
        console.log('👋 Goodbye!');
        rl.close();
        return;
      }

      if (trimmed === '/history') {
        const history = await chatbot.getConversationHistory();
        console.log('\n📜 Conversation History:');
        history.forEach((msg, i) => {
          console.log(`${i + 1}. ${msg.role}: ${msg.content}`);
        });
        console.log();
        askQuestion();
        return;
      }

      if (trimmed === '/stats') {
        const stats = await chatbot.getStats();
        console.log('\n📊 Memory Statistics:');
        console.log(`Total: ${stats.totalMemories}`);
        console.log(`By type:`, stats.byType);
        console.log();
        askQuestion();
        return;
      }

      if (trimmed.startsWith('/search ')) {
        const query = trimmed.substring(8);
        const memories = await chatbot.searchMemories(query);
        console.log(`\n🔍 Found ${memories.length} memories:`);
        memories.forEach((mem, i) => {
          console.log(`${i + 1}. [${mem.type}] ${mem.content}`);
        });
        console.log();
        askQuestion();
        return;
      }

      if (trimmed) {
        const response = await chatbot.chat(trimmed);
        console.log(`Bot: ${response}\n`);
      }

      askQuestion();
    });
  };

  askQuestion();
}

// Run the example
if (require.main === module) {
  chatbotWithMemoryExample()
    .then(() => {
      console.log('🎉 Example finished successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

export { chatbotWithMemoryExample, MemoryChatbot };
