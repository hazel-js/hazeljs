/**
 * Advanced Agentic RAG Example
 * Demonstrates all advanced features: HyDE, Multi-hop, Corrective RAG, etc.
 */

import * as dotenv from 'dotenv';
dotenv.config();

import {
  AgenticRAGService,
  QueryPlanner,
  SelfReflective,
  AdaptiveRetrieval,
  MultiHop,
  HyDE,
  CorrectiveRAG,
  ContextAware,
  QueryRewriter,
  SourceVerification,
  ActiveLearning,
  Feedback,
  Cached,
  getQueryPlan,
  getReasoningChain,
  getHyDEResult,
} from '@hazeljs/rag/src/agentic';
import { MemoryVectorStore } from '@hazeljs/rag/src/vector-stores/memory-vector-store';
import { OpenAIEmbeddings } from '@hazeljs/rag/src/embeddings/openai-embeddings';
import { Document, SearchResult } from '@hazeljs/rag/src/types';

// Custom Agentic RAG class with all features
class AdvancedResearchAssistant {
  constructor(private vectorStore: MemoryVectorStore) {}

  /**
   * Standard retrieval with reflection and adaptation
   */
  @SelfReflective({ maxIterations: 3, qualityThreshold: 0.8 })
  @AdaptiveRetrieval({ autoSelect: true, contextAware: true })
  @Cached({ ttl: 3600 })
  async retrieve(query: string): Promise<SearchResult[]> {
    return this.vectorStore.search(query, { topK: 5 });
  }

  /**
   * HyDE-powered retrieval for abstract queries
   */
  @HyDE({ generateHypothesis: true, numHypotheses: 3 })
  @CorrectiveRAG({ relevanceThreshold: 0.7 })
  @Cached({ ttl: 1800 })
  async hydeRetrieve(query: string): Promise<SearchResult[]> {
    return this.vectorStore.search(query, { topK: 5 });
  }

  /**
   * Multi-hop reasoning for complex questions
   */
  @MultiHop({ maxHops: 3, strategy: 'breadth-first' })
  async deepResearch(query: string): Promise<any> {
    return this.vectorStore.search(query, { topK: 3 });
  }

  /**
   * Context-aware conversational retrieval
   */
  @ContextAware({ windowSize: 5, entityTracking: true, topicModeling: true })
  @QueryRewriter({ techniques: ['expansion', 'synonym'] })
  @Cached({ ttl: 600 })
  async conversationalRetrieve(query: string, sessionId: string): Promise<SearchResult[]> {
    return this.vectorStore.search(query, { topK: 5 });
  }

  /**
   * Verified retrieval with source checking
   */
  @SourceVerification({
    checkFreshness: true,
    verifyAuthority: true,
    requireCitations: true,
  })
  @SelfReflective({ maxIterations: 2, qualityThreshold: 0.85 })
  async verifiedRetrieve(query: string): Promise<SearchResult[]> {
    return this.vectorStore.search(query, { topK: 5 });
  }

  /**
   * Learning-enabled retrieval
   */
  @ActiveLearning({ feedbackEnabled: true, retrainThreshold: 100 })
  async learningRetrieve(query: string): Promise<SearchResult[]> {
    return this.vectorStore.search(query, { topK: 5 });
  }

  /**
   * Provide feedback
   */
  @Feedback()
  async provideFeedback(resultId: string, rating: number, relevant: boolean): Promise<void> {
    // Feedback stored by decorator
  }

  /**
   * Super retrieval - ALL features combined
   */
  @QueryPlanner({ decompose: true, maxSubQueries: 5, parallel: true })
  @SelfReflective({ maxIterations: 3, qualityThreshold: 0.8 })
  @AdaptiveRetrieval({ autoSelect: true, contextAware: true })
  @HyDE({ generateHypothesis: true, numHypotheses: 2 })
  @CorrectiveRAG({ relevanceThreshold: 0.7 })
  @ContextAware({ windowSize: 5, entityTracking: true })
  @QueryRewriter({ techniques: ['expansion', 'synonym'] })
  @SourceVerification({ checkFreshness: true, verifyAuthority: true })
  @ActiveLearning({ feedbackEnabled: true })
  @Cached({ ttl: 3600 })
  async superRetrieve(query: string, sessionId: string): Promise<SearchResult[]> {
    return this.vectorStore.search(query, { topK: 5 });
  }
}

async function advancedExample() {
  console.log('🚀 Advanced Agentic RAG Example\n');

  // Setup
  const embeddings = new OpenAIEmbeddings({
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'text-embedding-3-small',
  });
  const vectorStore = new MemoryVectorStore(embeddings);
  await vectorStore.initialize();

  // Add comprehensive documents
  const documents: Document[] = [
    {
      id: '1',
      content: 'Artificial Intelligence (AI) is the simulation of human intelligence by machines. It includes machine learning, deep learning, and natural language processing.',
      metadata: { source: 'ai-overview.pdf', timestamp: new Date('2024-01-01') },
    },
    {
      id: '2',
      content: 'Machine Learning is a subset of AI that enables systems to learn from data without explicit programming. It uses algorithms to find patterns.',
      metadata: { source: 'ml-guide.pdf', timestamp: new Date('2024-02-01') },
    },
    {
      id: '3',
      content: 'Deep Learning uses neural networks with multiple layers. It has revolutionized computer vision, speech recognition, and NLP tasks.',
      metadata: { source: 'dl-book.pdf', timestamp: new Date('2024-03-01') },
    },
    {
      id: '4',
      content: 'Natural Language Processing (NLP) enables computers to understand, interpret, and generate human language. Modern NLP uses transformer models.',
      metadata: { source: 'nlp-intro.pdf', timestamp: new Date('2024-04-01') },
    },
    {
      id: '5',
      content: 'Transformers are neural network architectures that use self-attention mechanisms. They power models like GPT, BERT, and T5.',
      metadata: { source: 'transformers.pdf', timestamp: new Date('2024-05-01') },
    },
    {
      id: '6',
      content: 'Reinforcement Learning trains agents through trial and error using rewards. It is used in robotics, game playing, and autonomous systems.',
      metadata: { source: 'rl-tutorial.pdf', timestamp: new Date('2024-06-01') },
    },
    {
      id: '7',
      content: 'Computer Vision enables machines to interpret visual information. Deep learning has dramatically improved image classification and object detection.',
      metadata: { source: 'cv-handbook.pdf', timestamp: new Date('2024-07-01') },
    },
    {
      id: '8',
      content: 'Generative AI creates new content like text, images, and code. Large Language Models (LLMs) are a prominent example.',
      metadata: { source: 'genai-guide.pdf', timestamp: new Date('2024-08-01') },
    },
  ];

  await vectorStore.addDocuments(documents);
  console.log(`✅ Indexed ${documents.length} documents\n`);

  const assistant = new AdvancedResearchAssistant(vectorStore);

  // Example 1: HyDE Retrieval
  console.log('📝 Example 1: HyDE Retrieval (Hypothetical Documents)\n');
  const hydeResults = await assistant.hydeRetrieve(
    'How do modern AI systems understand language?'
  );
  console.log(`Found ${hydeResults.length} results with HyDE:`);
  hydeResults.slice(0, 3).forEach((result, i) => {
    console.log(`${i + 1}. ${result.content.slice(0, 80)}...`);
  });

  // Example 2: Multi-hop Reasoning
  console.log('\n📝 Example 2: Multi-hop Reasoning\n');
  const reasoningChain = await assistant.deepResearch(
    'Explain the relationship between AI, machine learning, and deep learning'
  );
  console.log('Reasoning chain:', reasoningChain);

  // Example 3: Context-aware Conversational Retrieval
  console.log('\n📝 Example 3: Context-aware Conversational Retrieval\n');
  const sessionId = 'research-session-123';

  const conv1 = await assistant.conversationalRetrieve(
    'What is machine learning?',
    sessionId
  );
  console.log('Q1: What is machine learning?');
  console.log(`A1: ${conv1[0]?.content.slice(0, 100)}...\n`);

  const conv2 = await assistant.conversationalRetrieve(
    'How does it differ from deep learning?',
    sessionId
  );
  console.log('Q2: How does it differ from deep learning? (uses context)');
  console.log(`A2: ${conv2[0]?.content.slice(0, 100)}...\n`);

  // Example 4: Verified Retrieval with Citations
  console.log('📝 Example 4: Verified Retrieval with Source Checking\n');
  const verifiedResults = await assistant.verifiedRetrieve(
    'What are transformers in AI?'
  );
  console.log(`Found ${verifiedResults.length} verified results:`);
  verifiedResults.slice(0, 2).forEach((result, i) => {
    console.log(`${i + 1}. ${result.content.slice(0, 80)}...`);
    console.log(`   Source: ${result.metadata?.source}`);
    console.log(`   Verified: ${(result as any).verification?.verified || 'N/A'}\n`);
  });

  // Example 5: Learning with Feedback
  console.log('📝 Example 5: Active Learning with Feedback\n');
  const learningResults = await assistant.learningRetrieve('What is NLP?');
  console.log(`Initial results: ${learningResults.length}`);

  // Provide feedback
  await assistant.provideFeedback(learningResults[0].id, 5, true);
  await assistant.provideFeedback(learningResults[1].id, 4, true);
  console.log('✅ Feedback provided - system will learn from this\n');

  // Example 6: Super Retrieval (All Features)
  console.log('📝 Example 6: Super Retrieval (ALL Features Combined)\n');
  const superResults = await assistant.superRetrieve(
    'Compare and contrast machine learning, deep learning, and reinforcement learning approaches, and explain which is best for natural language tasks',
    sessionId
  );
  console.log(`Super retrieval found ${superResults.length} results:`);
  superResults.slice(0, 3).forEach((result, i) => {
    console.log(`${i + 1}. ${result.content.slice(0, 80)}...`);
  });

  console.log('\n✅ Advanced examples completed!\n');
  console.log('🎯 Key Features Demonstrated:');
  console.log('   ✓ HyDE - Hypothetical document embeddings');
  console.log('   ✓ Multi-hop reasoning - Complex question answering');
  console.log('   ✓ Context-aware - Conversational memory');
  console.log('   ✓ Source verification - Citation generation');
  console.log('   ✓ Active learning - Feedback-based improvement');
  console.log('   ✓ Super retrieval - All features combined\n');
}

// Run example
if (require.main === module) {
  advancedExample().catch(console.error);
}

export { advancedExample, AdvancedResearchAssistant };
