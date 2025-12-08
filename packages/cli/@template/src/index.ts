// Create a simple HTTP server
import { HazelApp } from '@hazeljs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = new HazelApp(AppModule);
  await app.listen(3000);
}

bootstrap();
