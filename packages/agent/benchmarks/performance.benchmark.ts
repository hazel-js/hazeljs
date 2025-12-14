/**
 * Performance Benchmarks
 * Measure agent runtime performance under various conditions
 */

import { AgentRuntime } from '../src/runtime/agent.runtime';
import { Agent } from '../src/decorators/agent.decorator';
import { Tool } from '../src/decorators/tool.decorator';

interface BenchmarkResult {
  name: string;
  iterations: number;
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  throughput: number;
}

class PerformanceBenchmark {
  /**
   * Run a benchmark
   */
  async runBenchmark(
    name: string,
    fn: () => Promise<void>,
    iterations: number = 100
  ): Promise<BenchmarkResult> {
    const times: number[] = [];
    const startTotal = Date.now();

    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      await fn();
      const duration = Date.now() - start;
      times.push(duration);
    }

    const totalTime = Date.now() - startTotal;
    const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const throughput = (iterations / totalTime) * 1000;

    return {
      name,
      iterations,
      totalTime,
      averageTime,
      minTime,
      maxTime,
      throughput,
    };
  }

  /**
   * Format benchmark results
   */
  formatResults(results: BenchmarkResult[]): string {
    const lines: string[] = [
      'Performance Benchmark Results',
      '============================',
      '',
    ];

    for (const result of results) {
      lines.push(`${result.name}:`);
      lines.push(`  Iterations: ${result.iterations}`);
      lines.push(`  Total Time: ${result.totalTime.toFixed(2)}ms`);
      lines.push(`  Average: ${result.averageTime.toFixed(2)}ms`);
      lines.push(`  Min: ${result.minTime.toFixed(2)}ms`);
      lines.push(`  Max: ${result.maxTime.toFixed(2)}ms`);
      lines.push(`  Throughput: ${result.throughput.toFixed(2)} ops/sec`);
      lines.push('');
    }

    return lines.join('\n');
  }
}

/**
 * Example benchmarks
 */
async function runBenchmarks() {
  const benchmark = new PerformanceBenchmark();
  const results: BenchmarkResult[] = [];

  // Benchmark 1: Agent Registration
  @Agent({ name: 'bench-agent', description: 'Benchmark agent' })
  class BenchAgent {
    @Tool({ description: 'Benchmark tool', parameters: [] })
    async benchTool() {
      return { result: 'ok' };
    }
  }

  const runtime = new AgentRuntime({
    enableMetrics: true,
    rateLimitPerMinute: 10000,
  });

  results.push(
    await benchmark.runBenchmark(
      'Agent Registration',
      async () => {
        const agent = new BenchAgent();
        runtime.registerAgentInstance('bench-agent', agent);
      },
      1000
    )
  );

  // Benchmark 2: Tool Registry Lookup
  const agent = new BenchAgent();
  runtime.registerAgentInstance('bench-agent', agent);

  results.push(
    await benchmark.runBenchmark(
      'Tool Registry Lookup',
      async () => {
        runtime.getAgentTools('bench-agent');
      },
      10000
    )
  );

  // Benchmark 3: Metrics Collection
  results.push(
    await benchmark.runBenchmark(
      'Metrics Collection',
      async () => {
        runtime.getMetrics();
      },
      10000
    )
  );

  // Benchmark 4: Health Check
  results.push(
    await benchmark.runBenchmark(
      'Health Check',
      async () => {
        await runtime.healthCheck();
      },
      100
    )
  );

  console.log(benchmark.formatResults(results));
}

// Run benchmarks if executed directly
if (require.main === module) {
  runBenchmarks().catch(console.error);
}

export { PerformanceBenchmark, runBenchmarks };
