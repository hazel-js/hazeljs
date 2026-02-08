import { Command } from 'commander';
import { Generator } from '../utils/generator';
import chalk from 'chalk';

const RAG_SERVICE_TEMPLATE = `import { Injectable } from '@hazeljs/core';
import { RAGPipeline, MemoryVectorStore } from '@hazeljs/rag';

@Injectable()
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

export function generateRag(command: Command) {
  command
    .command('rag <name>')
    .description('Generate a RAG (Retrieval-Augmented Generation) service')
    .option('-p, --path <path>', 'Specify the path')
    .option('--dry-run', 'Preview files without writing them')
    .action(async (name: string, options: { path?: string; dryRun?: boolean }) => {
      const generator = new RagServiceGenerator();
      await generator.generate({ name, path: options.path, dryRun: options.dryRun });

      if (!options.dryRun) {
        console.log(chalk.gray('\nNext steps:'));
        console.log(chalk.gray('  1. npm install @hazeljs/rag'));
        console.log(chalk.gray('  2. Register this service as a provider in your module'));
        console.log(chalk.gray('  3. Configure your embedding provider and vector store'));
      }
    });
}
