import { PrismaClient } from '@prisma/client';
import { OpenAIEmbeddings } from '@hazeljs/rag';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Initialize OpenAI embeddings for sample documents
  const embeddings = new OpenAIEmbeddings({
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'text-embedding-3-small',
  });

  // Sample documents for RAG demonstration
  const sampleDocuments = [
    {
      content: 'HazelJS is a TypeScript framework for building AI-native backend applications. It provides built-in support for AI agents, RAG (Retrieval-Augmented Generation), and seamless integration with LLM providers like OpenAI, Anthropic, and Ollama.',
      metadata: {
        source: 'documentation',
        type: 'introduction',
        category: 'framework',
        tags: ['hazeljs', 'typescript', 'ai', 'backend'],
      },
    },
    {
      content: 'TypeScript decorators provide a way to add metadata and modify the behavior of classes, methods, and properties. In HazelJS, decorators like @Controller, @Get, @Post, @Service, and @Agent are used to define the application structure and routing.',
      metadata: {
        source: 'typescript-guide',
        type: 'tutorial',
        category: 'decorators',
        tags: ['typescript', 'decorators', 'hazeljs', 'patterns'],
      },
    },
    {
      content: 'AI agents in HazelJS can use tools to perform actions like API calls, database queries, or external service integrations. The @Agent decorator defines an agent, and @Tool decorator defines its capabilities.',
      metadata: {
        source: 'agent-guide',
        type: 'tutorial',
        category: 'agents',
        tags: ['agents', 'tools', 'ai', 'automation'],
      },
    },
    {
      content: 'RAG (Retrieval-Augmented Generation) combines document retrieval with LLM generation to provide more accurate and context-aware responses. HazelJS provides built-in RAG services with vector similarity search.',
      metadata: {
        source: 'rag-guide',
        type: 'tutorial',
        category: 'rag',
        tags: ['rag', 'search', 'vectors', 'llm'],
      },
    },
    {
      content: 'The HazelJS Inspector is a development dashboard available at /__hazel that provides real-time insights into your application, including module dependencies, request metrics, and AI agent performance.',
      metadata: {
        source: 'development-guide',
        type: 'tutorial',
        category: 'tools',
        tags: ['inspector', 'development', 'debugging', 'metrics'],
      },
    },
  ];

  console.log('📚 Creating sample documents...');
  for (const doc of sampleDocuments) {
    try {
      // Generate embedding for the document
      const embedding = await embeddings.embed(doc.content);
      
      // Use raw SQL to insert document with vector embedding
      await prisma.$executeRaw`
        INSERT INTO documents (id, content, metadata, embedding, "createdAt", "updatedAt")
        VALUES (
          gen_random_uuid()::text,
          ${doc.content},
          ${JSON.stringify(doc.metadata)}::jsonb,
          ${embedding}::vector,
          NOW(),
          NOW()
        )
      `;
      
      console.log(`✅ Created document: ${doc.metadata.source}`);
    } catch (error) {
      console.error(`❌ Failed to create document: ${doc.metadata.source}`, error);
    }
  }

  // Sample agent conversations
  console.log('🤖 Creating sample agent conversations...');
  const sampleConversations = [
    {
      agentName: 'WeatherAgent',
      sessionId: 'demo-session-1',
      userMessage: 'What is the weather like in Tokyo?',
      agentResponse: 'The weather in Tokyo is 72°F and sunny with 45% humidity.',
      metadata: {
        toolsUsed: ['getWeather'],
        responseTime: 1.2,
      },
    },
    {
      agentName: 'WeatherAgent',
      sessionId: 'demo-session-2',
      userMessage: 'Tell me about the weather in New York and London',
      agentResponse: 'New York: 65°F and cloudy. London: 58°F and rainy.',
      metadata: {
        toolsUsed: ['getWeather'],
        responseTime: 2.1,
      },
    },
  ];

  for (const conv of sampleConversations) {
    try {
      await prisma.agentConversation.create({
        data: conv,
      });
      console.log(`✅ Created conversation for ${conv.agentName}`);
    } catch (error) {
      console.error(`❌ Failed to create conversation`, error);
    }
  }

  // Sample chat history
  console.log('💬 Creating sample chat history...');
  const sampleChatHistory = [
    {
      sessionId: 'chat-session-1',
      userMessage: 'What is HazelJS?',
      aiResponse: 'HazelJS is a TypeScript framework for building AI-native backend applications with built-in support for AI agents, RAG, and LLM integration.',
      model: 'gpt-4',
      tokensUsed: 156,
    },
    {
      sessionId: 'chat-session-1',
      userMessage: 'How do I create an AI agent?',
      aiResponse: 'You can create an AI agent in HazelJS using the @Agent decorator and defining tools with @Tool decorator. Here\'s an example: @Agent({name: "MyAgent"}) class MyAgent { @Tool({description: "My tool"}) async myTool() { return "result"; } }',
      model: 'gpt-4',
      tokensUsed: 234,
    },
  ];

  for (const chat of sampleChatHistory) {
    try {
      await prisma.chatHistory.create({
        data: chat,
      });
      console.log(`✅ Created chat entry for session ${chat.sessionId}`);
    } catch (error) {
      console.error(`❌ Failed to create chat entry`, error);
    }
  }

  console.log('🎉 Database seeding completed!');
  console.log('');
  console.log('📊 Summary:');
  console.log(`   Documents: ${sampleDocuments.length}`);
  console.log(`   Agent Conversations: ${sampleConversations.length}`);
  console.log(`   Chat History: ${sampleChatHistory.length}`);
  console.log('');
  console.log('🚀 Your HazelJS AI-Native app is ready to use!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
