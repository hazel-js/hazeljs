/**
 * Example demonstrating the HazelJS Unified AI Platform
 *
 * This example shows how to use the new HazelAI class as a single
 * entry point for all AI capabilities in HazelJS.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from examples directory and package root
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

import { HazelAI } from '../src';

// Initialize the unified AI platform with OpenAI
const ai = HazelAI.create({
  defaultProvider: 'openai',
  model: 'gpt-4o',
  temperature: 0.7,
});

async function demonstrateUnifiedPlatform() {
  console.log('🚀 HazelJS Unified AI Platform Demo\n');

  // Check if OpenAI API key is available
  console.log('🔑 Environment check:');
  console.log(`OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Not set'}`);
  console.log();

  // 1. Simple Chat
  console.log('💬 Chat:');
  const response = await ai.chat('What is HazelJS?');
  console.log(response);
  console.log();

  // 2. Streaming Chat
  console.log('🌊 Streaming Chat:');
  console.log('Assistant: ');
  for await (const chunk of ai.stream('Tell me a short story about AI')) {
    process.stdout.write(chunk);
  }
  console.log('\n');

  // 3. Classification
  console.log('🏷️  Classification:');
  const sentiment = await ai.sentiment('I love using HazelJS!');
  console.log(`Sentiment: ${sentiment.sentiment} (confidence: ${sentiment.score})`);
  console.log();

  // 4. Scoring
  console.log('⭐ Scoring:');
  try {
    const scores = await ai.score('Rate for technical accuracy', {
      items: [
        { id: '1', text: 'TypeScript is a typed superset of JavaScript' },
        { id: '2', text: 'Python is a snake' },
      ],
      criteria: 'Technical accuracy',
    });
    const scoreList = Array.isArray(scores) ? scores : [scores];
    scoreList.forEach((score) => {
      console.log(`Item ${score.id}: ${score.score} - ${score.reasoning}`);
    });
  } catch (err) {
    console.log('Scoring error:', (err as Error).message);
  }
  console.log();

  // 5. Workflow
  console.log('🔄 Workflow:');
  const workflow = ai.workflow('demo-workflow');
  const workflowResult = await workflow
    .step('extract', async (text: string) => {
      const words = text.split(' ');
      return { words, count: words.length };
    })
    .step('analyze', async (data: { words: string[]; count: number }) => {
      const avgLength = data.words.reduce((sum, word) => sum + word.length, 0) / data.count;
      return { averageWordLength: avgLength, totalWords: data.count };
    })
    .run('The quick brown fox jumps over the lazy dog');

  console.log(`Workflow result:`, workflowResult.output);
  console.log(`Total duration: ${workflowResult.totalDuration}ms`);
  console.log();

  // 6. Assistant with Memory
  console.log('🤖 Assistant with Memory:');
  const assistant = ai.assistant({
    name: 'HazelJS Helper',
    systemPrompt: 'You are a helpful assistant specialized in HazelJS framework.',
    memory: true,
  });

  const chat1 = await assistant.chat('What modules does HazelJS have?');
  console.log(`Q: What modules does HazelJS have?`);
  console.log(`A: ${chat1.content}`);
  console.log();

  const chat2 = await assistant.chat('Tell me more about the AI module');
  console.log(`Q: Tell me more about the AI module`);
  console.log(`A: ${chat2.content}`);
  console.log();

  console.log(`Session: ${assistant.sessionId}`);
  console.log(`History length: ${assistant.getHistory().length} messages`);
  console.log();

  // 7. Metrics (placeholder for now)
  console.log('📊 Metrics:');
  const metrics = ai.getMetrics();
  console.log(`Total requests: ${metrics.totalRequests}`);
  console.log(`Total tokens: ${metrics.totalTokens}`);
  console.log(`Average latency: ${metrics.averageLatencyMs}ms`);
  console.log();

  console.log('✅ Demo completed!');
}

// Run the demo if this file is executed directly
if (require.main === module) {
  demonstrateUnifiedPlatform().catch(console.error);
}

export { demonstrateUnifiedPlatform };
