import { Pipeline } from './pipeline.decorator';
import { Transform } from './transform.decorator';
import { Mask, Redact, getMaskMetadata, getRedactMetadata } from './pii.decorator';
import { ETLService } from '../pipelines/etl.service';
import { SchemaValidator } from '../validators/schema.validator';

@Pipeline('mask-pipeline')
class MaskPipeline {
  @Transform({ step: 1, name: 'mask' })
  @Mask({ fields: ['email', 'ssn'] })
  mask(data: unknown) {
    return data;
  }
}

@Pipeline('mask-showlast')
class MaskShowLastPipeline {
  @Transform({ step: 1, name: 'mask' })
  @Mask({ fields: ['phone'], replacement: '***', showLast: 4 })
  mask(data: unknown) {
    return data;
  }
}

@Pipeline('redact-pipeline')
class RedactPipeline {
  @Transform({ step: 1, name: 'redact' })
  @Redact({ fields: ['password', 'secret'] })
  redact(data: unknown) {
    return data;
  }
}

describe('@Mask decorator', () => {
  it('masks specified fields', async () => {
    const etl = new ETLService(new SchemaValidator());
    const pipeline = new MaskPipeline();
    const result = await etl.execute<Record<string, unknown>>(pipeline, {
      email: 'user@example.com',
      ssn: '123-45-6789',
      name: 'John',
    });
    expect(result.email).toBe('****');
    expect(result.ssn).toBe('****');
    expect(result.name).toBe('John');
  });

  it('showLast shows last N chars', async () => {
    const etl = new ETLService(new SchemaValidator());
    const pipeline = new MaskShowLastPipeline();
    const result = await etl.execute<Record<string, unknown>>(pipeline, {
      phone: '1234567890',
    });
    expect(result.phone).toBe('***7890');
  });

  it('getMaskMetadata returns options', () => {
    const meta = getMaskMetadata(MaskPipeline.prototype, 'mask');
    expect(meta?.fields).toContain('email');
    expect(meta?.fields).toContain('ssn');
  });
});

describe('@Redact decorator', () => {
  it('removes specified fields', async () => {
    const etl = new ETLService(new SchemaValidator());
    const pipeline = new RedactPipeline();
    const result = await etl.execute<Record<string, unknown>>(pipeline, {
      password: 'secret123',
      secret: 'key',
      name: 'John',
    });
    expect(result.password).toBeUndefined();
    expect(result.secret).toBeUndefined();
    expect(result.name).toBe('John');
  });

  it('getRedactMetadata returns options', () => {
    const meta = getRedactMetadata(RedactPipeline.prototype, 'redact');
    expect(meta?.fields).toContain('password');
  });

  it('Mask with array shorthand', async () => {
    @Pipeline('mask-array')
    class MaskArrayPipeline {
      @Transform({ step: 1, name: 'mask' })
      @Mask(['secret'])
      mask(data: unknown) {
        return data;
      }
    }
    const etl = new ETLService(new SchemaValidator());
    const result = await etl.execute<Record<string, unknown>>(new MaskArrayPipeline(), {
      secret: 'x',
      ok: 1,
    });
    expect(result.secret).toBe('****');
    expect(result.ok).toBe(1);
  });

  it('Mask leaves non-object unchanged', async () => {
    @Pipeline('mask-nonobj')
    class MaskNonObjPipeline {
      @Transform({ step: 1, name: 'mask' })
      @Mask(['x'])
      mask(data: unknown) {
        return data;
      }
    }
    const etl = new ETLService(new SchemaValidator());
    const result = await etl.execute<unknown>(new MaskNonObjPipeline(), 'string');
    expect(result).toBe('string');
  });
});
