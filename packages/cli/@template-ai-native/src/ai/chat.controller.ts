import { Controller, Post, Body, Service } from '@hazeljs/core';
import { AIEnhancedService } from '@hazeljs/ai';

@Service()
export class ChatService {
  constructor(private readonly ai: AIEnhancedService) {}

  async chat(message: string): Promise<string> {
    return this.ai
      .chat(message)
      .system('You are a helpful assistant specializing in HazelJS and TypeScript development.')
      .model('gpt-4')
      .temperature(0.7)
      .text();
  }
}

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  async sendMessage(@Body() body: { message: string }) {
    const response = await this.chatService.chat(body.message);
    return { response };
  }
}
