export class PrismaClient {
  $on = jest.fn();
  $connect = jest.fn().mockResolvedValue(undefined);
  $disconnect = jest.fn().mockResolvedValue(undefined);

  constructor(_options?: unknown) {}
}
