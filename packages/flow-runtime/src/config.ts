/**
 * Runtime configuration from environment
 */

export function getConfig(): { databaseUrl: string; port: number } {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const port = parseInt(process.env.PORT ?? '3000', 10);

  return {
    databaseUrl,
    port,
  };
}
