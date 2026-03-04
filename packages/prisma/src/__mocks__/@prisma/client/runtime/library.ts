export class PrismaClientKnownRequestError extends Error {
  code: string;
  meta?: Record<string, unknown>;
  clientVersion: string;

  constructor(message: string, { code, meta }: { code: string; meta?: Record<string, unknown> }) {
    super(message);
    this.name = 'PrismaClientKnownRequestError';
    this.code = code;
    this.meta = meta;
    this.clientVersion = '5.0.0';
  }
}
