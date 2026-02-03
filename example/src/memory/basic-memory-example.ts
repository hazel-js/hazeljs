/**
 * Basic Memory Example
 * Demonstrates core memory features: conversation tracking, facts, and entities
 */

import {
  MemoryManager,
  BufferMemory,
  MemoryType,
} from '@hazeljs/rag';

async function basicMemoryExample() {
  console.log('🧠 Basic Memory Example\n');

  // 1. Setup memory store
  console.log('1️⃣  Setting up BufferMemory...');
  const memoryStore = new BufferMemory({
    maxSize: 100,
    ttl: 3600000, // 1 hour
  });

  // 2. Create memory manager
  const memoryManager = new MemoryManager(memoryStore, {
    maxConversationLength: 20,
    entityExtraction: true,
    importanceScoring: true,
  });

  await memoryManager.initialize();
  console.log('✅ Memory manager initialized\n');

  // 3. Conversation Memory
  console.log('2️⃣  Testing Conversation Memory...');
  const sessionId = 'demo-session-123';

  await memoryManager.addMessage(
    { role: 'user', content: 'Hi! My name is Alice and I work at TechCorp.' },
    sessionId
  );

  await memoryManager.addMessage(
    { role: 'assistant', content: 'Hello Alice! Nice to meet you. How can I help you today?' },
    sessionId
  );

  await memoryManager.addMessage(
    { role: 'user', content: 'I need help with the HazelJS framework. Can you explain RAG?' },
    sessionId
  );

  await memoryManager.addMessage(
    {
      role: 'assistant',
      content: 'RAG (Retrieval-Augmented Generation) combines document retrieval with LLMs to provide accurate, context-aware responses.',
    },
    sessionId
  );

  // Get conversation history
  const history = await memoryManager.getConversationHistory(sessionId);
  console.log(`📝 Conversation history (${history.length} messages):`);
  history.forEach((msg, i) => {
    console.log(`   ${i + 1}. ${msg.role}: ${msg.content.substring(0, 60)}...`);
  });
  console.log();

  // 4. Entity Memory
  console.log('3️⃣  Testing Entity Memory...');
  
  await memoryManager.trackEntity({
    name: 'Alice',
    type: 'person',
    attributes: {
      company: 'TechCorp',
      role: 'developer',
    },
    relationships: [
      { type: 'works_at', target: 'TechCorp' },
    ],
    firstSeen: new Date(),
    lastSeen: new Date(),
    mentions: 1,
  });

  await memoryManager.trackEntity({
    name: 'TechCorp',
    type: 'company',
    attributes: {
      industry: 'technology',
    },
    relationships: [
      { type: 'employs', target: 'Alice' },
    ],
    firstSeen: new Date(),
    lastSeen: new Date(),
    mentions: 1,
  });

  const alice = await memoryManager.getEntity('Alice');
  console.log('👤 Retrieved entity:', JSON.stringify(alice, null, 2));
  console.log();

  // 5. Semantic Memory (Facts)
  console.log('4️⃣  Testing Semantic Memory (Facts)...');
  
  await memoryManager.storeFact(
    'Alice prefers TypeScript over JavaScript',
    { userId: 'alice', category: 'preference' }
  );

  await memoryManager.storeFact(
    'HazelJS supports decorators for dependency injection',
    { category: 'framework-feature' }
  );

  await memoryManager.storeFact(
    'RAG combines retrieval with generation for better accuracy',
    { category: 'ai-concept' }
  );

  // Recall facts
  const ragFacts = await memoryManager.recallFacts('RAG and AI', { topK: 3 });
  console.log('🔍 Facts about RAG and AI:');
  ragFacts.forEach((fact, i) => {
    console.log(`   ${i + 1}. ${fact}`);
  });
  console.log();

  // 6. Working Memory
  console.log('5️⃣  Testing Working Memory...');
  
  await memoryManager.setContext('current_task', 'learning_rag', sessionId);
  await memoryManager.setContext('progress', { step: 1, total: 5 }, sessionId);
  await memoryManager.setContext('user_preferences', { theme: 'dark', language: 'typescript' }, sessionId);

  const task = await memoryManager.getContext('current_task', sessionId);
  const progress = await memoryManager.getContext('progress', sessionId);
  const prefs = await memoryManager.getContext('user_preferences', sessionId);

  console.log('💾 Working Memory:');
  console.log(`   Task: ${task}`);
  console.log(`   Progress: ${JSON.stringify(progress)}`);
  console.log(`   Preferences: ${JSON.stringify(prefs)}`);
  console.log();

  // 7. Memory Search
  console.log('6️⃣  Testing Memory Search...');
  
  const relevantMemories = await memoryManager.relevantMemories(
    'Alice and her work',
    {
      sessionId,
      types: [MemoryType.CONVERSATION, MemoryType.FACT, MemoryType.ENTITY],
      topK: 5,
    }
  );

  console.log(`🔎 Found ${relevantMemories.length} relevant memories:`);
  relevantMemories.forEach((mem, i) => {
    console.log(`   ${i + 1}. [${mem.type}] ${mem.content.substring(0, 60)}...`);
  });
  console.log();

  // 8. Memory Statistics
  console.log('7️⃣  Memory Statistics...');
  
  const stats = await memoryManager.getStats(sessionId);
  console.log('📊 Memory Stats:');
  console.log(`   Total memories: ${stats.totalMemories}`);
  console.log(`   By type:`, stats.byType);
  console.log(`   Average importance: ${stats.averageImportance.toFixed(2)}`);
  console.log();

  // 9. Conversation Summary
  console.log('8️⃣  Conversation Summary...');
  
  const summary = await memoryManager.summarizeConversation(sessionId);
  console.log('📋 Summary:');
  console.log(`   ${summary.substring(0, 200)}...`);
  console.log();

  console.log('✅ Basic memory example completed!\n');
}

// Run the example
if (require.main === module) {
  basicMemoryExample()
    .then(() => {
      console.log('🎉 Example finished successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

export { basicMemoryExample };
