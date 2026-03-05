/**
 * SupportAgent
 *
 * A HazelJS agent class whose methods are exposed as MCP tools via @Tool().
 *
 * This is the native HazelJS way to define tools. Each method decorated with
 * @Tool() is automatically discovered by ToolRegistry.registerAgentTools()
 * through reflect-metadata — no manual registration array needed.
 *
 * The decorator stores three things on the class prototype:
 *   - Per-method metadata (name, description, parameters) via TOOL_METADATA_KEY
 *   - A list of decorated method names on the class via TOOLS_LIST_KEY
 *   - The method reference and original target (updated to the instance later)
 *
 * Compare to the SimpleToolRegistry pattern in examples/stdio-server where
 * each tool is registered imperatively. Here the class IS the registry spec.
 */

import 'reflect-metadata';
import { Tool } from '@hazeljs/agent';

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
// Mock data  (replace with Prisma / TypeORM / HTTP calls in production)
// ---------------------------------------------------------------------------

const CUSTOMERS: Customer[] = [
  { id: 'cust_001', name: 'Alice Johnson',  email: 'alice@example.com', plan: 'pro',        joinedAt: '2023-03-15' },
  { id: 'cust_002', name: 'Bob Martinez',   email: 'bob@example.com',   plan: 'enterprise', joinedAt: '2022-11-01' },
  { id: 'cust_003', name: 'Carol White',    email: 'carol@example.com', plan: 'free',       joinedAt: '2024-01-20' },
];

const ORDERS: Order[] = [
  {
    id: 'ORD-1001', customerId: 'cust_001', status: 'shipped',
    total: 149.99, currency: 'USD', updatedAt: '2024-02-10T14:30:00Z',
    items: [{ sku: 'SKU-A1', name: 'Wireless Headphones', qty: 1, unitPrice: 149.99 }],
  },
  {
    id: 'ORD-1002', customerId: 'cust_001', status: 'delivered',
    total: 59.98, currency: 'USD', updatedAt: '2024-01-28T09:00:00Z',
    items: [
      { sku: 'SKU-B2', name: 'USB-C Cable', qty: 2, unitPrice: 19.99 },
      { sku: 'SKU-B3', name: 'Phone Stand', qty: 1, unitPrice: 19.99 },
    ],
  },
  {
    id: 'ORD-1003', customerId: 'cust_002', status: 'processing',
    total: 899.00, currency: 'USD', updatedAt: '2024-02-11T08:15:00Z',
    items: [{ sku: 'SKU-C1', name: 'Developer Keyboard', qty: 1, unitPrice: 899.00 }],
  },
];

const KNOWLEDGE_BASE: KnowledgeArticle[] = [
  {
    id: 'kb_001', title: 'Refund & Return Policy',
    excerpt: 'We accept returns within 30 days of delivery. Refunds are processed to the original payment method within 5–7 business days.',
    url: 'https://help.example.com/refund-policy', tags: ['refund', 'return', 'policy'],
  },
  {
    id: 'kb_002', title: 'How to Track Your Order',
    excerpt: 'Use the tracking number in your shipping confirmation email. Visit our order tracker at orders.example.com.',
    url: 'https://help.example.com/track-order', tags: ['tracking', 'shipping', 'order', 'status'],
  },
  {
    id: 'kb_003', title: 'Changing or Cancelling an Order',
    excerpt: 'Orders can be modified or cancelled within 1 hour of placement. After that, wait for delivery and request a return.',
    url: 'https://help.example.com/cancel-order', tags: ['cancel', 'modify', 'order'],
  },
  {
    id: 'kb_004', title: 'Warranty Coverage',
    excerpt: 'All hardware products carry a 1-year limited warranty. Enterprise plan customers receive extended 3-year coverage.',
    url: 'https://help.example.com/warranty', tags: ['warranty', 'hardware', 'coverage', 'enterprise'],
  },
  {
    id: 'kb_005', title: 'Upgrading Your Plan',
    excerpt: 'You can upgrade from Free to Pro or Enterprise at any time from your account dashboard. Billing is prorated.',
    url: 'https://help.example.com/upgrade-plan', tags: ['plan', 'upgrade', 'billing', 'pro', 'enterprise'],
  },
];

// In-memory ticket store — resets on restart
const TICKETS: SupportTicket[] = [];
let ticketCounter = 1000;

// ---------------------------------------------------------------------------
// Agent class
// ---------------------------------------------------------------------------

export class SupportAgent {
  /**
   * Look up a customer record by email address.
   *
   * In production, replace the array find with a database query:
   *   return prisma.customer.findUnique({ where: { email: input.email } });
   */
  @Tool({
    name: 'lookup_customer',
    description:
      'Look up a customer record by their email address. Returns the customer ID, name, plan tier, and join date. Call this first before any ticket or order operation.',
    parameters: [
      {
        name: 'email',
        type: 'string',
        description: "The customer's email address",
        required: true,
      },
    ],
  })
  async lookupCustomer(
    input: Record<string, unknown>,
  ): Promise<{ found: boolean; customer?: Customer; error?: string }> {
    const email = String(input['email'] ?? '').trim();

    if (!email) return { found: false, error: 'email is required' };

    const customer = CUSTOMERS.find((c) => c.email.toLowerCase() === email.toLowerCase());

    if (!customer) return { found: false, error: `No customer found for email: ${email}` };

    return { found: true, customer };
  }

  /**
   * Retrieve the latest status and line items for an order.
   *
   * In production:
   *   return prisma.order.findUnique({ where: { id: input.order_id }, include: { items: true } });
   */
  @Tool({
    name: 'get_order_status',
    description:
      'Retrieve the current status, items, and total for a given order ID. Use lookup_customer first to confirm the customer context.',
    parameters: [
      {
        name: 'order_id',
        type: 'string',
        description: 'Order ID in the format ORD-XXXX',
        required: true,
      },
    ],
  })
  async getOrderStatus(
    input: Record<string, unknown>,
  ): Promise<{ found: boolean; order?: Order; error?: string }> {
    const orderId = String(input['order_id'] ?? '').trim();

    if (!orderId) return { found: false, error: 'order_id is required' };

    const order = ORDERS.find((o) => o.id.toLowerCase() === orderId.toLowerCase());

    if (!order) return { found: false, error: `No order found with ID: ${orderId}` };

    return { found: true, order };
  }

  /**
   * Search help articles by relevance to a natural-language query.
   *
   * In production, replace the in-memory score with a vector search or
   * a full-text search index (Postgres tsvector, Elasticsearch, etc.).
   */
  @Tool({
    name: 'search_knowledge_base',
    description:
      'Search the support knowledge base for help articles relevant to a customer issue. Returns titles, excerpts, and URLs. Use this before creating a ticket to check if self-service content exists.',
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
  })
  async searchKnowledgeBase(
    input: Record<string, unknown>,
  ): Promise<{ results: KnowledgeArticle[]; total: number }> {
    const query = String(input['query'] ?? '').toLowerCase().trim();
    const limit = Math.min(Number(input['limit']) || 3, 10);

    if (!query) return { results: [], total: 0 };

    const scored = KNOWLEDGE_BASE
      .map((article) => {
        const haystack = [article.title, article.excerpt, ...article.tags].join(' ').toLowerCase();
        const hits = query.split(/\s+/).filter((w) => haystack.includes(w)).length;
        return { article, score: hits };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((r) => r.article);

    return { results: scored, total: scored.length };
  }

  /**
   * Open a new support ticket for a customer.
   *
   * In production:
   *   return prisma.ticket.create({ data: { customerId, subject, body, priority } });
   */
  @Tool({
    name: 'create_support_ticket',
    description:
      'Open a new support ticket for a customer. Call lookup_customer first to get the customer_id. Returns the ticket ID and creation timestamp.',
    parameters: [
      {
        name: 'customer_id',
        type: 'string',
        description: 'Internal customer ID (e.g. cust_001) — obtained from lookup_customer',
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
  })
  async createSupportTicket(
    input: Record<string, unknown>,
  ): Promise<{ success: boolean; ticket?: SupportTicket; error?: string }> {
    const customerId = String(input['customer_id'] ?? '').trim();
    const subject    = String(input['subject']     ?? '').trim();
    const body       = String(input['body']        ?? '').trim();

    if (!customerId) return { success: false, error: 'customer_id is required' };
    if (!subject)    return { success: false, error: 'subject is required' };
    if (!body)       return { success: false, error: 'body is required' };

    if (!CUSTOMERS.some((c) => c.id === customerId)) {
      return { success: false, error: `Customer not found: ${customerId}` };
    }

    const validPriorities = ['low', 'normal', 'high', 'urgent'] as const;
    type Priority = typeof validPriorities[number];
    const rawPriority = String(input['priority'] ?? '');
    const priority: Priority = (validPriorities as readonly string[]).includes(rawPriority)
      ? (rawPriority as Priority)
      : 'normal';

    const ticket: SupportTicket = {
      id: `TKT-${++ticketCounter}`,
      customerId,
      subject,
      body,
      priority,
      status: 'open',
      createdAt: new Date().toISOString(),
    };

    TICKETS.push(ticket);

    return { success: true, ticket };
  }
}
