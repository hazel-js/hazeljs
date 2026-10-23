import { HazelApp } from '@hazeljs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const port = Number(process.env.PORT || 3000);
  const app = new HazelApp(AppModule);
  await app.listen(port);
  console.log(`HazelJS AI-Native HTTP app on http://localhost:${port}`);
  console.log(`  Health     http://localhost:${port}/health`);
  console.log(`  Inspector  http://localhost:${port}/__hazel`);
  console.log(`  Context    POST /context/assemble  |  POST /context/remember`);
  console.log(`  Desk agent POST /desk/chat`);
  console.log(`  RAG        POST /rag/ingest | /rag/search`);
  console.log('');
  console.log('Note: this is an HTTP server. For local Agent OS (hazeld + apply + HITL):');
  console.log('  hazel new agent my-desk --template=context');
}

bootstrap();
