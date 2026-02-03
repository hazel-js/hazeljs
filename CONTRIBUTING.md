# Contributing to HazelJS

First off, thank you for considering contributing to HazelJS! It's people like you that make HazelJS such a great tool.

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues to avoid duplicates. When you create a bug report, include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps to reproduce the problem**
- **Provide specific examples** (code snippets, error messages)
- **Describe the behavior you observed** and what you expected
- **Include your environment details** (Node.js version, OS, etc.)

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion:

- **Use a clear and descriptive title**
- **Provide a detailed description** of the suggested enhancement
- **Explain why this enhancement would be useful**
- **List any similar features** in other frameworks

### Pull Requests

1. **Fork the repository** and create your branch from `main`
2. **Follow the coding style** (run `npm run lint` and `npm run format`)
3. **Add tests** for any new functionality
4. **Ensure all tests pass** (`npm test`)
5. **Update documentation** if needed
6. **Write clear commit messages** following conventional commits

#### Commit Message Format

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Code style changes (formatting, missing semi-colons, etc.)
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Changes to build process or auxiliary tools

**Examples:**
```
feat(cache): add multi-tier caching support

Implements memory, Redis, and CDN caching strategies with automatic
invalidation and cache warming.

Closes #123
```

```
fix(di): resolve circular dependency detection issue

The DI container was not properly detecting circular dependencies
in certain edge cases involving request-scoped providers.

Fixes #456
```

## Development Setup

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Docker (for database testing)

### Setup Steps

1. **Clone your fork:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/hazeljs.git
   cd hazeljs
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the database:**
   ```bash
   npm run db:up
   ```

4. **Run migrations:**
   ```bash
   npm run prisma:migrate
   ```

5. **Run tests:**
   ```bash
   npm test
   ```

6. **Start development:**
   ```bash
   npm run dev
   ```

## Project Structure

```
hazeljs/
├── packages/
│   ├── core/          # Core framework (DI, routing, decorators)
│   ├── ai/            # AI integration (OpenAI, Anthropic, Gemini, Cohere)
│   ├── agent/         # AI agent runtime with tools and memory
│   ├── rag/           # Vector search and RAG capabilities
│   ├── cache/         # Multi-tier caching system
│   ├── websocket/     # WebSocket & SSE support
│   ├── serverless/    # Serverless adapters
│   ├── discovery/     # Service discovery for microservices
│   ├── prisma/        # Prisma ORM integration
│   ├── auth/          # JWT authentication
│   ├── config/        # Configuration management
│   ├── swagger/       # API documentation
│   ├── cron/          # Scheduled tasks
│   └── cli/           # CLI tool for scaffolding
├── example/           # Example applications
├── docs/              # Documentation
│   └── guides/        # Feature guides
└── .github/           # CI/CD workflows
```

## Coding Guidelines

### TypeScript

- **Use TypeScript** for all new code
- **Add explicit return types** to all functions
- **Avoid `any` types** - use proper typing or `unknown`
- **Use interfaces** for object shapes
- **Export public APIs** from index files

### Testing

- **Write tests** for all new features
- **Maintain 80%+ coverage** for new code
- **Use descriptive test names**
- **Follow AAA pattern** (Arrange, Act, Assert)

Example:
```typescript
describe('CacheService', () => {
  it('should cache values with TTL', async () => {
    // Arrange
    const cache = new CacheService();
    const key = 'test-key';
    const value = { data: 'test' };

    // Act
    await cache.set(key, value, { ttl: 3600 });
    const result = await cache.get(key);

    // Assert
    expect(result).toEqual(value);
  });
});
```

### Documentation

- **Add JSDoc comments** to public APIs
- **Include examples** in documentation
- **Update README.md** for major changes
- **Keep CHANGELOG.md** updated

Example:
```typescript
/**
 * Caches a value with the specified key and options.
 * 
 * @param key - The cache key
 * @param value - The value to cache
 * @param options - Cache options including TTL
 * @returns Promise that resolves when cached
 * 
 * @example
 * ```typescript
 * await cache.set('user:123', userData, { ttl: 3600 });
 * ```
 */
async set<T>(key: string, value: T, options?: CacheOptions): Promise<void>
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- cache.test.ts
```

## Linting and Formatting

```bash
# Run linter
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format
```

## Building

```bash
# Build the project
npm run build

# Build and watch for changes
npm run build:watch
```

## Documentation

- **API Reference**: See [IMPROVEMENTS.md](IMPROVEMENTS.md)
- **Quick Start**: See [QUICKSTART.md](QUICKSTART.md)
- **Roadmap**: See [ROADMAP.md](ROADMAP.md)

## Release Process

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Create a git tag
4. Push to GitHub
5. CI will automatically publish to npm

## Getting Help

- **GitHub Issues**: For bugs and feature requests
- **GitHub Discussions**: For questions and general discussion
- **Discord**: Join our community server (coming soon)

## Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes
- Project website (coming soon)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to HazelJS! 🎉
