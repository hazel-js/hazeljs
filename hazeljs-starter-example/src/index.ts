import 'reflect-metadata';
import { HazelApp } from '@hazeljs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = new HazelApp(AppModule);

  // Enable CORS
  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });

  const port = parseInt(process.env.PORT || '3000', 10);
  await app.listen(port);
}

bootstrap();
