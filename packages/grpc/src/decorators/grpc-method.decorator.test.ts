import 'reflect-metadata';
import {
  GrpcMethod,
  getGrpcMethodMetadata,
  GRPC_METHOD_METADATA_KEY,
} from './grpc-method.decorator';

describe('GrpcMethod decorator', () => {
  it('should define GRPC_METHOD_METADATA_KEY', () => {
    expect(typeof GRPC_METHOD_METADATA_KEY).toBe('symbol');
  });

  it('should add metadata for service and method', () => {
    class TestController {
      @GrpcMethod('HeroService', 'FindOne')
      findOne(_data: { id: number }) {
        return { id: 1, name: 'Hero' };
      }
    }

    const metadata = getGrpcMethodMetadata(new TestController());
    expect(metadata).toHaveLength(1);
    expect(metadata[0].service).toBe('HeroService');
    expect(metadata[0].method).toBe('FindOne');
    expect(metadata[0].methodName).toBe('findOne');
  });

  it('should default method name to property key when not provided', () => {
    class TestController {
      @GrpcMethod('HeroService')
      findOne(_data: { id: number }) {
        return { id: 1, name: 'Hero' };
      }
    }

    const metadata = getGrpcMethodMetadata(new TestController());
    expect(metadata[0].method).toBe('findOne');
    expect(metadata[0].methodName).toBe('findOne');
  });

  it('should add metadata for multiple methods on same class', () => {
    class TestController {
      @GrpcMethod('HeroService', 'FindOne')
      findOne(_data: { id: number }) {
        return { id: 1, name: 'Hero' };
      }

      @GrpcMethod('HeroService', 'FindAll')
      findAll(_data: unknown) {
        return [];
      }
    }

    const metadata = getGrpcMethodMetadata(new TestController());
    expect(metadata).toHaveLength(2);
    expect(metadata[0].service).toBe('HeroService');
    expect(metadata[0].method).toBe('FindOne');
    expect(metadata[1].service).toBe('HeroService');
    expect(metadata[1].method).toBe('FindAll');
  });

  it('should support different services on same class', () => {
    class TestController {
      @GrpcMethod('HeroService', 'FindOne')
      findHero(_data: { id: number }) {
        return { id: 1, name: 'Hero' };
      }

      @GrpcMethod('UserService', 'GetUser')
      getUser(_data: { id: string }) {
        return { id: '1', name: 'User' };
      }
    }

    const metadata = getGrpcMethodMetadata(new TestController());
    expect(metadata).toHaveLength(2);
    expect(metadata[0].service).toBe('HeroService');
    expect(metadata[1].service).toBe('UserService');
  });
});

describe('getGrpcMethodMetadata', () => {
  it('should return empty array for class without @GrpcMethod decorators', () => {
    class PlainClass {}
    const metadata = getGrpcMethodMetadata(new PlainClass());
    expect(metadata).toEqual([]);
  });

  it('should return metadata from class constructor', () => {
    class TestController {
      @GrpcMethod('TestService', 'TestMethod')
      testMethod() {}
    }
    const instance = new TestController();
    const metadata = getGrpcMethodMetadata(instance);
    expect(metadata).toHaveLength(1);
    expect(metadata[0].service).toBe('TestService');
    expect(metadata[0].method).toBe('TestMethod');
  });
});
