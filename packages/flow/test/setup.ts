/**
 * Vitest setup - ensures DATABASE_URL for integration tests
 * Run `pnpm flow:migrate` before tests to create schema
 */
beforeAll(() => {
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/hazeljs?schema=public';
  }
});
