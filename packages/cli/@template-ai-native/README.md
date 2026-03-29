# HazelJS AI-Native Application

A complete AI-native backend application with HazelJS, featuring:

- 🤖 **AI Chat Service** - OpenAI-powered chat endpoints
- 🧠 **AI Agents** - Agents with tools and capabilities  
- 📚 **RAG System** - Document ingestion and semantic search
- 🏥 **Health Checks** - Application monitoring
- 📊 **Inspector** - Development tools and debugging
- 🐳 **Docker Support** - Containerized deployment
- 📮 **Postman Collection** - Ready-to-use API tests

## Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Add your OpenAI API key to .env
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Visit the application**
   - App: http://localhost:3000
   - Inspector: http://localhost:3000/__hazel
   - Health: http://localhost:3000/health

## Available Endpoints

### AI Chat
```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is HazelJS?"}'
```

### AI Agent (with tools)
```bash
curl -X POST http://localhost:3000/agent \
  -H "Content-Type: application/json" \
  -d '{"message": "What is the weather in Tokyo?"}'
```

### RAG Document Ingestion
```bash
curl -X POST http://localhost:3000/rag/ingest \
  -H "Content-Type: application/json" \
  -d '{"content": "HazelJS is a TypeScript framework for AI-native backends"}'
```

### RAG Search
```bash
curl -X POST http://localhost:3000/rag/search \
  -H "Content-Type: application/json" \
  -d '{"query": "What is HazelJS?"}'
```

## Docker Deployment

### Using Docker Compose (Recommended)

1. **Configure environment**
   ```bash
   cp .env.example .env
   # Add your OpenAI API key
   ```

2. **Start all services**
   ```bash
   docker-compose up -d
   ```

3. **View logs**
   ```bash
   docker-compose logs -f hazeljs-ai-app
   ```

4. **Stop services**
   ```bash
   docker-compose down
   ```

### Using Docker (Standalone)

1. **Build the image**
   ```bash
   docker build -t hazeljs-ai-app .
   ```

2. **Run the container**
   ```bash
   docker run -p 3000:3000 --env-file .env hazeljs-ai-app
   ```

### Docker Services

The `docker-compose.yml` includes:

- **hazeljs-ai-app** - Main application (port 3000)
- **redis** - Caching and queues (port 6379) 
- **postgres** - Database with pgvector extension (port 5432)

## API Testing with Postman

1. **Import the collection**
   ```bash
   # Import HazelJS-AI-Native.postman_collection.json into Postman
   ```

2. **Set environment variable**
   - Create a Postman environment
   - Set `baseUrl` to `http://localhost:3000`

3. **Test the endpoints**
   - Health & Status - Check application health
   - AI Chat - Test chat functionality
   - AI Agent - Test agent with weather tools
   - RAG - Test document ingestion and search

```
src/
├── app.module.ts          # Main application module
├── index.ts               # Application bootstrap
├── health.controller.ts   # Health check endpoints
├── ai/
│   └── chat.controller.ts # AI chat service
├── agent/
│   └── agent.controller.ts # AI agent with tools
└── rag/
    └── rag.controller.ts  # RAG service

prisma/
├── schema.prisma          # Database schema with vector embeddings
└── seed.ts               # Database seeding script

docker/
└── init-db.sql           # Database initialization (pgvector extension)

HazelJS-AI-Native.postman_collection.json  # API tests
Dockerfile                    # Container configuration
docker-compose.yml           # Multi-service deployment
```

## Database Setup with Prisma

This template uses Prisma for database management. Follow these steps to set up your database:

### 1. Configure Database URL

```bash
# Add to your .env file
DATABASE_URL="postgresql://hazeljs:hazeljs123@localhost:5432/hazeljs"
```

### 2. Initialize Database

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database (for development)
npm run db:push

# Seed with sample data
npm run db:seed
```

### 2.1 Vector Indexes

The template uses the `pgvector/pgvector` Docker image which includes the vector extension. Prisma automatically handles the vector indexes when you run `db:push`. The schema includes:

- **Vector embeddings** stored as `Float[]` for RAG search
- **Full-text search index** on the `content` field  
- **JSONB index** on the `metadata` field

No manual SQL required - Prisma handles everything!

### 3. Database Management

```bash
# View and edit data
npm run db:studio

# Reset database
npm run db:reset

# Generate client after schema changes
npm run db:generate
```

### Database Schema

The template includes:

- **Documents** - RAG document storage with vector embeddings
- **AgentConversations** - AI agent interaction history  
- **ChatHistory** - AI chat session logs

### Using Docker with Database

```bash
# Start PostgreSQL with Docker
docker-compose up postgres -d

# Run database setup
npm run db:push
npm run db:seed

# Start the application
npm run dev
```

## Environment Variables

- `OPENAI_API_KEY` - Your OpenAI API key (required)
- `PORT` - Server port (default: 3000)
- `LOG_LEVEL` - Logging level (default: info)
- `DATABASE_URL` - Database connection (optional, for PostgreSQL)
- `REDIS_HOST` - Redis host (default: localhost)
- `REDIS_PORT` - Redis port (default: 6379)

## Development

```bash
# Development mode with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format
```

## Production Deployment

### Environment Setup

1. **Set production variables**
   ```bash
   export NODE_ENV=production
   export OPENAI_API_KEY=your_production_key
   export DATABASE_URL=postgresql://user:pass@host:5432/db
   ```

2. **Deploy with Docker**
   ```bash
   docker-compose -f docker-compose.yml up -d
   ```

3. **Monitor health**
   ```bash
   curl http://localhost:3000/health
   ```

### Scaling

- **Horizontal scaling**: Deploy multiple instances behind a load balancer
- **Database scaling**: Use managed PostgreSQL with connection pooling
- **Caching**: Redis cluster for distributed caching
- **Monitoring**: Add Prometheus/Grafana for metrics

## Learn More

- [HazelJS Documentation](https://hazeljs.ai/docs)
- [HazelJS Playground](https://github.com/hazel-js/hazeljs-playground)
- [AI Agents Guide](https://hazeljs.ai/docs/agents)
- [RAG Guide](https://hazeljs.ai/docs/rag)
- [Docker Guide](https://hazeljs.ai/docs/docker)
