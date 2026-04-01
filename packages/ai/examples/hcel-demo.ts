/**
 * HCEL - HazelJS Composable Expression Language Example
 * 
 * This example demonstrates the new HCEL API that provides a fluent,
 * TypeScript-native way to compose AI operations.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from examples directory and package root
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

import { HazelAI, SentimentResult } from '../src';

async function demonstrateHCEL() {
  console.log('🚀 HCEL - HazelJS Composable Expression Language Demo\n');
  
  // Initialize HazelAI
  const ai = HazelAI.create({
    defaultProvider: 'openai',
    model: 'gpt-4o',
    temperature: 0.7,
  });

  // Check if OpenAI API key is available
  console.log('🔑 Environment check:');
  console.log(`OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Not set'}`);
  console.log();

  try {
    // ── Simple HCEL Chain ────────────────────────────────────────
    console.log('📝 Simple HCEL Chain:');
    console.log('ai.hazel.prompt("What is HazelJS?").execute()');
    
    const simpleResult = await ai.hazel
      .prompt('What is HazelJS?')
      .execute() as string;
    
    console.log(`Result: ${simpleResult.slice(0, 100)}...\n`);

    // ── RAG + ML Chain ───────────────────────────────────────────
    console.log('🔍 RAG + ML Chain:');
    console.log('ai.hazel.rag("docs").ml("sentiment").execute()');
    
    try {
      const ragMlResult = await ai.hazel
        .rag('docs')
        .ml('sentiment')
        .execute() as SentimentResult;
      
      console.log(`Sentiment: ${ragMlResult.sentiment} (${ragMlResult.score})\n`);
    } catch (error) {
      console.log('RAG not configured, skipping...\n');
    }

    // ── Multi-Operation Chain ───────────────────────────────────
    console.log('🔗 Multi-Operation Chain:');
    console.log('ai.hazel.prompt("Analyze").agent("analyst").execute()');
    
    try {
      const multiResult = await ai.hazel
        .prompt('Analyze the sentiment of this text: "I love building AI applications!"')
        .ml('sentiment')
        .execute() as SentimentResult;
      
      console.log(`Analysis: ${multiResult.sentiment} (${multiResult.score})\n`);
    } catch (error) {
      console.log('Agent not configured, using ML only...\n');
    }

    // ── Streaming Chain ─────────────────────────────────────────
    console.log('🌊 Streaming Chain:');
    console.log('ai.hazel.prompt("Tell me a story").stream()');
    
    console.log('Assistant: ');
    for await (const chunk of ai.hazel
      .prompt('Tell me a short story about AI and creativity')
      .stream()) {
      process.stdout.write(chunk as string);
    }
    console.log('\n');

    // ── Chain with Context ───────────────────────────────────────
    console.log('📊 Chain with Context & Observability:');
    
    const contextChain = ai.hazel
      .prompt('Analyze this user feedback: {feedback}')
      .ml('sentiment')
      .context({ userId: 'user-123', sessionId: 'session-456' })
      .observe((event) => {
        console.log(`📡 Event: ${event.type} at ${new Date(event.timestamp).toISOString()}`);
      });
    
    const contextResult = await contextChain.execute() as SentimentResult;
    console.log(`Result: ${contextResult.sentiment} (${contextResult.score})\n`);

    // ── Chain Summary ───────────────────────────────────────────
    console.log('📈 Chain Summary:');
    const summary = contextChain.getSummary();
    console.log(`Operations: ${summary.operationCount}`);
    console.log(`Types: ${summary.operations.join(' → ')}\n`);

    // ── Advanced Composition (Parallel) ──────────────────────────
    console.log('⚡ Parallel Operations:');
    
    try {
      const parallelChain = ai.hazel
        .parallel(
          ai.hazel.prompt('Summarize: "AI is transforming the world"'),
          ai.hazel.ml('sentiment', { labels: ['positive', 'negative', 'neutral'] })
        );
      
      const parallelResult = await parallelChain.execute();
      console.log(`Parallel results: ${Array.isArray(parallelResult) ? parallelResult.length : 1} operations\n`);
    } catch (error) {
      console.log('Parallel execution demo skipped\n');
    }

    // ── Chain Configuration ─────────────────────────────────────
    console.log('⚙️ Chain Configuration:');
    
    const configuredChain = ai.hazel
      .prompt('Process this text')
      .ml('classify', { labels: ['urgent', 'normal', 'low'] })
      .config({ 
        adaptive: true,
        retryPolicy: { maxAttempts: 3, initialDelay: 1000, maxDelay: 5000, backoffMultiplier: 2 }
      });
    
    console.log(`Chain configured: ${JSON.stringify(configuredChain.getSummary().config, null, 2)}\n`);

    console.log('✅ HCEL Demo completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during HCEL demo:', error);
    
    if (error instanceof Error) {
      console.log('\n💡 Troubleshooting tips:');
      console.log('- Ensure OPENAI_API_KEY is set in your environment');
      console.log('- Check that you have internet connectivity');
      console.log('- Verify the OpenAI API key has sufficient credits');
    }
  }
}

// Run the demo if this file is executed directly
if (require.main === module) {
  demonstrateHCEL().catch(console.error);
}

export { demonstrateHCEL };
