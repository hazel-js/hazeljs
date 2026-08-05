/**
 * Example: wire Skillgate from a Hazel module + optional MCP export.
 *
 * Not compiled into the package — copy into your app.
 *
 *   npm install @hazeljs/skillgate @hazeljs/swagger @hazeljs/mcp @hazeljs/agent
 */

/*
import { Controller, Get, Param, Post, Body, ApiTags, HazelModule } from '@hazeljs/core';
import { AgentSkill, Skillgate } from '@hazeljs/skillgate';
import { ToolRegistry } from '@hazeljs/agent';

@ApiTags('agent')
@Controller('/orders')
class OrdersController {
  @Get('/:id')
  @AgentSkill({ description: 'Fetch an order by id', readOnly: true })
  getOrder(@Param('id') id: string) {
    return { id, status: 'open' };
  }

  @Post('/:id/tickets')
  @AgentSkill({ requiresApproval: true, description: 'Open a ticket for an order' })
  createTicket(@Param('id') id: string, @Body() body: { subject: string }) {
    return { id: 'TKT-1', orderId: id, subject: body.subject };
  }
}

@HazelModule({ controllers: [OrdersController] })
class AppModule {}

const gate = Skillgate.fromModule(AppModule, {
  swagger: { title: 'Orders API', servers: [{ url: 'http://127.0.0.1:3000' }] },
  invoke: { baseUrl: 'http://127.0.0.1:3000' },
});

const registry = new ToolRegistry();
gate.register(registry, 'api-concierge');

// Optional: expose to Cursor / Claude Desktop
// const server = gate.toMcpServer({ name: 'orders-skills', version: '1.0.0', registry });
// server.listenStdio();
*/

export {};
