/**
 * Typed GraphQL client for HazelJS
 * Execute queries and mutations with optional decorator-based API
 */

export interface GraphQLClientOptions {
  url: string;
  headers?: Record<string, string>;
}

/**
 * Simple GraphQL client - fetch-based for Node and browser
 */
export class GraphQLClient {
  constructor(private readonly options: GraphQLClientOptions) {}

  /**
   * Execute a GraphQL query
   */
  async query<T = unknown>(operation: string, variables?: Record<string, unknown>): Promise<T> {
    return this.request<T>(operation, variables, 'query');
  }

  /**
   * Execute a GraphQL mutation
   */
  async mutate<T = unknown>(operation: string, variables?: Record<string, unknown>): Promise<T> {
    return this.request<T>(operation, variables, 'mutation');
  }

  private async request<T>(
    operation: string,
    variables?: Record<string, unknown>,
    opType: 'query' | 'mutation' = 'query'
  ): Promise<T> {
    const body = JSON.stringify(
      opType === 'mutation' ? { query: operation, variables } : { query: operation, variables }
    );

    const res = await fetch(this.options.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.options.headers,
      },
      body,
    });

    if (!res.ok) {
      throw new Error(`GraphQL request failed: ${res.status} ${res.statusText}`);
    }

    const json = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
    if (json.errors?.length) {
      throw new Error(json.errors.map((e) => e.message).join('; '));
    }
    return json.data as T;
  }
}
