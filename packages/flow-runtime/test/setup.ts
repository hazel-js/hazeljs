beforeAll(() => {
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/hazeljs?schema=public';
  }
});
