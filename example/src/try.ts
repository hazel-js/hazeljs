// Create a simple HTTP server
import { HazelModule, HazelApp, Controller, Get } from '@hazeljs/core';

@Controller('/hello')
class HelloController {
  @Get()
  hello(): Promise<string> {
    return Promise.resolve('Hello, World!');
  }
}

@HazelModule({
  controllers: [HelloController],
})
class AppModule {}

async function bootstrap(): Promise<void> {
  const app = new HazelApp(AppModule);
  await app.listen(3000);
}

bootstrap();
