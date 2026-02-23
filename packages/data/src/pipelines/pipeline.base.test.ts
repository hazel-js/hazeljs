import { PipelineBase } from './pipeline.base';
import { ETLService } from './etl.service';
import { SchemaValidator } from '../validators/schema.validator';
import { Pipeline, Transform } from '../decorators';

@Pipeline('base-test')
class TestPipeline extends PipelineBase {
  @Transform({ step: 1, name: 'double' })
  double(data: unknown) {
    const x = (data as { x: number }).x;
    return { x: x * 2 };
  }
}

describe('PipelineBase', () => {
  it('execute runs pipeline via ETLService', async () => {
    const etlService = new ETLService(new SchemaValidator());
    const pipeline = new TestPipeline(etlService);
    const result = await pipeline.execute<{ x: number }>({ x: 5 });
    expect(result).toEqual({ x: 10 });
  });
});
