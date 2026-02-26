import { FlinkService } from './flink.service';
import { ETLService } from './pipelines/etl.service';
import { StreamBuilder } from './streaming/stream.builder';
import { SchemaValidator } from './validators/schema.validator';
import { Stream, Transform } from './decorators';

@Stream({ name: 'test', source: 'kafka://in', sink: 'kafka://out', parallelism: 2 })
class TestPipeline {
  @Transform({ step: 1, name: 'a' })
  a(data: unknown) {
    return data;
  }
}

describe('FlinkService', () => {
  let service: FlinkService;

  beforeEach(() => {
    const etlService = new ETLService(new SchemaValidator());
    const streamBuilder = new StreamBuilder(etlService);
    service = new FlinkService(etlService, streamBuilder);
  });

  it('getClient throws when not configured', () => {
    expect(() => service.getClient()).toThrow('FlinkService not configured');
  });

  it('configure sets up client', () => {
    service.configure({ url: 'http://flink:8081' });
    const client = service.getClient();
    expect(client.url).toBe('http://flink:8081');
  });

  it('deployStream returns job config', async () => {
    service.configure({ url: 'http://localhost:8081' });
    const pipeline = new TestPipeline();
    const result = await service.deployStream(pipeline);

    expect(result.status).toBe('config_generated');
    expect(result.jobConfig).toBeDefined();
    expect(result.jobConfig.jobName).toBe('TestPipeline');
    expect(result.jobGraph).toBeDefined();
  });

  it('deployStream with config override', async () => {
    service.configure({ url: 'http://localhost:8081' });
    const result = await service.deployStream(new TestPipeline(), { parallelism: 16 });
    expect(result.jobConfig.parallelism).toBe(16);
  });
});
