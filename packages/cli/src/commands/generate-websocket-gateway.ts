import { Command } from 'commander';
import { Generator, GeneratorOptions } from '../utils/generator';

const WEBSOCKET_GATEWAY_TEMPLATE = `import { Realtime, OnConnect, OnDisconnect, OnMessage, Subscribe, Client, Data, WebSocketClient } from '@hazeljs/websocket';

@Realtime('/{{fileName}}')
export class {{className}}Gateway {
  @OnConnect()
  handleConnection(@Client() client: WebSocketClient) {
    console.log('Client connected:', client.id);
  }

  @OnDisconnect()
  handleDisconnect(@Client() client: WebSocketClient) {
    console.log('Client disconnected:', client.id);
  }

  @Subscribe('message')
  @OnMessage('message')
  handleMessage(@Client() client: WebSocketClient, @Data() data: unknown) {
    console.log('Message received from', client.id, ':', data);
    // Handle message logic here
  }
}
`;

class WebSocketGatewayGenerator extends Generator {
  protected getDefaultTemplate(): string {
    return WEBSOCKET_GATEWAY_TEMPLATE;
  }
}

export function generateWebSocketGateway(program: Command): void {
  program
    .command('gateway <name>')
    .description('Generate a new WebSocket gateway')
    .alias('ws')
    .option('-p, --path <path>', 'Path where the gateway should be generated')
    .action(async (name: string, options: { path?: string }) => {
      const generator = new WebSocketGatewayGenerator();
      const generatorOptions: Partial<GeneratorOptions> = {
        name,
        path: options.path,
      };

      const finalOptions = await generator.promptForOptions(generatorOptions);
      await generator.generate(finalOptions);
    });
}

