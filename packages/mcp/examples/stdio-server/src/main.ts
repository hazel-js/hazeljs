/**
 * @hazeljs/mcp — Customer Support Agent Example
 *
 * Real-world scenario: a support team uses Cursor (or Claude Desktop) as their
 * AI assistant. The AI needs to look up customers, check order status, search
 * the knowledge base, and file tickets — all from within the IDE or chat UI.
 *
 * This MCP server exposes four tools backed by in-memory mock data so the
 * example is fully self-contained. In a real deployment you would replace the
 * mock functions with calls to your database, ORM, or internal API layer.
 *
 * Tools exposed:
 *   lookup_customer       — find a customer record by email address
 *   get_order_status      — retrieve the latest status for an order ID
 *   search_knowledge_base — full-text search over help articles
 *   create_support_ticket — open a new ticket and return its ID
 *
 * Run:
 *   pnpm install
 *   pnpm dev
 *
 * Quick smoke test (paste each line into stdin after starting the server):
 *
 *   {"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05"}}
 *   {"jsonrpc":"2.0","id":2,"method":"tools/list"}
 *   {"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"lookup_customer","arguments":{"email":"alice@example.com"}}}
 *   {"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"get_order_status","arguments":{"order_id":"ORD-1001"}}}
 *   {"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"search_knowledge_base","arguments":{"query":"refund policy"}}}
 *   {"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"create_support_ticket","arguments":{"customer_id":"cust_001","subject":"Refund request for order ORD-1001","body":"Customer says item arrived damaged.","priority":"high"}}}
 */

import { createMcpServer } from '@hazeljs/mcp';
import type { IToolRegistry, HazelTool } from '@hazeljs/mcp';

// ---------------------------------------------------------------------------
// Domain types  (in production these come from your DB models / DTOs)
// ---------------------------------------------------------------------------

interface Customer {
  id: string;
  name: string;
  email: string;
  plan: 'free' | 'pro' | 'enterprise';
  joinedAt: string;
}

interface Order {
  id: string;
  customerId: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
  total: number;
  currency: string;
  items: Array<{ sku: string; name: string; qty: number; unitPrice: number }>;
  updatedAt: string;
}

interface KnowledgeArticle {
  id: string;
  title: string;
  excerpt: string;
  url: string;
  tags: string[];
}

interface SupportTicket {
  id: string;
  customerId: string;
  subject: string;
  body: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'open';
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Mock data  (replace with real DB / API calls in production)
// ---------------------------------------------------------------------------

const CUSTOMERS: Customer[] = [
  {
    id: 'cust_001',
    name: 'Alice Johnson',
    email: 'alice@example.com',
    plan: 'pro',
    joinedAt: '2023-03-15',
  },
  {
    id: 'cust_002',
    name: 'Bob Martinez',
    email: 'bob@example.com',
    plan: 'enterprise',
    joinedAt: '2022-11-01',
  },
  {
    id: 'cust_003',
    name: 'Carol White',
    email: 'carol@example.com',
    plan: 'free',
    joinedAt: '2024-01-20',
  },
];

const ORDERS: Order[] = [
  {
    id: 'ORD-1001',
    customerId: 'cust_001',
    status: 'shipped',
    total: 149.99,
    currency: 'USD',
    items: [{ sku: 'SKU-A1', name: 'Wireless Headphones', qty: 1, unitPrice: 149.99 }],
    updatedAt: '2024-02-10T14:30:00Z',
  },
  {
    id: 'ORD-1002',
    customerId: 'cust_001',
    status: 'delivered',
    total: 59.98,
    currency: 'USD',
    items: [
      { sku: 'SKU-B2', name: 'USB-C Cable', qty: 2, unitPrice: 19.99 },
      { sku: 'SKU-B3', name: 'Phone Stand', qty: 1, unitPrice: 19.99 },
    ],
    updatedAt: '2024-01-28T09:00:00Z',
  },
  {
    id: 'ORD-1003',
    customerId: 'cust_002',
    status: 'processing',
    total: 899.0,
    currency: 'USD',
    items: [{ sku: 'SKU-C1', name: 'Developer Keyboard', qty: 1, unitPrice: 899.0 }],
    updatedAt: '2024-02-11T08:15:00Z',
  },
];

const KNOWLEDGE_BASE: KnowledgeArticle[] = [
  {
    id: 'kb_001',
    title: 'Refund & Return Policy',
    excerpt:
      'We accept returns within 30 days of delivery. Refunds are processed to the original payment method within 5–7 business days.',
    url: 'https://help.example.com/refund-policy',
    tags: ['refund', 'return', 'policy'],
  },
  {
    id: 'kb_002',
    title: 'How to Track Your Order',
    excerpt:
      'Use the tracking number in your shipping confirmation email. Visit our order tracker at orders.example.com.',
    url: 'https://help.example.com/track-order',
    tags: ['tracking', 'shipping', 'order', 'status'],
  },
  {
    id: 'kb_003',
    title: 'Changing or Cancelling an Order',
    excerpt:
      'Orders can be modified or cancelled within 1 hour of placement. After that, please wait for delivery and request a return.',
    url: 'https://help.example.com/cancel-order',
    tags: ['cancel', 'modify', 'order'],
  },
  {
    id: 'kb_004',
    title: 'Warranty Coverage',
    excerpt:
      'All hardware products carry a 1-year limited warranty. Enterprise plan customers receive extended 3-year coverage.',
    url: 'https://help.example.com/warranty',
    tags: ['warranty', 'hardware', 'coverage', 'enterprise'],
  },
  {
    id: 'kb_005',
    title: 'Upgrading Your Plan',
    excerpt:
      'You can upgrade from Free to Pro or Enterprise at any time from your account dashboard. Billing is prorated.',
    url: 'https://help.example.com/upgrade-plan',
    tags: ['plan', 'upgrade', 'billing', 'pro', 'enterprise'],
  },
];

// In-memory ticket store — resets on restart
const TICKETS: SupportTicket[] = [];
let ticketCounter = 1000;

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

async function lookupCustomer(input: {
  email: string;
}): Promise<{ found: boolean; customer?: Customer; error?: string }> {
  if (!input.email?.trim()) {
    return { found: false, error: 'email is required' };
  }

  const customer = CUSTOMERS.find(
    (c) => c.email.toLowerCase() === input.email.toLowerCase().trim(),
  );

  if (!customer) {
    return { found: false, error: `No customer found for email: ${input.email}` };
  }

  return { found: true, customer };
}

async function getOrderStatus(input: {
  order_id: string;
}): Promise<{ found: boolean; order?: Order; error?: string }> {
  if (!input.order_id?.trim()) {
    return { found: false, error: 'order_id is required' };
  }

  const order = ORDERS.find(
    (o) => o.id.toLowerCase() === input.order_id.toLowerCase().trim(),
  );

  if (!order) {
    return { found: false, error: `No order found with ID: ${input.order_id}` };
  }

  return { found: true, order };
}

async function searchKnowledgeBase(input: {
  query: string;
  limit?: number;
}): Promise<{ results: KnowledgeArticle[]; total: number }> {
  const query = (input.query ?? '').toLowerCase().trim();
  const limit = Math.min(Number(input.limit) || 3, 10);

  if (!query) {
    return { results: [], total: 0 };
  }

  const scored = KNOWLEDGE_BASE.map((article) => {
    const haystack = [
      article.title,
      article.excerpt,
      ...article.tags,
    ].join(' ').toLowerCase();

    // Simple relevance: count how many query words appear in the article
    const words = query.split(/\s+/);
    const hits = words.filter((w) => haystack.includes(w)).length;
    return { article, score: hits };
  })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.article);

  return { results: scored, total: scored.length };
}

async function createSupportTicket(input: {
  customer_id: string;
  subject: string;
  body: string;
  priority?: string;
}): Promise<{ success: boolean; ticket?: SupportTicket; error?: string }> {
  if (!input.customer_id?.trim()) return { success: false, error: 'customer_id is required' };
  if (!input.subject?.trim()) return { success: false, error: 'subject is required' };
  if (!input.body?.trim()) return { success: false, error: 'body is required' };

  const customerExists = CUSTOMERS.some((c) => c.id === input.customer_id.trim());
  if (!customerExists) {
    return { success: false, error: `Customer not found: ${input.customer_id}` };
  }

  const validPriorities = ['low', 'normal', 'high', 'urgent'] as const;
  const priority = validPriorities.includes(input.priority as typeof validPriorities[number])
    ? (input.priority as SupportTicket['priority'])
    : 'normal';

  const ticket: SupportTicket = {
    id: `TKT-${++ticketCounter}`,
    customerId: input.customer_id.trim(),
    subject: input.subject.trim(),
    body: input.body.trim(),
    priority,
    status: 'open',
    createdAt: new Date().toISOString(),
  };

  TICKETS.push(ticket);

  return { success: true, ticket };
}

// ---------------------------------------------------------------------------
// Tool registry
// ---------------------------------------------------------------------------

class SimpleToolRegistry implements IToolRegistry {
  private readonly tools: Map<string, HazelTool> = new Map();

  register(tool: HazelTool): void {
    this.tools.set(tool.name, tool);
  }

  getAllTools(): HazelTool[] {
    return Array.from(this.tools.values());
  }

  getTool(name: string): HazelTool | undefined {
    return this.tools.get(name);
  }

  hasTool(name: string): boolean {
    return this.tools.has(name);
  }
}

const registry = new SimpleToolRegistry();

registry.register({
  name: 'lookup_customer',
  description:
    'Look up a customer record by their email address. Returns the customer ID, name, plan tier, and join date.',
  parameters: [
    {
      name: 'email',
      type: 'string',
      description: "The customer's email address",
      required: true,
    },
  ],
  target: {},
  method: lookupCustomer,
});

registry.register({
  name: 'get_order_status',
  description:
    'Retrieve the current status, items, and total for a given order ID. Use lookup_customer first to verify the customer.',
  parameters: [
    {
      name: 'order_id',
      type: 'string',
      description: 'Order ID in the format ORD-XXXX',
      required: true,
    },
  ],
  target: {},
  method: getOrderStatus,
});

registry.register({
  name: 'search_knowledge_base',
  description:
    'Search the support knowledge base for help articles relevant to a customer issue. Returns titles, excerpts, and URLs.',
  parameters: [
    {
      name: 'query',
      type: 'string',
      description: 'Natural language search query, e.g. "refund policy" or "cancel order"',
      required: true,
    },
    {
      name: 'limit',
      type: 'number',
      description: 'Maximum number of articles to return (default 3, max 10)',
      required: false,
    },
  ],
  target: {},
  method: searchKnowledgeBase,
});

registry.register({
  name: 'create_support_ticket',
  description:
    'Open a new support ticket for a customer. Call lookup_customer first to get the customer_id.',
  parameters: [
    {
      name: 'customer_id',
      type: 'string',
      description: 'Internal customer ID (e.g. cust_001) — from lookup_customer',
      required: true,
    },
    {
      name: 'subject',
      type: 'string',
      description: 'One-line summary of the issue',
      required: true,
    },
    {
      name: 'body',
      type: 'string',
      description: 'Full description of the issue',
      required: true,
    },
    {
      name: 'priority',
      type: 'string',
      description: 'Ticket priority: low | normal | high | urgent (default: normal)',
      required: false,
      enum: ['low', 'normal', 'high', 'urgent'],
    },
  ],
  target: {},
  method: createSupportTicket,
});

// ---------------------------------------------------------------------------
// Start the server
// ---------------------------------------------------------------------------

const server = createMcpServer({
  name: 'hazel-support-agent',
  version: '1.0.0',
  toolRegistry: registry,
});

const toolNames = server.listTools().map((t) => t.name).join(', ');
process.stderr.write(`[hazel-mcp] Support agent server started\n`);
process.stderr.write(`[hazel-mcp] Tools: ${toolNames}\n`);
process.stderr.write(`[hazel-mcp] Waiting for JSON-RPC messages on stdin...\n`);

server.listenStdio();
