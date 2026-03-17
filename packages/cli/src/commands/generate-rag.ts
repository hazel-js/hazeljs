import { Command } from 'commander';
import { Generator, GenerateResult, GenerateCLIOptions, printGenerateResult } from '../utils/generator';

const RAG_SERVICE_TEMPLATE = `import { Service } from '@hazeljs/core';
import { RAGPipeline, MemoryVectorStore } from '@hazeljs/rag';

@Service()
export class {{className}}RagService {
  private pipeline: RAGPipeline;

  constructor() {
    // Initialize with a memory vector store (swap for Pinecone, Qdrant, etc. in production)
    const vectorStore = new MemoryVectorStore();

    this.pipeline = new RAGPipeline({
      vectorStore,
      topK: 5,
    });
  }

  async addDocument(content: string, metadata?: Record<string, unknown>) {
    // Add a document to the vector store for retrieval
    await this.pipeline.addDocument({
      content,
      metadata: metadata || {},
    });
  }

  async query(question: string) {
    // Retrieve relevant documents and generate a response
    const results = await this.pipeline.query(question);
    return results;
  }
}
`;

class RagServiceGenerator extends Generator {
  protected suffix = 'rag';

  protected getDefaultTemplate(): string {
    return RAG_SERVICE_TEMPLATE;
  }
}

export async function runRag(name: string, options: GenerateCLIOptions): Promise<GenerateResult> {
  const generator = new RagServiceGenerator();
  const result = await generator.generate({ name, path: options.path, dryRun: options.dryRun });
  result.nextSteps = [
    'npm install @hazeljs/rag',
    'Register this service as a provider in your module',
    'Configure your embedding provider and vector store',
  ];
  return result;
}

export function generateRag(command: Command) {
  command
    .command('rag <name>')
    .description('Generate a RAG (Retrieval-Augmented Generation) service')
    .option('-p, --path <path>', 'Specify the path')
    .option('--dry-run', 'Preview files without writing them')
    .option('--json', 'Output result as JSON')
    .action(async (name: string, options: GenerateCLIOptions) => {
      const result = await runRag(name, options);
      printGenerateResult(result, { json: options.json });
    });
}
