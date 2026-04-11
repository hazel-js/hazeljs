# HazelJS Documentation Plan

Documentation structure - practical, example-driven guides.

**Docs site (primary):** End-user guides live on the docs site under `hazeljs-landing/src/content/docs/` (e.g. `/docs/guides/*`). Repo `docs/guides/*.md` remains for distributed locking, saga, and serverless deep-dives.

## Documentation Structure

### 1. Introduction

- [x] What is HazelJS? (docs site: Introduction)
- [x] Why HazelJS?
- [x] Philosophy
- [x] First Steps (docs site: Installation)

### 2. Overview

- [x] Controllers
- [x] Providers
- [x] Modules
- [x] Middleware
- [x] Exception Filters
- [x] Pipes
- [x] Guards
- [x] Interceptors

### 3. Fundamentals

#### Controllers

- [x] Routing
- [x] Request object
- [x] Response handling
- [x] Route parameters
- [x] Query parameters
- [x] Request body
- [x] Headers
- [x] Status codes
- [x] Async/await

#### Providers

- [x] Services
- [x] Dependency injection
- [x] Scopes (Singleton, Transient, Request)
- [x] Custom providers
- [x] Optional providers
- [x] Property-based injection

#### Modules

- [x] Feature modules
- [x] Shared modules
- [x] Module re-exporting
- [x] Dependency injection
- [x] Global modules
- [x] Dynamic modules

#### Middleware

- [x] Applying middleware
- [x] Functional middleware
- [x] Class middleware
- [x] Multiple middleware
- [x] Global middleware
- [x] Route middleware

#### Exception Filters

- [x] Built-in HTTP exceptions
- [x] Custom exceptions
- [x] Exception filters
- [x] Catch everything
- [x] Inheritance

#### Pipes

- [x] Built-in pipes
- [x] Custom pipes
- [x] Validation pipe
- [x] Transformation pipe
- [x] Providing defaults

#### Guards

- [x] Authorization guard
- [x] Role-based access control
- [x] Reflection and metadata
- [x] Execution context

#### Interceptors

- [x] Basics
- [x] Binding interceptors
- [x] Response mapping
- [x] Exception mapping
- [x] Stream overriding
- [x] More operators

### 4. Techniques

#### Database (Prisma)

- [x] Getting started with Prisma (docs site: Database guide + packages/prisma)
- [x] Repository pattern
- [x] Migrations
- [x] Seeding
- [x] Relations
- [x] Transactions
- [x] Raw queries

#### Configuration

- [x] Configuration module (docs site: Configuration guide)
- [x] Environment variables
- [x] Configuration validation
- [x] Custom configuration
- [x] Partial registration

#### Validation

- [x] Auto-validation (docs site: Validation guide)
- [x] Stripping properties
- [x] Transform payload
- [x] Validation groups
- [x] Custom validators

#### Caching

- [x] In-memory cache (docs site: packages/cache + caching-strategies guide)
- [x] Redis cache
- [x] Multi-tier caching
- [x] Cache invalidation
- [x] Custom cache store

#### Distributed Systems

- [x] Distributed Locking ([guide](guides/distributed-locking.md))
- [x] Saga Patterns (Distributed Transactions) ([guide](guides/saga.md))
- [x] Redis-backed synchronization (docs site: caching-strategies guide + distributed-lock package)
- [x] Task Orchestration (docs site: saga package + HCEL guide)

#### Authentication

- [x] JWT strategy (docs site: packages/auth + Authentication guide)
- [x] Passport integration (docs site: Authentication guide — optional Passport bridge)
- [x] Guards
- [x] Login endpoint
- [x] Protected routes

#### Authorization

- [x] Role-based access control (docs site: packages/casl + Authentication guide)
- [x] Claims-based authorization (docs site: Authentication guide)
- [x] Policies
- [x] Custom decorators

#### File Upload

- [x] Single file (docs site: File Upload guide)
- [x] Multiple files
- [x] File validation
- [x] Storage options

#### Logging

- [x] Built-in logger (docs site: Logging guide)
- [x] Custom logger (docs site: Logging guide)
- [x] Log levels
- [x] Context

#### Testing

- [x] Unit testing (docs site: Testing guide)
- [x] Integration testing
- [x] E2E testing (docs site: Testing guide)
- [x] Test module
- [x] Mocking

### 5. AI Integration (Unique to HazelJS)

#### Getting Started

- [x] AI module overview (docs site: packages/ai + AI Quickstart)
- [x] Supported providers (OpenAI, Ollama, Anthropic, Gemini, Cohere)
- [x] Basic setup
- [x] Configuration

#### OpenAI Integration

- [x] Chat completions
- [x] Streaming responses
- [x] Function calling
- [x] Embeddings
- [x] Image generation

#### Ollama Integration

- [x] Local LLMs
- [x] Model management
- [x] Chat completions
- [x] Embeddings

#### AI Context Management

- [x] Conversation history
- [x] Context windows
- [x] Memory management

#### Token Tracking

- [x] Usage monitoring
- [x] Cost calculation
- [x] Rate limiting

#### Vector Search

- [x] Embeddings
- [x] Similarity search
- [x] Similarity search
- [x] RAG (Retrieval Augmented Generation)
- [x] Agentic RAG
- [x] GraphRAG

#### AI Decorators

- [x] @AITask decorator
- [x] @AIValidate decorator
- [x] @AIPrompt decorator

#### Practical Examples

- [x] Chatbot
- [x] Content generation
- [x] Semantic search
- [x] Code assistant
- [x] Data extraction

#### Advanced ML & Monitoring

- [x] Feature Store (TypeScript-Native)
- [x] Experiment Tracking
- [x] Drift Detection (PSC, KS, JSD)
- [x] Model Monitoring
- [x] Guardrails (PII, Toxicity)
- [x] Data Contracts & Pipelines

#### Agent Ecosystem

- [x] MCP Protocol Support
- [x] A2A Compliance (Interoperability)
- [x] Persistent Long-term Memory
- [x] Reasoning Loop Debugging (docs site: Agent Ecosystem guide)
- [x] Observability & Tracing (OTel)

### 6. WebSockets

#### Gateways

- [x] Basic gateway (docs site: WebSockets guide + packages/websocket)
- [x] Lifecycle hooks
- [x] Server
- [x] Multiple namespaces

#### Events

- [x] Emit events
- [x] Listen to events
- [x] Acknowledgements

#### Rooms

- [x] Joining rooms
- [x] Broadcasting
- [x] Private messages

#### Adapters

- [x] Redis adapter
- [x] Custom adapter

#### Server-Sent Events (SSE)

- [x] Basic SSE
- [x] Streaming data
- [x] Client reconnection

### 7. Serverless

#### AWS Lambda

- [x] Setup
- [x] Deployment
- [x] Environment variables
- [x] Cold start optimization
- [x] API Gateway integration

#### Vercel

- [x] Setup
- [x] Deployment
- [x] Environment variables
- [x] Edge functions

#### Netlify Functions

- [x] Setup
- [x] Deployment
- [x] Background functions

#### Railway

- [x] Setup
- [x] Deployment
- [x] Databases

### 8. OpenAPI (Swagger)

#### Introduction

- [x] Setup (docs site: OpenAPI guide + packages/swagger)
- [x] Decorators
- [x] Types and parameters
- [x] Operations
- [x] Security

#### Advanced

- [x] Multiple specifications
- [x] Tags
- [x] Responses
- [x] File upload
- [x] Extensions

### 9. Recipes

#### CRUD Application

- [x] Complete CRUD example
- [x] Validation
- [x] Error handling

#### REST API

- [x] Best practices
- [x] Versioning
- [x] Pagination
- [x] Filtering
- [x] Sorting

#### GraphQL API

- [x] Setup
- [x] Resolvers
- [x] Mutations
- [x] Subscriptions

#### Microservices

- [x] Message patterns
- [x] Request-response
- [x] Event-based
- [x] gRPC

#### AI-Powered Application

- [x] Chatbot with memory
- [x] Content generator
- [x] Semantic search engine
- [x] Code assistant

### 10. CLI

#### Overview

- [x] Installation (docs site: CLI guide)
- [x] Usage
- [x] Workspaces
- [x] Libraries

#### Generators

- [x] Generate module
- [x] Generate controller
- [x] Generate service
- [x] Generate guard
- [x] Generate interceptor

### 11. FAQ

- [x] Common questions
- [x] Troubleshooting
- [x] Migration from NestJS
- [x] Performance tips

### 12. Migration

- [x] From Express
- [x] From NestJS
- [x] From Fastify (docs site: migration-fastify guide)

## Documentation Style Guide

### Structure

- Start with a brief introduction
- Show a practical example immediately
- Explain concepts after the example
- Provide multiple examples for complex topics
- Include "Try it yourself" sections

### Code Examples

- Always show complete, runnable code
- Include imports
- Show both TypeScript and JavaScript when relevant
- Add comments for clarity
- Show expected output

### Best Practices

- Use real-world scenarios
- Avoid jargon
- Link to related topics
- Include "What's Next" section
- Add troubleshooting tips

## Priority Order

1. **Week 1: Fundamentals**
   - Controllers
   - Providers
   - Modules
   - Dependency Injection

2. **Week 2: Core Features**
   - Middleware
   - Exception Filters
   - Pipes
   - Guards

3. **Week 3: Techniques**
   - Database (Prisma)
   - Configuration
   - Validation
   - Caching

4. **Week 4: AI Integration** (Unique selling point)
   - All AI guides
   - Practical examples

5. **Week 5: Advanced**
   - WebSockets
   - Serverless
   - Swagger
   - Testing

6. **Week 6: Recipes & Polish**
   - Complete examples
   - FAQ
   - Migration guides
