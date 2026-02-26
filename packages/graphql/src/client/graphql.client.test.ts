import { GraphQLClient } from './graphql.client';

describe('GraphQLClient', () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    global.fetch = mockFetch;
    mockFetch.mockReset();
  });

  it('should execute query', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { hello: 'world' } }),
    });

    const client = new GraphQLClient({ url: 'http://localhost/graphql' });
    const result = await client.query('{ hello }');

    expect(result).toEqual({ hello: 'world' });
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost/graphql',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ query: '{ hello }', variables: undefined }),
      })
    );
  });

  it('should execute query with variables', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { user: { id: '1' } } }),
    });

    const client = new GraphQLClient({ url: 'http://localhost/graphql' });
    await client.query('query($id: ID!) { user(id: $id) { id } }', { id: '1' });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          query: 'query($id: ID!) { user(id: $id) { id } }',
          variables: { id: '1' },
        }),
      })
    );
  });

  it('should execute mutation', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { createUser: { id: '1' } } }),
    });

    const client = new GraphQLClient({ url: 'http://localhost/graphql' });
    const result = await client.mutate('mutation { createUser(name: "x") { id } }');

    expect(result).toEqual({ createUser: { id: '1' } });
  });

  it('should pass custom headers', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: {} }),
    });

    const client = new GraphQLClient({
      url: 'http://localhost/graphql',
      headers: { Authorization: 'Bearer token' },
    });
    await client.query('{ x }');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer token',
        }),
      })
    );
  });

  it('should throw on HTTP error', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, statusText: 'Internal Error' });

    const client = new GraphQLClient({ url: 'http://localhost/graphql' });
    await expect(client.query('{ x }')).rejects.toThrow(
      'GraphQL request failed: 500 Internal Error'
    );
  });

  it('should throw on GraphQL errors', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        errors: [{ message: 'Invalid query' }, { message: 'Second error' }],
      }),
    });

    const client = new GraphQLClient({ url: 'http://localhost/graphql' });
    await expect(client.query('{ bad }')).rejects.toThrow('Invalid query; Second error');
  });
});
