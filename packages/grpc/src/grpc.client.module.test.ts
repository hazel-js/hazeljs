import path from 'path';
import { GrpcClientModule } from './grpc.client.module';
import { GrpcClientService } from './grpc.client';

describe('GrpcClientModule', () => {
  const protoPath = path.join(__dirname, '__fixtures__', 'hero.proto');

  describe('forRoot', () => {
    it('should return module config with providers and exports', () => {
      const config = GrpcClientModule.forRoot({
        protoPath,
        package: 'hero',
        defaultUrl: 'localhost:50051',
      });

      expect(config.module).toBe(GrpcClientModule);
      expect(config.providers).toHaveLength(1);
      expect(config.providers[0].provide).toBe(GrpcClientService);
      expect(config.providers[0].useFactory).toBeDefined();
      expect(config.exports).toContain(GrpcClientService);
      expect(config.global).toBe(true);
    });

    it('should use isGlobal option', () => {
      const config = GrpcClientModule.forRoot({
        protoPath,
        package: 'hero',
        defaultUrl: 'localhost:50051',
        isGlobal: false,
      });
      expect(config.global).toBe(false);
    });

    it('should default isGlobal to true when not provided', () => {
      const config = GrpcClientModule.forRoot({
        protoPath,
        package: 'hero',
        defaultUrl: 'localhost:50051',
      });
      expect(config.global).toBe(true);
    });

    it('should create configured GrpcClientService via factory', () => {
      const config = GrpcClientModule.forRoot({
        protoPath,
        package: 'hero',
        defaultUrl: 'localhost:50051',
      });
      const factory = config.providers[0].useFactory as () => GrpcClientService;
      const client = factory();
      expect(client).toBeInstanceOf(GrpcClientService);
    });
  });

  describe('forRootAsync', () => {
    it('should return module config with async providers', () => {
      const config = GrpcClientModule.forRootAsync({
        useFactory: () => ({ protoPath, package: 'hero', defaultUrl: 'localhost:50051' }),
      });

      expect(config.module).toBe(GrpcClientModule);
      expect(config.providers).toHaveLength(2);
      expect(config.providers[0].provide).toBe('GRPC_CLIENT_OPTIONS');
      expect(config.providers[1].provide).toBe(GrpcClientService);
      expect(config.global).toBe(true);
    });

    it('should support inject option', () => {
      const config = GrpcClientModule.forRootAsync({
        useFactory: () => ({
          protoPath: 'test.proto',
          package: 'test',
          defaultUrl: 'localhost:50051',
        }),
        inject: ['ConfigService'],
      });
      expect(config.providers[0]).toHaveProperty('inject', ['ConfigService']);
    });

    it('should create GrpcClientService with async options', async () => {
      const config = GrpcClientModule.forRootAsync({
        useFactory: async () => ({ protoPath, package: 'hero', defaultUrl: 'localhost:50051' }),
      });

      const optionsFactory = config.providers[0].useFactory as () => Promise<{
        protoPath: string;
        package: string;
        defaultUrl: string;
      }>;
      const options = await optionsFactory();

      const clientFactory = config.providers[1].useFactory as (opts: {
        protoPath: string;
        package: string;
        defaultUrl: string;
      }) => GrpcClientService;
      const client = clientFactory(options);

      expect(client).toBeInstanceOf(GrpcClientService);
    });
  });
});
