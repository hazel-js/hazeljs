/**
 * Simple HazelJS Unified AI Platform Demo
 *
 * This example demonstrates the basic setup and usage without requiring API keys.
 */

import { HazelAI } from '../src';

async function demonstrateSimpleDemo() {
  console.log('🚀 HazelJS Unified AI Platform - Simple Demo\n');

  // Initialize with default configuration (uses Ollama by default)
  const ai = HazelAI.create({
    defaultProvider: 'ollama',
    model: 'llama3.2', // or whatever model you have available
  });

  console.log('✅ HazelAI initialized successfully');
  console.log('📊 Current metrics:', ai.getMetrics());
  console.log();

  // Test basic functionality (without making actual API calls)
  console.log('🔧 Available methods:');
  console.log('- ai.chat(message, options?)');
  console.log('- ai.stream(message, options?)');
  console.log('- ai.sentiment(text)');
  console.log('- ai.classify(text, options)');
  console.log('- ai.score(prompt, options)');
  console.log('- ai.workflow(id)');
  console.log('- ai.assistant(config)');
  console.log('- ai.rag (requires @hazeljs/rag)');
  console.log('- ai.agent(name, input) (requires @hazeljs/agent)');
  console.log();

  // Show workflow example (doesn't require API calls)
  console.log('🔄 Workflow Example:');
  const workflow = ai.workflow('demo-workflow');

  const workflowResult = await workflow
    .step('process', async (input: string) => {
      console.log(`Processing: "${input}"`);
      await new Promise((resolve) => setTimeout(resolve, 100)); // Simulate work
      return input.toUpperCase();
    })
    .step('format', async (input: string) => {
      console.log(`Formatting: "${input}"`);
      await new Promise((resolve) => setTimeout(resolve, 50)); // Simulate work
      return `Result: ${input}`;
    })
    .run('hello world');

  console.log(`✨ Workflow result: ${workflowResult.output}`);
  console.log(`⏱️  Total duration: ${workflowResult.totalDuration}ms`);
  console.log();

  // Show assistant creation (doesn't require API calls)
  console.log('🤖 Assistant Example:');
  const assistant = ai.assistant({
    name: 'Demo Assistant',
    systemPrompt: 'You are a helpful assistant.',
    memory: true,
  });

  console.log(`📝 Assistant created with session: ${assistant.sessionId}`);
  console.log(`📚 History length: ${assistant.getHistory().length} messages`);

  // Show assistant methods (just check the history, don't add messages since that requires API calls)
  console.log(`📚 Assistant ready for chat (history: ${assistant.getHistory().length} messages)`);
  console.log();

  console.log('✅ Demo completed successfully!');
  console.log();
  console.log('💡 To use with real AI providers:');
  console.log('1. Set OPENAI_API_KEY environment variable for OpenAI');
  console.log('2. Set ANTHROPIC_API_KEY environment variable for Claude');
  console.log('3. Install and run Ollama for local models');
  console.log('4. Then run: node dist/examples/simple-demo.js');
}

// Run the demo if this file is executed directly
if (require.main === module) {
  demonstrateSimpleDemo().catch(console.error);
}

export { demonstrateSimpleDemo };
