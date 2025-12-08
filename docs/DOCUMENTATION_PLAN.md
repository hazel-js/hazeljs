# HazelJS Documentation Plan

Documentation structure - practical, example-driven guides.

## Documentation Structure

### 1. Introduction
- [ ] What is HazelJS?
- [ ] Why HazelJS?
- [ ] Philosophy
- [ ] First Steps

### 2. Overview
- [ ] Controllers
- [ ] Providers
- [ ] Modules
- [ ] Middleware
- [ ] Exception Filters
- [ ] Pipes
- [ ] Guards
- [ ] Interceptors

### 3. Fundamentals

#### Controllers
- [ ] Routing
- [ ] Request object
- [ ] Response handling
- [ ] Route parameters
- [ ] Query parameters
- [ ] Request body
- [ ] Headers
- [ ] Status codes
- [ ] Async/await

#### Providers
- [ ] Services
- [ ] Dependency injection
- [ ] Scopes (Singleton, Transient, Request)
- [ ] Custom providers
- [ ] Optional providers
- [ ] Property-based injection

#### Modules
- [ ] Feature modules
- [ ] Shared modules
- [ ] Module re-exporting
- [ ] Dependency injection
- [ ] Global modules
- [ ] Dynamic modules

#### Middleware
- [ ] Applying middleware
- [ ] Functional middleware
- [ ] Class middleware
- [ ] Multiple middleware
- [ ] Global middleware
- [ ] Route middleware

#### Exception Filters
- [ ] Built-in HTTP exceptions
- [ ] Custom exceptions
- [ ] Exception filters
- [ ] Catch everything
- [ ] Inheritance

#### Pipes
- [ ] Built-in pipes
- [ ] Custom pipes
- [ ] Validation pipe
- [ ] Transformation pipe
- [ ] Providing defaults

#### Guards
- [ ] Authorization guard
- [ ] Role-based access control
- [ ] Reflection and metadata
- [ ] Execution context

#### Interceptors
- [ ] Basics
- [ ] Binding interceptors
- [ ] Response mapping
- [ ] Exception mapping
- [ ] Stream overriding
- [ ] More operators

### 4. Techniques

#### Database (Prisma)
- [ ] Getting started with Prisma
- [ ] Repository pattern
- [ ] Migrations
- [ ] Seeding
- [ ] Relations
- [ ] Transactions
- [ ] Raw queries

#### Configuration
- [ ] Configuration module
- [ ] Environment variables
- [ ] Configuration validation
- [ ] Custom configuration
- [ ] Partial registration

#### Validation
- [ ] Auto-validation
- [ ] Stripping properties
- [ ] Transform payload
- [ ] Validation groups
- [ ] Custom validators

#### Caching
- [ ] In-memory cache
- [ ] Redis cache
- [ ] Multi-tier caching
- [ ] Cache invalidation
- [ ] Custom cache store

#### Authentication
- [ ] JWT strategy
- [ ] Passport integration
- [ ] Guards
- [ ] Login endpoint
- [ ] Protected routes

#### Authorization
- [ ] Role-based access control
- [ ] Claims-based authorization
- [ ] Policies
- [ ] Custom decorators

#### File Upload
- [ ] Single file
- [ ] Multiple files
- [ ] File validation
- [ ] Storage options

#### Logging
- [ ] Built-in logger
- [ ] Custom logger
- [ ] Log levels
- [ ] Context

#### Testing
- [ ] Unit testing
- [ ] Integration testing
- [ ] E2E testing
- [ ] Test module
- [ ] Mocking

### 5. AI Integration (Unique to HazelJS)

#### Getting Started
- [ ] AI module overview
- [ ] Supported providers (OpenAI, Ollama, Anthropic, Gemini, Cohere)
- [ ] Basic setup
- [ ] Configuration

#### OpenAI Integration
- [ ] Chat completions
- [ ] Streaming responses
- [ ] Function calling
- [ ] Embeddings
- [ ] Image generation

#### Ollama Integration
- [ ] Local LLMs
- [ ] Model management
- [ ] Chat completions
- [ ] Embeddings

#### AI Context Management
- [ ] Conversation history
- [ ] Context windows
- [ ] Memory management

#### Token Tracking
- [ ] Usage monitoring
- [ ] Cost calculation
- [ ] Rate limiting

#### Vector Search
- [ ] Embeddings
- [ ] Similarity search
- [ ] RAG (Retrieval Augmented Generation)

#### AI Decorators
- [ ] @AITask decorator
- [ ] @AIValidate decorator
- [ ] @AIPrompt decorator

#### Practical Examples
- [ ] Chatbot
- [ ] Content generation
- [ ] Semantic search
- [ ] Code assistant
- [ ] Data extraction

### 6. WebSockets

#### Gateways
- [ ] Basic gateway
- [ ] Lifecycle hooks
- [ ] Server
- [ ] Multiple namespaces

#### Events
- [ ] Emit events
- [ ] Listen to events
- [ ] Acknowledgements

#### Rooms
- [ ] Joining rooms
- [ ] Broadcasting
- [ ] Private messages

#### Adapters
- [ ] Redis adapter
- [ ] Custom adapter

#### Server-Sent Events (SSE)
- [ ] Basic SSE
- [ ] Streaming data
- [ ] Client reconnection

### 7. Serverless

#### AWS Lambda
- [ ] Setup
- [ ] Deployment
- [ ] Environment variables
- [ ] Cold start optimization
- [ ] API Gateway integration

#### Vercel
- [ ] Setup
- [ ] Deployment
- [ ] Environment variables
- [ ] Edge functions

#### Netlify Functions
- [ ] Setup
- [ ] Deployment
- [ ] Background functions

#### Railway
- [ ] Setup
- [ ] Deployment
- [ ] Databases

### 8. OpenAPI (Swagger)

#### Introduction
- [ ] Setup
- [ ] Decorators
- [ ] Types and parameters
- [ ] Operations
- [ ] Security

#### Advanced
- [ ] Multiple specifications
- [ ] Tags
- [ ] Responses
- [ ] File upload
- [ ] Extensions

### 9. Recipes

#### CRUD Application
- [ ] Complete CRUD example
- [ ] Validation
- [ ] Error handling

#### REST API
- [ ] Best practices
- [ ] Versioning
- [ ] Pagination
- [ ] Filtering
- [ ] Sorting

#### GraphQL API
- [ ] Setup
- [ ] Resolvers
- [ ] Mutations
- [ ] Subscriptions

#### Microservices
- [ ] Message patterns
- [ ] Request-response
- [ ] Event-based
- [ ] gRPC

#### AI-Powered Application
- [ ] Chatbot with memory
- [ ] Content generator
- [ ] Semantic search engine
- [ ] Code assistant

### 10. CLI

#### Overview
- [ ] Installation
- [ ] Usage
- [ ] Workspaces
- [ ] Libraries

#### Generators
- [ ] Generate module
- [ ] Generate controller
- [ ] Generate service
- [ ] Generate guard
- [ ] Generate interceptor

### 11. FAQ

- [ ] Common questions
- [ ] Troubleshooting
- [ ] Migration from NestJS
- [ ] Performance tips

### 12. Migration

- [ ] From Express
- [ ] From NestJS
- [ ] From Fastify

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
