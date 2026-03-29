import { HazelApp } from '@hazeljs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = new HazelApp(AppModule);
  await app.listen(3000);
  console.log('🚀 HazelJS AI-Native app running on http://localhost:3000');
  console.log('📊 Inspector: http://localhost:3000/__hazel');
  console.log('🏥 Health: http://localhost:3000/health');
}

bootstrap();
