# @hazeljs/websocket

**WebSocket and Server-Sent Events Module for HazelJS**

Build real-time applications with WebSocket support, room management, and event-driven architecture.

[![npm version](https://img.shields.io/npm/v/@hazeljs/websocket.svg)](https://www.npmjs.com/package/@hazeljs/websocket)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 🔌 **WebSocket Support** - Full-duplex real-time communication
- 🏠 **Room Management** - Group clients into rooms
- 📡 **Event-Driven** - Decorator-based event handling
- 🎨 **Decorator API** - `@WebSocketGateway`, `@OnMessage`, `@Subscribe`
- 🔐 **Authentication** - Integrate with auth guards
- 📊 **Broadcasting** - Send messages to multiple clients
- 🎯 **Namespaces** - Separate WebSocket endpoints
- 💾 **State Management** - Per-client state storage

## Installation

```bash
npm install @hazeljs/websocket
```

## Quick Start

### 1. Create WebSocket Gateway

```typescript
import { Injectable } from '@hazeljs/core';
import {
  WebSocketGateway,
  OnConnect,
  OnDisconnect,
  OnMessage,
  WebSocketClient,
  Data,
} from '@hazeljs/websocket';

@Injectable()
@WebSocketGateway({ path: '/ws' })
export class ChatGateway {
  @OnConnect()
  handleConnection(client: WebSocketClient) {
    console.log('Client connected:', client.id);
    client.emit('welcome', { message: 'Welcome to the chat!' });
  }

  @OnDisconnect()
  handleDisconnect(client: WebSocketClient) {
    console.log('Client disconnected:', client.id);
  }

  @OnMessage('message')
  handleMessage(client: WebSocketClient, @Data() data: { text: string }) {
    console.log('Received message:', data.text);
    
    // Broadcast to all clients
    client.broadcast('message', {
      from: client.id,
      text: data.text,
      timestamp: new Date(),
    });
  }
}
```

### 2. Register Gateway

```typescript
import { HazelModule } from '@hazeljs/core';
import { WebSocketModule } from '@hazeljs/websocket';
import { ChatGateway } from './chat.gateway';

@HazelModule({
  imports: [WebSocketModule],
  providers: [ChatGateway],
})
export class AppModule {}
```

### 3. Connect from Client

```javascript
// Browser client
const ws = new WebSocket('ws://localhost:3000/ws');

ws.onopen = () => {
  console.log('Connected');
  ws.send(JSON.stringify({ event: 'message', data: { text: 'Hello!' } }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Received:', message);
};
```

## Decorators

### @WebSocketGateway()

Define a WebSocket gateway:

```typescript
@WebSocketGateway({
  path: '/chat',
  namespace: '/chat',
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class ChatGateway {}
```

### @OnConnect()

Handle client connections:

```typescript
@OnConnect()
handleConnection(client: WebSocketClient) {
  console.log('New client:', client.id);
  
  // Send welcome message
  client.emit('welcome', { message: 'Hello!' });
  
  // Store client data
  client.data.username = 'Guest';
}
```

### @OnDisconnect()

Handle client disconnections:

```typescript
@OnDisconnect()
handleDisconnect(client: WebSocketClient) {
  console.log('Client left:', client.id);
  
  // Notify others
  client.broadcast('user-left', {
    userId: client.id,
    username: client.data.username,
  });
}
```

### @OnMessage()

Handle specific messages:

```typescript
@OnMessage('chat-message')
handleChatMessage(client: WebSocketClient, @Data() data: ChatMessage) {
  console.log('Chat message from', client.id, ':', data.text);
  
  // Broadcast to all
  client.broadcast('chat-message', {
    from: client.data.username,
    text: data.text,
    timestamp: new Date(),
  });
}
```

### @Subscribe()

Subscribe to events:

```typescript
@Subscribe('join-room')
handleJoinRoom(client: WebSocketClient, @Data() data: { room: string }) {
  client.join(data.room);
  
  // Notify room members
  client.to(data.room).emit('user-joined', {
    userId: client.id,
    username: client.data.username,
  });
}
```

## Room Management

### Join Room

```typescript
@Subscribe('join-room')
handleJoinRoom(client: WebSocketClient, @Data() data: { room: string }) {
  client.join(data.room);
  client.emit('joined', { room: data.room });
}
```

### Leave Room

```typescript
@Subscribe('leave-room')
handleLeaveRoom(client: WebSocketClient, @Data() data: { room: string }) {
  client.leave(data.room);
  client.emit('left', { room: data.room });
}
```

### Send to Room

```typescript
@Subscribe('room-message')
handleRoomMessage(
  client: WebSocketClient,
  @Data() data: { room: string; text: string }
) {
  // Send to all clients in room except sender
  client.to(data.room).emit('room-message', {
    from: client.id,
    text: data.text,
  });
}
```

### Broadcast to Room

```typescript
@Subscribe('room-announcement')
handleAnnouncement(
  client: WebSocketClient,
  @Data() data: { room: string; text: string }
) {
  // Send to all clients in room including sender
  client.in(data.room).emit('announcement', {
    text: data.text,
  });
}
```

## Broadcasting

### Broadcast to All

```typescript
@OnMessage('global-message')
handleGlobalMessage(client: WebSocketClient, @Data() data: any) {
  // Send to all connected clients except sender
  client.broadcast('global-message', data);
}
```

### Emit to All

```typescript
@OnMessage('system-message')
handleSystemMessage(client: WebSocketClient, @Data() data: any) {
  // Send to all connected clients including sender
  this.server.emit('system-message', data);
}
```

### Emit to Specific Client

```typescript
@Subscribe('private-message')
handlePrivateMessage(
  client: WebSocketClient,
  @Data() data: { to: string; text: string }
) {
  const targetClient = this.server.getClient(data.to);
  
  if (targetClient) {
    targetClient.emit('private-message', {
      from: client.id,
      text: data.text,
    });
  }
}
```

## Authentication

### With Guards

```typescript
import { UseGuard } from '@hazeljs/core';
import { AuthGuard } from '@hazeljs/auth';

@WebSocketGateway({ path: '/secure' })
@UseGuard(AuthGuard)
export class SecureGateway {
  @OnConnect()
  handleConnection(client: WebSocketClient) {
    // Only authenticated clients reach here
    console.log('Authenticated user:', client.data.user);
  }
}
```

### Custom Authentication

```typescript
@WebSocketGateway({ path: '/chat' })
export class ChatGateway {
  @OnConnect()
  async handleConnection(client: WebSocketClient) {
    const token = client.handshake.query.token;
    
    try {
      const user = await this.authService.verifyToken(token);
      client.data.user = user;
      client.emit('authenticated', { user });
    } catch (error) {
      client.disconnect();
    }
  }
}
```

## Complete Example: Chat Application

```typescript
import { Injectable } from '@hazeljs/core';
import {
  WebSocketGateway,
  OnConnect,
  OnDisconnect,
  Subscribe,
  WebSocketClient,
  Data,
  WebSocketServer,
} from '@hazeljs/websocket';

interface ChatMessage {
  text: string;
  room?: string;
}

interface JoinRoomData {
  room: string;
  username: string;
}

@Injectable()
@WebSocketGateway({ path: '/chat' })
export class ChatGateway {
  @WebSocketServer()
  server: WebSocketServer;

  @OnConnect()
  handleConnection(client: WebSocketClient) {
    console.log(`Client connected: ${client.id}`);
    
    client.emit('connected', {
      clientId: client.id,
      message: 'Welcome to the chat!',
    });
  }

  @OnDisconnect()
  handleDisconnect(client: WebSocketClient) {
    console.log(`Client disconnected: ${client.id}`);
    
    // Notify rooms
    const rooms = client.rooms;
    rooms.forEach(room => {
      client.to(room).emit('user-left', {
        userId: client.id,
        username: client.data.username,
      });
    });
  }

  @Subscribe('join-room')
  handleJoinRoom(client: WebSocketClient, @Data() data: JoinRoomData) {
    client.join(data.room);
    client.data.username = data.username;
    
    // Notify room members
    client.to(data.room).emit('user-joined', {
      userId: client.id,
      username: data.username,
      room: data.room,
    });
    
    // Confirm to sender
    client.emit('joined-room', {
      room: data.room,
      members: this.getRoomMembers(data.room),
    });
  }

  @Subscribe('leave-room')
  handleLeaveRoom(client: WebSocketClient, @Data() data: { room: string }) {
    client.leave(data.room);
    
    // Notify room
    client.to(data.room).emit('user-left', {
      userId: client.id,
      username: client.data.username,
    });
  }

  @Subscribe('chat-message')
  handleMessage(client: WebSocketClient, @Data() data: ChatMessage) {
    const message = {
      from: client.id,
      username: client.data.username,
      text: data.text,
      timestamp: new Date(),
    };

    if (data.room) {
      // Send to specific room
      client.to(data.room).emit('chat-message', message);
    } else {
      // Broadcast to all
      client.broadcast('chat-message', message);
    }
  }

  @Subscribe('typing')
  handleTyping(client: WebSocketClient, @Data() data: { room?: string }) {
    const typingData = {
      userId: client.id,
      username: client.data.username,
    };

    if (data.room) {
      client.to(data.room).emit('typing', typingData);
    } else {
      client.broadcast('typing', typingData);
    }
  }

  private getRoomMembers(room: string): any[] {
    const clients = this.server.getClientsInRoom(room);
    return clients.map(c => ({
      id: c.id,
      username: c.data.username,
    }));
  }
}
```

## Client State

Store per-client data:

```typescript
@OnConnect()
handleConnection(client: WebSocketClient) {
  // Store custom data
  client.data.username = 'Guest';
  client.data.score = 0;
  client.data.joinedAt = new Date();
}

@Subscribe('update-profile')
handleUpdateProfile(client: WebSocketClient, @Data() data: any) {
  client.data.username = data.username;
  client.data.avatar = data.avatar;
}
```

## Server-Sent Events (SSE)

```typescript
import { Controller, Get, Res } from '@hazeljs/core';
import { Response } from 'express';

@Controller('/events')
export class EventsController {
  @Get('/stream')
  streamEvents(@Res() res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send event every second
    const interval = setInterval(() => {
      res.write(`data: ${JSON.stringify({ time: new Date() })}\n\n`);
    }, 1000);

    // Cleanup on close
    res.on('close', () => {
      clearInterval(interval);
      res.end();
    });
  }
}
```

## Best Practices

1. **Handle Disconnections** - Always implement `@OnDisconnect()`
2. **Validate Messages** - Validate incoming data
3. **Use Rooms** - Group related clients
4. **Authentication** - Verify clients on connection
5. **Error Handling** - Catch and handle errors gracefully
6. **Rate Limiting** - Prevent message flooding
7. **Heartbeat** - Implement ping/pong for connection health
8. **Clean Up** - Remove client data on disconnect

## Examples

See the [examples](../../example/src/websocket) directory for complete working examples.

## Testing

```bash
npm test
```

## Contributing

Contributions are welcome! Please read our [Contributing Guide](../../CONTRIBUTING.md) for details.

## License

MIT © [HazelJS](https://hazeljs.com)

## Links

- [Documentation](https://hazeljs.com/docs/packages/websocket)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [GitHub](https://github.com/hazel-js/hazeljs)
- [Issues](https://github.com/hazeljs/hazel-js/issues)
- [Discord](https://discord.gg/hazeljs)
